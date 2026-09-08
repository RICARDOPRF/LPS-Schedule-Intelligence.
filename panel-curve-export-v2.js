(()=>{
'use strict';

const $=s=>document.querySelector(s);
const PANEL_DISCIPLINES=['Elétrica','Mecânica','Tubulação','Fabricação de Tubulação','Montagem de Tubulação','Suportes','Equipamentos','Estrutura','Instrumentação','Automação','Refratário','Civil','Pintura','Andaime','Comissionamento'];
let modelCache={key:'',model:null};
let referenceChart=null;

const norm=s=>(s??'').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const num=v=>{let s=String(v??'').trim();if(!s)return 0;s=s.replace(/\s/g,'');if(s.includes(',')&&s.includes('.'))s=s.replace(/\./g,'').replace(',','.');else s=s.replace(',','.');const n=Number(s);return Number.isFinite(n)?n:0};
const isoDate=d=>`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
function dateOnly(v){const m=String(v||'').slice(0,10).match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return null;const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));return Number.isNaN(+d)?null:d}
function addDays(d,n){const x=new Date(+d);x.setUTCDate(x.getUTCDate()+n);return x}
function dayLabel(d){return ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][d.getUTCDay()]}
function isoWeek(d){const x=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));const day=x.getUTCDay()||7;x.setUTCDate(x.getUTCDate()+4-day);const y0=new Date(Date.UTC(x.getUTCFullYear(),0,1));return Math.ceil((((x-y0)/86400000)+1)/7)}
function sumMap(m){let s=0;for(const v of m.values())s+=Number(v)||0;return s}
function addMap(target,source){for(const[k,v]of source)target.set(k,(target.get(k)||0)+(Number(v)||0))}
function addScaled(target,shape,total){const s=sumMap(shape);if(!(s>0)||!(total>0))return;for(const[k,v]of shape)target.set(k,(target.get(k)||0)+total*(Number(v)||0)/s)}
function normalizeMap(raw,den){const out=new Map();if(!(den>0))return out;for(const[k,v]of raw)out.set(k,(Number(v)||0)/den);return out}
function customEntries(task){return Object.entries(task.custom||{}).map(([k,v])=>[norm(k),String(v??'').trim()]).filter(([,v])=>v)}
function customValue(task,re){for(const[k,v]of customEntries(task))if(re.test(k))return v;return''}

function aliasLabel(value){
 const s=norm(value);if(!s)return'';
 if(/fabricacao\s+(de\s+)?tub|fab\s+tub|pipe\s*shop|fabricacao\s+spool/.test(s))return'Fabricação de Tubulação';
 if(/montagem\s+(de\s+)?tub|mont\s+tub|montagem\s+linha/.test(s))return'Montagem de Tubulação';
 if(/fabricacao\s+suport|montagem\s+suport|^suporte?s?$|^suportes$/.test(s))return'Suportes';
 if(/eletrica.*instrument|instrument.*eletrica|eletrica\s+e\s+instrument/.test(s))return'Elétrica';
 if(/^eletrica$|^electrical$/.test(s))return'Elétrica';
 if(/^instrumentacao$|^instrumentation$/.test(s))return'Instrumentação';
 if(/^automacao$|^automation$/.test(s))return'Automação';
 if(/^mecanica$|^mechanical$/.test(s))return'Mecânica';
 if(/^equipamentos?$|^equipment/.test(s))return'Equipamentos';
 if(/^tubulacao$|^piping$/.test(s))return'Tubulação';
 if(/estrutura/.test(s))return'Estrutura';
 if(/refrat/.test(s))return'Refratário';
 if(/^civil$/.test(s))return'Civil';
 if(/pintura|painting|coating/.test(s))return'Pintura';
 if(/andaime|scaffold/.test(s))return'Andaime';
 if(/comission|commission|startup|start up/.test(s))return'Comissionamento';
 return'';
}

function classifyTask(task){
 // O Excel de referência classifica pela coluna de fase/painel/Disciplina. Prioriza os valores explícitos antes do nome da tarefa.
 const ranked=[];
 for(const[k,v]of customEntries(task)){
   let score=0;
   if(/painel\s+bordo/.test(k))score=120;
   else if(/^fase$|\bfase\b/.test(k))score=115;
   else if(/disciplina|discipline/.test(k))score=110;
   else if(/subdisciplina|sub\s*disc/.test(k))score=100;
   else if(/tipo\s+do\s+servico|tipo\s+servico/.test(k))score=90;
   const label=aliasLabel(v);if(label)ranked.push({score,label});
 }
 ranked.sort((a,b)=>b.score-a.score);if(ranked.length)return ranked[0].label;
 const direct=aliasLabel(task.discipline||'');if(direct)return direct;
 const all=norm([task.name,task.wbs,...Object.values(task.custom||{})].filter(Boolean).join(' '));
 if(/suport/.test(all)&&/tub|pipe/.test(all))return'Suportes';
 if(/fabric|pipe shop|spool/.test(all)&&/tub|pipe/.test(all))return'Fabricação de Tubulação';
 if(/montag/.test(all)&&/tub|pipe/.test(all))return'Montagem de Tubulação';
 if(/eletric/.test(all)&&/instrument/.test(all))return'Elétrica';
 if(/instrument/.test(all))return'Instrumentação';
 if(/eletric|eletrocalha|cabo|painel eletr/.test(all))return'Elétrica';
 if(/mecan|compressor|bomba|blower|alinhamento/.test(all))return'Mecânica';
 if(/tubul|piping|pipe\b/.test(all))return'Tubulação';
 if(/estrutura/.test(all))return'Estrutura';
 if(/civil|concreto|escav|fundacao/.test(all))return'Civil';
 if(/andaime|scaffold/.test(all))return'Andaime';
 if(/pintura|coating|painting/.test(all))return'Pintura';
 if(/comission|commission|startup/.test(all))return'Comissionamento';
 return'';
}

function assignmentMap(model){const m=new Map();for(const a of model.assignments||[]){const k=String(a.taskUid);if(!m.has(k))m.set(k,[]);m.get(k).push(a)}return m}
function dailyMap(task,assignments,kind,baselineId){
 const map=new Map();
 for(const a of assignments.get(String(task.uid))||[]){
   for(const d of a.dailyTimephased||[]){
     const date=String(d.date||'').slice(0,10);if(!date)continue;let v=0;
     if(kind==='actual')v=Number(d.actualHours)||0;
     else if(kind==='baseline')v=Number(d.baseline?.[String(baselineId)])||0;
     else v=Number(d.workHours)||Number(d.plannedHours)||0;
     if(Math.abs(v)>1e-9)map.set(date,(map.get(date)||0)+v);
   }
 }
 if(map.size)return map;
 const src=kind==='baseline'?(task.baselineTimephased||[]).filter(x=>String(x.baselineId)===String(baselineId)):(task.timephased||[]).filter(x=>kind==='actual'?/actual/i.test(x.type||''):!/actual/i.test(x.type||''));
 for(const x of src){const date=String(x.start||'').slice(0,10),v=Number(x.valueHours)||0;if(date&&Math.abs(v)>1e-9)map.set(date,(map.get(date)||0)+v)}
 return map;
}
function baselineEntry(task,id){return(task.baselines||[]).find(b=>String(b.id)===String(id))||null}
function fallbackShape(start,finish){const s=dateOnly(start),f=dateOnly(finish),m=new Map();if(!s||!f||f<s)return m;const all=[];for(let d=s;d<=f;d=addDays(d,1))all.push(new Date(+d));const weekdays=all.filter(d=>![0,6].includes(d.getUTCDay()));for(const d of(weekdays.length?weekdays:all))m.set(isoDate(d),1);return m}
function planForTask(task,assignments,kind,id){
 let shape=dailyMap(task,assignments,kind,id),total=sumMap(shape);let fallback=false;
 if(total>0)return{shape,total,fallback};
 if(kind==='baseline'){
   const b=baselineEntry(task,id);total=Number(b?.workHours)||0;if(total>0){shape=fallbackShape(b?.start||task.start,b?.finish||task.finish);fallback=true;return{shape,total,fallback}}
 }
 total=Number(task.workHours)||0;if(total>0){shape=fallbackShape(task.start,task.finish);fallback=true;return{shape,total,fallback}}
 return{shape:new Map(),total:0,fallback:true};
}
function actualForTask(task,assignments,status){
 let shape=dailyMap(task,assignments,'actual'),total=sumMap(shape),fallback=false;if(total>0)return{shape,total,fallback};
 total=Number(task.actualWorkHours)||0;if(total>0){let end=task.actualFinish||status||task.finish;if(status&&end&&String(end).slice(0,10)>status)end=status;shape=fallbackShape(task.actualStart||task.start,end);fallback=true;return{shape,total,fallback}}
 return{shape:new Map(),total:0,fallback:true};
}

function baselineConfig(model){const ids=(model.baselines||[]).map(b=>String(b.id));const original=ids.includes('0')?'0':ids[0]||null;const selected=String($('#baselineSelect')?.value||'current');let replan={kind:'none',id:null};if(original){if(selected!=='current'&&selected!==original&&ids.includes(selected))replan={kind:'baseline',id:selected};else replan={kind:'current',id:null}}return{original,replan}}
function buildOneSeries(tasks,model){
 const assignments=assignmentMap(model),{original,replan}=baselineConfig(model),status=String(model.project?.statusDate||'').slice(0,10);
 const prevRaw=new Map(),realRaw=new Map(),replanRaw=new Map();let prevTotal=0,replanTotal=0,actualTotal=0,fallback=0;
 for(const task of tasks){
   if(task.summary)continue;
   let p=original?planForTask(task,assignments,'baseline',original):planForTask(task,assignments,'current');if(p.fallback)fallback++;prevTotal+=p.total;addScaled(prevRaw,p.shape,p.total);
   const a=actualForTask(task,assignments,status);if(a.fallback&&a.total>0)fallback++;actualTotal+=a.total;addScaled(realRaw,a.shape,a.total);
   if(replan.kind==='baseline'){const rp=planForTask(task,assignments,'baseline',replan.id);if(rp.fallback)fallback++;replanTotal+=rp.total;addScaled(replanRaw,rp.shape,rp.total)}
   else if(replan.kind==='current'){const rp=planForTask(task,assignments,'current');if(rp.fallback)fallback++;replanTotal+=rp.total;addScaled(replanRaw,rp.shape,rp.total)}
 }
 return{prev:normalizeMap(prevRaw,prevTotal),real:normalizeMap(realRaw,prevTotal),replan:replan.kind==='none'?new Map():normalizeMap(replanRaw,replanTotal),prevTotal,actualTotal,replanTotal,fallback,finalReal:prevTotal>0?actualTotal/prevTotal:0};
}
function groupTasks(model){const groups=new Map(PANEL_DISCIPLINES.map(x=>[x,[]]));const unclassified=[];for(const t of model.tasks||[]){if(t.summary)continue;const label=classifyTask(t);if(label&&groups.has(label))groups.get(label).push(t);else if((Number(t.workHours)||Number(t.actualWorkHours)||0)>0)unclassified.push(t)}for(const[k,v]of[...groups])if(!v.length)groups.delete(k);return{groups,unclassified}}
function buildDisciplineSeries(model){const {groups,unclassified}=groupTasks(model),results=[];for(const label of PANEL_DISCIPLINES){const tasks=groups.get(label);if(tasks?.length)results.push({label,tasks:tasks.length,...buildOneSeries(tasks,model)})}return{results,unclassified}}
function valueAt(map,d){return Number(map.get(isoDate(d)))||0}
function dateRange(series,model){const keys=[];for(const d of series.results)for(const m of[d.prev,d.replan,d.real])keys.push(...m.keys());let min=keys.sort()[0]||String(model.project?.start||'').slice(0,10),max=keys.sort().at(-1)||String(model.project?.finish||'').slice(0,10);const s=dateOnly(min),f=dateOnly(max);if(!s||!f||f<s)throw new Error('Não foi possível determinar o intervalo de datas.');const out=[];for(let d=s;d<=f;d=addDays(d,1))out.push(new Date(+d));return out}
function safeName(s){return(s||'Cronograma').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,80)||'Cronograma'}

function status(msg,kind='info'){let el=document.getElementById('panelCurveExportStatus');if(!el){el=document.createElement('div');el.id='panelCurveExportStatus';el.style.cssText='position:fixed;right:18px;bottom:18px;z-index:10001;max-width:560px;padding:13px 16px;border-radius:12px;color:#fff;box-shadow:0 10px 30px #0004;font:700 13px/1.45 Inter,Arial,sans-serif;white-space:pre-line';document.body.appendChild(el)}el.textContent=msg;el.style.background=kind==='error'?'#991b1b':kind==='ok'?'#166534':'#0f2747';clearTimeout(status.timer);status.timer=setTimeout(()=>el?.remove(),kind==='ok'?9000:10000)}
async function parseMpp(file){const key=[file.name,file.size,file.lastModified].join('|');if(modelCache.key===key&&modelCache.model)return modelCache.model;const base=(localStorage.getItem('lps_api_base')||window.LPS_SCHEDULE_CONFIG?.apiBase||'').replace(/\/$/,'');if(!base)throw new Error('API LPS não configurada.');const fd=new FormData();fd.append('file',file,file.name);const r=await fetch(base+'/v1/parse/mpp',{method:'POST',body:fd});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.detail||j.error||`Falha ao ler o MPP (${r.status}).`);modelCache={key,model:j};return j}
async function ensureExcelJS(){if(window.ExcelJS)return;await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';s.onload=resolve;s.onerror=()=>reject(new Error('Não foi possível carregar o gerador XLSX.'));document.head.appendChild(s)})}

async function writePanelWorkbook(model){
 await ensureExcelJS();const series=buildDisciplineSeries(model);if(!series.results.length)throw new Error('Nenhuma disciplina reconhecida para gerar a Curva S.');const dates=dateRange(series,model);const wb=new ExcelJS.Workbook();wb.creator='Lean Performance Solutions';wb.created=new Date();const ws=wb.addWorksheet('CURVA');ws.properties.defaultRowHeight=18;ws.getColumn(1).width=29;ws.getColumn(2).width=12;for(let c=3;c<3+dates.length;c++)ws.getColumn(c).width=11;
 let row=1;for(const d of series.results){if(row>1)row++;const rows=[['','Data'],['','Semana'],['','Dia'],['','Previsto'],['','Replan'],['','Realizado']];rows[0][0]=d.label;for(const dt of dates){rows[0].push(dt);rows[1].push(`S${String(isoWeek(dt)).padStart(2,'0')}`);rows[2].push(dayLabel(dt));rows[3].push(valueAt(d.prev,dt));rows[4].push(valueAt(d.replan,dt));rows[5].push(valueAt(d.real,dt))}for(const rr of rows)ws.addRow(rr);const start=row,end=row+5;ws.getCell(start,1).font={bold:true,color:{argb:'FF1E3A8A'}};ws.getRange?null:null;for(let r=start;r<=end;r++){for(let c=1;c<=2+dates.length;c++){const cell=ws.getCell(r,c);cell.border={top:{style:'thin',color:{argb:'FFD6DEE8'}},left:{style:'thin',color:{argb:'FFD6DEE8'}},bottom:{style:'thin',color:{argb:'FFD6DEE8'}},right:{style:'thin',color:{argb:'FFD6DEE8'}}};if(c>=3&&r>=start+3)cell.numFmt='0.0000%';if(c>=3&&r===start)cell.numFmt='dd/mm/yyyy'}}row=end+1}
 ws.views=[{state:'frozen',xSplit:2,ySplit:0}];const buf=await wb.xlsx.writeBuffer();const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`Curvas_S_Unificadas_${safeName(model.project?.name||model.sourceName)}.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);return{series,dates:dates.length};
}

