(()=>{
'use strict';
const previousFetch=window.fetch.bind(window);
function urlOf(input){return typeof input==='string'?input:input?.url||''}
window.fetch=async function(input,init={}){
  const url=urlOf(input);
  if(/\/v1\/ai\/report(?:\?|$)/.test(url)){
    let body=null;
    try{body=typeof init.body==='string'?JSON.parse(init.body):null}catch{}
    if(!body?.model){
      return new Response(JSON.stringify({opinion:'',legacySuppressed:true}),{
        status:200,
        headers:{'Content-Type':'application/json; charset=utf-8'}
      });
    }
  }
  return previousFetch(input,init);
};
window.LPS_AI_BRIDGE={version:'2.0',legacyReportSuppressed:true};
})();
