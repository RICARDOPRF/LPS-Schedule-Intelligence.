(()=>{
'use strict';

const PANEL_DISCIPLINES=[
  'Elétrica','Mecânica','Tubulação','Fabricação de Tubulação','Montagem de Tubulação','Suportes',
  'Equipamentos','Estrutura','Instrumentação','Automação','Refratário','Civil','Pintura','Andaime','Comissionamento'
];
const TUBE_DETAILS=new Set(['Fabricação de Tubulação','Montagem de Tubulação','Suportes']);
const $=s=>document.querySelector(s);
const norm=s=>(s??'').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const slug=s=>norm(s).replace(/\s+/g,'_');
const num=v=>{let s=(v??'').toString().trim();if(!s)return 0;const pct=s.includes('%');s=s.replace(/\s/g,'').replace('%','');if(s.includes(',')&&s.includes('.'))s=s.replace(/\./g,'').replace(',','.');else if(s.includes(','))s=s.replace(',','.');const n=Number(s);if(!Number.isFinite(n))return 0;return pct?n/100:n};
const isoDate=d=>`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
function dateOnly(v){if(!v)return null;const m=String(v).slice(0,10).match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return null;const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));return Number.isNaN(+d)?null:d}
function addDays(d,n){const x=new Date(+d);x.setUTCDate(x.getUTCDate()+n);return x}
function isoWeek(d){const x=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));const day=x.getUTCDay()||7;x.setUTCDate(x.getUTCDate()+4-day);const y0=new Date(Date.UTC(x.getUTCFullYear(),0,1));return Math.ceil((((x-y0)/86400000)+1)/7)}
function dayLabel(d){return ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][d.getUTCDay()]}
function customValue(task,re){for(const [k,v] of Object.entries(task.custom||{}))if(re.test(norm(k))&&String(v??'').trim())return String(v).trim();return''}
function firstText(task){return [task.name,task.wbs,...Object.values(task.custom||{})].filter(Boolean).join(' ')}

function classifyTask(task){
  const raw=customValue(task,/\bdisciplina\b|\bdiscipline\b/);
  const r=norm(raw), all=norm(firstText(task));
  const sub=norm([customValue(task,/\bsub\b|subdisciplina|subdisc/),customValue(task,/tipo do servico|tipo servico|servico|fase/),task.name].join(' '));

  if(/eletric.*instrument|instrument.*eletric/.test(r)){
    if(/automacao|clp|remota|software|rede industrial|profibus|logica/.test(all))return'Automação';
    if(/instrument|calibr|transmiss|sensor|loop|fibra|valvula de controle|analisador/.test(all))return'Instrumentação';
    return'Elétrica';
  }
  if(/instrument.*automacao|automacao.*instrument/.test(r)){
    if(/automacao|clp|remota|software|rede industrial|profibus|logica/.test(all))return'Automação';
    return'Instrumentação';
  }
  if(/tubul|piping/.test(r)){
    if(/suport/.test(sub))return'Suportes';
    if(/fabric|pipe shop|spool/.test(sub))return'Fabricação de Tubulação';
    if(/montag|campo/.test(sub))return'Montagem de Tubulação';
    return'Tubulação';
  }

  const aliases=[
    [/^eletric|eletrica|electrical/,'Elétrica'],[/^mecan|mechanical/,'Mecânica'],[/equipamento|equipment/,'Equipamentos'],
    [/estrutura|structur|steel/,'Estrutura'],[/instrument/,'Instrumentação'],[/automacao|automation/,'Automação'],
    [/refrat|refractory/,'Refratário'],[/civil/,'Civil'],[/pintura|painting|coating/,'Pintura'],
    [/andaime|scaffold/,'Andaime'],[/comission|commission|startup|start up/,'Comissionamento']
  ];
  for(const [re,label] of aliases)if(re.test(r))return label;

  if(/suport/.test(all)&&/tubul|pipe/.test(all))return'Suportes';
  if(/fabric|pipe shop|spool/.test(all)&&/tubul|pipe/.test(all))return'Fabricação de Tubulação';
  if(/montag/.test(all)&&/tubul|pipe/.test(all))return'Montagem de Tubulação';
  if(/tubul|piping|pipe\b/.test(all))return'Tubulação';
  for(const [re,label] of aliases)if(re.test(all))return label;
  return'';
}

function taskWeight(task){
  const entries=Object.entries(task.custom||{});
  const ranked=entries.map(([k,v])=>{
    const nk=norm(k);let score=0;
    if(nk==='peso %'||nk==='peso percentual'||nk==='weight %')score=100;
    else if(nk==='peso'||nk==='weight')score=90;
    else if(/peso|weight/.test(nk))score=70;
    else if(/ponto|point/.test(nk))score=50;
    return{score,value:num(v)};
  }).filter(x=>x.score&&x.value>0).sort((a,b)=>b.score-a.score);
  return ranked[0]?.value||0;
}
function progressPct(task){const p=Number(task.physicalPercent);if(Number.isFinite(p)&&p>0)return Math.min(100,Math.max(0,p));const c=Number(task.percentComplete);return Number.isFinite(c)?Math.min(100,Math.max(0,c)):0}
function baselineEntry(task,id){return (task.baselines||[]).find(b=>String(b.id)===String(id))||null}

function assignmentMap(model){const m=new Map();for(const a of model.assignments||[]){const k=String(a.taskUid);if(!m.has(k))m.set(k,[]);m.get(k).push(a)}return m}
function shapeFromDaily(task,assignments,kind,baselineId){
  const map=new Map();
  for(const a of assignments.get(String(task.uid))||[]){
    for(const d of a.dailyTimephased||[]){
      let v=0;
      if(kind==='actual')v=Number(d.actualHours)||0;
      else if(kind==='baseline')v=Number(d.baseline?.[String(baselineId)])||0;
      else v=Number(d.workHours)||Number(d.plannedHours)||0;
      if(v>0&&d.date)map.set(String(d.date).slice(0,10),(map.get(String(d.date).slice(0,10))||0)+v);
    }
  }
  if(map.size)return map;
  const src=kind==='baseline'?(task.baselineTimephased||[]).filter(x=>String(x.baselineId)===String(baselineId)):(task.timephased||[]).filter(x=>kind==='actual'?/actual/i.test(x.type||''):!/actual/i.test(x.type||''));
  for(const x of src){const k=String(x.start||'').slice(0,10),v=Number(x.valueHours)||0;if(k&&v>0)map.set(k,(map.get(k)||0)+v)}
  return map;
}
function fallbackShape(start,finish){
  const s=dateOnly(start),f=dateOnly(finish),m=new Map();if(!s||!f||f<s)return m;
  const dates=[];for(let d=s;d<=f;d=addDays(d,1))dates.push(new Date(+d));
  const weekdays=dates.filter(d=>![0,6].includes(d.getUTCDay()));const use=weekdays.length?weekdays:dates;
  for(const d of use)m.set(isoDate(d),1);return m;
}
function addWeighted(target,shape,amount){
  const total=[...shape.values()].reduce((a,b)=>a+(Number(b)||0),0);if(!(total>0)||!(amount>0))return;
  for(const [k,v] of shape)target.set(k,(target.get(k)||0)+amount*(Number(v)||0)/total);
}
function normalizePlan(map,totalWeight){const out=new Map();if(!(totalWeight>0))return out;for(const [k,v] of map)out.set(k,v/totalWeight);const sum=[...out.values()].reduce((a,b)=>a+b,0);if(sum>0){const keys=[...out.keys()].sort();const last=keys.at(-1);out.set(last,(out.get(last)||0)+(1-sum))}return out}

function buildDisciplineSeries(model){
  const groups=new Map();
  for(const label of PANEL_DISCIPLINES)groups.set(label,[]);
  for(const task of model.tasks||[]){
    if(task.summary)continue;const label=classifyTask(task);if(!label||!groups.has(label))continue;
    groups.get(label).push(task);
    if(TUBE_DETAILS.has(label))groups.get('Tubulação').push(task);
  }
  for(const [k,v] of [...groups])if(!v.length)groups.delete(k);

  const baselineIds=(model.baselines||[]).map(b=>String(b.id));
  const originalId=baselineIds.includes('0')?'0':baselineIds[0]||null;
  const selected=String($('#baselineSelect')?.value||'current');
  let replan={kind:'none',id:null};
  if(originalId){
    if(selected!=='current'&&selected!==originalId&&baselineIds.includes(selected))replan={kind:'baseline',id:selected};
    else replan={kind:'current',id:null};
  }
  const assignments=assignmentMap(model),status=String(model.project?.statusDate||'').slice(0,10);
  const results=[];let missingWeights=0,fallbackCount=0;

  for(const label of PANEL_DISCIPLINES){
    const tasks=groups.get(label);if(!tasks?.length)continue;
    const weighted=tasks.map(t=>({t,w:taskWeight(t)}));let totalWeight=weighted.reduce((a,x)=>a+x.w,0);
    const noExplicitWeight=!(totalWeight>0);
    if(noExplicitWeight){weighted.forEach(x=>x.w=1);totalWeight=weighted.length;missingWeights+=weighted.length}else missingWeights+=weighted.filter(x=>!(x.w>0)).length;

    const pRaw=new Map(),rRaw=new Map(),aRaw=new Map();
    for(const {t,w} of weighted){
      if(!(w>0))continue;
      let shape,be;
      if(originalId){
        be=baselineEntry(t,originalId);shape=shapeFromDaily(t,assignments,'baseline',originalId);
        if(!shape.size){shape=fallbackShape(be?.start||t.start,be?.finish||t.finish);fallbackCount++}
      }else{
        shape=shapeFromDaily(t,assignments,'current');if(!shape.size){shape=fallbackShape(t.start,t.finish);fallbackCount++}
      }
      addWeighted(pRaw,shape,w);

      if(replan.kind==='baseline'){
        const rb=baselineEntry(t,replan.id);let rs=shapeFromDaily(t,assignments,'baseline',replan.id);if(!rs.size){rs=fallbackShape(rb?.start||t.start,rb?.finish||t.finish);fallbackCount++}addWeighted(rRaw,rs,w);
      }else if(replan.kind==='current'){
        let rs=shapeFromDaily(t,assignments,'current');if(!rs.size){rs=fallbackShape(t.start,t.finish);fallbackCount++}addWeighted(rRaw,rs,w);
      }

      const earned=w*progressPct(t)/100;
      if(earned>0){let as=shapeFromDaily(t,assignments,'actual');if(!as.size){let end=t.actualFinish||status||t.finish;if(status&&end&&end>status)end=status;as=fallbackShape(t.actualStart||t.start,end);fallbackCount++}addWeighted(aRaw,as,earned)}
    }
    results.push({label,tasks:tasks.length,totalWeight,noExplicitWeight,prev:normalizePlan(pRaw,totalWeight),replan:replan.kind==='none'?new Map():normalizePlan(rRaw,totalWeight),real:(()=>{const m=new Map();for(const[k,v]of aRaw)m.set(k,totalWeight?v/totalWeight:0);return m})()});
  }
  return{results,originalId,replan,missingWeights,fallbackCount};
}

function dateRange(series,model){
  const keys=[];for(const d of series.results)for(const m of [d.prev,d.replan,d.real])keys.push(...m.keys());
  let min=keys.sort()[0]||String(model.project?.start||'').slice(0,10),max=keys.sort().at(-1)||String(model.project?.finish||'').slice(0,10);
  const s=dateOnly(min),f=dateOnly(max);if(!s||!f||f<s)throw new Error('Não foi possível determinar o intervalo de datas da curva.');
  const dates=[];for(let d=s;d<=f;d=addDays(d,1))dates.push(new Date(+d));return dates;
}
function valueAt(map,d){return Number(map.get(isoDate(d)))||0}
function safeFileName(s){return (s||'Cronograma').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,80)||'Cronograma'}

function status(msg,kind='info'){
  let el=document.getElementById('panelCurveExportStatus');if(!el){el=document.createElement('div');el.id='panelCurveExportStatus';el.style.cssText='position:fixed;right:18px;bottom:18px;z-index:10001;max-width:480px;padding:13px 16px;border-radius:12px;color:#fff;box-shadow:0 10px 30px #0004;font:700 13px/1.4 Inter,Arial,sans-serif';document.body.appendChild(el)}
  el.textContent=msg;el.style.background=kind==='error'?'#991b1b':kind==='ok'?'#166534':'#0f2747';clearTimeout(status.timer);status.timer=setTimeout(()=>el?.remove(),kind==='ok'?6500:9000);
}
async function ensureExcelJS(){if(window.ExcelJS)return;await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';s.onload=resolve;s.onerror=()=>reject(new Error('Não foi possível carregar o gerador XLSX.'));document.head.appendChild(s)})}
async function parseMpp(file){
  const base=(localStorage.getItem('lps_api_base')||window.LPS_SCHEDULE_CONFIG?.apiBase||'').replace(/\/$/,'');if(!base)throw new Error('API LPS não configurada.');
  const fd=new FormData();fd.append('file',file,file.name);const r=await fetch(base+'/v1/parse/mpp',{method:'POST',body:fd});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.detail||j.error||`Falha ao ler o MPP (${r.status}).`);return j;
}
async function writePanelWorkbook(model){
  await ensureExcelJS();const series=buildDisciplineSeries(model);if(!series.results.length)throw new Error('Nenhuma disciplina reconhecida no cronograma para o padrão do Painel de Bordo.');
  const dates=dateRange(series,model),wb=new ExcelJS.Workbook();wb.creator='Lean Performance Solutions';wb.created=new Date();const ws=wb.addWorksheet('CURVA');
  ws.properties.defaultRowHeight=18;ws.getColumn(1).width=28;ws.getColumn(2).width=13;for(let c=3;c<3+dates.length;c++)ws.getColumn(c).width=12;
  const border={top:{style:'thin',color:{argb:'FF64748B'}},left:{style:'thin',color:{argb:'FF64748B'}},bottom:{style:'thin',color:{argb:'FF64748B'}},right:{style:'thin',color:{argb:'FF64748B'}}};
  const blue='FF1E3A8A',white='FFFFFFFF';let row=1;
  for(const disc of series.results){
    ws.mergeCells(row,1,row+5,1);const labelCell=ws.getCell(row,1);labelCell.value=disc.label;labelCell.alignment={horizontal:'center',vertical:'middle',wrapText:true};labelCell.font={name:'Calibri',size:10};labelCell.border=border;
    const names=['Data','Semana','Dia','Previsto','Replan','Realizado'];
    for(let rr=0;rr<6;rr++){
      const b=ws.getCell(row+rr,2);b.value=names[rr];b.fill={type:'pattern',pattern:'solid',fgColor:{argb:blue}};b.font={name:'Calibri',size:9,bold:true,color:{argb:white}};b.alignment={horizontal:'left',vertical:'middle'};b.border=border;
      for(let i=0;i<dates.length;i++){
        const cell=ws.getCell(row+rr,3+i),d=dates[i];
        if(rr===0){cell.value=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));cell.numFmt='dd/mm/yyyy'}
        else if(rr===1)cell.value='S'+String(isoWeek(d)).padStart(2,'0');
        else if(rr===2)cell.value=dayLabel(d);
        else if(rr===3){cell.value=valueAt(disc.prev,d);cell.numFmt='0.000000%'}
        else if(rr===4){cell.value=valueAt(disc.replan,d);cell.numFmt='0.000000%'}
        else{cell.value=valueAt(disc.real,d);cell.numFmt='0.000000%'}
        cell.font={name:'Calibri',size:8};cell.alignment={horizontal:'center',vertical:'middle'};cell.border=border;
      }
    }
    row+=6;if(disc!==series.results.at(-1)){ws.getRow(row).height=6;row++}
  }
  ws.views=[{state:'frozen',xSplit:2,ySplit:0}];
  const buffer=await wb.xlsx.writeBuffer(),blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`Curvas_S_Unificadas_${safeFileName(model.project?.title||model.project?.name||model.sourceName)}.xlsx`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
  return{disciplines:series.results.map(x=>x.label),dates:dates.length,missingWeights:series.missingWeights,fallbackCount:series.fallbackCount,originalId:series.originalId,replan:series.replan};
}

async function exportPanelCurve(){
  const input=$('#scheduleFile'),file=input?.files?.[0];if(!file)return status('Selecione/análise o cronograma antes de exportar a Curva S.','error');
  if(!/\.mpp$/i.test(file.name))return status('O exportador Painel de Bordo está fechado em MPP nesta versão.','error');
  const btn=$('#btnExportWorkbook'),old=btn?.textContent;if(btn){btn.disabled=true;btn.textContent='Gerando XLSX do painel…'}
  try{status('Lendo o cronograma e montando as curvas por disciplina…');const model=await parseMpp(file);const out=await writePanelWorkbook(model);const extra=out.fallbackCount?` · ${out.fallbackCount} distribuições com fallback`:'';status(`Curva S pronta para o Painel de Bordo: ${out.disciplines.length} disciplinas · ${out.dates} dias${extra}.`,'ok')}
  catch(e){console.error(e);status(e.message||'Erro ao gerar Curva S do Painel de Bordo.','error')}
  finally{if(btn){btn.disabled=false;btn.textContent=old||'Exportar XLSX'}}
}

function install(){
  const btn=$('#btnExportWorkbook');if(!btn||btn.dataset.panelExporter==='1')return;btn.dataset.panelExporter='1';btn.title='Gera Curvas S Unificadas no padrão exato de importação do Painel de Bordo';
  document.addEventListener('click',e=>{const t=e.target.closest?.('#btnExportWorkbook');if(!t)return;e.preventDefault();e.stopImmediatePropagation();exportPanelCurve()},true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
