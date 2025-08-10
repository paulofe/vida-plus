// Vida+ v5.1.7 (base 5.1.6) — Supabase only
const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON);
const $ = (q)=>document.querySelector(q), $$=(q)=>document.querySelectorAll(q);
const months=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'], wd=['dom','seg','ter','qua','qui','sex','sáb'];
const todayStr = ()=>fmtDate(new Date());
function fmtDate(d){ const z=new Date(d); const y=z.getFullYear(); const m=('0'+(z.getMonth()+1)).slice(-2); const dd=('0'+z.getDate()).slice(-2); return `${y}-${m}-${dd}`; }
function nice(d){ const z=new Date(d); return ('0'+z.getDate()).slice(-2)+'/'+months[z.getMonth()]+' ('+wd[z.getDay()]+')'; }

let USER=null, SESSION=null;
let CFG={ sleep:7, water:2500, goal:81, cup:250, start:null, end:null, coffeeLimit:3, alcoholLimit:1 };
let DAY=defaultDay();

function defaultDay(){
  return { date: todayStr(), weight:null,
    sleep:{hours:null,quality:0},
    meals:{bfast:0,snack1:0,lunch:0,snack2:0,dinner:0},
    exercise:{treino:null,walk:0},
    mind:{read:false,book:false,meditate:false},
    water:0, drinks:{coffee:0,alcohol:0},
    score:0 };
}

// ===== UI helpers (layout mantido) =====
function setTopDate(dstr){
  const d=new Date(dstr||DAY.date);
  $('#dateTop').textContent=('0'+d.getDate()).slice(-2)+'/'+months[d.getMonth()]+' ('+wd[d.getDay()]+')';
  $('#datePicker').value=(dstr||DAY.date);
}
function starize(el,val){ el.querySelectorAll('.star').forEach((s,i)=>s.classList.toggle('on', i<val)); }

function renderMeals(){
  const wrap=$('#meals'); wrap.innerHTML='';
  const MEAL_KEYS=[['Café da manhã','bfast'],['Lanche manhã','snack1'],['Almoço','lunch'],['Lanche tarde','snack2'],['Jantar','dinner']];
  for(const [label,key] of MEAL_KEYS){
    const row=document.createElement('div'); row.className='meal';
    const name=document.createElement('div'); name.textContent=label; name.style.cursor='pointer';
    const stars=document.createElement('div'); stars.className='stars';
    for(let i=1;i<=3;i++){ const s=document.createElement('span'); s.className='star'; s.textContent='★'; s.addEventListener('click', async()=>{ DAY.meals[key]=i; update(); await saveDay(); }); stars.appendChild(s); }
    name.addEventListener('click', async()=>{ DAY.meals[key]=0; update(); await saveDay(); });
    row.appendChild(name); row.appendChild(stars); wrap.appendChild(row);
  }
}

// ===== Scores (idêntico) =====
function scoreAll(){
  let sSono=0; const m=Number(CFG.sleep||7); const h=Number(DAY.sleep.hours||0); const q=Number(DAY.sleep.quality||0);
  sSono=Math.round(25*(0.7*Math.min(h/m,1)+0.3*(q/3))); $('#scoreSono').textContent=sSono+'/25';
  let sFood=0; Object.values(DAY.meals).forEach(v=>sFood+=v); sFood=Math.round((sFood/15)*45); $('#scoreFood').textContent=sFood+'/45';
  let sEx=Math.round(15*(0.6*Math.min((DAY.exercise.walk||0)/40,1)+0.4*(DAY.exercise.treino?1:0))); $('#scoreEx').textContent=sEx+'/15';
  let sWat=Math.round(10*Math.min((DAY.water||0)/CFG.water,1)); $('#scoreWater').textContent=sWat+'/10';
  let sMind=(DAY.mind.read||DAY.mind.book||DAY.mind.meditate)?5:0; $('#scoreMind').textContent=sMind+'/5';
  DAY.score=sSono+sFood+sEx+sWat+sMind; $('#scoreTop').textContent=DAY.score;
}

