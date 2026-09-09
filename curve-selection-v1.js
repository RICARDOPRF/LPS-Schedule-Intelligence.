(()=>{
'use strict';
const $=s=>document.querySelector(s);
const esc=s=>(s??'').toString().replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let renderedKey='';
const selected=new Set();

function show(msg,kind='info'){
  let el=$('#curveSelectionStatus');
  if(!el){el=document.createElement('div');el.id='curveSelectionStatus';el.style.cssText='position:fixed;right:18px;bottom:18px;z-index:10080;max-width:540px;padding:12px 16px;border-radius:12px;color:#fff;box-shadow:0 10px 30px #0003;font:700 13px/1.45 Inter,Arial,sans-serif';document.body.appendChild(el)}
  el.textContent=msg;el.style.background=kind==='error'?'#991b1b':kind==='ok'?'#166534':'#1e3a8a';clearTimeout(show.timer);show.timer=setTimeout(()=>el?.remove(),kind==='ok'?6500:10000);
}
function bumpFile(){
  const input=$('#scheduleFile'),f=input?.files?.[0];if(!f||typeof DataTransfer==='undefined'||typeof File==='undefined')return;
  try{const dt=new DataTransfer(),copy=new File([f],f.name,{type:f.type,lastModified:Date.now()+Math.floor(Math.random()*100000)});dt.items.add(copy);input.files=dt.files}catch(e){console.warn('Falha ao invalidar cache para download por obra',e)}
}
function ensureBox(){
  let box=$('#curveObraSelector');if(box)return box;
  const section=$('#curvas');if(!section)return null;
  box=document.createElement('article');box.id='curveObraSelector';box.className='panel';box.style.cssText='margin-bottom:18px;border:1px solid #bfdbfe;background:linear-gradient(180deg,#fff,#f8fbff)';
  box.innerHTML=`<div class="table-head"><div><span class="eyebrow">DOWNLOAD MULTIOBRA</span><h3 style="margin:4px 0">Escolha as obras para baixar as Curvas S</h3><small>Marque uma ou mais obras. Cada obra será gerada separadamente no template oficial.</small></div><span id="curveSelectedCount" class="pill">0 selecionadas</span></div><div id="curveObraChecks" style="display:flex;gap:10px;flex-wrap:wrap;margin:14px 0"></div><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button id="btnSelectAllObras" class="ghost" type="button">Marcar todas</button><button id="btnClearAllObras" class="ghost" type="button">Desmarcar todas</button><button id="btnDownloadSelectedCurves" class="primary" type="button">Baixar curvas selecionadas</button></div>`;
  const diag=$('#scheduleDataDiagnostics');if(diag)section.insertBefore(box,diag);else{const chart=section.querySelector('.chart-grid');section.insertBefore(box,chart)}
  $('#btnSelectAllObras').onclick=()=>{box.querySelectorAll('input[data-obra-download]').forEach(i=>{i.checked=true;selected.add(i.value)});updateCount()};
  $('#btnClearAllObras').onclick=()=>{box.querySelectorAll('input[data-obra-download]').forEach(i=>i.checked=false);selected.clear();updateCount()};
  $('#btnDownloadSelectedCurves').onclick=downloadSelected;
  const old=$('#btnGenerateCurves');if(old){old.style.display='none';old.setAttribute('aria-hidden','true')}
  return box;
}
function updateCount(){
  const box=$('#curveObraSelector');if(!box)return;selected.clear();box.querySelectorAll('input[data-obra-download]:checked').forEach(i=>selected.add(i.value));
  const c=$('#curveSelectedCount');if(c)c.textContent=`${selected.size} selecionada${selected.size===1?'':'s'}`;
  const b=$('#btnDownloadSelectedCurves');if(b){b.disabled=!selected.size;b.textContent=selected.size?`Baixar curvas selecionadas (${selected.size})`:'Selecione uma obra'}
}
function render(){
  const model=window.LPS_MULTIOBRA?.model||window.LPS_LAST_MODEL;if(!model)return;
  const obras=model.lpsHierarchy?.obras||[];const key=obras.join('|');const box=ensureBox();if(!box)return;
  if(key===renderedKey)return;renderedKey=key;
  const checks=$('#curveObraChecks');if(!checks)return;
  const hadSelection=selected.size>0;checks.innerHTML=obras.map(o=>{const checked=hadSelection?selected.has(o):true;return `<label style="display:flex;align-items:center;gap:8px;padding:10px 13px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;cursor:pointer;font-weight:800;color:#172554"><input type="checkbox" data-obra-download value="${esc(o)}" ${checked?'checked':''} style="width:17px;height:17px;accent-color:#1e3a8a"> <span>${esc(o)}</span></label>`}).join('');
  checks.querySelectorAll('input[data-obra-download]').forEach(i=>i.addEventListener('change',updateCount));updateCount();
}
async function waitEngine(timeout=12000){const start=Date.now();while(!window.LPS_TEMPLATE_ENGINE){if(Date.now()-start>timeout)throw new Error('Motor de Curva S não carregou.');await new Promise(r=>setTimeout(r,120))}return window.LPS_TEMPLATE_ENGINE}
async function downloadSelected(){
  updateCount();const obras=[...selected];if(!obras.length)return show('Selecione pelo menos uma obra.','error');
  const sector=$('#filterSector'),area=$('#filterArea'),disc=$('#filterDiscipline'),btn=$('#btnDownloadSelectedCurves');
  if(!sector)return show('Filtro de Obra não disponível.','error');
  const original={sector:sector.value,area:area?.value||'',disc:disc?.value||''};
  try{
    const engine=await waitEngine();btn.disabled=true;
    for(let i=0;i<obras.length;i++){
      const obra=obras[i];
      if(![...sector.options].some(o=>o.value===obra)){show(`A obra ${obra} não está disponível no filtro atual.`,'error');continue}
      btn.textContent=`Gerando ${i+1}/${obras.length} · ${obra}`;show(`Gerando Curva S ${i+1}/${obras.length}: ${obra}…`);
      sector.value=obra;if(area)area.value='';if(disc)disc.value='';bumpFile();
      await engine.runCurve();
      await new Promise(r=>setTimeout(r,280));
    }
    show(`${obras.length} Curva${obras.length===1?'':'s'} S gerada${obras.length===1?'':'s'} conforme as obras selecionadas.`,'ok');
  }catch(e){console.error(e);show(e.message||'Falha ao baixar as Curvas S selecionadas.','error')}
  finally{
    sector.value=original.sector;if(area)area.value=original.area;if(disc)disc.value=original.disc;bumpFile();
    sector.dispatchEvent(new Event('change',{bubbles:true}));btn.disabled=false;updateCount();
  }
}
function install(){ensureBox();render();window.addEventListener('lps-model-ready',()=>setTimeout(render,180));const timer=setInterval(()=>{render();if(window.LPS_MULTIOBRA?.model&&window.LPS_TEMPLATE_ENGINE){clearInterval(timer)}},300)}
window.LPS_CURVE_SELECTION={render,getSelected:()=>[...selected],downloadSelected};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
