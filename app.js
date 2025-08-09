/* Vida+ app.js — v4.7.2 (hotfix Supabase OTP redirect + healthcheck)
   - Tabela Supabase: public.days (user_id uuid, date text, data jsonb, updated_at timestamptz)
   - Chave composta (user_id,date)
   - Política RLS: o usuário só vê/escreve os próprios registros
*/

/* ====================== UTIL ====================== */
const pad = (n) => String(n).padStart(2, '0');
const toKey = (d = new Date()) => {
  const y = d.getFullYear(), m = d.getMonth()+1, day = d.getDate();
  return `${y}-${pad(m)}-${pad(day)}`;
};
const fromKey = (k) => {
  const [y,m,d] = k.split('-').map(Number);
  return new Date(y, m-1, d);
};
const fmtDateTop = (d) => {
  const dias = ['dom','seg','ter','qua','qui','sex','sáb'];
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  return `${pad(d.getDate())}/${meses[d.getMonth()]} (${dias[d.getDay()]})`;
};
const shallowClone = (o) => JSON.parse(JSON.stringify(o||{}));

/* ====================== ESTADO ====================== */
const state = {
  version: '4.7.2',
  currentKey: toKey(),
  cache: {},          // { 'yyyy-mm-dd': { ...dados do dia... } }
  config: {           // configurações do usuário (persistido local)
    metaSleepH: 7,
    metaWaterML: 2500,
    cupML: 250,
    startCampaign: toKey(), // ponto de partida p/ histórico/sync
    weightTarget: 81,
    walkGoalMin: 30,
    coffeeLimit: 3,
    alcoholLimit: 1
  },
  auth: {
    supabase: null,
    user: null,
    status: 'offline' // 'checando' | 'online' | 'offline'
  }
};

// pesos (conforme combinamos)
const WEIGHTS = {
  sleep: 30,
  food: 45,
  exercise: 15,
  water: 10,
  mind: 5
};

// estrutura de um dia
const emptyDay = () => ({
  weight: null,          // kg (number)
  sleep: { hours: null, quality: 0 }, // quality: 0..3
  food: { // 0..3 por refeição
    breakfast: 0, snack1: 0, lunch: 0, snack2: 0, dinner: 0
  },
  exercise: { walkMin: 0, workout: '' }, // workout: 'A'|'B'|'C'|''
  mind: { read: false, book: false, meditate: false },
  water: { ml: 0 },
  drinks: { coffee: 0, alcohol: 0 }, // não afetam nota
  note: ''                           // reservado p/ futuro
});

/* ====================== STORAGE LOCAL ====================== */
const LS_KEY = 'vida_plus_days_v1';
const LS_CFG = 'vida_plus_cfg_v1';

const loadLocal = () => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    state.cache = raw ? JSON.parse(raw) : {};
  } catch(_) { state.cache = {}; }
  try {
    const rawC = localStorage.getItem(LS_CFG);
    if (rawC) Object.assign(state.config, JSON.parse(rawC));
  } catch(_) {}
};
const saveLocal = () => {
  localStorage.setItem(LS_KEY, JSON.stringify(state.cache));
  localStorage.setItem(LS_CFG, JSON.stringify(state.config));
};

/* ====================== SUPABASE ====================== */
const $ = (id) => document.getElementById(id);

