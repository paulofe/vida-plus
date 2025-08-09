/* Vida+ v4.8.2 — completo (Supabase, Configurações, topo fixo, histórico) */
const pad=(n)=>String(n).padStart(2,'0');
const months=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const days=['dom','seg','ter','qua','qui','sex','sáb'];
const toKey=(d=new Date())=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const fromKey=(k)=>{const [y,m,d]=k.split('-').map(Number); return new Date(y,m-1,d);};
const fmtTop=(d)=>`${pad(d.getDate())}/${months[d.getMonth()]} (${days[d.getDay()]})`;
const $=(id)=>document.getElementById(id);

const WEIGHTS={ sleep:30, food:45, exercise:15, water:10, mind:5 };
const LS='vida_plus_days_v1', LSCFG='vida_plus_cfg_v1';

const state={ currentKey: toKey(), cache:{}, config: { metaSleepH:7, metaWaterML:2500, cupML:250, startCampaign: toKey(), weightTarget:81, walkGoalMin:30, coffeeLimit:3, alcoholLimit:1 } };

function loadLocal(){ try{Object.assign(state.config, JSON.parse(localStorage.getItem(LSCFG)||'{}'))}catch{} try{state.cache=JSON.parse(localStorage.getItem(LS)||'{}')}catch{} }
function saveLocal(){ localStorage.setItem(LS, JSON.stringify(state.cache)); localStorage.setItem(LSCFG, JSON.stringify(state.config)); }

function emptyDay(){ return { weight:null, sleep:{hours:null,quality:0}, food:{breakfast:0,snack1:0,lunch:0,snack2:0,dinner:0}, exercise:{walkMin:0,workout:''}, mind:{read:false,book:false,meditate:false}, water:{ml:0}, drinks:{coffee:0,alcohol:0} }; }

function scoreForDay(d){
  d=d||emptyDay(); let total=0;
  const h=Number(d.sleep.hours||0), q=Number(d.sleep.quality||0), hm=Number(state.config.metaSleepH||7);
  let s=0; if(hm>0){ const r=Math.min(h/hm,1); s=Math.round(WEIGHTS.sleep*(0.7*r+0.3*(q/3)));} total+=s;
  const f=d.food||{}; const meals=(f.breakfast||0)+(f.snack1||0)+(f.lunch||0)+(f.snack2||0)+(f.dinner||0);
  const foodPts=Math.round((meals/15)*WEIGHTS.food); total+=foodPts;
  const walk=Number(d.exercise.walkMin||0), goal=Number(state.config.walkGoalMin||30);
  const exPts=Math.round(WEIGHTS.exercise*(0.6*Math.min(walk/goal,1)+0.4*((d.exercise.workout||'')?1:0))); total+=exPts;
  const ml=Number(d.water.ml||0), meta=Number(state.config.metaWaterML||2500);
  const waterPts=meta>0?Math.round(WEIGHTS.water*Math.min(ml/meta,1)):0; total+=waterPts;
  const mind=(d.mind.read||d.mind.book||d.mind.meditate)?WEIGHTS.mind:0; total+=mind;
  return { total, breakdown:{sleep:s,food:foodPts,exercise:exPts,water:waterPts,mind:mind} };
}

function computeStreak(key){
  const keys=Object.keys(state.cache).sort(); const idx=keys.indexOf(key); if(idx<0)return 0;
  let s=0; for(let i=idx;i>0;i--){ const a=state.cache[keys[i]], b=state.cache[keys[i-1]]; if(!a?.weight||!b?.weight) break; if(a.weight<b.weight)s++; else break; } return s;
}

function setTop(){
  const d=fromKey(state.currentKey); const sc=scoreForDay(state.cache[state.currentKey]||emptyDay()).total;
  $('dateTop').textContent=fmtTop(d); $('scoreTop').textContent=sc; $('streakNum').textContent=computeStreak(state.currentKey); const dp=$('datePicker'); if(dp) dp.value=state.currentKey;
}