function paint(){
  setTopDate(DAY.date);
  // peso
  $('#pesoMeta').textContent='Meta: '+(CFG.goal?CFG.goal+' kg':'—');
  const y=localStorage.getItem('lastWeight'); $('#pesoYesterday').textContent='Ontem: '+(y?Number(y)+' kg':'—');
  if(y && DAY.weight!=null){ const diff=(DAY.weight-Number(y)).toFixed(1); const cls=diff<0?'good':(diff>0?'bad':'warn'); $('#pesoDiff').innerHTML=`<span class="${cls}">${diff>0?'+':''}${diff} kg</span>`; } else $('#pesoDiff').textContent='';
  // sono
  starize($('#sleepStars'), DAY.sleep.quality||0);
  // refeições
  $$('#meals .meal').forEach((row,idx)=>{ const keys=['bfast','snack1','lunch','snack2','dinner']; const k=keys[idx]; starize(row.querySelector('.stars'), DAY.meals[k]||0); });
  // hidratação
  const pct=Math.min(100,Math.round(((DAY.water||0)/(CFG.water||2500))*100)); $('#waterPct').textContent=pct+'%'; $('#waterBar').style.width=pct+'%'; $('#waterTotal').textContent=(DAY.water||0)+' / '+CFG.water+' ml';
  // bebidas
  $('#coffeeIcons').textContent=DAY.drinks.coffee>0?('☕'+(DAY.drinks.coffee>1?' x'+DAY.drinks.coffee:'')):'';
  $('#alcoholIcons').textContent=DAY.drinks.alcohol>0?('🍷'+(DAY.drinks.alcohol>1?' x'+DAY.drinks.alcohol:'')):'';
  // treino toggles visuais
  $$('button[data-treino]').forEach(b=>b.classList.toggle('active', DAY.exercise.treino===b.dataset.treino));
  // mente visual
  $$('.mind').forEach(b=>b.classList.toggle('on', !!DAY.mind[b.dataset.mind]));
  // score
  scoreAll();
}

function attachEvents(){
  // Top date
  $('#dateTop').addEventListener('click', ()=>$('#datePicker').showPicker?.());
  $('#datePicker').addEventListener('change', async e=>{ DAY.date=e.target.value; await ensureDayLoaded(); update(); });
  // Peso
  $('#btnPesoOk').addEventListener('click', async()=>{ const v=parseFloat($('#pesoHoje').value); if(!isNaN(v)){ DAY.weight=v; localStorage.setItem('lastWeight',String(v)); await saveDay(); update(); }});
  // Sono
  $('#sleepHours').addEventListener('change', async e=>{ DAY.sleep.hours=parseFloat(e.target.value)||0; await saveDay(); update(); });
  $('#sleepStars').querySelectorAll('.star').forEach((s,idx)=> s.addEventListener('click', async()=>{ DAY.sleep.quality=idx+1; await saveDay(); update(); }));
  // Refeições: handlers estão no render
  // Exercício
  $$('button[data-treino]').forEach(b=> b.addEventListener('click', async()=>{ DAY.exercise.treino=b.dataset.treino; await saveDay(); update(); }));
  $('#walkMin').addEventListener('change', async e=>{ DAY.exercise.walk=parseInt(e.target.value||'0',10); await saveDay(); update(); });
  // Mente
  $$('.mind').forEach(b=> b.addEventListener('click', async()=>{ const k=b.dataset.mind; DAY.mind[k]=!DAY.mind[k]; await saveDay(); update(); }));
  // Hidratação
  $('#btnWaterPlus').addEventListener('click', async()=>{ DAY.water=(DAY.water||0)+Number(CFG.cup||250); await saveDay(); update(); });
  $('#btnWaterMinus').addEventListener('click', async()=>{ DAY.water=Math.max(0,(DAY.water||0)-Number(CFG.cup||250)); await saveDay(); update(); });
  // Bebidas
  $('#coffeePlus').addEventListener('click', async()=>{ DAY.drinks.coffee++; await saveDay(); update(); });
  $('#coffeeMinus').addEventListener('click', async()=>{ DAY.drinks.coffee=Math.max(0,DAY.drinks.coffee-1); await saveDay(); update(); });
  $('#alcoholPlus').addEventListener('click', async()=>{ DAY.drinks.alcohol++; await saveDay(); update(); });
  $('#alcoholMinus').addEventListener('click', async()=>{ DAY.drinks.alcohol=Math.max(0,DAY.drinks.alcohol-1); await saveDay(); update(); });
  // Config
  $('#btnSaveCfg').addEventListener('click', async()=>{ readCfgFromUI(); await saveDay(); update(); alert('Config salva.'); });
  $('#btnExport').addEventListener('click', async()=>{ const rows=await loadAllDays(); downloadCSV(rows); });
  $('#btnSignOut').addEventListener('click', async()=>{ await supabase.auth.signOut(); location.reload(); });
}

function readCfgFromUI(){
  CFG.sleep=parseFloat($('#cfgSleep').value)||7;
  CFG.water=parseInt($('#cfgWater').value||'2500',10);
  CFG.goal=parseFloat($('#cfgGoal').value)||81;
  CFG.cup=parseInt($('#cfgCup').value||'250',10);
  CFG.start=$('#cfgStart').value||null;
  CFG.end=$('#cfgEnd').value||null;
}

