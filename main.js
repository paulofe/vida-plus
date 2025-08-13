// 9x9 board game — conecte vizinhos ortogonais; se sum % 9 === 0, remove seleção (sem gravidade)
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const sumEl = document.getElementById('sum');
const modEl = document.getElementById('mod');
const countEl = document.getElementById('count');
const removedEl = document.getElementById('removed');
const btnRestart = document.getElementById('btnRestart');

const GRID = 9;
const VALUES = { min: 1, max: 8 };
const PADDING = 24; // padding ao redor do grid

// Estado
const state = {
  grid: [],          // número ou 0 (vazio)
  selected: [],      // [{r,c}]
  removed: 0,
  sum: 0,
  dragging: false,
  lastPt: null,
};

function randInt(a, b){ return Math.floor(a + Math.random()*(b-a+1)); }

function initGrid(){
  state.grid = Array.from({length: GRID}, () =>
    Array.from({length: GRID}, () => randInt(VALUES.min, VALUES.max))
  );
  state.removed = 0;
  clearSelection();
  draw();
  syncHud();
}

function clearSelection(){
  state.selected.length = 0;
  state.sum = 0;
  syncHud();
}

function inBounds(r,c){ return r>=0 && r<GRID && c>=0 && c<GRID; }
function isEmpty(r,c){ return state.grid[r][c] === 0; }

function cellSize(){
  const usable = Math.min(canvas.width, canvas.height) - PADDING*2;
  return Math.floor(usable / GRID);
}

function cellRect(r,c){
  const size = cellSize();
  const x0 = Math.floor((canvas.width - size*GRID)/2);
  const y0 = Math.floor((canvas.height - size*GRID)/2);
  const x = x0 + c*size;
  const y = y0 + r*size;
  return { x, y, w: size, h: size, cx: x + size/2, cy: y + size/2 };
}

function pointToCell(px, py){
  const size = cellSize();
  const x0 = Math.floor((canvas.width - size*GRID)/2);
  const y0 = Math.floor((canvas.height - size*GRID)/2);
  const c = Math.floor((px - x0) / size);
  const r = Math.floor((py - y0) / size);
  if (!inBounds(r,c)) return null;
  const rect = cellRect(r,c);
  if (px < rect.x || py < rect.y || px >= rect.x+rect.w || py >= rect.y+rect.h) return null;
  return { r, c };
}

function areAdj(a,b){
  const dr = Math.abs(a.r - b.r);
  const dc = Math.abs(a.c - b.c);
  return (dr + dc === 1); // apenas ortogonal
}

function alreadySelected(rc){
  return state.selected.some(p => p.r===rc.r && p.c===rc.c);
}

function tryAddToSelection(rc){
  if (!inBounds(rc.r, rc.c) || isEmpty(rc.r, rc.c)) return;
  if (state.selected.length === 0){
    state.selected.push(rc);
    state.sum += state.grid[rc.r][rc.c];
  } else {
    const last = state.selected[state.selected.length-1];
    // backtrack (voltar um passo) se tocar no penúltimo
    if (state.selected.length >= 2){
      const prev = state.selected[state.selected.length-2];
      if (prev.r===rc.r && prev.c===rc.c){
        const popped = state.selected.pop();
        state.sum -= state.grid[popped.r][popped.c];
        return;
      }
    }
    if (areAdj(last, rc) && !alreadySelected(rc)){
      state.selected.push(rc);
      state.sum += state.grid[rc.r][rc.c];
    }
  }
  syncHud();
}

function commitIfValid(){
  if (state.selected.length === 0) return false;
  if (state.sum % 9 === 0){
    for (const p of state.selected){
      if (state.grid[p.r][p.c] !== 0){
        state.grid[p.r][p.c] = 0; // remove
        state.removed++;
      }
    }
    clearSelection();
    return true;
  } else {
    clearSelection();
    return false;
  }
}

function syncHud(){
  sumEl.textContent = state.sum;
  modEl.textContent = state.sum % 9;
  countEl.textContent = state.selected.length;
  removedEl.textContent = state.removed;
}

function resize(){
  // Canvas quadrado que se ajusta ao viewport
  const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  const vw = Math.min(window.innerWidth, 1024);
  const vh = window.innerHeight - 120; // header/footer aprox
  const sizeCSS = Math.min(vw - 24, vh - 24);
  canvas.style.width = sizeCSS + 'px';
  canvas.style.height = sizeCSS + 'px';
  canvas.width = Math.floor(sizeCSS * dpr);
  canvas.height = Math.floor(sizeCSS * dpr);
  draw();
}
addEventListener('resize', resize);

