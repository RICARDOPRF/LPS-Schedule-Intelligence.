(()=>{
  'use strict';
  const $=s=>document.querySelector(s);
  let triggered=false;

  function showStatus(msg,kind='info'){
    let el=$('#engineStatus');
    if(!el){
      el=document.createElement('div');
      el.id='engineStatus';
      el.style.cssText='position:fixed;right:18px;bottom:18px;z-index:9999;max-width:420px;padding:12px 16px;border-radius:12px;background:#0f2747;color:white;box-shadow:0 10px 30px #0003;font:600 13px/1.4 Inter,Arial,sans-serif';
      document.body.appendChild(el);
    }
    el.textContent=msg;
    el.style.background=kind==='error'?'#991b1b':kind==='ok'?'#14532d':'#0f2747';
    clearTimeout(showStatus.timer);
    showStatus.timer=setTimeout(()=>{ if(el) el.remove(); },5000);
  }

  function loadPanelExporter(){
    if(document.querySelector('script[data-lps-panel-exporter]'))return;
    const s=document.createElement('script');
    s.src='panel-curve-export.js?v=20260908-1';
    s.dataset.lpsPanelExporter='1';
    s.onerror=()=>console.error('Falha ao carregar panel-curve-export.js');
    document.head.appendChild(s);
  }

  async function health(){
    try{
      const base=(localStorage.getItem('lps_api_base')||window.LPS_SCHEDULE_CONFIG?.apiBase||'').replace(/\/$/,'');
      if(!base)return;
      const r=await fetch(base+'/health',{cache:'no-store'});
      if(r.ok){
        const j=await r.json();
        window.LPS_ENGINE_HEALTH=j;
      }
    }catch(e){ console.warn('LPS health unavailable',e); }
  }

  function runAfterImport(){
    if(triggered)return;
    const workspace=$('#workspace');
    if(!workspace || workspace.hidden)return;
    triggered=true;
    showStatus('Cronograma lido. Executando auditoria, Curva S e histograma…');
    setTimeout(()=>$('#btnRunAudit')?.click(),150);
    setTimeout(()=>$('#btnGenerateCurves')?.click(),450);
    setTimeout(()=>$('#btnBuildReport')?.click(),850);
    setTimeout(()=>showStatus('Análise automática concluída.','ok'),1200);
  }

  window.addEventListener('DOMContentLoaded',()=>{
    loadPanelExporter();
    health();
    const workspace=$('#workspace');
    if(workspace){
      new MutationObserver(runAfterImport).observe(workspace,{attributes:true,attributeFilter:['hidden']});
    }
    $('#scheduleFile')?.addEventListener('change',()=>{ triggered=false; });
    $('#btnAnalyze')?.addEventListener('click',()=>{ triggered=false; showStatus('Lendo cronograma e preparando o modelo…'); },true);
  });
})();