function scopedTasks(model){const all=(model.tasks||[]).filter(t=>!t.summary),disc=$('#filterDiscipline')?.value||'';if(!disc)return all;const desired=aliasLabel(disc)||disc;return all.filter(t=>classifyTask(t)===desired||norm(classifyTask(t))===norm(desired))}
function renderReferenceCurve(model){const tasks=scopedTasks(model);if(!tasks.length)throw new Error('Nenhuma atividade reconhecida no escopo selecionado.');const s=buildOneSeries(tasks,model),keys=[...new Set([...s.prev.keys(),...s.real.keys(),...s.replan.keys()])].sort();let cp=0,cr=0,crp=0;const planned=[],real=[],replan=[];for(const k of keys){cp+=(s.prev.get(k)||0);cr+=(s.real.get(k)||0);crp+=(s.replan.get(k)||0);planned.push(cp*100);real.push(cr*100);replan.push(crp*100)}const canvas=$('#curveChart');if(!canvas)return;if(referenceChart)referenceChart.destroy();if(window.Chart?.getChart){const old=Chart.getChart(canvas);if(old)old.destroy()}const sets=[{label:'Previsto',data:planned,borderColor:'#1e3a8a',backgroundColor:'#1e3a8a',tension:.25,pointRadius:1.5},{label:'Realizado',data:real,borderColor:'#2563eb',backgroundColor:'#2563eb',borderDash:[5,3],tension:.25,pointRadius:1.5}];if(s.replanTotal>0)sets.splice(1,0,{label:'Replan',data:replan,borderColor:'#64748b',backgroundColor:'#64748b',tension:.25,pointRadius:1});referenceChart=new Chart(canvas,{type:'line',data:{labels:keys.map(k=>{const d=dateOnly(k);return d?d.toLocaleDateString('pt-BR',{timeZone:'UTC'}):k}),datasets:sets},options:{responsive:true,maintainAspectRatio:false,scales:{y:{min:0,max:Math.max(100,Math.ceil((Math.max(...real,100))/10)*10),ticks:{callback:v=>v+'%'}}},plugins:{legend:{labels:{boxWidth:12,font:{size:10}}}}}});const basis=$('#curveBasis');if(basis)basis.textContent='Modo Excel/Painel de Bordo: Realizado = Trabalho Real diário ÷ Trabalho Previsto total da disciplina';const cards=$('#curveCards');if(cards)cards.innerHTML=`<div class="curve-card"><span>Trabalho previsto base</span><b>${s.prevTotal.toLocaleString('pt-BR',{maximumFractionDigits:2})}</b></div><div class="curve-card"><span>Trabalho realizado</span><b>${s.actualTotal.toLocaleString('pt-BR',{maximumFractionDigits:2})}</b></div><div class="curve-card"><span>Real acumulado</span><b>${(s.finalReal*100).toFixed(2)}%</b></div>`;return s}

