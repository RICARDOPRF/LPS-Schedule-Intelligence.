(()=>{
'use strict';
const $=s=>document.querySelector(s);
const norm=s=>(s??'').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const dayKey=v=>String(v||'').slice(0,10);
const add=(m,k,v)=>{const x=Number(v)||0;if(k&&Math.abs(x)>1e-12)m.set(k,(m.get(k)||0)+x)};
const COLORS=['#1e3a8a','#2563eb','#0f766e','#7c3aed','#b45309','#be123c','#475569','#0369a1'];
function model(){return window.LPS_MULTIOBRA?.model||window.LPS_LAST_MODEL||null}
function scope(){return{obra:$('#filterSector')?.value||'',area:$('#filterArea')?.value||'',discipline:$('#filterDiscipline')?.value||''}}
function inScope(t,s){return(!s.obra||norm(t.lpsObra)===norm(s.obra))&&(!s.area||norm(t.lpsArea)===norm(s.area))&&(!s.discipline||norm(t.lpsDiscipline)===norm(s.discipline))}
function groupKey(t,mode){if(mode==='sector')return t.lpsObra||'Sem obra';if(mode==='area')return t.lpsArea||'Sem área';if(mode==='discipline')return t.lpsDiscipline||'Sem disciplina';return'Consolidado'}
function build(){
 const m=model();if(!m)return null;const s=scope(),mode=$('#curveGrouping')?.value||'project',baseSel=String($('#baselineSelect')?.value||'current');
 const tasks=new Map((m.tasks||[]).filter(t=>!t.summary&&inScope(t,s)).map(t=>[String(t.uid),t]));if(!tasks.size)return null;
 const groups=new Map();
 for(const a of m.assignments||[]){const t=tasks.get(String(a.taskUid));if(!t)continue;const key=groupKey(t,mode);if(!groups.has(key))groups.set(key,{label:key,plan:new Map(),real:new Map(),replan:new Map(),planTotal:0,realTotal:0,replanTotal:0});const g=groups.get(key);
   for(const d of a.dailyTimephased||[]){const k=dayKey(d.date);if(!k)continue;const cur=Number(d.workHours)||((Number(d.actualHours)||0)+(Number(d.remainingHours)||0))||Number(d.plannedHours)||0;const act=Number(d.actualHours)||0;const b=baseSel!=='current'?Number(d.baseline?.[baseSel])||0:cur;add(g.plan,k,b);add(g.real,k,act);if(baseSel!=='current')add(g.replan,k,cur)}
 }
 for(const g of groups.values()){g.planTotal=[...g.plan.values()].reduce((a,b)=>a+b,0);g.realTotal=[...g.real.values()].reduce((a,b)=>a+b,0);g.replanTotal=[...g.replan.values()].reduce((a,b)=>a+b,0)}
 let list=[...groups.values()].filter(g=>g.planTotal>0||g.realTotal>0||g.replanTotal>0).sort((a,b)=>b.planTotal-a.planTotal);
 const explicit=mode==='sector'?s.obra:mode==='area'?s.area:mode==='discipline'?s.discipline:'';if(explicit)list=list.filter(g=>norm(g.label)===norm(explicit));
 const limit=mode==='project'?1:mode==='sector'?6:mode==='area'?6:6;list=list.slice(0,limit);if(!list.length)return null;
 const dates=[...new Set(list.flatMap(g=>[...g.plan.keys(),...g.real.keys(),...g.replan.keys()]))].sort();return{mode,baseSel,groups:list,dates,s,totalGroups:groups.size}
}
function cum(map,dates,den){let c=0;return dates.map(k=>{c+=den?(map.get(k)||0)/den*100:0;return c})}
function render(){
 const x=build(),canvas=$('#curveChart');if(!x||!canvas||!window.Chart)return;Chart.getChart(canvas)?.destroy();
 const labels=x.dates.map(k=>{const [y,m,d]=k.split('-');return`${d}/${m}/${y}`}),datasets=[];
 x.groups.forEach((g,i)=>{const color=COLORS[i%COLORS.length],den=g.planTotal||g.replanTotal||1;
   if(x.groups.length===1){datasets.push({label:`Previsto · ${g.label}`,data:cum(g.plan,x.dates,den),borderColor:'#1e3a8a',backgroundColor:'transparent',tension:.2,pointRadius:0,borderWidth:3});if(x.baseSel!=='current'&&g.replanTotal>0)datasets.push({label:`Replan · ${g.label}`,data:cum(g.replan,x.dates,g.replanTotal),borderColor:'#2563eb',borderDash:[6,4],tension:.2,pointRadius:0,borderWidth:2});datasets.push({label:`Realizado · ${g.label}`,data:cum(g.real,x.dates,den),borderColor:'#dc2626',tension:.2,pointRadius:0,borderWidth:3});}
   else{datasets.push({label:`Prev. · ${g.label}`,data:cum(g.plan,x.dates,den),borderColor:color,tension:.18,pointRadius:0,borderWidth:2});datasets.push({label:`Real · ${g.label}`,data:cum(g.real,x.dates,den),borderColor:color,borderDash:[7,4],tension:.18,pointRadius:0,borderWidth:2});}
 });
 new Chart(canvas,{type:'line',data:{labels,datasets},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{labels:{boxWidth:22}}},scales:{y:{beginAtZero:true,suggestedMax:100,ticks:{callback:v=>v+'%'}}}}});
 const names={project:'Consolidado',sector:'Por obra',area:'Por área',discipline:'Por disciplina'},basis=$('#curveBasis');if(basis)basis.textContent=`${names[x.mode]} · escopo atual${x.totalGroups>x.groups.length?` · exibindo ${x.groups.length} maiores por HH`:''} · Uso da Tarefa diário`;
}
function wrap(){const e=window.LPS_TEMPLATE_ENGINE;if(!e||e.__lpsPreviewV2)return false;const orig=e.runCurve;if(typeof orig!=='function')return false;e.runCurve=async(...args)=>{const r=await orig(...args);setTimeout(render,20);return r};e.__lpsPreviewV2=true;return true}
function install(){const grouping=$('#curveGrouping');if(grouping&&grouping.value==='discipline')grouping.value='project';for(const id of['curveGrouping','filterSector','filterArea','filterDiscipline','baselineSelect'])$('#'+id)?.addEventListener('change',()=>setTimeout(render,60));window.addEventListener('lps-model-ready',()=>setTimeout(render,180));const timer=setInterval(()=>{if(wrap())clearInterval(timer)},100);setTimeout(render,800)}
window.LPS_CURVE_PREVIEW_V2={render};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();