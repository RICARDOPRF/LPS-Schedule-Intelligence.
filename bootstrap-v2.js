(()=>{
  'use strict';
  const $=s=>document.querySelector(s);
  let triggered=false;

  function showStatus(msg,kind='info'){
    let el=$('#engineStatus');
    if(!el){el=document.createElement('div');el.id='engineStatus';el.style.cssText='position:fixed;right:18px;bottom:18px;z-index:9999;max-width:500px;padding:12px 16px;border-radius:12px;background:#1e3a8a;color:white;box-shadow:0 10px 30px #0003;font:600 13px/1.4 Inter,Arial,sans-serif';document.body.appendChild(el)}
    el.textContent=msg;el.style.background=kind==='error'?'#991b1b':kind==='ok'?'#14532d':'#1e3a8a';clearTimeout(showStatus.timer);showStatus.timer=setTimeout(()=>{if(el)el.remove()},5500);
  }
  function loadFirebase(){
    if(document.querySelector('script[data-lps-firebase]'))return;
    const f=document.createElement('script');f.type='module';f.src='firebase-init.js?v=20260909-4';f.dataset.lpsFirebase='1';f.onerror=()=>showStatus('Falha ao inicializar o Firebase.','error');f.onload=()=>{
      if(!document.querySelector('script[data-lps-auth-gate]')){const a=document.createElement('script');a.src='auth-gate-v2.js?v=20260909-1';a.dataset.lpsAuthGate='2';a.onerror=()=>showStatus('Falha ao carregar a tela de login.','error');document.head.appendChild(a)}
      if(!document.querySelector('script[data-lps-schedule-history]')){const h=document.createElement('script');h.src='schedule-history-v1.js?v=20260909-1';h.dataset.lpsScheduleHistory='1';h.onerror=()=>showStatus('Falha ao carregar o histórico de análises.','error');document.head.appendChild(h)}
    };document.head.appendChild(f);
  }
  function loadMultiobra(){
    if(document.querySelector('script[data-lps-multiobra]'))return;
    const m=document.createElement('script');m.src='multiobra-v1.js?v=20260909-5';m.dataset.lpsMultiobra='1';m.onerror=()=>showStatus('Falha ao carregar o motor Multiobra.','error');document.head.appendChild(m);
  }
  function loadCurveSelection(){
    if(document.querySelector('script[data-lps-curve-selection]'))return;
    const c=document.createElement('script');c.src='curve-selection-v1.js?v=20260909-1';c.dataset.lpsCurveSelection='1';c.onerror=()=>showStatus('Falha ao carregar a seleção de obras para Curva S.','error');document.head.appendChild(c);
  }
  function loadTemplateExporter(){
    if(document.querySelector('script[data-lps-template-exporter]'))return;
    const s=document.createElement('script');s.src='panel-export-v5.js?v=20260909-3';s.dataset.lpsTemplateExporter='5';s.onerror=()=>showStatus('Falha ao carregar o motor de Curva S / Histograma. Atualize a página.','error');
    s.onload=()=>{if(!document.querySelector('script[data-lps-auto-preview]')){const p=document.createElement('script');p.src='auto-preview-v1.js?v=20260909-3';p.dataset.lpsAutoPreview='1';p.onerror=()=>showStatus('Falha ao carregar a geração automática das prévias.','error');document.head.appendChild(p)}loadCurveSelection()};document.head.appendChild(s);
  }
  function loadAILayer(){
    if(document.querySelector('script[data-lps-ai-layer]'))return;
    const bridge=document.createElement('script');bridge.src='ai-bridge-v2.js?v=20260909-1';bridge.dataset.lpsAiBridge='2';bridge.onerror=()=>showStatus('Falha ao carregar a ponte da IA.','error');bridge.onload=()=>{const a=document.createElement('script');a.src='ai-layer-v1.js?v=20260909-4';a.dataset.lpsAiLayer='1';a.onerror=()=>showStatus('Falha ao carregar a camada GPT-5.6 Sol.','error');document.head.appendChild(a)};document.head.appendChild(bridge);
  }
  async function health(){try{const base=(localStorage.getItem('lps_api_base')||window.LPS_SCHEDULE_CONFIG?.apiBase||'').replace(/\/$/,'');if(!base)return;const r=await fetch(base+'/health',{cache:'no-store'});if(r.ok){window.LPS_ENGINE_HEALTH=await r.json();document.documentElement.dataset.lpsApiVersion=window.LPS_ENGINE_HEALTH?.version||''}}catch(e){console.warn('LPS health unavailable',e)}}

  function runAfterImport(){
    if(triggered)return;const workspace=$('#workspace');if(!workspace||workspace.hidden)return;triggered=true;
    showStatus('Cronograma lido. Separando Obras → Áreas → Disciplinas, reconciliando HH e preparando IA…');
    setTimeout(()=>$('#btnRunAudit')?.click(),180);setTimeout(()=>$('#btnBuildReport')?.click(),520);setTimeout(()=>window.LPS_MULTIOBRA?.render?.(),620);setTimeout(()=>window.LPS_AUTO_PREVIEW?.prepareAll?.(false),760);setTimeout(()=>window.LPS_CURVE_SELECTION?.render?.(),900);
    setTimeout(()=>showStatus('Análise base concluída. Selecione GERAL, Obra, Área ou Disciplina para recalcular Curva S e Histograma.','ok'),1600);
  }

  window.addEventListener('DOMContentLoaded',()=>{
    loadFirebase();loadMultiobra();loadTemplateExporter();loadAILayer();health();
    const workspace=$('#workspace');if(workspace)new MutationObserver(runAfterImport).observe(workspace,{attributes:true,attributeFilter:['hidden']});
    $('#scheduleFile')?.addEventListener('change',()=>{triggered=false});
    $('#btnAnalyze')?.addEventListener('click',()=>{triggered=false;showStatus('Lendo todas as tarefas, WBS, campos, recursos e distribuições diárias…')},true);
  });
})();
