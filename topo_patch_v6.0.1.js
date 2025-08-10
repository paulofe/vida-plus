/*! Vida+ v6.0.1 – Patch Topo (consolidado)
   Escopo: SOMENTE TOPO, em cima da v6.0.0.
   - Deixa topo flutuante (sticky) sem alterar layout abaixo
   - Corrige espaço no " / 100"
   - Garante data correta (local) e datepicker confiável (iOS/desktop)
   - NÃO muda outras sessões. Seguro para remover depois.
*/
(function(){
  const PATCH_ID = 'vida-topo-601';

  // ---------- Utils
  function injectCSS(cssText){
    const id = PATCH_ID + '-css';
    if (document.getElementById(id)) return;
    const s = document.createElement('style');
    s.id = id;
    s.textContent = cssText;
    document.head.appendChild(s);
  }
  function ready(fn){
    if (document.readyState === 'complete' || document.readyState === 'interactive') fn();
    else document.addEventListener('DOMContentLoaded', fn, {once:true});
  }
  function toYmdLocal(d){
    const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  function fromYmdLocal(s){
    const [y,m,d]=s.split('-').map(Number);
    return new Date(y, m-1, d);
  }
  function fmtPtShort(d){
    const o={day:'2-digit',month:'short',weekday:'short'};
    return d.toLocaleDateString('pt-BR',o).replace('.', '');
  }

  // ---------- CSS: topo flutuante e grid estável
  ready(function(){
    injectCSS(`
      header#hdr{position:sticky;top:0;z-index:1000;backdrop-filter:blur(8px);background:rgba(14,1,34,.78);}
      main{overflow:visible;}
      header#hdr{display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:12px;}
      header#hdr .vida-brand{font-weight:700;font-size:22px;}
      header#hdr .vida-score{justify-self:center;}
      header#hdr .vida-date-btn{justify-self:end;padding:6px 10px;border-radius:10px;background:transparent;border:1px solid rgba(255,255,255,.15);}
      input.vida-date-hidden{position:absolute;left:-9999px;opacity:0;pointer-events:none;}
      @media (max-width:390px){
        header#hdr{grid-template-columns:1fr auto;grid-template-areas:"brand date" "score score";}
        header#hdr .vida-brand{grid-area:brand;}
        header#hdr .vida-score{grid-area:score;justify-self:center;}
        header#hdr .vida-date-btn{grid-area:date;justify-self:end;}
      }
    `);
  });

  // ---------- Espaço no " / 100" e reforço de marcação
  ready(function(){
    const hdr = document.getElementById('hdr') || document.querySelector('header');
    if(!hdr) return;
    // Marca elementos se já existirem; senão cria wrappers leves (não invasivo)
    if(!hdr.querySelector('.vida-brand')){
      const h1 = hdr.querySelector('h1, .brand, .logo') || hdr.firstElementChild;
      if(h1){ h1.classList.add('vida-brand'); }
    }
    let scoreBox = hdr.querySelector('.vida-score');
    if(!scoreBox){
      // tenta detectar a nota pelo conteúdo "/100"
      const candidates = [...hdr.querySelectorAll('*')].filter(el => /\/\s*100/.test(el.textContent||''));
      scoreBox = candidates[0];
      if(scoreBox) scoreBox.classList.add('vida-score');
    }
    if(scoreBox){
      // Padroniza span para garantir o espaço
      const txt = (scoreBox.textContent||'').trim();
      const m = txt.match(/(\d+)\s*\/\s*100/);
      if(m){
        scoreBox.innerHTML = `<span id="topScore">${m[1]}</span><span id="topOutOf"> / 100</span>`;
      }else{
        // se não encontrar, força apenas o replace seguro
        scoreBox.textContent = txt.replace(/\s*\/\s*100/g,' / 100');
      }
    }
  });

  // ---------- Data correta + datepicker confiável
  (function(){
    const LS_KEY = 'vida.currentYmd';

    function getCurrentYmd(){
      try{
        const s = localStorage.getItem(LS_KEY);
        if(s && /^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      }catch(e){}
      const today = toYmdLocal(new Date());
      try{ localStorage.setItem(LS_KEY, today); }catch(e){}
      return today;
    }
    function setCurrentYmd(ymd){
      try{ localStorage.setItem(LS_KEY, ymd); }catch(e){}
      // Se o app principal expor funções, usamos
      if(typeof window.setCurrentYmd === 'function'){ try{ window.setCurrentYmd(ymd); }catch(e){} }
      else if(typeof window.loadDay === 'function'){ try{ window.loadDay(ymd); }catch(e){} }
      // Notifica
      try{ window.dispatchEvent(new CustomEvent('vida:date:change',{detail:{ymd}})); }catch(e){}
    }
    function enhance(){
      const hdr = document.getElementById('hdr') || document.querySelector('header');
      if(!hdr) return;
      // botão
      let btn = hdr.querySelector('.vida-date-btn');
      if(!btn){
        btn = document.createElement('button');
        btn.type='button';
        btn.className='vida-date-btn';
        hdr.appendChild(btn);
      }
      // input oculto
      let input = document.getElementById('vidaDateInputPatch');
      if(!input){
        input = document.createElement('input');
        input.type='date';
        input.className='vida-date-hidden';
        input.id='vidaDateInputPatch';
        hdr.appendChild(input);
      }
      function render(){
        const ymd = getCurrentYmd();
        input.value = ymd;
        btn.textContent = fmtPtShort(fromYmdLocal(ymd));
      }
      render();
      btn.addEventListener('click', ()=>{
        try{
          if(input.showPicker) input.showPicker();
          else input.click();
        }catch(e){
          const cur = getCurrentYmd();
          const s = prompt('Digite a data (AAAA-MM-DD):', cur);
          if(s && /^\d{4}-\d{2}-\d{2}$/.test(s)){ setCurrentYmd(s); render(); }
        }
      });
      input.addEventListener('change', (e)=>{
        const v = e.target.value;
        if(v){ setCurrentYmd(v); render(); }
      });
      window.addEventListener('vida:date:change', render);
      setTimeout(render, 50);
    }
    ready(enhance);
  })();

  try{ console.log('[Vida+ patch topo v6.0.1] aplicado'); }catch(e){}
})();