function renderAll(){
  if(!state.cache[state.currentKey]) state.cache[state.currentKey]=emptyDay();
  setTop();
  const day=state.cache[state.currentKey]; const main=document.querySelector('main'); main.innerHTML='';

  // PESO
  const secPeso=document.createElement('section');
  secPeso.innerHTML=`<h2>⚖️ Peso</h2>
    <div class="row"><input id="inpWeight" type="number" step="0.01" placeholder="ex: 88.2" value="${day.weight??''}" style="max-width:160px" />
    <div class="chip" id="btnSaveWeight">OK</div><span class="small muted">kg</span></div>
    <div class="small" id="pesoInfo"></div>`;
  main.appendChild(secPeso);
  const pesoInfo=()=>{ const d=new Date(fromKey(state.currentKey)); d.setDate(d.getDate()-1); const pk=toKey(d);
    const ontem=state.cache[pk]?.weight; const w=Number(day.weight||0); const tgt=Number(state.config.weightTarget||0);
    const delta=(ontem&&w)?(w-ontem):null; const falta=(w&&tgt)?(w-tgt):null; const fmt=(x)=>(x===null||isNaN(x))?'—':x.toFixed(1)+' kg';
    secPeso.querySelector('#pesoInfo').innerHTML=`Ontem: ${fmt(ontem)} ${delta!==null?(delta<0?'<span class="ok">(↓ '+delta.toFixed(1)+' kg)</span>':'<span class="bad">(↑ +'+delta.toFixed(1)+' kg)</span>'):''}<br>`+
      `Meta: ${fmt(tgt)} ${falta!==null?'('+(falta>0?'+':'')+falta.toFixed(1)+' kg para chegar)':''}`; }; pesoInfo();
  secPeso.querySelector('#btnSaveWeight').onclick=()=>{ const v=parseFloat(secPeso.querySelector('#inpWeight').value); day.weight=isNaN(v)?null:v; saveLocal(); pesoInfo(); setTop(); SYNC.upsertDay(state.currentKey); };

  // SONO
  const sDay=scoreForDay(day);
  const secSleep=document.createElement('section');
  secSleep.innerHTML=`<h2>😴 Sono <span class="secPts">${sDay.breakdown.sleep} / ${WEIGHTS.sleep}</span></h2>
  <div class="grid g2"><div class="col"><span class="small muted">Horas dormidas</span>
  <input id="sleepHours" type="number" inputmode="decimal" placeholder="ex: 6.5" value="${day.sleep.hours??''}">
  <span class="small muted">Meta: ${state.config.metaSleepH} h ${(Number(day.sleep.hours||0)>=state.config.metaSleepH)?'✓ <span class="ok">ok</span>':'<span class="warn">↓ abaixo</span>'}</span></div>
  <div class="col"><span class="small muted">Qualidade</span><div class="stars" id="sleepStars">
  ${[1,2,3].map(i=>`<div class="star ${i<=day.sleep.quality?'active':''}" data-v="${i}"><span>★</span></div>`).join('')}</div></div></div>`;
  main.appendChild(secSleep);
  secSleep.querySelector('#sleepHours').onchange=(e)=>{ const v=parseFloat(e.target.value); day.sleep.hours=isNaN(v)?null:v; saveLocal(); setTop(); renderAll(); SYNC.upsertDay(state.currentKey); };
  secSleep.querySelectorAll('#sleepStars .star').forEach(el=>{ el.onclick=()=>{ day.sleep.quality=Number(el.dataset.v); saveLocal(); setTop(); renderAll(); SYNC.upsertDay(state.currentKey); }; });

  // ALIMENTAÇÃO
  const secFood=document.createElement('section'); const meals=[['Café da manhã','breakfast'],['Lanche manhã','snack1'],['Almoço','lunch'],['Lanche tarde','snack2'],['Jantar','dinner']];
  secFood.innerHTML=`<h2>🍽️ Alimentação <span class="secPts">${sDay.breakdown.food} / ${WEIGHTS.food}</span></h2><div class="col" id="foodList"></div><footer class="note">Toque no nome para limpar.</footer>`;
  main.appendChild(secFood);
  const foodList=secFood.querySelector('#foodList');
  meals.forEach(([label,key])=>{ const row=document.createElement('div'); row.className='row';
    row.innerHTML=`<div class="smallish" style="min-width:140px;cursor:pointer">${label}</div><div class="stars">
    ${[1,2,3].map(i=>`<div class="star ${i<=(day.food[key]||0)?'active':''}" data-k="${key}" data-v="${i}"><span>★</span></div>`).join('')}</div>`;
    row.querySelector('.smallish').onclick=()=>{ day.food[key]=0; saveLocal(); setTop(); renderAll(); SYNC.upsertDay(state.currentKey); };
    row.querySelectorAll('.star').forEach(st=>{ st.onclick=()=>{ day.food[key]=Number(st.dataset.v); saveLocal(); setTop(); renderAll(); SYNC.upsertDay(state.currentKey); }; });
    foodList.appendChild(row);
  });

  // EXERCÍCIO
  const secEx=document.createElement('section');
  secEx.innerHTML=`<h2>🏃 Exercício <span class="secPts">${sDay.breakdown.exercise} / ${WEIGHTS.exercise}</span></h2>
  <div class="row">${['A','B','C'].map(n=>`<div class="chip" data-w="${n}" aria-pressed="${day.exercise.workout===n}">Treino ${n}</div>`).join('')}</div>
  <div class="col" style="margin-top:8px"><span class="small muted">Caminhada (min)</span><input id="walkMin" type="number" placeholder="ex: 30" value="${day.exercise.walkMin||''}" /></div>`;
  main.appendChild(secEx);
  secEx.querySelectorAll('[data-w]').forEach(b=>{ b.onclick=()=>{ const n=b.dataset.w; day.exercise.workout=(day.exercise.workout===n)?'':n; saveLocal(); setTop(); renderAll(); SYNC.upsertDay(state.currentKey); }; });
  secEx.querySelector('#walkMin').onchange=(e)=>{ const v=parseInt(e.target.value||'0',10); day.exercise.walkMin=isNaN(v)?0:v; saveLocal(); setTop(); renderAll(); SYNC.upsertDay(state.currentKey); };

  // MENTE
  const secMind=document.createElement('section');
  secMind.innerHTML=`<h2>🧠 Mente <span class="secPts">${sDay.breakdown.mind} / ${WEIGHTS.mind}</span></h2>
  <div class="row"><div class="chip" data-m="read" aria-pressed="${day.mind.read}">📖 Leitura</div><div class="chip" data-m="book" aria-pressed="${day.mind.book}">✍️ Livro</div><div class="chip" data-m="meditate" aria-pressed="${day.mind.meditate}">🧘 Meditar</div></div>`;
  main.appendChild(secMind);
  secMind.querySelectorAll('[data-m]').forEach(b=>{ b.onclick=()=>{ const k=b.dataset.m; day.mind[k]=!day.mind[k]; saveLocal(); setTop(); renderAll(); SYNC.upsertDay(state.currentKey); }; });

  // HIDRATAÇÃO (−1 à esquerda)
  const secWater=document.createElement('section'); const pct=Math.min(100, Math.round((day.water.ml||0)/state.config.metaWaterML*100));
  secWater.innerHTML=`<h2>💧 Hidratação <span class="secPts">${sDay.breakdown.water} / ${WEIGHTS.water}</span></h2>
  <div class="row"><div class="chip" id="btnSubWater">−1 copo</div><div class="chip" id="btnAddWater">+ ${state.config.cupML} ml</div><div class="right smallish muted">${pct}%</div></div>
  <div class="row" style="margin-top:6px"><progress max="${state.config.metaWaterML}" value="${day.water.ml||0}"></progress><div class="right numRight smallish muted">${day.water.ml||0} / ${state.config.metaWaterML} ml</div></div>`;
  main.appendChild(secWater);
  secWater.querySelector('#btnAddWater').onclick=()=>{ day.water.ml=(day.water.ml||0)+state.config.cupML; saveLocal(); setTop(); renderAll(); SYNC.upsertDay(state.currentKey); };
  secWater.querySelector('#btnSubWater').onclick=()=>{ day.water.ml=Math.max(0,(day.water.ml||0)-state.config.cupML); saveLocal(); setTop(); renderAll(); SYNC.upsertDay(state.currentKey); };

  // BEBIDAS (−1 alinhado)
  const secBev=document.createElement('section'); const cof=day.drinks.coffee||0, alc=day.drinks.alcohol||0;
  const cofCl=cof===0?'ok':(cof<=state.config.coffeeLimit?'warn':'bad'); const alcCl=alc===0?'ok':(alc<=state.config.alcoholLimit?'warn':'bad');
  secBev.innerHTML=`<h2>🥤 Bebidas</h2>
  <div class="bevGrid"><div>☕ Café</div><div class="chip" id="cPlus">+1</div><div class="chip" id="cMinus">−1</div><div class="small muted">—</div><div class="numRight ${cofCl}">${cof}</div></div>
  <div class="bevGrid"><div>🍷 Álcool</div><div class="chip" id="aPlus">+1</div><div class="chip" id="aMinus">−1</div><div class="small muted">—</div><div class="numRight ${alcCl}">${alc}</div></div>
  <footer class="note">Não afetam a nota. Limites em configurações.</footer>`;
  main.appendChild(secBev);
  secBev.querySelector('#cPlus').onclick=()=>{ day.drinks.coffee=(day.drinks.coffee||0)+1; saveLocal(); renderAll(); SYNC.upsertDay(state.currentKey); };
  secBev.querySelector('#cMinus').onclick=()=>{ day.drinks.coffee=Math.max(0,(day.drinks.coffee||0)-1); saveLocal(); renderAll(); SYNC.upsertDay(state.currentKey); };
  secBev.querySelector('#aPlus').onclick=()=>{ day.drinks.alcohol=(day.drinks.alcohol||0)+1; saveLocal(); renderAll(); SYNC.upsertDay(state.currentKey); };
  secBev.querySelector('#aMinus').onclick=()=>{ day.drinks.alcohol=Math.max(0,(day.drinks.alcohol||0)-1); saveLocal(); renderAll(); SYNC.upsertDay(state.currentKey); };

  // HISTÓRICO (ordem: mais novo primeiro)
  const secHist=document.createElement('section'); const keys=Object.keys(state.cache).sort().reverse();
  let sSum=0,sN=0,wSum=0,wN=0; keys.forEach(k=>{ const s=scoreForDay(state.cache[k]).total; if(s>0){sSum+=s;sN++;} const w=state.cache[k].weight; if(typeof w==='number'){wSum+=w;wN++;} });
  const avgS=sN?Math.round(sSum/sN):'—', avgW=wN?(wSum/wN).toFixed(1)+' kg':'—';
  secHist.innerHTML=`<h2>📚 Histórico</h2>
  <div class="histHead small muted"><div><span class="histColLabel">Data</span><br><span class="histAvg">média</span></div>
  <div><span class="histColLabel">Nota</span><br><span class="histAvg">${avgS}</span></div><div><span class="histColLabel">Ícones</span></div>
  <div class="numRight"><span class="histColLabel">Peso</span><br><span class="histAvg">${avgW}</span></div></div><div id="histList" class="col"></div>`;
  main.appendChild(secHist);
  const list=secHist.querySelector('#histList');
  keys.forEach(k=>{ const d=fromKey(k), sc=scoreForDay(state.cache[k]).total, it=state.cache[k];
    const icons=[]; const m=it.mind||{}; if(m.read||m.book||m.meditate) icons.push('🧠');
    const cf=it.drinks?.coffee||0; if(cf>0) icons.push('☕'+(cf>state.config.coffeeLimit?'﹡':''));
    const al=it.drinks?.alcohol||0; if(al>0) icons.push('🍷'+(al>state.config.alcoholLimit?'﹡':''));
    const w=typeof it.weight==='number'? it.weight.toFixed(1)+' kg':'—';
    const row=document.createElement('div'); row.className='histRow';
    row.innerHTML=`<div class="smallish">${pad(d.getDate())}/${months[d.getMonth()]}</div><div class="smallish">${sc||'—'}</div>
    <div class="histIcons smallish">${icons.join(' ')||'—'}</div><div class="numRight smallish">${w}</div>`;
    row.onclick=()=>{ state.currentKey=k; renderAll(); }; list.appendChild(row);
  });

  // CONFIGURAÇÕES
  $('cfgSleep').value=state.config.metaSleepH; $('cfgWater').value=state.config.metaWaterML; $('cfgCup').value=state.config.cupML;
  $('cfgTarget').value=state.config.weightTarget; $('cfgWalk').value=state.config.walkGoalMin;
  $('cfgCoffee').value=state.config.coffeeLimit; $('cfgAlcohol').value=state.config.alcoholLimit; $('cfgStart').value=state.config.startCampaign;
  $('cfgSave').onclick=()=>{ state.config.metaSleepH=Number($('cfgSleep').value||7);
    state.config.metaWaterML=Number($('cfgWater').value||2500); state.config.cupML=Number($('cfgCup').value||250);
    state.config.weightTarget=Number($('cfgTarget').value||81); state.config.walkGoalMin=Number($('cfgWalk').value||30);
    state.config.coffeeLimit=Number($('cfgCoffee').value||3); state.config.alcoholLimit=Number($('cfgAlcohol').value||1);
    state.config.startCampaign=$('cfgStart').value||toKey(); saveLocal(); renderAll(); };
  $('cfgReset').onclick=()=>{ Object.assign(state.config, { metaSleepH:7, metaWaterML:2500, cupML:250, startCampaign: toKey(), weightTarget:81, walkGoalMin:30, coffeeLimit:3, alcoholLimit:1 }); saveLocal(); renderAll(); };
}

