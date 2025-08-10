// Vida+ 5.2.0 full baseline
const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
const $ = (q)=>document.querySelector(q);
const $$ = (q)=>document.querySelectorAll(q);
const months = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const wd = ['dom','seg','ter','qua','qui','sex','sáb'];
const todayStr = ()=>fmtDate(new Date());
function fmtDate(d){const z=new Date(d);const y=z.getFullYear();const m=('0'+(z.getMonth()+1)).slice(-2);const dd=('0'+z.getDate()).slice(-2);return `${y}-${m}-${dd}`;}
function nice(d){
  const z=new Date(d);return ('0'+z.getDate()).slice(-2)+'/'+months[z.getMonth()]+' ('+wd[z.getDay()]+')';
}
function setTop(){
  const now = new Date();
  $('#dateTop').textContent = ('0'+now.getDate()).slice(-2)+'/'+months[now.getMonth()]+' ('+wd[now.getDay()]+')';
}

// App state
let SESSION=null, USER=null;
let CFG = { sleep:7, water:2500, goal:81, cup:250, start:null, end:null, coffeeLimit:3, alcoholLimit:1 };
let DAY = defaultDay();

function defaultDay(){
  return { date: todayStr(), weight:null, sleep:{hours:null, quality:0}, meals:{bfast:0, snack1:0, lunch:0, snack2:0, dinner:0},
    exercise:{treino:null, walk:0}, mind:{read:false,book:false,meditate:false},
    water:0, drinks:{coffee:0, alcohol:0}, score:0 };
}

// Meals list
const MEAL_KEYS=[['Café da manhã','bfast'],['Lanche manhã','snack1'],['Almoço','lunch'],['Lanche tarde','snack2'],['Jantar','dinner']];

function renderMeals(){
  const wrap=$('#meals'); wrap.innerHTML='';
  for(const [label,key] of MEAL_KEYS){
    const row=document.createElement('div'); row.className='meal';
    const name=document.createElement('div'); name.textContent=label; name.style.cursor='pointer';
    const stars=document.createElement('div'); stars.className='stars'; for(let i=1;i<=3;i++){ const s=document.createElement('span'); s.className='star'; s.textContent='★'; s.addEventListener('click',()=>{DAY.meals[key]=i;update();saveDay();}); stars.appendChild(s);}
    name.addEventListener('click',()=>{DAY.meals[key]=0;update();saveDay();});
    row.appendChild(name); row.appendChild(stars); wrap.appendChild(row);
  }
}

function updateStars(container, value){
  const arr = container.querySelectorAll('.star'); arr.forEach((el,idx)=>{ el.classList.toggle('on', idx < value); });
}

function scoreAll(){
  // Pesos: Sono 25, Alimentação 45, Exercício 15, Hidratação 10, Mente 5
  let sSono=0;
  const h = Number(DAY.sleep.hours||0); const q = Number(DAY.sleep.quality||0);
  const meta = Number(CFG.sleep||7); const frac = Math.min(h/meta,1.0); sSono = Math.round(25*(0.7*frac + 0.3*(q/3)));
  $('#scoreSono').textContent = sSono + '/25';

  let sFood=0; for(const [,k] of MEAL_KEYS) sFood += (DAY.meals[k]||0);
  sFood = Math.round( (sFood/15) * 45 ); $('#scoreFood').textContent = sFood + '/45';

  let sEx=0; const walked = Number(DAY.exercise.walk||0); const treino = DAY.exercise.treino?1:0;
  sEx = Math.round(15*(0.6*Math.min(walked/40,1) + 0.4*treino)); $('#scoreEx').textContent = sEx + '/15';

  let sWat=0; const w = Number(DAY.water||0); sWat = Math.round(10*Math.min(w/CFG.water,1)); $('#scoreWater').textContent = sWat + '/10';

  let sMind=0; const m=DAY.mind; const any = (m.read||m.book||m.meditate)?1:0; sMind = any?5:0; $('#scoreMind').textContent = sMind + '/5';

  const total = sSono+sFood+sEx+sWat+sMind; DAY.score = total; $('#scoreTop').textContent = total;
  return total;
}

function paint(){
  $('#pesoMeta').textContent = 'Meta: '+(CFG.goal?CFG.goal+' kg':'—');
  const y = localStorage.getItem('lastWeight')?Number(localStorage.getItem('lastWeight')):null;
  $('#pesoYesterday').textContent = 'Ontem: '+(y?y+' kg':'—');
  if(DAY.weight!=null && y!=null){
    const diff = (DAY.weight - y).toFixed(1);
    const cls = diff<0?'good':(diff>0?'bad':'warn');
    $('#pesoDiff').innerHTML = `<span class="${cls}">${diff>0?'+':''}${diff} kg</span>`;
  } else $('#pesoDiff').textContent='';

  updateStars($('#sleepStars'), DAY.sleep.quality||0);

  const mealRows = $$('#meals .meal'); mealRows.forEach((row,idx)=>{ const key=MEAL_KEYS[idx][1]; updateStars(row.querySelector('.stars'), DAY.meals[key]||0); });

  const pct = Math.min(100, Math.round( (DAY.water/CFG.water)*100 )); $('#waterPct').textContent = pct+'%';
  $('#waterBar').style.width = pct+'%'; $('#waterTotal').textContent = (DAY.water||0)+' / '+CFG.water+' ml';

  $('#coffeeIcons').textContent = DAY.drinks.coffee>0 ? ('☕' + (DAY.drinks.coffee>1? ' x'+DAY.drinks.coffee : '')) : '';
  $('#alcoholIcons').textContent = DAY.drinks.alcohol>0 ? ('🍷' + (DAY.drinks.alcohol>1? ' x'+DAY.drinks.alcohol : '')) : '';

  scoreAll();
}

