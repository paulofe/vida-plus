/* Vida+ JS v4.6 (compact build) */
(()=>{
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const main=$('main'); const W={sleep:.30,meals:.45,exercise:.15,hydration:.10,mind:.05};
const CFG=JSON.parse(localStorage.getItem('vida_plus_settings')||'{}');
Object.assign(CFG,{sleepGoal:CFG.sleepGoal??7,waterGoal:CFG.waterGoal??2500,weightGoal:CFG.weightGoal??81,cup:CFG.cup??250,startDate:CFG.startDate||new Date().toISOString().slice(0,10),coffeeLimit:CFG.coffeeLimit??3,alcoholLimit:CFG.alcoholLimit??2,nameA:CFG.nameA||'Treino A',nameB:CFG.nameB||'Treino B',nameC:CFG.nameC||'Treino C'});
function saveCfg(){localStorage.setItem('vida_plus_settings',JSON.stringify(CFG))}
const today=()=>new Date().toISOString().slice(0,10); let cur=today();
function ld(k=cur){try{return JSON.parse(localStorage.getItem('vida_plus_'+k)||'{}')}catch(e){return{}}}
function sv(d,k=cur){const m=Object.assign(ld(k),d,{dateKey:k,updated_at:new Date().toISOString()});localStorage.setItem('vida_plus_'+k,JSON.stringify(m));renderAll()}
function arr(k,n){try{return JSON.parse(localStorage.getItem('vida_plus_'+k+'_'+n)||'[]')}catch(e){return[]}}
function setArr(k,n,a){localStorage.setItem('vida_plus_'+k+'_'+n,JSON.stringify(a))}
function sec(t,id){return `<section id="${id}"><h2>${t}</h2><div class="content"></div></section>`}
main.innerHTML=sec('⚖️ Peso','sWeight')+sec('😴 Sono <span class="secPts" id="ptsSleep">0 / 30</span>','sSleep')+
sec('🍽️ Alimentação <span class="secPts" id="ptsMeals">0 / 45</span>','sMeals')+
sec('🏃 Exercício <span class="secPts" id="ptsEx">0 / 15</span>','sEx')+
sec('🧠 Mente <span class="secPts" id="ptsMind">0 / 5</span>','sMind')+
sec('💧 Hidratação <span class="secPts" id="ptsHyd">0 / 10</span>','sHyd')+
sec('🥤 Bebidas','sBev')+
`<section id="sAct"><h2>⚙️ Ações</h2><div class="grid g2">
<button id="saveBtn" class="btn">Salvar agora</button><button id="closeBtn" class="btn secondary">Fechar o dia</button></div>
<details><summary>Configurações</summary><div class="grid g2" style="margin-top:8px">
<div><label class="small muted">Meta de sono (h)</label><input id="cfgSleep" type="number" step="0.25"></div>
<div><label class="small muted">Meta de água (ml)</label><input id="cfgWater" type="number" step="100"></div>
</div><div class="grid g2" style="margin-top:8px">
<div><label class="small muted">Peso alvo (kg)</label><input id="cfgGoal" type="number" step="0.1"></div>
<div><label class="small muted">Copo padrão (ml)</label><input id="cfgCup" type="number"></div>
</div><div class="grid g2" style="margin-top:8px">
<div><label class="small muted">Data inicial</label><input id="cfgStart" type="date"></div>
<div><label class="small muted">Limites (café/álcool)</label><div class="row"><input id="cfgCoffee" type="number" style="max-width:100px"><input id="cfgAlc" type="number" style="max-width:100px"></div></div>
</div><div class="row" style="margin-top:8px"><button id="reset" class="chip">Corrigir cache</button></div></details></section>`+
`<section id="sHist"><h2>📚 Histórico</h2>
<div class="histHead"><div></div><div class="numRight"><div class="histColLabel">Nota</div><div class="histAvg" id="avgNote">—</div></div><div><div class="histColLabel">Ícones</div><div class="histAvg" id="avgIcons"></div></div><div class="numRight"><div class="histColLabel">Peso</div><div class="histAvg" id="avgWeight">—</div></div></div>
<div id="histList" class="col"></div></section>`;
function rowStars(n,id){return `<div class="stars" id="${id}">${'<div class="star"><span>★</span></div>'.repeat(n)}</div>`}
$('#sWeight .content').innerHTML=`<div class="grid g2"><div><div class="row" style="flex-wrap:nowrap">
<input id="wToday" type="number" step="0.1" style="max-width:140px"><span class="smallish muted">kg</span><button id="wOk" class="chip">OK</button>
</div><div id="wPrevRow" class="small" style="display:none">Ontem: <span id="wPrev"></span> <span id="wDelta" class="muted"></span></div>
<div class="small">Meta: <span id="wGoal"></span> (<span id="wLeft">—</span> para chegar)</div></div></div>`;
$('#sSleep .content').innerHTML=`<div class="grid g2"><div><label class="small muted">Horas dormidas</label>
<input id="sHours" type="number" step="0.25" style="max-width:140px"><div class="small">Meta: <span id="sGoal"></span> h <span id="sOk" class="muted"></span></div></div>
<div><label class="small muted">Qualidade</label>${rowStars(3,'sQual')}</div></div>`;
$('#sMeals .content').innerHTML=['Café da manhã','Lanche manhã','Almoço','Lanche tarde','Jantar'].map((n,i)=>{
 const ids=['cafe','lman','alm','ltar','jan'][i]; return `<div class="row"><div style="min-width:120px" class="mealName" data-k="${ids}">${n}</div>${rowStars(3,'m_'+ids)}</div>`}).join('')+
`<footer class="note">Toque no nome para limpar.</footer>`;
$('#sEx .content').innerHTML=`<div class="small muted" id="exPrev"></div>
<div class="row"><span id="exA" class="chip" aria-pressed="false">Treino A</span><span id="exB" class="chip" aria-pressed="false">Treino B</span><span id="exC" class="chip" aria-pressed="false">Treino C</span></div>
<div class="grid g2"><div><label class="small muted">Caminhada (min)</label><input id="exMin" type="number" step="5" placeholder="ex: 30"></div></div>`;
$('#sMind .content').innerHTML=`<div class="row" style="gap:8px"><span id="mRead" class="chip">📖 Ler</span><span id="mBook" class="chip">✍️ Livro</span><span id="mMed" class="chip">🧘‍♂️ Meditar</span></div>`;
$('#sHyd .content').innerHTML=`<div class="row"><button id="hUndo" class="chip">−1 copo</button><button id="hAdd" class="chip">+ <span id="cupLbl">250</span> ml</button><div class="right small" id="hPct">0%</div></div>
<div class="row" style="margin-top:6px;align-items:center"><div style="flex:1"><progress id="hProg" max="2500" value="0"></progress></div>
<div class="right small muted"><span id="hTot">0</span> / <span id="hGoal">2500</span> ml</div></div>`;
$('#sBev .content').innerHTML=`<div class="bevGrid"><div>☕ Café</div><button id="cUndo" class="chip">−1</button><button id="cAdd" class="chip">+1</button><div id="cIcons" class="small">—</div><div id="cNum" class="bevNum small">0</div></div>
<div class="bevGrid" style="margin-top:6px"><div>🍷 Álcool</div><button id="aUndo" class="chip">−1</button><button id="aAdd" class="chip">+1</button><div id="aIcons" class="small">—</div><div id="aNum" class="bevNum small">0</div></div>
<footer class="note">Não afetam a nota. Limites em configurações.</footer>`;
// header date/score
function fmtTop(){const d=new Date(cur);const m=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][d.getUTCMonth()];const w=['dom','seg','ter','qua','qui','sex','sab'][d.getUTCDay()];const dd=('0'+d.getUTCDate()).slice(-2);$('#dateTop').textContent=`${dd}/${m} (${w})`}
function starify(qSel, n, on){const nodes=$$(qSel+' .star'); const set=v=>{nodes.forEach((e,i)=>e.classList.toggle('active',i<v)); on&&on(v)}; nodes.forEach((e,i)=>e.onclick=()=>set(i+1)); return set }
const setQual=starify('#sQual',3,n=>sv({sleepQuality:n}));
['cafe','lman','alm','ltar','jan'].forEach(id=>{ starify('#m_'+id,3,()=>sv({mealRatings:getMeals()})); $('.mealName[data-k="'+id+'"]').onclick=()=>{$$('#m_'+id+' .star').forEach(s=>s.classList.remove('active')); sv({mealRatings:getMeals()})}; });
function pressed(id){const e=$(id); const on=e.getAttribute('aria-pressed')==='true'; e.setAttribute('aria-pressed', on?'false':'true'); }
$('#exA').onclick=()=>{pressed('#exA'); sv({muscs:getMuscs()})}; $('#exB').onclick=()=>{pressed('#exB'); sv({muscs:getMuscs()})}; $('#exC').onclick=()=>{pressed('#exC'); sv({muscs:getMuscs()})};
$('#exMin').onchange=()=>sv({exerciseMins:parseInt($('#exMin').value)||0});
$('#mRead').onclick=()=>{pressed('#mRead'); sv({mind:getMind()})}; $('#mBook').onclick=()=>{pressed('#mBook'); sv({mind:getMind()})}; $('#mMed').onclick=()=>{pressed('#mMed'); sv({mind:getMind()})};
$('#hAdd').onclick=()=>{const a=arr(cur,'waterEvents'); a.push(CFG.cup); setArr(cur,'waterEvents',a); updWater()}
$('#hUndo').onclick=()=>{const a=arr(cur,'waterEvents'); a.pop(); setArr(cur,'waterEvents',a); updWater()}
$('#cAdd').onclick=()=>{const d=ld(); sv({coffeeCount:(d.coffeeCount||0)+1}); updBev()}; $('#cUndo').onclick=()=>{const d=ld(); sv({coffeeCount:Math.max(0,(d.coffeeCount||0)-1)}); updBev()}
$('#aAdd').onclick=()=>{const d=ld(); sv({alcoholCount:(d.alcoholCount||0)+1}); updBev()}; $('#aUndo').onclick=()=>{const d=ld(); sv({alcoholCount:Math.max(0,(d.alcoholCount||0)-1)}); updBev()}
$('#wOk').onclick=()=>{const v=parseFloat($('#wToday').value); if(!isNaN(v)) sv({weight:v}); labels(); hist(); }
$('#sHours').onchange=()=>sv({sleepHours:parseFloat($('#sHours').value)||0});
$('#saveBtn').onclick=()=>sv(ld());
$('#closeBtn').onclick=()=>{const d=ld(); let t=''; if(d.muscs?.A) t=CFG.nameA; else if(d.muscs?.B) t=CFG.nameB; else if(d.muscs?.C) t=CFG.nameC; sv({prevWorkout:t}); alert('Dia fechado')}
$('#cfgSleep').value=CFG.sleepGoal; $('#cfgWater').value=CFG.waterGoal; $('#cfgGoal').value=CFG.weightGoal; $('#cfgCup').value=CFG.cup; $('#cfgStart').value=CFG.startDate; $('#cfgCoffee').value=CFG.coffeeLimit; $('#cfgAlc').value=CFG.alcoholLimit;
['cfgSleep','cfgWater','cfgGoal','cfgCup','cfgStart','cfgCoffee','cfgAlc'].forEach(id=>{$('#'+id).onchange=()=>{Object.assign(CFG,{sleepGoal:parseFloat($('#cfgSleep').value)||CFG.sleepGoal,waterGoal:parseFloat($('#cfgWater').value)||CFG.waterGoal,weightGoal:parseFloat($('#cfgGoal').value)||CFG.weightGoal,cup:parseFloat($('#cfgCup').value)||CFG.cup,startDate:$('#cfgStart').value||CFG.startDate,coffeeLimit:parseInt($('#cfgCoffee').value)||CFG.coffeeLimit,alcoholLimit:parseInt($('#cfgAlc').value)||CFG.alcoholLimit}); saveCfg(); labels(); updWater(); updBev(); hist(); renderAll(); }});
$('#reset').onclick=async()=>{if(confirm('Limpar cache e recarregar?')){try{const r=await navigator.serviceWorker.getRegistrations(); for(const x of r) await x.unregister();}catch(e){} localStorage.clear(); location.reload();}}
function getMeals(){const m={}; ['cafe','lman','alm','ltar','jan'].forEach((id,i)=>{m[['cafe','lanche_manha','almoco','lanche_tarde','jantar'][i]]=$$('#m_'+id+' .star.active').length}); return m}
function getMuscs(){return {A:$('#exA').getAttribute('aria-pressed')==='true',B:$('#exB').getAttribute('aria-pressed')==='true',C:$('#exC').getAttribute('aria-pressed')==='true'}}
function getMind(){return {read:$('#mRead').getAttribute('aria-pressed')==='true',book:$('#mBook').getAttribute('aria-pressed')==='true',meditation:$('#mMed').getAttribute('aria-pressed')==='true'}}
function parts(d){function sleep(h,q,g){if(!h) return 0; const ratio=Math.min(h/g,g/h); return Math.max(0,Math.min(1,ratio*((q||0)/3)))}; 
const ms={0:0,1:0,2:.6,3:1}; const meal=(()=>{const k=['cafe','lanche_manha','almoco','lanche_tarde','jantar']; const v=k.map(x=>ms[(d.mealRatings||{})[x]||0]); return v.reduce((a,b)=>a+b,0)/k.length})();
const ex=Math.min(1,(Math.min((d.exerciseMins||0)/30,1)*.6)+((d.muscs&&(d.muscs.A||d.muscs.B||d.muscs.C))?.4:0));
const mind=((d.mind?.read? .4:0)+(d.mind?.book? .3:0)+(d.mind?.meditation? .3:0)); const hyd=Math.min(1,(d.waterTotal||0)/(CFG.waterGoal||1));
const sl=sleep(d.sleepHours||0,d.sleepQuality||0,CFG.sleepGoal); return {sleep:sl, meals:meal, exercise:ex, mind:Math.min(1,mind), hydration:hyd}}
function total(d){const p=parts(d); return Math.round(p.sleep*W.sleep*100 + p.meals*W.meals*100 + p.exercise*W.exercise*100 + p.hydration*W.hydration*100 + p.mind*W.mind*100)}
function labels(){const d=ld(cur), y=new Date(Date.parse(cur)-86400000).toISOString().slice(0,10), yd=ld(y);
$('#wGoal').textContent=(CFG.weightGoal).toFixed(1)+' kg'; if(yd.weight!=null){$('#wPrevRow').style.display='block'; $('#wPrev').textContent=(yd.weight).toFixed(1)+' kg';
if(d.weight!=null){const df=+(d.weight-yd.weight).toFixed(1); $('#wDelta').textContent=' ('+(df>0?'+':'')+df+' kg)'; $('#wDelta').style.color=df<0?'#58d68d':(df>0?'#ff6b6b':'#aaa'); }}
else{$('#wPrevRow').style.display='none'}; $('#wLeft').textContent=(d.weight!=null? Math.max(0,(d.weight-CFG.weightGoal)).toFixed(1)+' kg':'—')}
function updWater(){const a=arr(cur,'waterEvents'); const tot=a.reduce((x,y)=>x+y,0); $('#hProg').max=CFG.waterGoal; $('#hGoal').textContent=CFG.waterGoal; $('#hTot').textContent=tot; const pct=CFG.waterGoal? Math.min(100,Math.round(100*tot/CFG.waterGoal)):0; $('#hPct').textContent=pct+'%'; sv({waterTotal:tot})}
function updBev(){const d=ld(); const c=d.coffeeCount||0,a=d.alcoholCount||0; $('#cIcons').innerHTML=c? '☕'.repeat(Math.min(c,5))+(c>5?'<span class=mini>x'+c+'</span>':''):'—'; $('#aIcons').innerHTML=a? '🍷'.repeat(Math.min(a,5))+(a>5?'<span class=mini>x'+a+'</span>':''):'—';
$('#cNum').className='bevNum small '+(c===0?'ok':(c<=CFG.coffeeLimit?'warn':'bad')); $('#aNum').className='bevNum small '+(a===0?'ok':(a<=CFG.alcoholLimit?'warn':'bad')); $('#cNum').textContent=c; $('#aNum').textContent=a}
function streak(){let s=0,prev=null; for(let i=0;i<365;i++){const k=new Date(Date.now()-i*86400000).toISOString().slice(0,10), d=ld(k); if(d.weight==null){if(i===0){prev=null;continue} break} if(i===0){prev=d.weight;s=1;continue} if(prev!=null && d.weight<prev){s++;prev=d.weight}else{break}} $('#streakNum').textContent=Math.max(0,s-1)}
function hist(){const list=$('#histList'); list.innerHTML=''; const start=new Date(CFG.startDate); const rows=[]; for(let i=0;i<365;i++){const dt=new Date(Date.now()-i*86400000); if(dt<start) break; const k=dt.toISOString().slice(0,10); rows.push({k,d:ld(k)})}
let sn=0,cn=0,sw=0,cw=0; rows.forEach(({k,d})=>{const n=total(d||{}); if(n>0){sn+=n;cn++} if(d&&d.weight!=null){sw+=d.weight;cw++}});
$('#avgNote').textContent=cn?Math.round(sn/cn):'—'; $('#avgWeight').textContent=cw?(sw/cw).toFixed(1)+' kg':'—';
rows.forEach(({k,d})=>{const div=document.createElement('div'); div.className='histRow'; div.onclick=()=>{cur=k; fill(ld(k)); window.scrollTo({top:0,behavior:'smooth'})};
const note=total(d||{}); const mind=(d?.mind&&(d.mind.read||d.mind.book||d.mind.meditation))?'🧠':''; const c=d?.coffeeCount||0,a=d?.alcoholCount||0;
const cc=(c===0?'ok':(c<=CFG.coffeeLimit?'warn':'bad')); const aa=(a===0?'ok':(a<=CFG.alcoholLimit?'warn':'bad'));
div.innerHTML=`<div>${k.slice(8,10)}/${['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][+k.slice(5,7)-1]}</div>
<div class="numRight">${note||'—'}</div><div class="histIcons"><span class="mini">${mind}</span> <span class="mini ${cc}">${c? '☕'.repeat(Math.min(c,3))+(c>3?'x'+c:''):''}</span> <span class="mini ${aa}">${a? '🍷'.repeat(Math.min(a,3))+(a>3?'x'+a:''):''}</span></div>
<div class="numRight">${(d&&d.weight!=null)? d.weight.toFixed(1)+' kg':'—'}</div>`; list.appendChild(div)})}
function renderPts(){const d=ld(); const p=parts(d); $('#ptsSleep').textContent=Math.round(p.sleep*W.sleep*100)+' / 30'; $('#ptsMeals').textContent=Math.round(p.meals*W.meals*100)+' / 45'; $('#ptsEx').textContent=Math.round(p.exercise*W.exercise*100)+' / 15'; $('#ptsHyd').textContent=Math.round(p.hydration*W.hydration*100)+' / 10'; $('#ptsMind').textContent=Math.round(p.mind*W.mind*100)+' / 5'}
function renderTop(){ $('#scoreTop').textContent= total(ld()); streak(); fmtTop(); }
function fill(d){ $('#wToday').value=d.weight??''; $('#sHours').value=d.sleepHours??''; setQual(d.sleepQuality||0); ['cafe','lman','alm','ltar','jan'].forEach((id,i)=>{$$('#m_'+id+' .star').forEach(s=>s.classList.remove('active')); const map={cafe:'cafe',lman:'lanche_manha',alm:'almoco',ltar:'lanche_tarde',jan:'jantar'}; const v=(d.mealRatings||{})[map[id]]||0; $$('#m_'+id+' .star').forEach((s,ix)=> s.classList.toggle('active', ix<v));}); $('#exA').setAttribute('aria-pressed',d.muscs?.A?'true':'false'); $('#exB').setAttribute('aria-pressed',d.muscs?.B?'true':'false'); $('#exC').setAttribute('aria-pressed',d.muscs?.C?'true':'false'); $('#exMin').value=d.exerciseMins||''; $('#mRead').setAttribute('aria-pressed',d.mind?.read?'true':'false'); $('#mBook').setAttribute('aria-pressed',d.mind?.book?'true':'false'); $('#mMed').setAttribute('aria-pressed',d.mind?.meditation?'true':'false'); updBev(); updWater(); labels(); renderTop(); renderPts(); }
function renderAll(){renderTop(); renderPts(); hist();}
function boot(){ $('#cupLbl').textContent=CFG.cup; $('#hProg').max=CFG.waterGoal; $('#hGoal').textContent=CFG.waterGoal; $('#sGoal').textContent=CFG.sleepGoal; $('#sOk').textContent=''; labels(); fill(ld()); }
if('serviceWorker' in navigator){ navigator.serviceWorker.register('./sw.js?v=460').catch(()=>{}); }
boot(); document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){renderAll()}});
})();