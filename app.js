// Vida+ v6.0.1 — igual à 6.0.0 com correção do topo (sem datepicker; data do Supabase)
const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON);
const $ = (q)=>document.querySelector(q), $$=(q)=>document.querySelectorAll(q);
const months=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'], wd=['dom','seg','ter','qua','qui','sex','sáb'];
const monthsFull=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const wdFull=['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
const fmtDateStr = (d)=>{ const z=new Date(d), y=z.getFullYear(), m=('0'+(z.getMonth()+1)).slice(-2), dd=('0'+z.getDate()).slice(-2); return `${y}-${m}-${dd}`; };

// Formatador para label do topo (usa string YYYY-MM-DD; cria Date apenas para weekday, em meio-dia local)
function fmtDateLabel(ymd){
  if(typeof ymd!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return '—';
  const [y,m,d]=ymd.split('-').map(Number);
  const dt = new Date(y, m-1, d, 12, 0, 0, 0);
  return String(d).padStart(2,'0')+'/'+months[m-1]+' ('+wd[dt.getDay()]+')';
}

let USER=null, SESSION=null;
let CFG={ sleep:7, water:2500, goal:81, cup:250, start:null, end:null, coffeeLimit:3, alcoholLimit:1 };
let DAY=defaultDay();
let ALL_ROWS=[]; // cache para histórico/gráfico
let currentYmd = DAY.date; // manter YMD atual como string

function defaultDay(){
  return { date: fmtDateStr(new Date()), weight:null,
    sleep:{hours:null,quality:0},
    meals:{bfast:0,snack1:0,lunch:0,snack2:0,dinner:0},
    exercise:{treino:null,walk:0},
    mind:{read:false,book:false,meditate:false},
    water:0, drinks:{coffee:0,alcohol:0},
    score:0 };
}

// ===== Top =====
function renderTop(){
  $('#scoreTop').textContent = DAY.score||0;
  // Data no topo (esquerda)
  const dmEl = document.getElementById('dateDayMonth');
  const wdEl = document.getElementById('dateWeekday');
  if(dmEl && wdEl){
    if(typeof currentYmd==='string' && /^\d{4}-\d{2}-\d{2}$/.test(currentYmd)){
      const [y,m,d]=currentYmd.split('-').map(Number);
      const dt = new Date(y, m-1, d, 12, 0, 0, 0);
      dmEl.textContent = String(d).padStart(2,'0')+' '+monthsFull[m-1];
      wdEl.textContent = wdFull[dt.getDay()];
    } else {
      dmEl.textContent = '—'; wdEl.textContent='';
    }
  }
  // Streak abaixo do topo
  const streakVal = computeStreak(ALL_ROWS);
  const iconsEl = document.getElementById('streakIcons');
  const textEl  = document.getElementById('streakText');
  if(iconsEl && textEl){
    if(!streakVal){ iconsEl.textContent=''; textEl.textContent=''; }
    else if(streakVal<=6){ iconsEl.textContent = '🔥'.repeat(streakVal); textEl.textContent=''; }
    else { iconsEl.textContent='🔥'; textEl.textContent=' x '+streakVal; }
  } else {
    const barWrap = document.querySelector('.streakBar .wrap');
    if(barWrap){
      let html='';
      if(streakVal>0){ html = (streakVal<=6) ? '🔥'.repeat(streakVal) : ('🔥 x '+streakVal); }
      barWrap.innerHTML = html;
    }
  }
}

// ===== Meals UI =====
function renderMeals(){
  const wrap=$('#meals'); wrap.innerHTML='';
  const MEAL_KEYS=[['Café da manhã','bfast'],['Lanche manhã','snack1'],['Almoço','lunch'],['Lanche tarde','snack2'],['Jantar','dinner']];
  for(const [label,key] of MEAL_KEYS){
    const row=document.createElement('div'); row.className='meal';
    const name=document.createElement('div'); name.textContent=label; name.style.cursor='pointer';
    const stars=document.createElement('div'); stars.className='stars';
    for(let i=1;i<=3;i++){ const s=document.createElement('span'); s.className='star'; s.textContent='★'; s.addEventListener('click',async()=>{ DAY.meals[key]=i; await saveDay(); update(); }); stars.appendChild(s); }
    name.addEventListener('click', async()=>{ DAY.meals[key]=0; await saveDay(); update(); });
    row.appendChild(name); row.appendChild(stars); wrap.appendChild(row);
  }
}
function setStars(container, val){ container.querySelectorAll('.star').forEach((e,i)=>e.classList.toggle('on', i<val)); }

// ===== Score =====
function scoreAll(){
  let sSono=0; { const m=Number(CFG.sleep||7), h=Number(DAY.sleep.hours||0), q=Number(DAY.sleep.quality||0);
    sSono=Math.round(25*(0.7*Math.min(h/m,1)+0.3*(q/3)));
    // Força texto simples para compat iOS/Android, sem depender de espaçamentos especiais
    const el = $('#scoreSono');
    if(el){ el.textContent = String(sSono) + ' / 25'; }
  }
  let sFood=0; Object.values(DAY.meals).forEach(v=>sFood+=v); sFood=Math.round((sFood/15)*45); $('#scoreFood').textContent=sFood+'/45';
  let sEx=Math.round(15*(0.6*Math.min((DAY.exercise.walk||0)/40,1)+0.4*(DAY.exercise.treino?1:0))); $('#scoreEx').textContent=sEx+'/15';
  let sWat=Math.round(10*Math.min((DAY.water||0)/CFG.water,1)); $('#scoreWater').textContent=sWat+'/10';
  let sMind=(DAY.mind.read||DAY.mind.book||DAY.mind.meditate)?5:0; $('#scoreMind').textContent=sMind+'/5';
  DAY.score = sSono+sFood+sEx+sWat+sMind;
}

// ===== Paint =====
function paint(){
  // topo
  renderTop();
// peso
(function(){
  // Meta
  const goalVal = (CFG.goal!=null && CFG.goal!=='') ? Number(CFG.goal) : null;
  const metaEl  = $('#pesoMeta');
  if(goalVal==null){
    metaEl.textContent = 'Meta: —';
  }else{
    let faltaTxt = '';
    if (DAY.weight!=null){
      const falta = (goalVal - Number(DAY.weight));
      const abs   = Math.abs(falta).toFixed(1);
      // só informativo, sempre cinza discreto (estilo hint)
      faltaTxt = ` (${abs} kg para chegar)`;
    }
    metaEl.textContent = `Meta: ${goalVal} kg${faltaTxt}`;
  }

  // Ontem = última medição anterior no histórico
  let ontemVal = null;
  // ALL_ROWS está do mais novo -> mais antigo
  for (let i=0;i<ALL_ROWS.length;i++){
    const r = ALL_ROWS[i];
    if (r.date === DAY.date){
      const next = ALL_ROWS[i+1];
      if(next && next.data && next.data.weight!=null) ontemVal = Number(next.data.weight);
      break;
    }
  }
  if(ontemVal==null){
    const y = localStorage.getItem('lastWeight');
    if(y!=null) ontemVal = Number(y);
  }

  const yEl = $('#pesoYesterday');
  if(ontemVal==null){
    yEl.textContent = 'Ontem: —';
  }else if(DAY.weight==null){
    yEl.textContent = `Ontem: ${ontemVal.toFixed(1)} kg`;
  }else{
    const diff = Number(DAY.weight) - Number(ontemVal);
    let cls = 'warn';
    if (diff < 0) cls = 'good';
    else if (diff > 0) cls = 'bad';
    // Ontem com variação colorida (verde ↓, vermelho ↑, amarelo =)
    yEl.innerHTML = `Ontem: ${ontemVal.toFixed(1)} kg <span class="${cls}">(${diff>0?'+':''}${diff.toFixed(1)} kg)</span>`;
  }
})();

  // sono
  setStars($('#sleepStars'), DAY.sleep.quality||0);
  // Sono: meta a partir de CFG.sleep
  (function(){
    const sleepMetaEl = document.getElementById('sleepMetaHint');
    if(sleepMetaEl){
      const sleepTarget = Number(CFG.sleep);
      if(Number.isFinite(sleepTarget) && sleepTarget>0){
        sleepMetaEl.textContent = 'Meta: ' + sleepTarget + ' h';
      } else {
        sleepMetaEl.textContent = 'Meta: —';
      }
    }
  })();
  // refeições
  const keys=['bfast','snack1','lunch','snack2','dinner'];
  $$('#meals .meal').forEach((row,idx)=> setStars(row.querySelector('.stars'), DAY.meals[keys[idx]]||0));
  // hidratação
  const pct=Math.min(100,Math.round(((DAY.water||0)/(CFG.water||2500))*100)); $('#waterPct').textContent=pct+'%'; $('#waterBar').style.width=pct+'%'; $('#waterTotal').textContent=(DAY.water||0)+' / '+CFG.water+' ml';
  // bebidas
  const iconRepeat = (icon, n)=>{ if(n<=0) return ''; if(n<=8) return icon.repeat(n); return icon+' x'+n; };
  $('#coffeeIcons').textContent = iconRepeat('☕', DAY.drinks.coffee||0);
  $('#alcoholIcons').textContent = iconRepeat('🍷', DAY.drinks.alcohol||0);
  // treino visual + ontem ref
  $$('button[data-treino]').forEach(b=>b.classList.toggle('active', DAY.exercise.treino===b.dataset.treino));
  $('#treinoOntem').textContent = getYesterdayTreino();
}

// ===== Eventos =====
function attachEvents(){
  // Sono
  $('#sleepHours').addEventListener('change', async e=>{ DAY.sleep.hours=parseFloat(e.target.value)||0; await saveDay(); update(); });
  $('#sleepStars').querySelectorAll('.star').forEach((s,idx)=> s.addEventListener('click', async()=>{ DAY.sleep.quality=idx+1; await saveDay(); update(); }));
  // Exercício
  $$('button[data-treino]').forEach(b=> b.addEventListener('click', async()=>{ DAY.exercise.treino=b.dataset.treino; await saveDay(); update(); }));
  $('#walkMin').addEventListener('change', async e=>{ DAY.exercise.walk=parseInt(e.target.value||'0',10); await saveDay(); update(); });
  // Mente
  $$('.mind').forEach(b=> b.addEventListener('click', async()=>{ const k=b.dataset.mind; DAY.mind[k]=!DAY.mind[k]; await saveDay(); update(); }));
  // Hidratação
  $('#btnWaterPlus').addEventListener('click', async()=>{ DAY.water=(DAY.water||0)+Number(CFG.cup||250); await saveDay(); update(); });
  $('#btnWaterPlus300').addEventListener('click', async()=>{ DAY.water=(DAY.water||0)+300; await saveDay(); update(); });
  $('#btnWaterMinus').addEventListener('click', async()=>{ DAY.water=Math.max(0,(DAY.water||0)-Number(CFG.cup||250)); await saveDay(); update(); });
  // Bebidas
  $('#coffeePlus').addEventListener('click', async()=>{ DAY.drinks.coffee++; await saveDay(); update(); });
  $('#coffeeMinus').addEventListener('click', async()=>{ DAY.drinks.coffee=Math.max(0,DAY.drinks.coffee-1); await saveDay(); update(); });
  $('#alcoholPlus').addEventListener('click', async()=>{ DAY.drinks.alcohol++; await saveDay(); update(); });
  $('#alcoholMinus').addEventListener('click', async()=>{ DAY.drinks.alcohol=Math.max(0,DAY.drinks.alcohol-1); await saveDay(); update(); });
  // Config
  $('#btnSaveCfg').addEventListener('click', async()=>{ readCfgFromUI(); await saveDay(); update(); alert('Config salva.'); });
  $('#btnExport').addEventListener('click', async()=>{ const rows=await getRowsForPeriod(); downloadCSV(rows); });
  $('#btnWipe').addEventListener('click', async()=>{ if(!confirm('Apagar TODOS os dados deste usuário (local e servidor)?')) return;
    try{ if(USER){ await supabase.from('days').delete().eq('user_id',USER.id); } localStorage.clear(); alert('Dados apagados.'); location.reload(); } catch(e){ alert('Erro ao apagar: '+(e.message||e)); }
  });
  $('#btnSignOut').addEventListener('click', async()=>{ await supabase.auth.signOut(); location.reload(); });
}

// === Autosave do PESO (debounce + blur + Enter) ===
(function(){
  const input  = document.getElementById('pesoHoje');
  const status = document.getElementById('pesoSaveStatus');
  if(!input) return;

  let lastSaved = DAY.weight;   // evita salvar se não mudou
  let t;

  function setStatus(mode){
    if(!status) return;
    status.classList.remove('saving','saved');
    if(mode==='saving'){ status.textContent=''; status.classList.add('saving'); status.style.opacity='0.75'; }
    if(mode==='saved'){  status.textContent='';   status.classList.add('saved');  status.style.opacity='0.75'; setTimeout(()=>status.style.opacity='0', 900); }
  }

  async function doSave(val){
    const num = parseFloat(String(val).replace(',','.'));
    if(Number.isNaN(num)) return;                     // ignora inválido
    if(lastSaved!=null && Number(lastSaved)===num) return; // não mudou
    DAY.weight = num;
    localStorage.setItem('lastWeight', String(num));  // fallback p/ ontem
    setStatus('saving');
    await saveDay();
    lastSaved = num;
    update();                                        // repinta tudo
    setStatus('saved');
  }

  function debounced(){ clearTimeout(t); t = setTimeout(()=>doSave(input.value), 600); }

  input.addEventListener('input',   debounced);
  input.addEventListener('blur',    ()=> doSave(input.value));
  input.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); doSave(input.value); } });
})();



