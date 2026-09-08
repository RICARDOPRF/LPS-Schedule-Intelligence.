(()=>{
  'use strict';
  if(document.querySelector('script[data-lps-template-exporter]'))return;
  const s=document.createElement('script');
  s.src='panel-export-v3.js?v=20260908-1';
  s.dataset.lpsTemplateExporter='3';
  s.onerror=()=>console.error('Falha ao carregar panel-export-v3.js');
  document.head.appendChild(s);
})();
