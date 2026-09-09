(()=>{
  'use strict';
  const $=s=>document.querySelector(s);
  let triggered=false;

  function showStatus(msg,kind='info'){
    let el=$('#engineStatus');
    if(!el){el=document.createElement('div');el.id='engineStatus';el.style.cssText='position:fixed;right:18px;bottom:18px;z-index:9999;max-width:460px;padding:12px 16px;border-radius:12px;background:#1e3a8a;color:white;box-shadow:0 10px 30px #0003;font:600 13px/1.4 Inter,Arial,sans-serif';document.body.appendChild(el)}
    el.textContent=msg;el.style.background=kind==='error'?'#991b1b':kind==='ok'?'#14532d':'#1e3a8a';clearTimeout(showStatus.timer);showStatus.timer=setTimeout(()=>{if(el)el.remove()},5000);
  }

  function loadTemplateExporter(){
    if(document.querySelector('script[data-lps-template-exporter]'))return;
    const s=document.createElement('script');s.src='panel-export-v5.js?v=20260908-6';s.dataset.lpsTemplateExporter='5';s.onerror=()=>showStatus('Falha ao carregar o motor de Curva S / Histograma. Atualize a página.','error');
    s.onload=()=>{if(document.querySelector('script[data-lps-auto-preview]'))return;const p=document.createElement('script');p.src='auto-preview-v1.js?v=20260908-1';p.dataset.lpsAutoPreview='1';p.onerror=()=>showStatus('Falha ao carregar a geração automática das prévias.','error');document.head.appendChild(p)};document.head.appendChild(s);
  }
  function loadAILayer(){
    if(document.querySelector('script[data-lps-ai-layer]'))return;
    const a=document.createElement('script');a.src='ai-layer-v1.js?v=20260909-1';a.dataset.lpsAiLayer='1';a.onerror=()=>showStatus('Falha ao carregar a camada GPT-5.6 Sol.','error');document.head.appendChild(a);
  }
  async function health(){try{const base=(localStorage.getItem('lps_api_base')||window.LPS_SCHEDULE_CONFIG?.apiBase||'').replace(/\/$/,'');if(!base)return;const r=await fetch(base+'/health',{cache:'no-store'});if(r.ok){window.LPS_ENGINE_HEALTH=await r.json();document.documentElement.dataset.lpsApiVersion=window.LPS_ENGINE_HEALTH?.version||''}}catch(e){console.warn('LPS health unavailable',e)}}

  function runAfterImport(){
    if(triggered)return;const workspace=$('#workspace');if(!workspace||workspace.hidden)return;triggered=true;
    showStatus('Cronograma lido. Auditando lógica, gerando Curva S/Histograma e preparando análise GPT…');
    setTimeout(()=>$('#btnRunAudit')?.click(),150);setTimeout(()=>$('#btnBuildReport')?.click(),500);setTimeout(()=>window.LPS_AUTO_PREVIEW?.prepareAll?.(false),650);
    setTimeout(()=>showStatus('Análise base concluída. A camada GPT aparece na Auditoria quando estiver configurada.','ok'),1400);
  }

  window.addEventListener('DOMContentLoaded',()=>{loadTemplateExporter();loadAILayer();health();const workspace=$('#workspace');if(workspace)new MutationObserver(runAfterImport).observe(workspace,{attributes:true,attributeFilter:['hidden']});$('#scheduleFile')?.addEventListener('change',()=>{triggered=false});$('#btnAnalyze')?.addEventListener('click',()=>{triggered=false;showStatus('Lendo todas as tarefas, campos, recursos e distribuições diárias…')},true)});
})();