// ===== Config =====
function readCfgFromUI(){
  CFG.sleep=parseFloat($('#cfgSleep').value)||7;
  CFG.water=parseInt($('#cfgWater').value||'2500',10);
  CFG.goal=parseFloat($('#cfgGoal').value)||81;
  CFG.cup=parseInt($('#cfgCup').value||'250',10);
  CFG.start=$('#cfgStart').value||null;
  CFG.end=$('#cfgEnd').value||null;
  CFG.coffeeLimit=parseInt($('#cfgCoffee').value||'3',10);
  CFG.alcoholLimit=parseInt($('#cfgAlcohol').value||'1',10);
}

// ===== Supabase =====
async function saveDay(){
  if(!USER) return;
  // DAY.date deve ser SEMPRE string 'YYYY-MM-DD' (não mexer)
  const payload={ user_id: USER.id, date: DAY.date, data: DAY };
  const { error } = await supabase.from('days').upsert(payload, { onConflict: 'user_id,date' });
  if(error) console.error('save error', error);
  // refresh lightweight: update ALL_ROWS in memory for this date
  const idx = ALL_ROWS.findIndex(r=>r.date===DAY.date);
  if(idx>=0) ALL_ROWS[idx]={ date: DAY.date, data: JSON.parse(JSON.stringify(DAY)) };
  else ALL_ROWS.unshift({ date: DAY.date, data: JSON.parse(JSON.stringify(DAY)) });
}

