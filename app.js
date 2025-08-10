// Vida+ v6.0.0 — versão consolidada
const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON);
const $ = (q)=>document.querySelector(q), $$=(q)=>document.querySelectorAll(q);
const months=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'], wd=['dom','seg','ter','qua','qui','sex','sáb'];
const fmtDate = (d)=>{ const z=new Date(d), y=z.getFullYear(), m=('0'+(z.getMonth()+1)).slice(-2), dd=('0'+z.getDate()).slice(-2); return `${y}-${m}-${dd}`; };
const dispDate = (dstr)=>{ const d=new Date(dstr); return ('0'+d.getDate()).slice(-2)+'/'+months[d.getMonth()]+' ('+wd[d.getDay()]+')'; };

let USER=null, SESSION=null;
let CFG={ sleep:7, water:2500, goal:81, cup:250, start:null, end:null, coffeeLimit:3, alcoholLimit:1 };
let DAY=defaultDay();
let ALL_ROWS=[]; // cache para histórico/gráfico

function defaultDay(){
  return { date: fmtDate(new Date()), weight:null,
    sleep:{hours:null,quality:0},
    meals:{bfast:0,snack1:0,lunch:0,snack2:0,dinner:0},
    exercise:{treino:null,walk:0},
    mind:{read:false,book:false,meditate:false},
    water:0, drinks:{coffee:0,alcohol:0},
    score:0 };
}

// ===== Top =====
function renderTop(){
  $('#dateTop').textContent = dispDate(DAY.date);
  $('#datePicker').value = DAY.date;
  $('#scoreTop').textContent = DAY.score||0;
  $('#streakNum').textContent = computeStreak(ALL_ROWS);
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
    sSono=Math.round(25*(0.7*Math.min(h/m,1)+0.3*(q/3))); $('#scoreSono').textContent=sSono+'/25'; }
  let sFood=0; Object.values(DAY.meals).forEach(v=>sFood+=v); sFood=Math.round((sFood/15)*45); $('#scoreFood').textContent=sFood+'/45';
  let sEx=Math.round(15*(0.6*Math.min((DAY.exercise.walk||0)/40,1)+0.4*(DAY.exercise.treino?1:0))); $('#scoreEx').textContent=sEx+'/15';
  let sWat=Math.round(10*Math.min((DAY.water||0)/CFG.water,1)); $('#scoreWater').textContent=sWat+'/10';
  let sMind=(DAY.mind.read||DAY.mind.book||DAY.mind.meditate)?5:0; $('#scoreMind').textContent=sMind+'/5';
  DAY.score = sSono+sFood+sEx+sWat+sMind;
  $('#scoreTop').textContent = DAY.score;
}

// ===== Paint =====
function paint(){
  renderTop();
  // peso
  $('#pesoMeta').textContent='Meta: '+(CFG.goal?CFG.goal+' kg':'—');
  const y=localStorage.getItem('lastWeight'); $('#pesoYesterday').textContent='Ontem: '+(y?Number(y)+' kg':'—');
  if(y && DAY.weight!=null){ const diff=(DAY.weight-Number(y)).toFixed(1); const cls=diff<0?'good':(diff>0?'bad':'warn'); $('#pesoDiff').innerHTML=`<span class="${cls}">${diff>0?'+':''}${diff} kg</span>`; } else $('#pesoDiff').textContent='';
  // sono
  setStars($('#sleepStars'), DAY.sleep.quality||0);
  // refeições
  const keys=['bfast','snack1','lunch','snack2','dinner'];
  $$('#meals .meal').forEach((row,idx)=> setStars(row.querySelector('.stars'), DAY.meals[keys[idx]]||0));
  // hidratação
  const pct=Math.min(100,Math.round(((DAY.water||0)/(CFG.water||2500))*100)); $('#waterPct').textContent=pct+'%'; $('#waterBar').style.width=pct+'%'; $('#waterTotal').textContent=(DAY.water||0)+' / '+CFG.water+' ml';
  // bebidas (mostra barra de ícones — repetido ou xN se muito)
  const iconRepeat = (icon, n)=>{ if(n<=0) return ''; if(n<=8) return icon.repeat(n); return icon+' x'+n; };
  $('#coffeeIcons').textContent = iconRepeat('☕', DAY.drinks.coffee||0);
  $('#alcoholIcons').textContent = iconRepeat('🍷', DAY.drinks.alcohol||0);
  // treino visual + ontem ref
  $$('button[data-treino]').forEach(b=>b.classList.toggle('active', DAY.exercise.treino===b.dataset.treino));
  $('#treinoOntem').textContent = getYesterdayTreino();
  // score final
  scoreAll();
}