function attachEvents(){
  $('#btnPesoOk').addEventListener('click', async()=>{ const v=parseFloat($('#pesoHoje').value); if(!isNaN(v)){ DAY.weight=v; localStorage.setItem('lastWeight', String(v)); await saveDay(); update(); } });
  $('#sleepHours').addEventListener('change', async(e)=>{ DAY.sleep.hours=parseFloat(e.target.value)||0; await saveDay(); update(); });
  $('#sleepStars').querySelectorAll('.star').forEach((s,idx)=> s.addEventListener('click', async()=>{ DAY.sleep.quality=idx+1; await saveDay(); update(); }));
  $$('button[data-treino]').forEach(b=> b.addEventListener('click', async()=>{ DAY.exercise.treino=b.dataset.treino; await saveDay(); update(); }));
  $('#walkMin').addEventListener('change', async(e)=>{ DAY.exercise.walk=parseInt(e.target.value||'0',10); await saveDay(); update(); });
  $$('.mind').forEach(b=> b.addEventListener('click', async()=>{ const k=b.dataset.mind; DAY.mind[k]=!DAY.mind[k]; b.classList.toggle('on', DAY.mind[k]); await saveDay(); update(); }));
  $('#btnWaterPlus').addEventListener('click', async()=>{ DAY.water = (DAY.water||0) + Number(CFG.cup||250); await saveDay(); update(); });
  $('#btnWaterMinus').addEventListener('click', async()=>{ DAY.water = Math.max(0, (DAY.water||0) - Number(CFG.cup||250)); await saveDay(); update(); });
  $('#coffeePlus').addEventListener('click', async()=>{ DAY.drinks.coffee++; await saveDay(); update(); });
  $('#coffeeMinus').addEventListener('click', async()=>{ DAY.drinks.coffee=Math.max(0,DAY.drinks.coffee-1); await saveDay(); update(); });
  $('#alcoholPlus').addEventListener('click', async()=>{ DAY.drinks.alcohol++; await saveDay(); update(); });
  $('#alcoholMinus').addEventListener('click', async()=>{ DAY.drinks.alcohol=Math.max(0,DAY.drinks.alcohol-1); await saveDay(); update(); });
  $('#btnSaveCfg').addEventListener('click', async()=>{ readCfgFromUI(); await saveDay(); update(); alert('Config salva.'); });
  $('#btnExport').addEventListener('click', async()=>{ const rows=await loadAllDays(); downloadCSV(rows); });
  $('#btnSignOut').addEventListener('click', async()=>{ await supabase.auth.signOut(); location.reload(); });
  $('#dateTop').addEventListener('click', ()=>{ $('#datePicker').showPicker?.(); });
}

function readCfgFromUI(){
  CFG.sleep = parseFloat($('#cfgSleep').value)||7;
  CFG.water = parseInt($('#cfgWater').value||'2500',10);
  CFG.goal  = parseFloat($('#cfgGoal').value)||81;
  CFG.cup   = parseInt($('#cfgCup').value||'250',10);
  CFG.start = $('#cfgStart').value||null;
  CFG.end   = $('#cfgEnd').value||null;
}

async function saveDay(){
  if(!USER) return;
  const payload = { user_id: USER.id, date: DAY.date, data: DAY };
  const { error } = await supabase.from('days').upsert(payload, { onConflict: 'user_id,date' });
  if(error) console.error('save error', error);
}

async function loadAllDays(){
  const { data, error } = await supabase.from('days').select('date,data').eq('user_id', USER.id).order('date', {ascending:false});
  if(error) { console.error(error); return []; }
  return data||[];
}