// ====== Supabase ======
async function saveDay(){
  if(!USER) return;
  const payload={ user_id: USER.id, date: DAY.date, data: DAY };
  const { error } = await supabase.from('days').upsert(payload, { onConflict: 'user_id,date' });
  if(error) console.error('save error', error);
}
async function ensureDayLoaded(){
  if(!USER) return;
  const { data } = await supabase.from('days').select('data').eq('user_id',USER.id).eq('date',DAY.date).maybeSingle();
  DAY = data?.data || { ...defaultDay(), date: DAY.date };
}
async function loadAllDays(){
  if(!USER) return [];
  const { data, error } = await supabase.from('days').select('date,data').eq('user_id',USER.id).order('date',{ascending:false});
  if(error) { console.error(error); return []; }
  return data||[];
}
async function mergeLocalIntoServer(){
  // Se houver local days, envia para supabase sem sobrescrever datas que já existem no server.
  try{
    const raw=localStorage.getItem('vida_days'); if(!raw) return;
    const days=JSON.parse(raw); if(!Array.isArray(days)) return;
    const { data: server } = await supabase.from('days').select('date').eq('user_id',USER.id);
    const existing=new Set((server||[]).map(r=>r.date));
    const payload=days.filter(d=>!existing.has(d.date)).map(d=>({ user_id:USER.id, date:d.date, data:d }));
    if(payload.length){ await supabase.from('days').insert(payload); }
  }catch(e){ console.warn('merge skip', e); }
}

// ===== Histórico + Gráfico =====
function renderHistory(rows){
  const list=$('#histList'); list.innerHTML='';
  rows.forEach(r=>{
    const d=r.date; const obj=r.data||{}; const score=obj.score||0; const weight=(obj.weight!=null)?(obj.weight+' kg'):'—';
    let cls=''; if(score<60) cls='bad'; else if(score<80) cls='warn';
    const icons=[];
    if((obj.drinks?.coffee||0)>0) icons.push('☕'+(obj.drinks.coffee>1?' x'+obj.drinks.coffee:''));
    if((obj.drinks?.alcohol||0)>0) icons.push('🍷'+(obj.drinks.alcohol>1?' x'+obj.drinks.alcohol:''));
    if((obj.water||0)>= (CFG.water||2500)) icons.push('💧');
    if((obj.exercise?.treino)||((obj.exercise?.walk||0)>0)) icons.push('🏃');
    const row=document.createElement('div'); row.className='histRow';
    row.innerHTML=`<div>${d.slice(8,10)}/${months[Number(d.slice(5,7))-1]}</div>
                   <div class="${cls}">${score} <span style="opacity:.8;margin-left:6px">${icons.join('  ')}</span></div>
                   <div class="right">${weight}</div>`;
    list.appendChild(row);
  });
}

function renderChart(rows){
  const cvs=$('#chart'); const ctx=cvs.getContext('2d'); ctx.clearRect(0,0,cvs.width,cvs.height);
  if(!rows.length) return;
  const scores=rows.map(r=>r.data?.score||0).reverse();
  const weights=rows.map(r=>r.data?.weight||null).reverse();
  const n=rows.length, w=cvs.width, h=cvs.height, pad=30, maxS=100, bw=(w-2*pad)/n-6;
  ctx.fillStyle='rgba(100,150,255,0.25)';
  scores.forEach((s,i)=>{ const x=pad+i*((w-2*pad)/n)+3, bh=(s/maxS)*(h-2*pad); ctx.fillRect(x,h-pad-bh,bw,bh); });
  const vals=weights.filter(v=>v!=null); if(vals.length>=2){
    const minW=Math.min(...vals), maxW=Math.max(...vals); ctx.strokeStyle='#9be9a8'; ctx.lineWidth=2; ctx.beginPath();
    weights.forEach((v,i)=>{ if(v==null) return; const x=pad+i*((w-2*pad)/n)+bw/2, y=h-pad-((v-minW)/(maxW-minW+1e-6))*(h-2*pad); if(i==0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }); ctx.stroke();
  }
}

// ===== Boot =====
async function bootstrap(){
  // topo
  setTopDate(DAY.date);
  // auth state
  const { data:{ session } } = await supabase.auth.getSession(); SESSION=session; USER=session?.user||null;
  supabase.auth.onAuthStateChange((_e,s)=>{ SESSION=s; USER=s?.user||null; gate(); });
  // UI wiring
  renderMeals(); attachEvents(); update();
  gate();
}

async function gate(){
  if(USER){
    $('#loginOverlay').style.display='none'; $('#app').style.display='grid'; $('#loginStatus').textContent='logado como '+(USER.email||'');
    await mergeLocalIntoServer();
    await ensureDayLoaded(); update();
    const rows=await loadAllDays(); renderHistory(rows); renderChart(rows);
  } else {
    $('#loginOverlay').style.display='flex'; $('#app').style.display='none'; $('#loginStatus').textContent='offline';
  }
}

function update(){ paint(); }

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