async function ensureDayLoaded(){
  if(!USER) return;
  // busca EXATAMENTE essa chave (string)
  const { data } = await supabase.from('days').select('date,data').eq('user_id',USER.id).eq('date',currentYmd).maybeSingle();
  if(data?.data){ DAY = data.data; DAY.date = data.date; }
  else { DAY = { ...defaultDay(), date: currentYmd }; }
  // preencher inputs
  $('#pesoHoje').value = (DAY.weight!=null)?DAY.weight:'';
  $('#sleepHours').value = (DAY.sleep.hours!=null)?DAY.sleep.hours:'';
  $('#walkMin').value = (DAY.exercise.walk||0);
  renderTop(); // reflete a data exata carregada
}

async function loadAllDays(){
  if(!USER) return [];
  const { data, error } = await supabase.from('days').select('date,data').eq('user_id',USER.id).order('date',{ascending:false});
  if(error){ console.error(error); return []; }
  return data||[];
}

async function getRowsForPeriod(){
  let rows = ALL_ROWS.slice(); // já está desc
  if(CFG.start){ rows = rows.filter(r=> r.date >= CFG.start ); }
  if(CFG.end){ rows = rows.filter(r=> r.date <= CFG.end ); }
  return rows;
}

// ===== History & Streak =====
function computeStreak(rowsDesc){
  // Conta dias consecutivos com redução de peso (hoje vs dia anterior), começando do mais novo
  const rows = rowsDesc.slice().sort((a,b)=> b.date.localeCompare(a.date));
  let streak=0;
  for(let i=0;i<rows.length-1;i++){
    const w0 = rows[i].data?.weight;
    const w1 = rows[i+1].data?.weight;
    if(w0==null || w1==null){ break; }
    if(Number(w0) < Number(w1)) streak++; else break;
  }
  return streak;
}