let supabaseClient=null;
async function authInit(){
  const msg=$('authMsg'), btn=$('authSend');
  if(msg) msg.textContent='checando…'; if(btn) btn.disabled=true;
  try{ const res=await fetch(window.SUPABASE_URL+'/auth/v1/settings',{ headers:{ apikey: window.SUPABASE_ANON_KEY } }); const ok=res.ok; if(msg) msg.textContent= ok? 'online':'offline'; if(btn) btn.disabled=!ok; }
  catch(_){ if(msg) msg.textContent='offline'; if(btn) btn.disabled=true; }

  supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

  const { data:{ session } } = await supabaseClient.auth.getSession();
  if(session?.user) onLoginUI(); else onLogoutUI();

  supabaseClient.auth.onAuthStateChange((_e, sess)=>{ if(sess?.user){ onLoginUI(); pullCampaign().then(renderAll); } else onLogoutUI(); });

  if(btn) btn.onclick = async()=>{ const email=$('authEmail').value.trim(); if(!email){ if(msg) msg.textContent='informe seu e-mail'; return; }
    btn.disabled=true; if(msg) msg.textContent='enviando…';
    const base = location.origin + (location.pathname.endsWith('/') ? location.pathname : location.pathname.replace(/[^\/]+$/, '/'));
    const { error } = await supabaseClient.auth.signInWithOtp({ email, options:{ emailRedirectTo: base, shouldCreateUser:true } });
    if(msg) msg.textContent = error ? ('erro: '+error.message) : 'link enviado!'; btn.disabled=false; };

  const out=$('authSignOut'); if(out) out.onclick=async()=>{ await supabaseClient.auth.signOut(); };
}
function onLoginUI(){ const m=$('authMsg'); if(m) m.textContent='logado'; const o=$('authSignOut'); if(o) o.style.display=''; }
function onLogoutUI(){ const m=$('authMsg'); if(m) m.textContent='online'; const o=$('authSignOut'); if(o) o.style.display='none'; }