function draw(){
  const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  ctx.save();
  ctx.scale(dpr, dpr);
  const w = canvas.width / dpr, h = canvas.height / dpr;

  // fundo
  ctx.fillStyle = '#0b0d11';
  ctx.fillRect(0,0,w,h);

  // grid
  const size = cellSize();
  const x0 = Math.floor((w - size*GRID)/2);
  const y0 = Math.floor((h - size*GRID)/2);

  // placa do tabuleiro
  ctx.fillStyle = '#0f1318';
  ctx.fillRect(x0-4, y0-4, size*GRID+8, size*GRID+8);

  // células
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = Math.floor(size*0.42) + 'px system-ui';

  const isSel = (r,c) => state.selected.some(p=>p.r===r&&p.c===c);

  for (let r=0;r<GRID;r++){
    for (let c=0;c<GRID;c++){
      const val = state.grid[r][c];
      const {x,y,w:sw,h:sh,cx,cy} = cellRect(r,c);
      // fundo da célula
      ctx.fillStyle = isSel(r,c) ? '#214367' : (val===0 ? '#141920' : '#151b23');
      ctx.fillRect(x+1, y+1, sw-2, sh-2);

      // borda
      ctx.strokeStyle = '#243041';
      ctx.lineWidth = 1;
      ctx.strokeRect(x+0.5, y+0.5, sw-1, sh-1);

      // valor
      if (val !== 0){
        // paleta por valor
        ctx.fillStyle = ['','#a6e3a1','#94e2d5','#89b4fa','#f9e2af','#fab387','#eba0ac','#cba6f7','#f38ba8'][val];
        ctx.fillText(String(val), cx, cy);
      } else {
        // pontinho para vazio
        ctx.fillStyle = 'rgba(255,255,255,.06)';
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(2, size*0.04), 0, Math.PI*2);
        ctx.fill();
      }
    }
  }

  // linha ligando a seleção
  if (state.selected.length>0){
    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.lineWidth = Math.max(2, size*0.06);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i=0;i<state.selected.length;i++){
      const p = state.selected[i];
      const {cx,cy} = cellRect(p.r,p.c);
      if (i===0) ctx.moveTo(cx,cy); else ctx.lineTo(cx,cy);
    }
    ctx.stroke();
  }

  // dica
  ctx.fillStyle = 'rgba(255,255,255,.12)';
  ctx.font = '12px system-ui';
  ctx.textAlign = 'left';
  ctx.fillText('Arraste para selecionar. Solte para validar.', x0, y0 - 10);

  ctx.restore();
}

// Input (mouse + touch)
function getCanvasPoint(evt){
  const rect = canvas.getBoundingClientRect();
  let x, y;
  if (evt.touches && evt.touches.length){
    x = evt.touches[0].clientX - rect.left;
    y = evt.touches[0].clientY - rect.top;
  } else {
    x = evt.clientX - rect.left;
    y = evt.clientY - rect.top;
  }
  const cssW = parseFloat(getComputedStyle(canvas).width);
  const cssH = parseFloat(getComputedStyle(canvas).height);
  const scaleX = canvas.width / cssW;
  const scaleY = canvas.height / cssH;
  return { x: x*scaleX, y: y*scaleY };
}

function pointToCellDpr(pt){
  // converte ponto em px do canvas para célula (considerando dpr)
  const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  return pointToCell(pt.x / dpr, pt.y / dpr);
}

function pointerDown(evt){
  evt.preventDefault();
  state.dragging = true;
  const pt = getCanvasPoint(evt);
  const cell = pointToCellDpr(pt);
  if (cell) { clearSelection(); tryAddToSelection(cell); draw(); }
}

function pointerMove(evt){
  if (!state.dragging) return;
  evt.preventDefault();
  const pt = getCanvasPoint(evt);
  const cell = pointToCellDpr(pt);
  if (cell){
    tryAddToSelection(cell);
    draw();
  }
}

function pointerUp(evt){
  if (!state.dragging) return;
  evt.preventDefault();
  state.dragging = false;
  commitIfValid();
  draw();
}

canvas.addEventListener('mousedown', pointerDown);
canvas.addEventListener('mousemove', pointerMove);
addEventListener('mouseup', pointerUp);

canvas.addEventListener('touchstart', pointerDown, {passive:false});
canvas.addEventListener('touchmove', pointerMove, {passive:false});
canvas.addEventListener('touchend', pointerUp, {passive:false});

btnRestart.addEventListener('click', initGrid);

// Boot
function boot(){
  resize();
  initGrid();
}
boot();