function iconCountSpan(icon, n, limit){
  if(!n) return '';
  let cls='warn'; // dentro do limite
  if(n===0) cls='good'; else if(limit!=null && n>limit) cls='bad';
  const txt = n>1 ? ` x${n}` : '';
  return `<span class="${cls}">${icon}${txt}</span>`;
}

function renderHistory(rowsDesc){
  const list=$('#histList'); list.innerHTML='';
  const rows = rowsDesc; // já desc, mais novo primeiro
  // Médias
  const validScores = rows.map(r=>r.data?.score).filter(v=>typeof v==='number');
  const validWeights= rows.map(r=>r.data?.weight).filter(v=>typeof v==='number');
  const avgS = validScores.length? Math.round(validScores.reduce((a,b)=>a+b,0)/validScores.length) : '—';
  const avgW = validWeights.length? (validWeights.reduce((a,b)=>a+b,0)/validWeights.length).toFixed(1)+' kg' : '—';
  $('#avgScore').textContent = avgS;
  $('#avgWeight').textContent = avgW;

  for(const r of rows){
    const d=r.data||{};
    const score=d.score||0;
    let cls=''; if(score<60) cls='bad'; else if(score<80) cls='warn';
    const weight=(d.weight!=null)?(d.weight+' kg'):'—';
    const coffee=(d.drinks?.coffee||0), alcohol=(d.drinks?.alcohol||0);
    const iconsHTML = [
      iconCountSpan(' ☕', coffee, CFG.coffeeLimit),
      iconCountSpan(' 🍷', alcohol, CFG.alcoholLimit),
      (d.water||0) >= (CFG.water||2500) ? `<span> 💧</span>` : '',
      (d.exercise?.treino || (d.exercise?.walk||0)>0) ? `<span> 🏃</span>` : ''
    ].filter(Boolean).join(' ');
    const row=document.createElement('div'); row.className='histRow';
    row.innerHTML = `<div>${r.date.slice(8,10)}/${months[Number(r.date.slice(5,7))-1]}</div>
                     <div class="${cls}">${score}<span style="margin-left:8px">${iconsHTML}</span></div>
                     <div class="right">${weight}</div>`;
    list.appendChild(row);
  }
}