async function pullCampaign(){
  if(!supabaseClient) return;
  const { data:{ user } } = await supabaseClient.auth.getUser(); if(!user) return;
  const from=state.config.startCampaign||toKey();
  const { data, error } = await supabaseClient.from('days').select('date,data,updated_at').eq('user_id', user.id).gte('date', from).order('date',{ascending:true});
  if(error){ console.warn('pull',error); return; }
  (data||[]).forEach(r=> state.cache[r.date]=r.data||{});
  saveLocal();
}
async function upsertDay(k){
  if(!supabaseClient) return;
  const { data:{ user } } = await supabaseClient.auth.getUser(); if(!user) return;
  const payload={ user_id:user.id, date:k, data: state.cache[k]||{} };
  const { error } = await supabaseClient.from('days').upsert(payload).select(); if(error) console.warn('upsert',error);
}
const SYNC={ pullCampaign, upsertDay };

function initHeader(){
  setTop();
  const dt=$('dateTop'), dp=$('datePicker');
  if(dt&&dp){ dt.onclick=()=>{ dp.value=state.currentKey; dp.style.display= (dp.style.display==='block'?'none':'block'); dp.showPicker&&dp.showPicker(); };
    dp.onchange=()=>{ if(dp.value){ state.currentKey=dp.value; renderAll(); } dp.style.display='none'; } }
}

(function(){
  loadLocal(); initHeader(); authInit(); renderAll();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
  window.addEventListener('focus', async()=>{ const { data:{ user } } = await (supabaseClient?.auth.getUser()||{data:{}}); if(user) await pullCampaign(); renderAll(); });
})();
