
/* Vida+ v5.1.3 — app completo (login, render, supabase diag, CSV, projeção, espaçamentos) */
const pad=(n)=>String(n).padStart(2,'0');
const months=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const days=['dom','seg','ter','qua','qui','sex','sáb'];
const toKey=(d=new Date())=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const fromKey=(k)=>{const [y,m,d]=k.split('-').map(Number); return new Date(y,m-1,d);};
const fmtTop=(d)=>`${pad(d.getDate())}/${months[d.getMonth()]} (${days[d.getDay()]})`;
const $=(id)=>document.getElementById(id);
const WEIGHTS={ sleep:25, food:45, exercise:15, water:10, mind:5 };
const LS='vida_plus_days_v1', LSCFG='vida_plus_cfg_v1', LSLAST='vida_plus_meta_v1';
const state={ currentKey: toKey(), cache:{}, config: { metaSleepH:7, metaWaterML:2500, cupML:250, startCampaign: toKey(), endCampaign:'', weightTarget:81, walkGoalMin:30, coffeeLimit:3, alcoholLimit:1 } };

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
    let deltaTxt=''; if(delta!==null){ if(delta<0) deltaTxt=`<span>(↓ ${Math.abs(delta).toFixed(1)} kg)</span>`; else if(delta>0) deltaTxt=`<span class="bad">(↑ +${delta.toFixed(1)} kg)</span>`; else deltaTxt=`<span class="warn">(= 0.0 kg)</span>`; }
    secPeso.querySelector('#pesoInfo').innerHTML=`Ontem: ${fmt(ontem)} ${deltaTxt}<br>`+
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
  const lastWorkout = (localStorage.getItem(LSLAST)||'').toString();
  const suggestNext = (prev)=> prev==='A'?'B':(prev==='B'?'C':'A');
  const sug= suggestNext(lastWorkout||'C');
  const secEx=document.createElement('section');
  const walkPct=Math.min(100, Math.round((day.exercise.walkMin||0)/(state.config.walkGoalMin||30)*100));
  secEx.innerHTML=`<h2>🏃 Exercício <span class="secPts">${sDay.breakdown.exercise} / ${WEIGHTS.exercise}</span></h2>
  <div class="row">${['A','B','C'].map(n=>`<div class="chip" data-w="${n}" aria-pressed="${day.exercise.workout===n}" title="${n===sug?'Sugerido hoje':''}" style="${n===sug?'outline:1px solid #7aa7ff':''}">Treino ${n}</div>`).join('')}</div>
  <div class="col" style="margin-top:8px">
    <span class="small muted">Caminhada (min) — <span class="smallish">${walkPct}% da meta</span></span>
    <div class="row">
      <input id="walkMin" type="number" placeholder="ex: 30" value="${day.exercise.walkMin||''}" style="max-width:140px" />
      <progress id="walkProg" max="100" value="${walkPct}" style="flex:1"></progress>
    </div>
  </div>`;
  main.appendChild(secEx);
  secEx.querySelectorAll('[data-w]').forEach(b=>{ b.onclick=()=>{ const n=b.dataset.w; day.exercise.workout=(day.exercise.workout===n)?'':n; if(day.exercise.workout) localStorage.setItem(LSLAST, day.exercise.workout); saveLocal(); setTop(); renderAll(); SYNC.upsertDay(state.currentKey); }; });
  secEx.querySelector('#walkMin').onchange=(e)=>{ const v=parseInt(e.target.value||'0',10); day.exercise.walkMin=isNaN(v)?0:v; saveLocal(); setTop(); renderAll(); SYNC.upsertDay(state.currentKey); };

  // MENTE
  const secMind=document.createElement('section');
  secMind.innerHTML=`<h2>🧠 Mente <span class="secPts">${sDay.breakdown.mind} / ${WEIGHTS.mind}</span></h2>
  <div class="row"><div class="chip" data-m="read" aria-pressed="${day.mind.read}">📖 Leitura</div><div class="chip" data-m="book" aria-pressed="${day.mind.book}">✍️ Livro</div><div class="chip" data-m="meditate" aria-pressed="${day.mind.meditate}">🧘 Meditar</div></div>`;
  main.appendChild(secMind);
  secMind.querySelectorAll('[data-m]').forEach(b=>{ b.onclick=()=>{ const k=b.dataset.m; day.mind[k]=!day.mind[k]; saveLocal(); setTop(); renderAll(); SYNC.upsertDay(state.currentKey); }; });

  // HIDRATAÇÃO
  const secWater=document.createElement('section'); const pct=Math.min(100, Math.round((day.water.ml||0)/state.config.metaWaterML*100));
  secWater.innerHTML=`<h2>💧 Hidratação <span class="secPts">${sDay.breakdown.water} / ${WEIGHTS.water}</span></h2>
  <div class="row"><div class="chip" id="btnSubWater">−1 copo</div><div class="chip" id="btnAddWater">+ ${state.config.cupML} ml</div><div class="right smallish muted">${pct}%</div></div>
  <div class="row" style="margin-top:6px"><progress max="${state.config.metaWaterML}" value="${day.water.ml||0}"></progress><div class="right numRight smallish muted">${day.water.ml||0} / ${state.config.metaWaterML} ml</div></div>`;
  main.appendChild(secWater);
  secWater.querySelector('#btnAddWater').onclick=()=>{ day.water.ml=(day.water.ml||0)+state.config.cupML; saveLocal(); setTop(); renderAll(); SYNC.upsertDay(state.currentKey); };
  secWater.querySelector('#btnSubWater').onclick=()=>{ day.water.ml=Math.max(0,(day.water.ml||0)-state.config.cupML); saveLocal(); setTop(); renderAll(); SYNC.upsertDay(state.currentKey); };

  // BEBIDAS
  const secBev=document.createElement('section'); const cof=day.drinks.coffee||0, alc=day.drinks.alcohol||0;
  const cofCl=cof===0?'ok':(cof<=state.config.coffeeLimit?'warn':'bad'); const alcCl=alc===0?'ok':(alc<=state.config.alcoholLimit?'warn':'bad');
  secBev.innerHTML=`<h2>🥤 Bebidas</h2>
  <div class="bevGrid"><div>☕ Café</div><div class="chip" id="cMinus">−1</div><div class="chip" id="cPlus">+1</div><div class="small muted">${'☕'.repeat(Math.min(cof,12))}</div><div class="numRight ${cofCl}">${cof}</div></div>
  <div class="bevGrid"><div>🍷 Álcool</div><div class="chip" id="aMinus">−1</div><div class="chip" id="aPlus">+1</div><div class="small muted">${'🍷'.repeat(Math.min(alc,12))}</div><div class="numRight ${alcCl}">${alc}</div></div>
  <footer class="note">Não afetam a nota. Limites em configurações.</footer>`;
  main.appendChild(secBev);
  secBev.querySelector('#cPlus').onclick=()=>{ day.drinks.coffee=(day.drinks.coffee||0)+1; saveLocal(); renderAll(); SYNC.upsertDay(state.currentKey); };
  secBev.querySelector('#cMinus').onclick=()=>{ day.drinks.coffee=Math.max(0,(day.drinks.coffee||0)-1); saveLocal(); renderAll(); SYNC.upsertDay(state.currentKey); };
  secBev.querySelector('#aPlus').onclick=()=>{ day.drinks.alcohol=(day.drinks.alcohol||0)+1; saveLocal(); renderAll(); SYNC.upsertDay(state.currentKey); };
  secBev.querySelector('#aMinus').onclick=()=>{ day.drinks.alcohol=Math.max(0,(day.drinks.alcohol||0)-1); saveLocal(); renderAll(); SYNC.upsertDay(state.currentKey); };

  // HISTÓRICO
  const secHist=document.createElement('section'); const keys=Object.keys(state.cache).sort().reverse();
  let sSum=0,sN=0,wSum=0,wN=0; keys.forEach(k=>{ const s=scoreForDay(state.cache[k]).total; if(s>=0){sSum+=s;sN++;} const w=state.cache[k].weight; if(typeof w==='number'){wSum+=w;wN++;} });
  const avgS=sN?Math.round(sSum/sN):'—', avgW=wN?(wSum/wN).toFixed(1)+' kg':'—';
  secHist.innerHTML=`<h2>📚 Histórico</h2>
  <div class="histHead small muted"><div><span class="histColLabel"></span><br><span class="histAvg">&nbsp;</span></div>
  <div><span class="histColLabel"></span><br><span class="histAvg">${avgS}</span></div><div><span class="histColLabel"></span></div>
  <div class="numRight"><span class="histColLabel"></span><br><span class="histAvg">${avgW}</span></div></div><div id="histList" class="col"></div>`;
  main.appendChild(secHist);
  const list=secHist.querySelector('#histList');
  keys.forEach((k,i)=>{ const d=fromKey(k), sc=scoreForDay(state.cache[k]).total, it=state.cache[k];
    const mindIcon = (it.mind?.read||it.mind?.book||it.mind?.meditate) ? '🧠' : '';
    const coffeeQty = it.drinks?.coffee||0; const alcoholQty = it.drinks?.alcohol||0;
    const coffeeStr = coffeeQty>0 ? `☕${coffeeQty>1?' x'+coffeeQty:''}` : '';
    const alcoholStr = alcoholQty>0 ? `🍷${alcoholQty>1?' x'+alcoholQty:''}` : '';
    const coffeeCls = coffeeQty===0?'':(coffeeQty<=state.config.coffeeLimit?'warn':'bad');
    const alcoholCls = alcoholQty===0?'':(alcoholQty<=state.config.alcoholLimit?'warn':'bad');
    const waterOK = (it.water?.ml||0) >= (state.config.metaWaterML||2500) ? '💧' : '';
    const anyExercise = (it.exercise?.walkMin||0)>0 || (it.exercise?.workout||'')!=='' ? '🏃' : '';
    const icons = [mindIcon, coffeeQty?`<span class="${coffeeCls}">${coffeeStr}</span>`:'', alcoholQty?`<span class="${alcoholCls}">${alcoholStr}</span>`:'', waterOK, anyExercise].filter(Boolean).join(' ');
    const w=typeof it.weight==='number'? it.weight.toFixed(1)+' kg':'—';
    let scoreCls=''; if(sc<60) scoreCls='bad'; else if(sc<80) scoreCls='warn'; else scoreCls='';
    let deltaHtml=''; 
    if(typeof it.weight==='number'){ const prev = keys[i+1]; if(prev){ const pw=state.cache[prev]?.weight;
      if(typeof pw==='number'){ const diff=(it.weight-pw).toFixed(1);
        if(it.weight>pw) deltaHtml=` <span class="bad">(↑ +${diff})</span>`;
        else if(it.weight<pw) deltaHtml=` <span>(↓ ${Math.abs(diff)})</span>`;
        else deltaHtml=` <span class="warn">(= 0.0)</span>`;
      }}}
    const row=document.createElement('div'); row.className='histRow';
    row.innerHTML=`<div class="smallish">${pad(d.getDate())}/${months[d.getMonth()]}</div><div class="smallish ${scoreCls}">${sc||'—'}</div>
    <div class="histIcons smallish">${icons||'—'}</div><div class="numRight smallish">${w}${deltaHtml}</div>`;
    row.onclick=()=>{ state.currentKey=k; renderAll(); }; list.appendChild(row);
  });

  // GRÁFICO
  const ascKeys = Object.keys(state.cache).sort();
  drawChart(ascKeys);
  window.addEventListener('resize', ()=> drawChart(Object.keys(state.cache).sort()));
  
  // CONFIGS
  $('cfgSleep').value=state.config.metaSleepH; $('cfgWater').value=state.config.metaWaterML; $('cfgCup').value=state.config.cupML;
  $('cfgTarget').value=state.config.weightTarget; $('cfgWalk').value=state.config.walkGoalMin;
  $('cfgCoffee').value=state.config.coffeeLimit; $('cfgAlcohol').value=state.config.alcoholLimit; $('cfgStart').value=state.config.startCampaign; $('cfgEnd').value=state.config.endCampaign||'';
  $('cfgSave').onclick=()=>{ state.config.metaSleepH=Number($('cfgSleep').value||7);
    state.config.metaWaterML=Number($('cfgWater').value||2500); state.config.cupML=Number($('cfgCup').value||250);
    state.config.weightTarget=Number($('cfgTarget').value||81); state.config.walkGoalMin=Number($('cfgWalk').value||30);
    state.config.coffeeLimit=Number($('cfgCoffee').value||3); state.config.alcoholLimit=Number($('cfgAlcohol').value||1);
    state.config.startCampaign=$('cfgStart').value||toKey(); state.config.endCampaign=$('cfgEnd').value||''; saveLocal(); renderAll(); };

  $('cfgReset').onclick=()=>{ Object.assign(state.config, { metaSleepH:7, metaWaterML:2500, cupML:250, startCampaign: toKey(), endCampaign:'', weightTarget:81, walkGoalMin:30, coffeeLimit:3, alcoholLimit:1 }); saveLocal(); renderAll(); };

  // EXPORT CSV robusto
  $('btnExport').onclick = async ()=>{
    try{
      if(window.__supa){ try{ await SYNC.pullCampaign(); }catch(e){ console.warn('pull before export', e); } }
      let uid=''; try{ const r=await (supabaseClient?.auth.getUser()||Promise.resolve({data:{}})); uid=r?.data?.user?.id||'';}catch{}
      const keysAsc = Object.keys(state.cache).sort();
      const rows = [];
      rows.push([
        'user_id','date','score_total','score_sleep','score_food','score_exercise','score_water','score_mind',
        'weight','sleep_hours','sleep_quality',
        'food_breakfast','food_snack1','food_lunch','food_snack2','food_dinner',
        'exercise_walkMin','exercise_workout',
        'mind_read','mind_book','mind_meditate',
        'water_ml','drinks_coffee','drinks_alcohol'
      ].join(','));
      keysAsc.forEach(k=>{
        const d = state.cache[k]||emptyDay();
        const sc = scoreForDay(d);
        rows.push([
          uid, k, sc.total, sc.breakdown.sleep, sc.breakdown.food, sc.breakdown.exercise, sc.breakdown.water, sc.breakdown.mind,
          (d.weight??''),
          (d.sleep?.hours??''), (d.sleep?.quality??''),
          (d.food?.breakfast??0),(d.food?.snack1??0),(d.food?.lunch??0),(d.food?.snack2??0),(d.food?.dinner??0),
          (d.exercise?.walkMin??0), `"${(d.exercise?.workout||'')}"`,
          (d.mind?.read?1:0),(d.mind?.book?1:0),(d.mind?.meditate?1:0),
          (d.water?.ml??0),(d.drinks?.coffee??0),(d.drinks?.alcohol??0)
        ].join(','));
      });
      const blob = new Blob([rows.join('\n')], {type:'text/csv;charset=utf-8;'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `vida_plus_export_${toKey()}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      const m=$('cfgMsg'); if(m){ m.textContent='CSV exportado com sucesso.'; setTimeout(()=>m.textContent='',3000); }
    }catch(err){ console.error('CSV export error', err); const m=$('cfgMsg'); if(m){ m.textContent='Falha ao exportar. Veja o console.'; } }
  };

  // Diagnóstico Supabase
  $('btnDiag').onclick = async ()=>{
    const out = $('cfgMsg'); const stamp = Date.now();
    try{
      if(!supabaseClient){ out.textContent='Client não iniciado.'; return; }
      const { data:{ user }, error:ue } = await supabaseClient.auth.getUser();
      if(ue || !user){ out.textContent='Não logado.'; return; }
      const from=state.config.startCampaign||toKey();
      const pull = await supabaseClient.from('days').select('date').eq('user_id', user.id).gte('date', from).limit(1);
      if(pull.error){ out.textContent='Falha SELECT (RLS?): '+pull.error.message; return; }
      const k = state.currentKey;
      const original = JSON.parse(JSON.stringify(state.cache[k]||emptyDay()));
      const testData = JSON.parse(JSON.stringify(original));
      testData.__diagTest = { ts: stamp };
      let r = await supabaseClient.from('days').upsert({ user_id:user.id, date:k, data:testData });
      if(r.error){ out.textContent='Falha UPSERT (RLS?): '+r.error.message; return; }
      let r2 = await supabaseClient.from('days').select('data').eq('user_id', user.id).eq('date', k).single();
      if(r2.error){ out.textContent='Falha SELECT pós-upsert: '+r2.error.message; return; }
      const ok = !!r2.data?.data?.__diagTest?.ts;
      let r3 = await supabaseClient.from('days').upsert({ user_id:user.id, date:k, data: original });
      if(r3.error){ out.textContent='Gravou diagnóstico mas falhou ao restaurar: '+r3.error.message; return; }
      out.textContent = ok ? 'OK: leitura e escrita funcionando.' : 'Leu mas não encontrou eco da escrita.';
      setTimeout(()=>{ out.textContent=''; }, 5000);
    }catch(e){
      console.error('diagnóstico', e);
      out.textContent='Erro no diagnóstico. Veja o console.';
    }
  };

  // Logout e Nuke
  $('btnSignOut').onclick = async ()=>{ await supabaseClient?.auth.signOut(); location.reload(); };
  $('btnNuke').onclick = async ()=>{
    const txt = prompt('Para confirmar digite: APAGAR');
    if(txt!=='APAGAR') return;
    try{
      const { data:{ user } } = await (supabaseClient?.auth.getUser()||{data:{}});
      if(user){ await supabaseClient.from('days').delete().eq('user_id', user.id); }
    }catch(e){ console.warn('delete supa',e); }
    localStorage.removeItem(LS); localStorage.removeItem(LSCFG);
    location.reload();
  };
}

/* ===== Gráfico ===== */
function drawChart(keysAsc){
  const sec = document.getElementById('chartSec'); const cvs = document.getElementById('chartCanvas');
  if(!sec||!cvs){ return; }
  if(keysAsc.length===0){ sec.style.display='none'; return; }

  const w = Math.min(860, document.body.clientWidth - 28);
  cvs.width = w; sec.style.display = 'block';

  const ctx = cvs.getContext('2d');
  const H = cvs.height; const W = cvs.width;
  ctx.clearRect(0,0,W,H);

  const data = keysAsc.map(k=>({ k, d: state.cache[k]||emptyDay(), s: scoreForDay(state.cache[k]||emptyDay()).total }));
  const scores = data.map(o=>o.s);
  const weights = data.map(o=> typeof o.d.weight==='number' ? o.d.weight : null);

  const padL=34, padR=34, padT=10, padB=18;
  const plotW=W-padL-padR, plotH=H-padT-padB;
  const n=data.length;
  const xFor=(i)=> padL + (plotW*(i+0.5)/n);
  const barW = Math.max(2, plotW/n*0.6);

  ctx.fillStyle='rgba(255,255,255,0.18)';
  for(let i=0;i<n;i++){
    const s = Math.max(0, Math.min(100, scores[i]||0));
    const y = padT + plotH * (1 - s/100);
    const h = plotH - (y-padT);
    ctx.fillRect(xFor(i)-barW/2, y, barW, h);
  }

  const wVals = weights.filter(v=>v!=null);
  let minW, maxW;
  if(wVals.length>0){ minW = Math.min.apply(null, wVals); maxW = Math.max.apply(null, wVals); }
  if(wVals.length>0){
    if(minW==maxW){ minW-=0.5; maxW+=0.5; }
    const yW=(v)=> padT + plotH * (1 - ( (v-minW)/(maxW-minW)  ));
    ctx.beginPath();
    let first=true;
    for(let i=0;i<n;i++){
      const v=weights[i];
      if(v==null) continue;
      const x=xFor(i), y=yW(v);
      if(first){ ctx.moveTo(x,y); first=false; } else { ctx.lineTo(x,y); }
    }
    ctx.lineWidth=2; ctx.strokeStyle='#7aa7ff'; ctx.stroke();
  }

  // projeção alvo
  try{
    const start=(state.config.startCampaign||'').trim();
    const end=(state.config.endCampaign||'').trim();
    const target=Number(state.config.weightTarget||0);
    if(start && end && target){
      const startIdx = keysAsc.findIndex(k=>k>=start);
      const endIdx = (()=>{ const idx = keysAsc.findIndex(k=>k>=end); return idx>=0?idx:keysAsc.length-1; })();
      let initIdx=-1, initW=null;
      for(let i=Math.max(0,startIdx); i<keysAsc.length; i++){
        const v = state.cache[keysAsc[i]]?.weight;
        if(typeof v==='number'){ initIdx=i; initW=v; break; }
      }
      if(initIdx>=0 && initW!=null && endIdx>initIdx){
        let minAll = (typeof minW==='number')?Math.min(minW, target):target;
        let maxAll = (typeof maxW==='number')?Math.max(maxW, target):target;
        if(minAll==maxAll){ minAll-=0.5; maxAll+=0.5; }
        const yW2=(v)=> padT + plotH * (1 - ( (v-minAll)/(maxAll-minAll) ));
        const x0 = xFor(initIdx);
        const x1 = xFor(endIdx);
        const y0 = yW2(initW);
        const y1 = yW2(target);
        ctx.setLineDash([5,4]); ctx.lineWidth=1.8; ctx.strokeStyle='rgba(255,255,255,0.35)';
        ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }catch(e){ console.warn('projection error', e); }

  ctx.globalAlpha=0.3;
  ctx.font='10px system-ui, -apple-system, Segoe UI, Roboto, Arial';
  ctx.fillStyle='#bbb';
  if(n>=1){
    const first = keysAsc[0].slice(5).replace('-','/');
    const last = keysAsc[n-1].slice(5).replace('-','/');
    ctx.fillText(first, padL, H-4);
    ctx.fillText(last, W-padR-28, H-4);
  }
  ctx.globalAlpha=1;
}

/* ===== Auth + Gate ===== */
let supabaseClient=null;
function setGate(isLocked){
  const main=document.querySelector('main');
  const cfg=document.querySelector('.config');
  const chart=document.getElementById('chartSec');
  const login=document.getElementById('loginWrap');
  const center=document.getElementById('hdrCenter');
  const dateTop=document.getElementById('dateTop');
  if(isLocked){
    login.style.display='block';
    main.style.display='none';
    cfg.style.display='none';
    chart.style.display='none';
    center.style.visibility='hidden';
    dateTop.style.visibility='hidden';
  }else{
    login.style.display='none';
    main.style.display='';
    cfg.style.display='';
    chart.style.display='';
    center.style.visibility='';
    dateTop.style.visibility='';
  }
}

function setAuthStatus(text){ const el=$('authStatus'); if(el) el.textContent='Status: '+text; }

async function authInit(){
  supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  window.__supa = supabaseClient;
  setAuthStatus('conectando…');

  const { data:{ session } } = await supabaseClient.auth.getSession();
  if(session?.user){ setAuthStatus('logado como '+(session.user.email||session.user.id)); onLoginUI(); await SYNC.pullCampaign(); setGate(false); renderAll(); }
  else { setAuthStatus('deslogado'); onLogoutUI(); setGate(true); }

  supabaseClient.auth.onAuthStateChange(async (event, sess)=>{
    if(event==='SIGNED_IN' && sess?.user){ setAuthStatus('logado como '+(sess.user.email||sess.user.id)); onLoginUI(); await SYNC.pullCampaign(); setGate(false); renderAll(); }
    if(event==='SIGNED_OUT'){ setAuthStatus('deslogado'); onLogoutUI(); setGate(true); }
    if(event==='PASSWORD_RECOVERY'){ setAuthStatus('redefinição de senha iniciada'); }
  });

  const email=$('loginEmail'), pass=$('loginPass'), msg=$('loginMsg');
  $('btnSignIn').onclick=async()=>{
    msg.textContent='Entrando…';
    const { error } = await supabaseClient.auth.signInWithPassword({ email:email.value.trim(), password:pass.value });
    msg.textContent = error ? ('Erro: '+error.message) : 'OK!';
  };
  $('btnSignUp').onclick=async()=>{
    msg.textContent='Criando…';
    const { data, error } = await supabaseClient.auth.signUp({ email:email.value.trim(), password:pass.value });
    if (error) { msg.textContent = 'Erro: '+error.message; return; }
    msg.textContent = data.user?.aud ? 'Conta criada! Verifique seu e-mail para confirmar.' : 'Conta criada!';
  };
  $('btnReset').onclick=async()=>{
    msg.textContent='Enviando e-mail de redefinição…';
    const base = location.origin + (location.pathname.endsWith('/') ? location.pathname : location.pathname.replace(/[^\/]+$/, '/'));
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email.value.trim(), { redirectTo: base });
    msg.textContent = error ? ('Erro: '+error.message) : 'E-mail enviado!';
  };
}

function onLoginUI(){}
function onLogoutUI(){}

async function pullCampaign(){
  if(!supabaseClient) return;
  const { data:{ user } } = await supabaseClient.auth.getUser(); if(!user) return;
  const from=state.config.startCampaign||toKey();
  const { data, error } = await supabaseClient.from('days').select('date,data,updated_at').eq('user_id', user.id).gte('date', from).order('date',{ascending:true});
  if(error){ console.error('pull error', error); setAuthStatus('erro ao sincronizar'); return; }
  (data||[]).forEach(r=> state.cache[r.date]=r.data||{});
  saveLocal();
  setAuthStatus('sincronizado agora');
}
async function upsertDay(k){
  if(!supabaseClient) return;
  const { data:{ user } } = await supabaseClient.auth.getUser(); if(!user) return;
  const payload={ user_id:user.id, date:k, data: state.cache[k]||{} };
  const { error } = await supabaseClient.from('days').upsert(payload).select();
  if(error){ console.error('upsert error', error); setAuthStatus('erro ao salvar'); }
  else { setAuthStatus('salvo'); }
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