// ===== Chart =====
function renderChart(rowsDesc){
  const cvs=$('#chart'), ctx=cvs.getContext('2d'); ctx.clearRect(0,0,cvs.width,cvs.height);
  if(!rowsDesc.length) return;
  const rows = rowsDesc.slice().reverse(); // antigo -> novo para eixo
  const scores=rows.map(r=>r.data?.score||0);
  const weights=rows.map(r=>r.data?.weight);
  const n=rows.length, w=cvs.width, h=cvs.height, pad=30, maxS=100, bw=(w-2*pad)/n-6;

  // barras de nota
  ctx.fillStyle='rgba(100,150,255,0.25)';
  scores.forEach((s,i)=>{ const x=pad+i*((w-2*pad)/n)+3, bh=(s/maxS)*(h-2*pad); ctx.fillRect(x,h-pad-bh,bw,bh); });

  // linha de peso
  const vals=weights.filter(v=>v!=null);
  if(vals.length>=2){
    const minW=Math.min(...vals), maxW=Math.max(...vals);
    ctx.strokeStyle='#9be9a8'; ctx.lineWidth=2; ctx.beginPath();
    let started=false
    for (let i=0;i<weights.length;i++){
      const v=weights[i]; if(v==null) continue;
      const x=pad+i*((w-2*pad)/n)+bw/2, y=h-pad-((v-minW)/(maxW-minW+1e-6))*(h-2*pad);
      if(!started){ ctx.moveTo(x,y); started=true; } else { ctx.lineTo(x,y); }
    }
    ctx.stroke();
  }

  // linha projetada (meta linear)
  if(CFG.start && CFG.end && CFG.goal!=null){
    const inRange = rows.filter(r=> r.date>=CFG.start && r.date<=CFG.end && r.data?.weight!=null );
    const startRow = inRange.length? inRange[0] : (rows.find(r=>r.date>=CFG.start) || null);
    if(startRow && startRow.data?.weight!=null){
      const startIdx = rows.indexOf(startRow);
      const startW = startRow.data.weight;
      let endIdx = -1; for(let i=rows.length-1;i>=0;i--){ if(rows[i].date<=CFG.end){ endIdx=i; break; } }
      if(endIdx>=0){
        const steps = endIdx-startIdx;
        if(steps>0){
          const allVals = weights.filter(v=>v!=null).concat([CFG.goal, startW]);
          const minW=Math.min(...allVals), maxW=Math.max(...allVals);
ctx.save(); ctx.setLineDash([5,4]); ctx.strokeStyle='#cccccc'; ctx.lineWidth=1.5; ctx.beginPath();
for(let i=0;i<=steps;i++){
  const wTarget = startW + (CFG.goal-startW)*(i/steps);
  const x=pad+(startIdx+i)*((w-2*pad)/n)+bw/2;
  const y=h-pad-((wTarget-minW)/(maxW-minW+1e-6))*(h-2*pad);
  if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
}
ctx.stroke(); ctx.restore();
        }
      }
    }
  }
}