const AUTH = {
  init: async () => {
    const msg = $('authMsg'), btn = $('authSend');
    msg.textContent = 'checando…';
    btn.disabled = true;
    // healthcheck
    try {
      const ok = await fetch(window.SUPABASE_URL + '/health', {mode:'cors'}).then(r=>r.ok);
      state.auth.status = ok ? 'online' : 'offline';
      msg.textContent = ok ? 'online' : 'offline';
      btn.disabled = !ok;
    } catch(e){
      state.auth.status = 'offline';
      msg.textContent = 'offline';
      btn.disabled = true;
    }

    // cliente
    try{
      state.auth.supabase = window.supabase.createClient(
        window.SUPABASE_URL, window.SUPABASE_ANON_KEY
      );
      // detectar sessão
      const { data: { session } } = await state.auth.supabase.auth.getSession();
      if (session?.user) {
        state.auth.user = session.user;
        AUTH._onLoginUI();
      } else {
        AUTH._onLogoutUI();
      }

      // escuta mudança de sessão
      state.auth.supabase.auth.onAuthStateChange((_event, sess)=>{
        if (sess?.user){
          state.auth.user = sess.user;
          AUTH._onLoginUI();
          // após logar, tentar puxar campanha
          SYNC.pullCampaign().then(()=>{
            renderAll();
          });
        } else {
          state.auth.user = null;
          AUTH._onLogoutUI();
        }
      });

      // botão enviar
      $('authSend').onclick = async () => {
        const email = $('authEmail').value.trim();
        if (!email) { msg.textContent = 'informe seu e-mail'; return; }
        if (state.auth.status !== 'online') { msg.textContent = 'offline'; return; }
        $('authSend').disabled = true;
        msg.textContent = 'enviando…';
        const redirectTo = location.origin + location.pathname; // ex: https://user.github.io/app/
        const { error } = await state.auth.supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: redirectTo, shouldCreateUser: true }
        });
        if (error) {
          msg.textContent = 'erro: ' + error.message;
        } else {
          msg.textContent = 'link enviado! confira o e-mail';
        }
        $('authSend').disabled = false;
      };

      // sair
      $('authSignOut').onclick = async () => {
        await state.auth.supabase.auth.signOut();
      };

    }catch(e){
      msg.textContent = 'erro supabase';
    }
  },
  _onLoginUI(){
    $('authMsg').textContent = 'logado';
    $('authSignOut').style.display = '';
  },
  _onLogoutUI(){
    $('authMsg').textContent = state.auth.status === 'online' ? 'online' : 'offline';
    $('authSignOut').style.display = 'none';
  }
};

const SYNC = {
  // baixa todos os dias desde a data inicial da campanha
  pullCampaign: async () => {
    if (!state.auth.user || !state.auth.supabase) return;
    const from = state.config.startCampaign || toKey();
    const { data, error } = await state.auth.supabase
      .from('days')
      .select('date,data,updated_at')
      .eq('user_id', state.auth.user.id)
      .gte('date', from)
      .order('date', { ascending: true });

    if (error) { console.warn('pull error', error); return; }

    data.forEach(row => {
      const local = state.cache[row.date];
      // usa o mais novo (server vs local)
      if (!local || (row.updated_at && (!local.updated_at || new Date(row.updated_at) > new Date(local.updated_at)))) {
        state.cache[row.date] = {...row.data, updated_at: row.updated_at};
      }
    });
    saveLocal();
  },
  upsertToday: async (key) => {
    if (!state.auth.user || !state.auth.supabase) return;
    const day = shallowClone(state.cache[key] || emptyDay());
    const payload = { user_id: state.auth.user.id, date: key, data: day };
    const { error } = await state.auth.supabase.from('days').upsert(payload).select();
    if (error) console.warn('upsert error', error);
  }
};

/* ====================== CÁLCULOS ====================== */
function scoreForDay(d){
  d = d || emptyDay();
  let total = 0;

  // SONO (30): horas vs meta, + qualidade 0..3 -> até 30
  const h = Number(d.sleep.hours||0);
  const q = Number(d.sleep.quality||0); // 0..3
  const hMeta = Number(state.config.metaSleepH||7);
  let sleepPts = 0;
  if (hMeta > 0){
    const hRatio = Math.min(h / hMeta, 1); // 0..1
    // 70% por horas, 30% por qualidade
    sleepPts = Math.round(WEIGHTS.sleep * (0.7*hRatio + 0.3*(q/3)));
  }
  total += sleepPts;

  // ALIMENTAÇÃO (45): 5 refeições, cada 0..3 => 15 máx → escala para 45
  const f = d.food||{};
  const sumMeals = (f.breakfast||0)+(f.snack1||0)+(f.lunch||0)+(f.snack2||0)+(f.dinner||0); // 0..15
  const foodPts = Math.round((sumMeals/15)*WEIGHTS.food);
  total += foodPts;

  // EXERCÍCIO (15): 60% caminhada (atingir goal), 40% treino A/B/C
  const walk = Number((d.exercise||{}).walkMin||0);
  const walkGoal = Number(state.config.walkGoalMin||30);
  const walkRatio = walkGoal>0 ? Math.min(walk/walkGoal,1) : 0;
  const workoutDone = ((d.exercise||{}).workout||'') ? 1 : 0;
  const exPts = Math.round(WEIGHTS.exercise*(0.6*walkRatio + 0.4*workoutDone));
  total += exPts;

  // HIDRATAÇÃO (10): ml vs meta
  const ml = Number((d.water||{}).ml||0);
  const metaML = Number(state.config.metaWaterML||2500);
  const waterPts = metaML>0 ? Math.round(WEIGHTS.water*Math.min(ml/metaML,1)) : 0;
  total += waterPts;

  // MENTE (5): qualquer um dos 3 marca (ler/livro/meditar)
  const m = d.mind||{};
  const mindDone = (m.read||m.book||m.meditate) ? 1 : 0;
  const mindPts = mindDone ? WEIGHTS.mind : 0;
  total += mindPts;

  return { total, breakdown: { sleep: sleepPts, food: foodPts, exercise: exPts, water: waterPts, mind: mindPts } };
}