// ===== Eventos =====
function attachEvents(){
  // Header date
  $('#dateTop').addEventListener('click', ()=>$('#datePicker').showPicker?.());
  $('#datePicker').addEventListener('change', async e=>{ DAY.date=e.target.value; await ensureDayLoaded(); update(); });
  // Peso
  $('#btnPesoOk').addEventListener('click', async()=>{ const v=parseFloat($('#pesoHoje').value); if(!isNaN(v)){ DAY.weight=v; localStorage.setItem('lastWeight',String(v)); await saveDay(); update(); }});
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
  const { data } = await supabase.from('days').select('data').eq('user_id',USER.id).eq('date',DAY.date).maybeSingle();
  DAY = data?.data || { ...defaultDay(), date: DAY.date };
  // preencher inputs
  $('#pesoHoje').value = (DAY.weight!=null)?DAY.weight:'';
  $('#sleepHours').value = (DAY.sleep.hours!=null)?DAY.sleep.hours:'';
  $('#walkMin').value = (DAY.exercise.walk||0);
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
    if(w0 < w1) streak++; else break;
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
    weights.forEach((v,i)=>{ if(v==null) return; const x=pad+i*((w-2*pad)/n)+bw/2, y=h-pad-((v-minW)/(maxW-minW+1e-6))*(h-2*pad); if(ctx.currentPathEmpty) ctx.moveTo(x,y); else ctx.lineTo(x,y); });
    ctx.stroke();
  }

  // linha projetada (meta linear)
  if(CFG.start && CFG.end && CFG.goal!=null){
    const inRange = rows.filter(r=> r.date>=CFG.start && r.date<=CFG.end && r.data?.weight!=null );
    const startRow = inRange.length? inRange[0] : (rows.find(r=>r.date>=CFG.start) || null);
    if(startRow && startRow.data?.weight!=null){
      const startIdx = rows.indexOf(startRow);
      const startW = startRow.data.weight;
      const endIdx = rows.findLastIndex ? rows.findLastIndex(r=>r.date<=CFG.end) : (function(){let idx=-1; for(let i=rows.length-1;i>=0;i--){ if(rows[i].date<=CFG.end){ idx=i; break; } } return idx;})();
      if(endIdx>=0){
        const steps = endIdx-startIdx;
        if(steps>0){
          const minW=Math.min(...vals, CFG.goal, startW), maxW=Math.max(...vals, CFG.goal, startW);
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

// ===== Export =====
function downloadCSV(rows){
  if(!rows||!rows.length){ alert('Sem dados.'); return; }
  const header=['user_id','date','score','weight','sleep_hours','sleep_quality','walk_min','treino','water_ml','coffee','alcohol'];
  const lines=[header.join(',')];
  for(const r of rows){
    const d=r.data||{};
    lines.push([USER?.id||'', r.date, d.score||'', d.weight||'', d.sleep?.hours||'', d.sleep?.quality||'', d.exercise?.walk||'', d.exercise?.treino||'', d.water||'', d.drinks?.coffee||'', d.drinks?.alcohol||''].join(','));
  }
  const blob=new Blob([lines.join('\\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='vida_plus_export.csv'; a.click(); URL.revokeObjectURL(url);
}

// ===== Aux =====
function getYesterdayTreino(){
  if(ALL_ROWS.length<2) return '';
  const y = ALL_ROWS[1].data?.exercise?.treino;
  return y ? ('Ontem: Treino '+y) : '';
}

// ===== Boot =====
async function bootstrap(){
  const { data:{ session } } = await supabase.auth.getSession(); SESSION=session; USER=session?.user||null;
  supabase.auth.onAuthStateChange((_e,s)=>{ SESSION=s; USER=s?.user||null; gate(); });
  renderMeals(); attachEvents(); update(); gate();
}

async function gate(){
  if(USER){
    $('#loginOverlay').style.display='none'; $('#app').style.display='grid'; $('#loginStatus').textContent='logado como '+(USER.email||'');
    ALL_ROWS = await loadAllDays();
    await ensureDayLoaded();
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

document.addEventListener('DOMContentLoaded', () => {
  // 2.1 — “ / 100” sem mexer na tipografia
  const outOf = document.querySelector('.scoreTop .outOf');
  if (outOf && !outOf.dataset.sepFixed) {
    outOf.dataset.sepFixed = '1';
    // se alguém tiver colocado "/" dentro do score antes, normaliza
    outOf.textContent = '100';
  }

  // 2.2 — Data do topo = datePicker (sem fuso)
  const dateTop = document.getElementById('dateTop');
  const dp = document.getElementById('datePicker');

  function ymd(d){ const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; }
  function fromYmd(s){ const [y,m,d]=s.split('-').map(Number); return new Date(y, m-1, d); }
  function fmtPtShort(d){
    const o={day:'2-digit',month:'short',weekday:'short'};
    return d.toLocaleDateString('pt-BR',o).replace('.', '');
  }

  // valor inicial do input
  if (!dp.value) dp.value = ymd(new Date());
  renderDateTop();

  function renderDateTop(){
    if (!dateTop) return;
    const d = fromYmd(dp.value);
    dateTop.textContent = fmtPtShort(d); // ex: "10/ago (dom)"
  }

  // abre o seletor no iOS/desktop com fallback
  if (dateTop){
    dateTop.addEventListener('click', () => {
      try {
        if (dp.showPicker) dp.showPicker(); else dp.click();
      } catch(e) {
        const s = prompt('Digite a data (AAAA-MM-DD):', dp.value);
        if (s && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
          dp.value = s;
          dp.dispatchEvent(new Event('change', {bubbles:true}));
        }
      }
    });
  }

  // quando trocar a data, atualiza rótulo e deixa o resto do app reagir
  dp.addEventListener('change', () => {
    renderDateTop();
    // Se seu app já escuta essa troca, dispare um evento genérico:
    try{ window.dispatchEvent(new CustomEvent('vida:date:change',{detail:{ymd:dp.value}})); }catch(_){}
    // Se você tiver uma função própria, descomente:
    // if (typeof window.loadDay === 'function') window.loadDay(dp.value);
    // ou: if (typeof window.setCurrentYmd === 'function') window.setCurrentYmd(dp.value);
  });
});

// ——— Topo: data correta e iOS datepicker ———
(function(){
  const dateTop = document.getElementById('dateTop');
  const dp = document.getElementById('datePicker');
  if(!dateTop || !dp) return;

  // Utilidades sem UTC (tudo local)
  function ymdLocal(d){
    const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${dd}`;
  }
  function fromYmdLocal(s){
    const [y,m,d]=s.split('-').map(Number);
    return new Date(y, m-1, d); // local, não UTC
  }
  function fmtPtShortLocal(d){
    // Evita . em "ago." no iOS
    const weekday = d.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.', '');
    const month   = d.toLocaleDateString('pt-BR',{month:'short'}).replace('.', '');
    const day     = String(d.getDate()).padStart(2,'0');
    return `${day}/${month} (${weekday})`;
  }

  // Inicializa valor do input se vazio
  if(!dp.value){
    dp.value = ymdLocal(new Date());
  }

  // Renderiza rótulo sem offset
  function renderTopDate(){
    const d = fromYmdLocal(dp.value);
    dateTop.textContent = fmtPtShortLocal(d);
  }
  renderTopDate();

  // Abre seletor (iOS/desktop). Importante: o input NÃO está display:none
  dateTop.addEventListener('click', () => {
    try{
      if (typeof dp.showPicker === 'function') {
        dp.showPicker();
      } else {
        // iOS precisa foco+click em um elemento visível
        dp.focus();
        dp.click();
      }
    }catch(e){
      const s = prompt('Digite a data (AAAA-MM-DD):', dp.value);
      if (s && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
        dp.value = s;
        dp.dispatchEvent(new Event('change', {bubbles:true}));
      }
    }
  });

  dp.addEventListener('change', () => {
    renderTopDate();
    // Notifica o app (se você já escuta esse evento, manter)
    try{ window.dispatchEvent(new CustomEvent('vida:date:change',{detail:{ymd:dp.value}})); }catch(_){}
    // Se houver função interna pra carregar o dia, descomente:
    // if (typeof window.loadDay === 'function') window.loadDay(dp.value);
  });

  // Garante o “ / 100 ” com espaço, sem trocar tipografia
  const outEl = document.querySelector('.scoreTop .outOf');
  if (outEl) {
    outEl.textContent = '100';
    if (!outEl.dataset.sepFixed) {
      outEl.dataset.sepFixed = '1';
      if (!outEl.previousSibling || outEl.previousSibling.textContent.indexOf('/') === -1) {
        // deixa o /  no elemento anterior, se for o seu HTML, ignore
        // visualmente o espaço é garantido via CSS pseudo-element no seu CSS,
        // mas se preferir forçar no texto, comente a linha abaixo e use replace.
      }
    }
  }
})();


// ——— Topo: data local correta + datepicker Android/iOS sem prompt ———
(function(){
  const dateTop = document.getElementById('dateTop');
  const dp = document.getElementById('datePicker');
  if (!dateTop || !dp) return;

  // 2.1 “/ 100” com espaço (mantém sua tipografia)
  const outEl = document.querySelector('.scoreTop .outOf');
  if (outEl) outEl.textContent = '100';

  // 2.2 utilitários 100% locais (evita UTC e -1 dia)
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const dias  = ['dom','seg','ter','qua','qui','sex','sáb'];

  function ymdLocal(d){
    const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${dd}`;
  }
  function fromYmdLocal(s){
    const [y,m,d]=s.split('-').map(Number);
    // meio-dia local evita qualquer virada/offset
    return new Date(y, m-1, d, 12, 0, 0, 0);
  }
  function fmtLocal(s){
    const [y,m,d]=s.split('-').map(Number);
    const dt = new Date(y, m-1, d, 12, 0, 0, 0);
    const dd = String(d).padStart(2,'0');
    return `${dd}/${meses[m-1]} (${dias[dt.getDay()]})`;
  }

  // 2.3 inicializa input se vazio
  if (!dp.value) dp.value = ymdLocal(new Date());

  // 2.4 render no topo sem offset
  function renderTopDate(){ dateTop.textContent = fmtLocal(dp.value); }
  renderTopDate();

  // 2.5 abrir seletor (sem prompt)
  dateTop.addEventListener('click', () => {
    // Android/Chrome e iOS modernos
    if (typeof dp.showPicker === 'function') {
      dp.showPicker();
    } else {
      // fallback suave
      dp.focus();
      dp.click();
    }
  });

  // 2.6 ao trocar a data
  dp.addEventListener('change', () => {
    // normaliza para AAAA-MM-DD local (alguns navegadores podem devolver outro formato)
    const s = dp.value;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      dp.value = s;
    } else if (!isNaN(dp.valueAsDate?.getTime())) {
      dp.value = ymdLocal(dp.valueAsDate);
    }
    renderTopDate();
    // notifica o app (caso você já use esse evento)
    try{ window.dispatchEvent(new CustomEvent('vida:date:change',{detail:{ymd:dp.value}})); }catch(_){}
    // se tiver sua função própria, descomente:
    // if (typeof window.loadDay === 'function') window.loadDay(dp.value);
  });
})();