// ===== Boot =====
async function bootstrap(){
  const { data:{ session } } = await supabase.auth.getSession(); SESSION=session; USER=session?.user||null;
  // garante que scoreSono inicial não herde cache visual antigo
  const el = document.getElementById('scoreSono'); if(el && typeof el.textContent==='string' && /[()]/.test(el.textContent)) el.textContent = '0 / 25';
  supabase.auth.onAuthStateChange((_e,s)=>{ SESSION=s; USER=s?.user||null; gate(); });
  renderMeals(); attachEvents(); update(); gate();
}

async function gate(){
  if(USER){
    $('#loginOverlay').style.display='none'; $('#app').style.display='grid'; $('#loginStatus').textContent='logado como '+(USER.email||'');
    ALL_ROWS = await loadAllDays();
    // ymd atual: mais novo salvo ou hoje
    currentYmd = (ALL_ROWS[0]?.date) || fmtDateStr(new Date());
    await ensureDayLoaded(); // usa currentYmd
    update();
    const periodRows = await getRowsForPeriod();
    renderHistory(periodRows);
    renderChart(periodRows);
    renderTop();
  } else {
    $('#loginOverlay').style.display='flex'; $('#app').style.display='none'; $('#loginStatus').textContent='offline';
  }
}

function update(){ scoreAll(); paint(); }

// ===== Login buttons =====
document.addEventListener('DOMContentLoaded', ()=>{
  $('#btnSignIn').addEventListener('click', async()=>{
    const email=$('#loginEmail').value.trim(), password=$('#loginPass').value; $('#loginMsg').textContent='...';
    try{ const { error } = await supabase.auth.signInWithPassword({ email, password }); if(error) throw error; $('#loginMsg').textContent='ok'; }
    catch(e){ $('#loginMsg').textContent='Erro: '+(e.message||e); }
  });
  $('#btnSignUp').addEventListener('click', async()=>{
    const email=$('#loginEmail').value.trim(), password=$('#loginPass').value; $('#loginMsg').textContent='...';
    try{ const { error } = await supabase.auth.signUp({ email, password }); if(error) throw error; $('#loginMsg').textContent='Conta criada. Faça login.'; }
    catch(e){ $('#loginMsg').textContent='Erro: '+(e.message||e); }
  });
  $('#btnReset').addEventListener('click', async()=>{
    const email=$('#loginEmail').value.trim(); $('#loginMsg').textContent='...';
    try{ const url=location.origin+location.pathname; const { error } = await supabase.auth.resetPasswordForEmail(email,{redirectTo:url}); if(error) throw error; $('#loginMsg').textContent='Email enviado.'; }
    catch(e){ $('#loginMsg').textContent='Erro: '+(e.message||e); }
  });
  bootstrap();
});