function renderHistory(rows){
  const list=$('#histList'); list.innerHTML='';
  for(const r of rows){
    const d = r.date; const data = r.data||{}; const score = data.score||0; const weight = (data.weight!=null)? (data.weight+' kg') : '—';
    let cls=''; if(score<60) cls='bad'; else if(score<80) cls='warn';
    const icons=[];
    if((data.drinks?.coffee||0)>0) icons.push('☕'+(data.drinks.coffee>1?(' x'+data.drinks.coffee):''));
    if((data.drinks?.alcohol||0)>0) icons.push('🍷'+(data.drinks.alcohol>1?(' x'+data.drinks.alcohol):''));
    if((data.water||0) >= (CFG.water||2500)) icons.push('💧');
    if((data.exercise?.treino)||((data.exercise?.walk||0)>0)) icons.push('🏃');
    const row=document.createElement('div'); row.className='histRow';
    row.innerHTML = `<div>${d.slice(8,10)}/${months[Number(d.slice(5,7))-1]}</div>
                     <div class="${cls}">${score}</div>
                     <div class="right">${weight}</div>`;
    const iconDiv = document.createElement('div'); iconDiv.style.position='relative'; iconDiv.style.marginLeft='-120px';
    iconDiv.textContent = icons.join('  ');
    row.children[1].appendChild(iconDiv);
    list.appendChild(row);
  }
}

function renderChart(rows){
  const cvs=$('#chart'); const ctx=cvs.getContext('2d'); ctx.clearRect(0,0,cvs.width,cvs.height);
  if(!rows.length) return;
  const scores = rows.map(r=> (r.data?.score)||0 ).reverse();
  const weights = rows.map(r=> (r.data?.weight)||null ).reverse();
  const n = rows.length; const w = cvs.width, h=cvs.height; const pad=30;
  const maxS=100; const bw = (w-2*pad)/n - 6;
  ctx.fillStyle='rgba(100,150,255,0.25)';
  scores.forEach((s,i)=>{ const x=pad+i*((w-2*pad)/n)+3; const bh=(s/maxS)*(h-2*pad); ctx.fillRect(x, h-pad-bh, bw, bh); });
  const vals = weights.filter(v=>v!=null); if(vals.length>=2){
    const minW=Math.min(...vals), maxW=Math.max(...vals);
    ctx.strokeStyle='#9be9a8'; ctx.lineWidth=2; ctx.beginPath();
    weights.forEach((v,i)=>{ if(v==null) return; const x=pad+i*((w-2*pad)/n)+bw/2; const y=h-pad-((v-minW)/(maxW-minW+0.0001))*(h-2*pad);
      if(i==0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }); ctx.stroke();
  }
}

// Export CSV
function downloadCSV(rows){
  if(!rows||!rows.length){ alert('Sem dados.'); return; }
  const header=['date','score','weight','sleep_hours','sleep_quality','walk_min','treino','water_ml','coffee','alcohol'];
  const lines=[header.join(',')];
  for(const r of rows){
    const d=r.data||{};
    lines.push([r.date, d.score||'', d.weight||'', d.sleep?.hours||'', d.sleep?.quality||'', d.exercise?.walk||'', d.exercise?.treino||'',
      d.water||'', d.drinks?.coffee||'', d.drinks?.alcohol||''].join(','));
  }
  const blob=new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8'}); const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='vida_plus_export.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

async function bootstrap(){
  setTop();
  const { data: { session } } = await supabase.auth.getSession(); SESSION=session; USER=session?.user||null;
  supabase.auth.onAuthStateChange((_e, s)=>{ SESSION=s; USER=s?.user||null; ensureAuth(); });
  ensureAuth();
  renderMeals(); attachEvents(); update();
}

async function ensureAuth(){
  if(USER){ $('#loginWrap').style.display='none'; $('#content').style.display='grid'; $('#loginStatus').textContent='logado como '+(USER.email||''); await loadAndRender(); }
  else { $('#loginWrap').style.display='block'; $('#content').style.display='none'; $('#loginStatus').textContent='offline'; }
}

async function loadAndRender(){
  const rows = await loadAllDays();
  renderHistory(rows);
  renderChart(rows);
}

function update(){ paint(); }

document.addEventListener('DOMContentLoaded', ()=>{
  $('#btnSignIn').addEventListener('click', async()=>{ const email=$('#loginEmail').value.trim(), pass=$('#loginPass').value; $('#loginMsg').textContent='...';
    try{ const {error} = await supabase.auth.signInWithPassword({email, password:pass}); if(error) throw error; $('#loginMsg').textContent='ok'; }
    catch(e){ $('#loginMsg').textContent='Erro: '+(e.message||e); }
  });
  $('#btnSignUp').addEventListener('click', async()=>{ const email=$('#loginEmail').value.trim(), pass=$('#loginPass').value; $('#loginMsg').textContent='...';
    try{ const {error} = await supabase.auth.signUp({email, password:pass}); if(error) throw error; $('#loginMsg').textContent='Conta criada. Faça login.'; }
    catch(e){ $('#loginMsg').textContent='Erro: '+(e.message||e); }
  });
  $('#btnReset').addEventListener('click', async()=>{ const email=$('#loginEmail').value.trim(); $('#loginMsg').textContent='...';
    try{ const url=location.origin+location.pathname; const {error}=await supabase.auth.resetPasswordForEmail(email, {redirectTo:url}); if(error) throw error; $('#loginMsg').textContent='Email enviado.'; }
    catch(e){ $('#loginMsg').textContent='Erro: '+(e.message||e); }
  });
  bootstrap();
});