(()=>{
  'use strict';
  const $=s=>document.querySelector(s);
  let triggered=false;

  function showStatus(msg,kind='info'){
    let el=$('#engineStatus');
    if(!el){
      el=document.createElement('div');
      el.id='engineStatus';
      el.style.cssText='position:fixed;right:18px;bottom:18px;z-index:9999;max-width:440px;padding:12px 16px;border-radius:12px;background:#1e3a8a;color:white;box-shadow:0 10px 30px #0003;font:600 13px/1.4 Inter,Arial,sans-serif';
      document.body.appendChild(el);
    }
    el.textContent=msg;
    el.style.background=kind==='error'?'#991b1b':kind==='ok'?'#14532d':'#1e3a8a';
    clearTimeout(showStatus.timer);
    showStatus.timer=setTimeout(()=>{ if(el) el.remove(); },5000);
  }

  function loadTemplateExporter(){
    if(document.querySelector('script[data-lps-template-exporter]'))return;
    const s=document.createElement('script');
    s.src='panel-export-v3.js?v=20260908-1';
    s.dataset.lpsTemplateExporter='3';
    s.onerror=()=>console.error('Falha ao carregar panel-export-v3.js');
    document.head.appendChild(s);
  }

  async function health(){
    try{
      const base=(localStorage.getItem('lps_api_base')||window.LPS_SCHEDULE_CONFIG?.apiBase||'').replace(/\/$/,'');
      if(!base)return;
      const r=await fetch(base+'/health',{cache:'no-store'});
      if(r.ok)window.LPS_ENGINE_HEALTH=await r.json();
    }catch(e){ console.warn('LPS health unavailable',e); }
  }

  function runAfterImport(){
    if(triggered)return;
    const workspace=$('#workspace');
    if(!workspace || workspace.hidden)return;
    triggered=true;
    showStatus('Cronograma lido. Executando auditoria e preparando os geradores…');
    setTimeout(()=>$('#btnRunAudit')?.click(),150);
    setTimeout(()=>$('#btnBuildReport')?.click(),500);
    setTimeout(()=>showStatus('Análise concluída. Use “Gerar Curva S” ou “Gerar Histograma” para baixar os templates.','ok'),900);
  }

  window.addEventListener('DOMContentLoaded',()=>{
    loadTemplateExporter();
    health();
    const workspace=$('#workspace');
    if(workspace)new MutationObserver(runAfterImport).observe(workspace,{attributes:true,attributeFilter:['hidden']});
    $('#scheduleFile')?.addEventListener('change',()=>{ triggered=false; });
    $('#btnAnalyze')?.addEventListener('click',()=>{ triggered=false; showStatus('Lendo cronograma e preparando o modelo…'); },true);
  });
})();