async function exportPanelCurve(){const file=$('#scheduleFile')?.files?.[0];if(!file)return status('Selecione o cronograma antes de exportar.','error');if(!/\.mpp$/i.test(file.name))return status('O modo Excel/Painel de Bordo está validado para MPP nesta versão.','error');const btn=$('#btnExportWorkbook'),old=btn?.textContent;if(btn){btn.disabled=true;btn.textContent='Gerando XLSX do painel…'}try{status('Aplicando a mesma lógica do Excel de referência…');const model=await parseMpp(file),out=await writePanelWorkbook(model);const summary=out.series.results.map(x=>`${x.label}: ${(x.finalReal*100).toFixed(2)}%`).join('\n');status(`Curva S gerada no padrão do Painel de Bordo.\n${summary}`,'ok')}catch(e){console.error(e);status(e.message||'Erro ao gerar Curva S.','error')}finally{if(btn){btn.disabled=false;btn.textContent=old||'Exportar XLSX'}}}
async function generateReferenceCurve(){const file=$('#scheduleFile')?.files?.[0];if(!file)return status('Selecione o cronograma antes de gerar a curva.','error');try{status('Recalculando pela lógica do Excel/Painel de Bordo…');const model=await parseMpp(file),s=renderReferenceCurve(model);status(`Curva recalculada. Real acumulado: ${(s.finalReal*100).toFixed(2)}%.`,'ok')}catch(e){console.error(e);status(e.message||'Erro ao gerar curva.','error')}}

function install(){document.addEventListener('click',e=>{const exp=e.target.closest?.('#btnExportWorkbook');if(exp){e.preventDefault();e.stopImmediatePropagation();exportPanelCurve();return}const gen=e.target.closest?.('#btnGenerateCurves');if(gen){e.preventDefault();e.stopImmediatePropagation();generateReferenceCurve()}},true)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
