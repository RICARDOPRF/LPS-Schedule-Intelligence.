(()=>{
  'use strict';
  const $=s=>document.querySelector(s);
  let preparedKey='';
  let preparing=false;

  function fileKey(){
    const f=$('#scheduleFile')?.files?.[0];
    return f?`${f.name}|${f.size}|${f.lastModified}|${$('#baselineSelect')?.value||'current'}`:'';
  }

  function setLabels(){
    const curve=$('#btnGenerateCurves'),hist=$('#btnExportWorkbook');
    if(curve){curve.textContent='Baixar Curva S';curve.title='Baixa a Curva S já calculada no template oficial do Painel de Bordo'}
    if(hist){hist.textContent='Baixar Histograma';hist.title='Baixa o Histograma já calculado no template oficial LPS'}
  }

  function clearGeneratorToast(){
    document.querySelector('#lpsTemplateExportStatus')?.remove();
  }

  function show(msg,kind='info'){
    let el=$('#autoPreviewStatus');
    if(!el){
      el=document.createElement('div');el.id='autoPreviewStatus';
      el.style.cssText='position:fixed;right:18px;bottom:18px;z-index:10060;max-width:520px;padding:12px 16px;border-radius:12px;color:#fff;box-shadow:0 10px 30px #0003;font:700 13px/1.45 Inter,Arial,sans-serif';
      document.body.appendChild(el);
    }
    el.textContent=msg;
    el.style.background=kind==='error'?'#991b1b':kind==='ok'?'#166534':'#1e3a8a';
    clearTimeout(show.timer);show.timer=setTimeout(()=>el?.remove(),kind==='ok'?5500:9000);
  }

  async function withoutDownload(fn){
    const proto=HTMLAnchorElement.prototype,original=proto.click;
    proto.click=function(){
      if(this.hasAttribute('download')||this.download)return;
      return original.call(this);
    };
    try{return await fn()}finally{proto.click=original}
  }

  async function waitEngine(timeout=12000){
    const start=Date.now();
    while(!window.LPS_TEMPLATE_ENGINE){
      if(Date.now()-start>timeout)throw new Error('Motor de Curva S/Histograma não carregou.');
      await new Promise(r=>setTimeout(r,120));
    }
    return window.LPS_TEMPLATE_ENGINE;
  }

  async function prepareAll(force=false){
    if(preparing)return;
    const workspace=$('#workspace'),f=$('#scheduleFile')?.files?.[0];
    if(!f||!workspace||workspace.hidden||!/\.mpp$/i.test(f.name))return;
    const key=fileKey();if(!force&&preparedKey===key){setLabels();return}
    preparing=true;
    const curve=$('#btnGenerateCurves'),hist=$('#btnExportWorkbook');
    const oldCurve=curve?.textContent,oldHist=hist?.textContent;
    try{
      const engine=await waitEngine();
      if(curve){curve.disabled=true;curve.textContent='Preparando Curva S…'}
      if(hist){hist.disabled=true;hist.textContent='Preparando Histograma…'}
      show('Gerando automaticamente Curva S e Histograma a partir do Uso da Tarefa…');
      await withoutDownload(()=>engine.runCurve());
      clearGeneratorToast();
      await withoutDownload(()=>engine.runHistogram());
      clearGeneratorToast();
      const curveReady=!!window.Chart?.getChart?.($('#curveChart'));
      const histReady=!!window.Chart?.getChart?.($('#histChart'));
      if(curveReady||histReady){preparedKey=key;show('Curva S e Histograma atualizados. Os botões agora servem somente para baixar os templates.','ok')}
      else show('Não foi possível montar as prévias automaticamente. Revise a validação dos dados do Project.','error');
    }catch(e){
      console.error('Auto preview failed',e);show(e.message||'Falha ao preparar Curva S e Histograma.','error');
    }finally{
      if(curve)curve.disabled=false;if(hist)hist.disabled=false;setLabels();
      if(curve&&oldCurve==='')curve.textContent='Baixar Curva S';
      if(hist&&oldHist==='')hist.textContent='Baixar Histograma';
      preparing=false;
    }
  }

  function install(){
    setLabels();
    const workspace=$('#workspace');
    if(workspace)new MutationObserver(()=>{if(!workspace.hidden)setTimeout(()=>prepareAll(false),180)}).observe(workspace,{attributes:true,attributeFilter:['hidden']});
    $('#scheduleFile')?.addEventListener('change',()=>{preparedKey='';setLabels()});
    $('#baselineSelect')?.addEventListener('change',()=>{preparedKey='';setTimeout(()=>prepareAll(true),80)});
    setTimeout(()=>prepareAll(false),250);
  }

  window.LPS_AUTO_PREVIEW={prepareAll};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
