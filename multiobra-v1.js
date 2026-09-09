(()=>{
'use strict';
const $=s=>document.querySelector(s);
const rawFetch=window.fetch.bind(window);
const state={model:null,exportScope:false,engineWrapped:false,renderTimer:null,aiFindings:[]};
const norm=s=>(s??'').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const esc=s=>(s??'').toString().replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const n=v=>Number(v)||0;
const GENERIC=/\b(cronograma|schedule|projeto|project|usina|planta|empreendimento|master|geral|overall|principal)\b/i;
const DISC=/\b(civil|mecan|eletric|instrument|tubul|piping|estrutura|pintura|andaime|comission|equipamento|suporte|fabric|montag|automacao|refrat|isolamento)\b/i;
const AREA_CODE=/^\s*\d{3,5}\s*[-–—]/;
function cval(t,re){for(const[k,v]of Object.entries(t.custom||{})){if(re.test(norm(k))&&String(v??'').trim())return String(v).trim()}return''}
function isGenericRoot(s){return !!s&&!AREA_CODE.test(s)&&GENERIC.test(norm(s))}
function isAreaNode(s){return AREA_CODE.test(String(s||''))}
function isDisciplineNode(s){return DISC.test(norm(s))&&!isAreaNode(s)}
function cleanArea(s){return String(s||'').trim().replace(/^\s*(area|área)\s*[:\-–—]\s*/i,'')}
function canonicalMacro(label){
 let s=String(label||'').trim();if(!s||isGenericRoot(s)||isAreaNode(s))return'';
 const parts=s.split(/\s*[-–—]\s*/).filter(Boolean);
 if(parts.length>1){const p=norm(parts[0]);if(/^\d+$/.test(p))return'';if(/^(o )?(civil|mecanica|mecanico|eletrica|eletrico|instrumentacao|tubulacao|montagem|fabricacao|equipamentos|comissionamento)$/.test(p))s=parts.slice(1).join(' - ');else if(/^[A-Z0-9]{2,8}$/.test(parts[0].trim())&&!/^\d+$/.test(parts[0].trim()))s=parts[0].trim()}
 s=s.replace(/^\s*(obra|unidade|setor|pacote|package|tancagem)\s+(?=\S)/i,'').trim();
 return s;
}
function canonicalDiscipline(raw,taskName=''){
 const src=norm(`${raw||''} ${taskName||''}`);
 if(!src)return'';
 if(/fabric.*(tub|pipe)|spool/.test(src))return'Fabricação de Tubulação';
 if(/montag.*(tub|pipe)/.test(src))return'Montagem de Tubulação';
 if(/suport/.test(src))return'Suportes';
 if(/instrument/.test(src)&&!/eletric/.test(norm(taskName)))return'Instrumentação';
 if(/eletric/.test(src))return'Elétrica';
 if(/automacao|automation/.test(src))return'Automação';
 if(/mecan/.test(src))return'Mecânica';
 if(/equipamento|equipment/.test(src))return'Equipamentos';
 if(/estrutura|structur|steel/.test(src))return'Estrutura';
 if(/refrat|refractory/.test(src))return'Refratário';
 if(/civil/.test(src))return'Civil';
 if(/pintura|painting|coating/.test(src))return'Pintura';
 if(/andaime|scaffold/.test(src))return'Andaime';
 if(/comission|commission|startup|start up/.test(src))return'Comissionamento';
 if(/tubul|piping|pipe\b/.test(src))return'Tubulação';
 return String(raw||'').trim();
}
function setField(t,key,value){if(!value)return;t.custom=t.custom||{};const old=t.custom[key];if(old&&norm(old)!==norm(value)&&!t.custom[`${key} Original`])t.custom[`${key} Original`]=old;t.custom[key]=value}
function enrichModel(model){
 const stack=[];let obraMissing=0,areaMissing=0,discMissing=0;
 for(const t of model.tasks||[]){
   const level=Math.max(1,Number(t.outlineLevel)||1);while(stack.length>=level)stack.pop();const parent=stack.at(-1)?.ctx||{};
   const explicitObra=cval(t,/^obra$|^setor$|^sector$|^unidade$|^unit$/);const explicitArea=cval(t,/^area$|^subarea$|^sub area$/);const explicitDisc=cval(t,/^disciplina$|^discipline$/);const phase=cval(t,/^fase$/)||parent.phase||'';
   let obra=canonicalMacro(explicitObra)||parent.obra||'';
   if(!obra&&t.summary&&!isGenericRoot(t.name)&&!isAreaNode(t.name)){const c=canonicalMacro(t.name);if(c&&!isDisciplineNode(c))obra=c}
   if(!obra){for(const p of stack){const c=canonicalMacro(p.task?.name);if(c&&!isGenericRoot(p.task?.name)&&!isAreaNode(p.task?.name)&&!isDisciplineNode(c)){obra=c;break}}}
   let area=cleanArea(explicitArea)||parent.area||'';
   if(!area&&t.summary&&isAreaNode(t.name))area=cleanArea(t.name);
   if(!area){for(let i=stack.length-1;i>=0;i--){const nm=stack[i].task?.name||'';if(isAreaNode(nm)){area=cleanArea(nm);break}}}
   let disc=canonicalDiscipline(explicitDisc||phase,t.name)||parent.disc||'';
   if(!t.summary){if(!obra)obraMissing++;if(!area)areaMissing++;if(!disc)discMissing++}
   setField(t,'Setor',obra);setField(t,'Area',area);setField(t,'Disciplina',disc);
   t.lpsObra=obra;t.lpsArea=area;t.lpsDiscipline=disc;
   if(t.summary)stack.push({task:t,ctx:{obra,area,disc,phase}});
 }
 const leaves=(model.tasks||[]).filter(t=>!t.summary),totWork=leaves.reduce((a,t)=>a+n(t.workHours),0),totActual=leaves.reduce((a,t)=>a+n(t.actualWorkHours),0);
 const obras=[...new Set(leaves.map(t=>t.lpsObra).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 const obraTotals=Object.fromEntries(obras.map(o=>[o,{tasks:leaves.filter(t=>t.lpsObra===o).length,workHours:leaves.filter(t=>t.lpsObra===o).reduce((a,t)=>a+n(t.workHours),0),actualWorkHours:leaves.filter(t=>t.lpsObra===o).reduce((a,t)=>a+n(t.actualWorkHours),0)}]));
 model.lpsHierarchy={obras,obraTotals,totalLeafTasks:leaves.length,totalWorkHours:totWork,totalActualWorkHours:totActual,obraMissing,areaMissing,discMissing};
 return model;
}
function scope(){return{obra:$('#filterSector')?.value||'',area:$('#filterArea')?.value||'',discipline:$('#filterDiscipline')?.value||''}}
function inScope(t,s=scope()){const obra=t.lpsObra||cval(t,/^setor$|^obra$/),area=t.lpsArea||cval(t,/^area$/),disc=t.lpsDiscipline||canonicalDiscipline(cval(t,/^disciplina$/),t.name);return(!s.obra||norm(obra)===norm(s.obra))&&(!s.area||norm(area)===norm(s.area))&&(!s.discipline||norm(disc)===norm(s.discipline))}
function scopedModel(model){const s=scope();if(!s.obra&&!s.area&&!s.discipline)return model;const leaves=(model.tasks||[]).filter(t=>!t.summary&&inScope(t,s)),ids=new Set(leaves.map(t=>String(t.uid))),tasks=(model.tasks||[]).filter(t=>t.summary||ids.has(String(t.uid))),assignments=(model.assignments||[]).filter(a=>ids.has(String(a.taskUid))),label=[s.obra,s.area,s.discipline].filter(Boolean).join(' · ');return{...model,project:{...(model.project||{}),name:`${model.project?.name||model.sourceName||'Cronograma'}${label?' - '+label:''}`},tasks,assignments,dailyTimephasedPoints:assignments.reduce((a,x)=>a+(x.dailyTimephased?.length||0),0),lpsScope:s}}
function responseWithJson(r,obj){const h=new Headers(r.headers);h.delete('content-length');h.delete('content-encoding');h.set('content-type','application/json; charset=utf-8');return new Response(JSON.stringify(obj),{status:r.status,statusText:r.statusText,headers:h})}
window.fetch=async function(input,init={}){
 const r=await rawFetch(input,init);const url=typeof input==='string'?input:input?.url||'';
 if(r.ok&&/\/v1\/parse\/mpp(?:\?|$)/.test(url)){
   try{const full=enrichModel(await r.clone().json());if(!state.exportScope){state.model=full;window.LPS_LAST_MODEL=full;setTimeout(()=>{window.dispatchEvent(new CustomEvent('lps-model-ready',{detail:{model:full}}));scheduleRender()},80)}return responseWithJson(r,state.exportScope?scopedModel(full):full)}catch(e){console.warn('LPS multiobra enrichment failed',e)}
 }
 return r;
};
function selectedLeaves(){return(state.model?.tasks||[]).filter(t=>!t.summary&&inScope(t))}
function ensureUI(){
 const label=$('#filterSector')?.closest('label');if(label&&label.childNodes?.[0])label.childNodes[0].nodeValue='Obra ';
 const panel=$('#multiobraPanel');if(panel)return panel;const section=$('#estrutura');if(!section)return null;
 const p=document.createElement('article');p.id='multiobraPanel';p.className='panel';p.style.cssText='margin-top:18px;border:1px solid #bfdbfe;background:linear-gradient(180deg,#fff,#f8fbff)';p.innerHTML='<div class="table-head"><div><span class="eyebrow">MULTIOBRA ENGINE</span><h3 style="margin:4px 0">Estrutura, reconciliação e escopo</h3><small>Projeto Geral → Obra → Área → Disciplina → Atividade</small></div><span id="multiobraIntegrity" class="pill">Aguardando</span></div><div id="obraTabs" style="display:flex;gap:8px;flex-wrap:wrap;margin:14px 0"></div><div id="multiobraMetrics" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px"></div><div id="multiobraReconciliation" style="margin-top:12px"></div><div id="lpsSuggestionQueue" style="margin-top:14px"></div>';
 section.appendChild(p);return p;
}
function metric(k,v){return`<div style="border:1px solid #dbeafe;border-radius:10px;padding:10px;background:#fff"><small style="display:block;color:#64748b">${esc(k)}</small><b style="display:block;margin-top:4px;color:#172554">${esc(v)}</b></div>`}
function renderTabs(h){const tabs=$('#obraTabs');if(!tabs)return;const current=$('#filterSector')?.value||'';tabs.innerHTML=[`<button class="${!current?'primary':'ghost'}" data-obra-tab="">GERAL</button>`,...(h.obras||[]).map(o=>`<button class="${current===o?'primary':'ghost'}" data-obra-tab="${esc(o)}">${esc(o)}</button>`)].join('');tabs.querySelectorAll('[data-obra-tab]').forEach(b=>b.onclick=()=>{const sel=$('#filterSector');if(!sel)return;sel.value=b.dataset.obraTab||'';sel.dispatchEvent(new Event('change',{bubbles:true}));setTimeout(()=>{renderMultiobra();window.LPS_AUTO_PREVIEW?.prepareAll?.(true)},80)})}
function renderSuggestions(){const q=$('#lpsSuggestionQueue');if(!q)return;const h=state.model?.lpsHierarchy||{},items=[];if(h.obraMissing)items.push({id:'LPS-AI-001',title:'Atividades sem Obra',text:`${h.obraMissing} atividades executivas ainda não foram associadas a uma obra.`});if(h.areaMissing)items.push({id:'LPS-AI-002',title:'Atividades sem Área',text:`${h.areaMissing} atividades executivas ainda não possuem área.`});if(h.discMissing)items.push({id:'LPS-AI-003',title:'Atividades sem Disciplina',text:`${h.discMissing} atividades executivas ainda não possuem disciplina.`});for(const f of state.aiFindings.slice(0,6))items.push({id:`LPS-AI-${String(items.length+10).padStart(3,'0')}`,title:f.title||f.category||'Melhoria sugerida pela IA',text:f.recommendation||f.impact||f.evidence||''});if(!items.length){q.innerHTML='<div class="muted-box"><b>Fila de melhorias</b><br>Nenhuma melhoria estrutural pendente detectada.</div>';return}q.innerHTML='<h4 style="margin:0 0 8px">Fila de melhorias sugeridas</h4>'+items.map(x=>`<div style="padding:10px 0;border-top:1px solid #e5e7eb"><b>${x.id} · ${esc(x.title)}</b><div style="font-size:13px;color:#475569;margin-top:3px">${esc(x.text)}</div><button class="ghost" style="margin-top:7px" data-copy-suggestion="${x.id}">Copiar ID para aprovação</button></div>`).join('');q.querySelectorAll('[data-copy-suggestion]').forEach(b=>b.onclick=()=>navigator.clipboard?.writeText(`${b.dataset.copySuggestion} — de acordo`).catch(()=>{}))}
function renderMultiobra(){
 if(!state.model)return;ensureUI();const h=state.model.lpsHierarchy||{},leaves=selectedLeaves(),scopeWork=leaves.reduce((a,t)=>a+n(t.workHours),0),scopeActual=leaves.reduce((a,t)=>a+n(t.actualWorkHours),0),classified=h.totalWorkHours-leaves.filter(t=>!t.lpsObra).reduce((a,t)=>a+n(t.workHours),0),diff=h.totalWorkHours-classified,coverage=h.totalWorkHours?classified/h.totalWorkHours*100:100,areas=new Set(leaves.map(t=>t.lpsArea).filter(Boolean)),disc=new Set(leaves.map(t=>t.lpsDiscipline).filter(Boolean));
 renderTabs(h);const m=$('#multiobraMetrics');if(m)m.innerHTML=[metric('Obras detectadas',h.obras?.length||0),metric('Áreas no escopo',areas.size),metric('Disciplinas no escopo',disc.size),metric('Atividades no escopo',leaves.length.toLocaleString('pt-BR')),metric('HH previsto no escopo',scopeWork.toLocaleString('pt-BR',{maximumFractionDigits:1})),metric('HH real no escopo',scopeActual.toLocaleString('pt-BR',{maximumFractionDigits:1}))].join('');
 const integ=$('#multiobraIntegrity');if(integ){integ.textContent=`Integridade ${coverage.toFixed(2)}%`;integ.style.background=coverage>=99.99?'#dcfce7':'#fef3c7';integ.style.color=coverage>=99.99?'#166534':'#92400e'}
 const r=$('#multiobraReconciliation');if(r)r.innerHTML=`<div class="muted-box"><b>Reconciliação:</b> ${h.obras?.length||0} obras · ${h.totalLeafTasks||0} atividades executivas · ${h.totalWorkHours?.toLocaleString('pt-BR',{maximumFractionDigits:1})||0} HH previstos. Diferença não classificada: <b>${diff.toLocaleString('pt-BR',{maximumFractionDigits:2})} HH</b>. ${h.obraMissing||0} sem Obra · ${h.areaMissing||0} sem Área · ${h.discMissing||0} sem Disciplina.</div>`;
 renderSuggestions();
}
function scheduleRender(){clearTimeout(state.renderTimer);state.renderTimer=setTimeout(renderMultiobra,220)}
function wrapEngine(){const e=window.LPS_TEMPLATE_ENGINE;if(!e||e.__lpsMultiobra)return false;for(const k of['runCurve','runHistogram']){const orig=e[k];if(typeof orig==='function')e[k]=async(...args)=>{state.exportScope=true;try{return await orig(...args)}finally{state.exportScope=false}}}e.__lpsMultiobra=true;state.engineWrapped=true;return true}
function install(){ensureUI();const timer=setInterval(()=>{if(wrapEngine())clearInterval(timer)},100);for(const id of['filterSector','filterArea','filterDiscipline'])$("#"+id)?.addEventListener('change',()=>{scheduleRender();setTimeout(()=>window.LPS_AUTO_PREVIEW?.prepareAll?.(true),120)});window.addEventListener('lps-ai-ready',e=>{state.aiFindings=e.detail?.analysis?.findings||[];renderSuggestions()});if(window.LPS_LAST_MODEL){state.model=enrichModel(window.LPS_LAST_MODEL);scheduleRender()}}
window.LPS_MULTIOBRA={get model(){return state.model},scope,render:renderMultiobra,enrichModel};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