function computeStreak(key){
  // dias consecutivos (descendo no tempo) com redução de peso vs dia anterior
  const keys = Object.keys(state.cache).sort(); // asc
  const idx = keys.indexOf(key);
  if (idx < 0) return 0;
  let streak = 0;
  for (let i=idx; i>0; i--){
    const a = state.cache[keys[i]];
    const b = state.cache[keys[i-1]];
    if (!a?.weight || !b?.weight) break;
    if (a.weight < b.weight) streak++;
    else break;
  }
  return streak;
}

/* ====================== RENDER ====================== */
function setTop(){
  const d = fromKey(state.currentKey);
  $('dateTop').textContent = fmtDateTop(d);
  const day = state.cache[state.currentKey] || emptyDay();
  const s = scoreForDay(day).total;
  $('scoreTop').textContent = s;
  $('streakNum').textContent = computeStreak(state.currentKey);
  // também sincroniza o value do date picker
  const dp = $('datePicker');
  if (dp) dp.value = state.currentKey;
}

function renderAll(){
  // garante que o dia atual existe em cache (sem sobrescrever hidratação!)
  if (!state.cache[state.currentKey]) state.cache[state.currentKey] = emptyDay();
  setTop();

  const day = state.cache[state.currentKey];
  const main = document.querySelector('main');
  main.innerHTML = '';

  // ==== PESO ====
  const secPeso = document.createElement('section');
  secPeso.innerHTML = `
    <h2>⚖️ Peso</h2>
    <div class="row">
      <input id="inpWeight" type="number" step="0.01" placeholder="ex: 88.2" value="${day.weight??''}" style="max-width:160px" />
      <div class="chip" id="btnSaveWeight">OK</div>
      <span class="small muted">kg</span>
    </div>
    <div class="small" id="pesoInfo"></div>
  `;
  main.appendChild(secPeso);
  const pesoInfo = () => {
    const prevKey = (()=>{const d=fromKey(state.currentKey); d.setDate(d.getDate()-1); return toKey(d);})();
    const ontem = state.cache[prevKey]?.weight;
    const w = Number(state.cache[state.currentKey]?.weight||0);
    const tgt = Number(state.config.weightTarget||0);
    let delta = (ontem && w) ? (w - ontem) : null; // positivo: +, negativo: -
    let falta = (w && tgt) ? (w - tgt) : null;
    const fmt = (x) => (x===null||isNaN(x)) ? '—' : `${x.toFixed(1)} kg`;
    let deltaStr = (delta===null) ? '—' : `${delta>0?'+':''}${delta.toFixed(1)} kg`;
    let faltaStr = (falta===null) ? '—' : `${(falta>0?'+':'')}${falta.toFixed(1)} kg para chegar`;
    $('#pesoInfo', secPeso)?.remove;
    secPeso.querySelector('#pesoInfo').innerHTML =
      `Ontem: ${fmt(ontem)} ${delta!==null ? (delta<0 ? '<span class="ok">(↓ '+deltaStr+')</span>' : '<span class="bad">(↑ '+deltaStr+')</span>') : ''}<br>` +
      `Meta: ${fmt(tgt)} ${falta!==null ? '('+faltaStr+')' : ''}`;
  };
  pesoInfo();

  secPeso.querySelector('#btnSaveWeight').onclick = () => {
    const val = parseFloat(secPeso.querySelector('#inpWeight').value);
    state.cache[state.currentKey].weight = isNaN(val) ? null : val;
    saveLocal();
    pesoInfo();
    setTop();
    SYNC.upsertToday(state.currentKey);
  };

  // ==== SONO ====
  const sDay = scoreForDay(day);
  const secSleep = document.createElement('section');
  secSleep.innerHTML = `
    <h2>😴 Sono <span class="secPts">${sDay.breakdown.sleep} / ${WEIGHTS.sleep}</span></h2>
    <div class="grid g2">
      <div class="col">
        <span class="small muted">Horas dormidas</span>
        <input id="sleepHours" type="number" inputmode="decimal" placeholder="ex: 6.5" value="${day.sleep.hours??''}">
        <span class="small muted">Meta: ${state.config.metaSleepH} h ${Number(day.sleep.hours||0) >= state.config.metaSleepH ? '✓ <span class="ok">ok</span>' : '<span class="warn">↓ abaixo</span>'}</span>
      </div>
      <div class="col">
        <span class="small muted">Qualidade</span>
        <div class="stars" id="sleepStars">
          ${[1,2,3].map(i=>`<div class="star ${i<=day.sleep.quality?'active':''}" data-v="${i}"><span>★</span></div>`).join('')}
        </div>
      </div>
    </div>
  `;
  main.appendChild(secSleep);
  secSleep.querySelector('#sleepHours').onchange = (e)=>{
    const v = parseFloat(e.target.value);
    state.cache[state.currentKey].sleep.hours = isNaN(v)?null:v;
    saveLocal(); setTop(); renderAll();
    SYNC.upsertToday(state.currentKey);
  };
  secSleep.querySelectorAll('#sleepStars .star').forEach(el=>{
    el.onclick = ()=>{
      const v = Number(el.dataset.v);
      state.cache[state.currentKey].sleep.quality = v;
      saveLocal(); setTop(); renderAll();
      SYNC.upsertToday(state.currentKey);
    };
  });

  // ==== ALIMENTAÇÃO ====
  const meals = [
    ['Café da manhã','breakfast'],
    ['Lanche manhã','snack1'],
    ['Almoço','lunch'],
    ['Lanche tarde','snack2'],
    ['Jantar','dinner']
  ];
  const secFood = document.createElement('section');
  secFood.innerHTML = `
    <h2>🍽️ Alimentação <span class="secPts">${sDay.breakdown.food} / ${WEIGHTS.food}</span></h2>
    <div class="col" id="foodList"></div>
    <footer class="note">Toque no nome para limpar.</footer>
  `;
  main.appendChild(secFood);
  const foodList = secFood.querySelector('#foodList');
  meals.forEach(([label,key])=>{
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `
      <div class="smallish" style="min-width:140px;cursor:pointer">${label}</div>
      <div class="stars">
        ${[1,2,3].map(i=>`<div class="star ${i<= (day.food[key]||0) ? 'active':''}" data-k="${key}" data-v="${i}"><span>★</span></div>`).join('')}
      </div>
    `;
    row.querySelector('.smallish').onclick = ()=>{
      state.cache[state.currentKey].food[key] = 0;
      saveLocal(); setTop(); renderAll(); SYNC.upsertToday(state.currentKey);
    };
    row.querySelectorAll('.star').forEach(st=>{
      st.onclick = ()=>{
        const v = Number(st.dataset.v), k = st.dataset.k;
        state.cache[state.currentKey].food[k] = v;
        saveLocal(); setTop(); renderAll(); SYNC.upsertToday(state.currentKey);
      };
    });
    foodList.appendChild(row);
  });

  // ==== EXERCÍCIO ====
  const secEx = document.createElement('section');
  secEx.innerHTML = `
    <h2>🏃 Exercício <span class="secPts">${sDay.breakdown.exercise} / ${WEIGHTS.exercise}</span></h2>
    <div class="row">
      ${['A','B','C'].map(n=>`<div class="chip" data-w="${n}" aria-pressed="${day.exercise.workout===n}">Treino ${n}</div>`).join('')}
    </div>
    <div class="col" style="margin-top:8px">
      <span class="small muted">Caminhada (min)</span>
      <input id="walkMin" type="number" placeholder="ex: 30" value="${day.exercise.walkMin||''}" />
    </div>
  `;
  main.appendChild(secEx);
  secEx.querySelectorAll('[data-w]').forEach(btn=>{
    btn.onclick = ()=>{
      const n = btn.dataset.w;
      state.cache[state.currentKey].exercise.workout = (day.exercise.workout===n) ? '' : n;
      saveLocal(); setTop(); renderAll(); SYNC.upsertToday(state.currentKey);
    };
  });
  secEx.querySelector('#walkMin').onchange = (e)=>{
    const v = parseInt(e.target.value||'0',10);
    state.cache[state.currentKey].exercise.walkMin = isNaN(v)?0:v;
    saveLocal(); setTop(); renderAll(); SYNC.upsertToday(state.currentKey);
  };

  // ==== MENTE ====
  const secMind = document.createElement('section');
  secMind.innerHTML = `
    <h2>🧠 Mente <span class="secPts">${sDay.breakdown.mind} / ${WEIGHTS.mind}</span></h2>
    <div class="row">
      <div class="chip" data-m="read" aria-pressed="${day.mind.read}">📖 Leitura</div>
      <div class="chip" data-m="book" aria-pressed="${day.mind.book}">✍️ Livro</div>
      <div class="chip" data-m="meditate" aria-pressed="${day.mind.meditate}">🧘 Meditar</div>
    </div>
  `;
  main.appendChild(secMind);
  secMind.querySelectorAll('[data-m]').forEach(b=>{
    b.onclick = ()=>{
      const k = b.dataset.m;
      // não tocar na hidratação aqui! (bug antigo corrigido)
      state.cache[state.currentKey].mind[k] = !state.cache[state.currentKey].mind[k];
      saveLocal(); setTop(); renderAll(); SYNC.upsertToday(state.currentKey);
    };
  });

  // ==== HIDRATAÇÃO ====
  const waterPct = Math.min(100, Math.round( (day.water.ml||0) / state.config.metaWaterML * 100 ));
  const secWater = document.createElement('section');
  secWater.innerHTML = `
    <h2>💧 Hidratação <span class="secPts">${sDay.breakdown.water} / ${WEIGHTS.water}</span></h2>
    <div class="row">
      <div class="chip" id="btnAddWater">+ ${state.config.cupML} ml</div>
      <div class="chip" id="btnSubWater">−1 copo</div>
      <div class="right smallish muted">${waterPct}%</div>
    </div>
    <div class="row" style="margin-top:6px">
      <progress max="${state.config.metaWaterML}" value="${day.water.ml||0}"></progress>
      <div class="right numRight smallish muted">${day.water.ml||0} / ${state.config.metaWaterML} ml</div>
    </div>
  `;
  main.appendChild(secWater);
  secWater.querySelector('#btnAddWater').onclick = ()=>{
    state.cache[state.currentKey].water.ml = (state.cache[state.currentKey].water.ml||0) + state.config.cupML;
    saveLocal(); setTop(); renderAll(); SYNC.upsertToday(state.currentKey);
  };
  secWater.querySelector('#btnSubWater').onclick = ()=>{
    state.cache[state.currentKey].water.ml = Math.max(0, (state.cache[state.currentKey].water.ml||0) - state.config.cupML);
    saveLocal(); setTop(); renderAll(); SYNC.upsertToday(state.currentKey);
  };

  // ==== BEBIDAS (não afeta nota) ====
  const secBev = document.createElement('section');
  const coffee = day.drinks.coffee||0, alcohol = day.drinks.alcohol||0;
  const coffeeClass = coffee===0?'ok': (coffee<=state.config.coffeeLimit?'warn':'bad');
  const alcoholClass = alcohol===0?'ok': (alcohol<=state.config.alcoholLimit?'warn':'bad');
  secBev.innerHTML = `
    <h2>🥤 Bebidas</h2>
    <div class="bevGrid">
      <div>☕ Café</div>
      <div class="chip" id="cPlus">+1</div>
      <div class="chip" id="cMinus">−1</div>
      <div class="small muted">—</div>
      <div class="numRight ${coffeeClass}">${coffee}</div>
    </div>
    <div class="bevGrid">
      <div>🍷 Álcool</div>
      <div class="chip" id="aPlus">+1</div>
      <div class="chip" id="aMinus">−1</div>
      <div class="small muted">—</div>
      <div class="numRight ${alcoholClass}">${alcohol}</div>
    </div>
    <footer class="note">Não afetam a nota. Limites em configurações.</footer>
  `;
  main.appendChild(secBev);
  secBev.querySelector('#cPlus').onclick = ()=>{
    state.cache[state.currentKey].drinks.coffee = (state.cache[state.currentKey].drinks.coffee||0)+1;
    saveLocal(); renderAll(); SYNC.upsertToday(state.currentKey);
  };
  secBev.querySelector('#cMinus').onclick = ()=>{
    state.cache[state.currentKey].drinks.coffee = Math.max(0,(state.cache[state.currentKey].drinks.coffee||0)-1);
    saveLocal(); renderAll(); SYNC.upsertToday(state.currentKey);
  };
  secBev.querySelector('#aPlus').onclick = ()=>{
    state.cache[state.currentKey].drinks.alcohol = (state.cache[state.currentKey].drinks.alcohol||0)+1;
    saveLocal(); renderAll(); SYNC.upsertToday(state.currentKey);
  };
  secBev.querySelector('#aMinus').onclick = ()=>{
    state.cache[state.currentKey].drinks.alcohol = Math.max(0,(state.cache[state.currentKey].drinks.alcohol||0)-1);
    saveLocal(); renderAll(); SYNC.upsertToday(state.currentKey);
  };

  // ==== HISTÓRICO (compacto, 1 linha) ====
  const secHist = document.createElement('section');
  const keys = Object.keys(state.cache).sort().reverse(); // mais novo primeiro
  // médias
  let sumScore=0, nScore=0, sumWeight=0, nWeight=0;
  keys.forEach(k=>{
    const s = scoreForDay(state.cache[k]).total;
    if (s>0){ sumScore+=s; nScore++; }
    const w = state.cache[k].weight;
    if (typeof w==='number'){ sumWeight+=w; nWeight++; }
  });
  const avgScore = nScore? Math.round(sumScore/nScore): '—';
  const avgWeight = nWeight? (sumWeight/nWeight).toFixed(1)+' kg' : '—';
  secHist.innerHTML = `
    <h2>📚 Histórico</h2>
    <div class="histHead small muted">
      <div><span class="histColLabel">Data</span><br><span class="histAvg">média</span></div>
      <div><span class="histColLabel">Nota</span><br><span class="histAvg">${avgScore}</span></div>
      <div><span class="histColLabel">Ícones</span></div>
      <div class="numRight"><span class="histColLabel">Peso</span><br><span class="histAvg">${avgWeight}</span></div>
    </div>
    <div id="histList" class="col"></div>
  `;
  main.appendChild(secHist);
  const histList = secHist.querySelector('#histList');
  keys.forEach(k=>{
    const d = fromKey(k);
    const line = document.createElement('div');
    const sc = scoreForDay(state.cache[k]).total;
    // ícones: mente (se marcou), café/álcool com asterisco se passou limite
    const icons = [];
    const m = state.cache[k].mind||{};
    if (m.read||m.book||m.meditate) icons.push('🧠');
    const cof = state.cache[k].drinks?.coffee||0;
    if (cof>0) icons.push('☕' + (cof>state.config.coffeeLimit ? '﹡' : ''));
    const alc = state.cache[k].drinks?.alcohol||0;
    if (alc>0) icons.push('🍷' + (alc>state.config.alcoholLimit ? '﹡' : ''));
    const w = state.cache[k].weight;

    line.className = 'histRow';
    line.innerHTML = `
      <div class="smallish">${pad(d.getDate())}/${['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][d.getMonth()]}</div>
      <div class="smallish">${sc||'—'}</div>
      <div class="histIcons smallish">${icons.join(' ')||'—'}</div>
      <div class="numRight smallish">${(typeof w==='number')? (w.toFixed(1)+ ' kg') : '—'}</div>
    `;
    line.onclick = ()=>{ state.currentKey = k; renderAll(); };
    histList.appendChild(line);
  });
}

/* ====================== CABEÇALHO E DATA PICKER ====================== */
function initHeader(){
  // preencher topo
  setTop();
  const dateTop = $('dateTop');
  const dp = $('datePicker');
  if (dateTop && dp){
    dateTop.onclick = ()=>{
      dp.value = state.currentKey;
      dp.style.display = (dp.style.display==='block' ? 'none' : 'block');
      if (dp.showPicker) dp.showPicker();
    };
    dp.onchange = ()=>{
      if (dp.value){
        state.currentKey = dp.value;
        renderAll();
      }
      dp.style.display='none';
    };
  }
}

/* ====================== BOOT ====================== */
(function boot(){
  loadLocal();
  initHeader();
  AUTH.init(); // inicia supabase + healthcheck
  renderAll();

  // registra SW (PWA)
  if ('serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw.js');
  }

  // quando voltar ao foco da aba: puxa campanha e recalcula
  window.addEventListener('focus', async ()=>{
    if (state.auth.user) { await SYNC.pullCampaign(); }
    renderAll();
  });
})();
