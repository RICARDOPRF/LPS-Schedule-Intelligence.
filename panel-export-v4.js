(()=>{
'use strict';

const $=s=>document.querySelector(s);
const CURVE_BLOCKS=[
  ['Elétrica',1],['Mecânica',8],['Tubulação',15],['Fabricação de Tubulação',22],['Montagem de Tubulação',29],['Suportes',36],
  ['Equipamentos',43],['Estrutura',50],['Instrumentação',57],['Automação',64],['Refratário',71],['Civil',78],['Pintura',85],['Andaime',92],['Comissionamento',99]
];
const CURVE_FIRST_COL=3, CURVE_LAST_COL=251;
const HIST_FIRST_COL=4, HIST_LAST_COL=39, WEEK_HOURS=44;
const MOI_ROLES=['GERENTE DE CONTRATO','GERENTE DO PROJETO','ENGENHEIRO DE CONTRATO','GERENTE DE PRODUÇÃO','COORDENADOR DE PRODUÇÃO','SUPERVISOR DE MECANICA','SUPERVISOR DE TUBULAÇÃO','SUPERVISOR DE SOLDA','SUPERVISOR DE ESTRUTURAS','SUPERVISOR DE RIGGER','SUPERVISOR DE ELETRICA','SUPERVISOR DE INSTRUMENTAÇÃO','SUPERVISOR DE ANDAIME','GERENTE DA QUALIDADE','SUPERVISOR QUALIDADE','TÉCNICO DE DOCUMENTAÇÃO','ASSISTENTE DA QUALIDADE','INSPETOR DIMENSIONAL','INSPETOR','INSPETOR N1','RIGGER','TOPOGRAFO','AUXILIAR DE TOPOGRAFO','GERENTE DE PLANEJAMENTO','SUPERVISOR DE PLANEJAMENTO','TECNICO DE PLANEJAMENTO','ASSISTENTE DE PLANEJAMENTO','SUPERVISOR DE ENGENHARIA','ENGENHEIRO ESPECIALISTA','PROJETISTA','DESENHISTA / CADISTA','ASSISTENTE DE ENGENHARIA','GERENTE ADMINISTRATIVO','SUPERVISOR ADMINISTRATIVO','ENCARREGADO ADMINISTRATIVO','ASSITENTE ADMINISTRATIVO','ASSISTENTE SOCIAL','COMPRADOR','ENCARREGADO DE ALMOXARIFE','ALMOXARIFE','FERRAMENTEIRO','AUXILIAR DE ALMOXARIFADO','COPEIRA','MOTORISTA','VIGIA','COORDENADOR HSE','ENGENHEIRO DE SEGURANÇA','TÉCNICO DE SEGURANÇA','TECNICO DE ENFERMAGEM','MÉDICO DO TRABALHO','ENGENHEIRO DE MEIO AMBIENTE','TÉCNICO DE MEIO AMBIENTE'];
const MOD_ROLES=['ENCARREGADO / MESTRE','MECANICO AJUSTADOR','CALDEIREIRO','SOLDADOR TIG / ER','MECANICO MONTADOR','AJUDANTE','SOLDADOR RX','ENCANADOR INDUSTRIAL','ELETRICISTA MONTADOR','ELETRICISTA FORÇA E CONTROLE','INSTRUMENTISTA','TUBISTA','ENCANADOR PREDIAL','PEDREIRO','CARPINTEIRO','PINTOR','AUXILIAR DE SERVIÇOS GERAIS','SUPERVISOR DE MATERIAIS','TÉCNICO DE MATERIAIS','OFICIAIS DE MATERIAIS','SINALEIRO','OPERADOR DE VEICULOS PESADOS','VIGIA','VIGIA - NOITE','ENGENHEIRO DE CONTRATO','TÉCNICO DE AUTOMAÇÃO','MONTADOR DE ANDAIME','X'];

const norm=s=>(s??'').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const safe=s=>(s||'Cronograma').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,90)||'Cronograma';
const dateKey=v=>String(v||'').slice(0,10);
const parseDate=v=>{const m=dateKey(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?new Date(Date.UTC(+m[1],+m[2]-1,+m[3])):null};
const addDays=(d,n)=>{const x=new Date(+d);x.setUTCDate(x.getUTCDate()+n);return x};
const iso=d=>`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
const dayLabel=d=>['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][d.getUTCDay()];
function isoWeek(d){const x=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));const day=x.getUTCDay()||7;x.setUTCDate(x.getUTCDate()+4-day);const y0=new Date(Date.UTC(x.getUTCFullYear(),0,1));return Math.ceil((((x-y0)/86400000)+1)/7)}
function monday(d){const x=new Date(+d),day=x.getUTCDay()||7;x.setUTCDate(x.getUTCDate()-(day-1));return x}
function monthPt(d){return ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][d.getUTCMonth()]+'-'+String(d.getUTCFullYear()).slice(-2)}
function add(map,k,v){const n=Number(v)||0;if(k&&Math.abs(n)>1e-12)map.set(k,(map.get(k)||0)+n)}
function mergeMap(target,src){for(const[k,v]of src)add(target,k,v)}
function sumMap(m){return [...m.values()].reduce((a,b)=>a+(Number(b)||0),0)}
function customValue(task,re){for(const[k,v]of Object.entries(task.custom||{})){if(re.test(norm(k))&&String(v??'').trim())return String(v).trim()}return''}
function taskText(t){return norm([t.name,t.wbs,...Object.values(t.custom||{})].filter(Boolean).join(' '))}

function status(msg,kind='info'){
  let el=$('#lpsTemplateExportStatus');if(!el){el=document.createElement('div');el.id='lpsTemplateExportStatus';el.style.cssText='position:fixed;right:18px;bottom:18px;z-index:10050;max-width:560px;padding:13px 16px;border-radius:12px;color:#fff;box-shadow:0 10px 30px #0004;font:700 13px/1.45 Inter,Arial,sans-serif';document.body.appendChild(el)}
  el.textContent=msg;el.style.background=kind==='error'?'#991b1b':kind==='ok'?'#166534':'#1e3a8a';clearTimeout(status.timer);status.timer=setTimeout(()=>el?.remove(),kind==='ok'?9000:12000);
}
async function ensureExcelJS(){if(window.ExcelJS)return;await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';s.onload=resolve;s.onerror=()=>reject(new Error('Não foi possível carregar o gerador XLSX.'));document.head.appendChild(s)})}
async function saveWorkbook(wb,name){const buf=await wb.xlsx.writeBuffer();const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1800)}

let modelCache=null,cacheKey='';
async function parseMpp(file){
  const key=`${file.name}|${file.size}|${file.lastModified}`;if(modelCache&&cacheKey===key)return modelCache;
  const base=(localStorage.getItem('lps_api_base')||window.LPS_SCHEDULE_CONFIG?.apiBase||'').replace(/\/$/,'');if(!base)throw new Error('API LPS não configurada.');
  const fd=new FormData();fd.append('file',file,file.name);const r=await fetch(base+'/v1/parse/mpp',{method:'POST',body:fd});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.detail||j.error||`Falha ao ler o MPP (${r.status}).`);modelCache=j;cacheKey=key;return j;
}
function selectedFile(){const f=$('#scheduleFile')?.files?.[0];if(!f)throw new Error('Selecione e analise um cronograma .MPP primeiro.');if(!/\.mpp$/i.test(f.name))throw new Error('Os templates oficiais desta versão são gerados a partir de .MPP.');return f}
function baselineChoice(model){
  const ids=(model.baselines||[]).map(b=>String(b.id));const ui=String($('#baselineSelect')?.value||'current');
  const plannedBaseline=(ui!=='current'&&ids.includes(ui))?ui:null;
  return{plannedBaseline,useCurrentAsReplan:!!plannedBaseline,available:ids};
}
function assignmentIndex(model){const m=new Map();for(const a of model.assignments||[]){const k=String(a.taskUid);if(!m.has(k))m.set(k,[]);m.get(k).push(a)}return m}
function fallbackDaily(start,finish,total){const m=new Map(),s=parseDate(start),f=parseDate(finish);if(!s||!f||f<s||!(total>0))return m;const work=[];for(let d=s;d<=f;d=addDays(d,1))if(![0,6].includes(d.getUTCDay()))work.push(new Date(+d));if(!work.length)for(let d=s;d<=f;d=addDays(d,1))work.push(new Date(+d));const each=total/work.length;for(const d of work)m.set(iso(d),each);return m}
function assignmentSeries(a,kind,baselineId){const m=new Map();for(const d of a.dailyTimephased||[]){const k=dateKey(d.date);let v=0;if(kind==='actual')v=Number(d.actualHours)||0;else if(kind==='baseline')v=Number(d.baseline?.[String(baselineId)])||0;else if(kind==='remaining')v=Number(d.remainingHours)||0;else v=Number(d.workHours)||((Number(d.actualHours)||0)+(Number(d.remainingHours)||0))||Number(d.plannedHours)||0;if(v>0)add(m,k,v)}return m}

function inheritedContexts(model){
  const out=new Map(),stack=[];
  for(const t of model.tasks||[]){const level=Math.max(1,Number(t.outlineLevel)||1);while(stack.length>=level)stack.pop();const parent=stack.at(-1)||{};const phase=customValue(t,/^fase$/)||parent.phase||'';const disc=customValue(t,/^disciplina$|^discipline$/)||parent.disc||'';const sub=customValue(t,/^sub$|subdisciplina|subdisc|tipo do servico|tipo servico/ )||parent.sub||'';const ctx={phase,disc,sub};out.set(String(t.uid),ctx);stack.push(ctx)}return out;
}
function phaseMemberships(task,ctx){
  const phase=norm(ctx?.phase),disc=norm(ctx?.disc),sub=norm([ctx?.sub,task.name].join(' ')),all=taskText(task);
  if(phase){
    if(/eletric.*instrument|instrument.*eletric/.test(phase))return['Elétrica'];
    if(/fabric.*tub|fabric.*pipe|spool/.test(phase))return['Fabricação de Tubulação','Tubulação'];
    if(/montag.*tub|montag.*pipe/.test(phase))return['Montagem de Tubulação','Tubulação'];
    if(/montag.*suport|fabric.*suport|^suport/.test(phase))return['Suportes','Tubulação'];
    if(/^tubul|^piping/.test(phase))return['Tubulação'];
    if(/^mecan|mechanical/.test(phase))return['Mecânica'];
    if(/^eletric|electrical/.test(phase))return['Elétrica'];
    if(/^instrument/.test(phase))return['Instrumentação'];
    if(/^automacao|automation/.test(phase))return['Automação'];
    if(/equipamento|equipment/.test(phase))return['Equipamentos'];
    if(/estrutura|structur|steel/.test(phase))return['Estrutura'];
    if(/refrat|refractory/.test(phase))return['Refratário'];
    if(/civil/.test(phase))return['Civil'];
    if(/pintura|painting|coating/.test(phase))return['Pintura'];
    if(/andaime|scaffold/.test(phase))return['Andaime'];
    if(/comission|commission|startup|start up/.test(phase))return['Comissionamento'];
  }
  const source=disc||all;
  if(/eletric.*instrument|instrument.*eletric/.test(source))return['Elétrica'];
  if(/tubul|piping|pipe\b/.test(source)){if(/suport/.test(sub))return['Suportes','Tubulação'];if(/fabric|spool/.test(sub))return['Fabricação de Tubulação','Tubulação'];if(/montag/.test(sub))return['Montagem de Tubulação','Tubulação'];return['Tubulação']}
  const rules=[[/eletric|electrical/,'Elétrica'],[/instrument/,'Instrumentação'],[/automacao|automation/,'Automação'],[/mecan|mechanical/,'Mecânica'],[/equipamento|equipment/,'Equipamentos'],[/estrutura|structur|steel/,'Estrutura'],[/refrat|refractory/,'Refratário'],[/civil/,'Civil'],[/pintura|painting|coating/,'Pintura'],[/andaime|scaffold/,'Andaime'],[/comission|commission|startup|start up/,'Comissionamento']];for(const[re,label]of rules)if(re.test(source))return[label];return[];
}

function buildCurveSeries(model){
  const idx=assignmentIndex(model),bc=baselineChoice(model),contexts=inheritedContexts(model),groups=new Map(CURVE_BLOCKS.map(([x])=>[x,[]]));
  for(const t of model.tasks||[]){if(t.summary)continue;for(const g of phaseMemberships(t,contexts.get(String(t.uid))))groups.get(g)?.push(t)}
  const results=[];let fallback=0,noAssignment=0,noBaseline=0;
  for(const [label] of CURVE_BLOCKS){const tasks=groups.get(label)||[],prev=new Map(),replan=new Map(),real=new Map();
    for(const t of tasks){const aa=idx.get(String(t.uid))||[];
      if(aa.length){for(const a of aa){const current=assignmentSeries(a,'current'),actual=assignmentSeries(a,'actual');mergeMap(replan,current);mergeMap(real,actual);if(bc.plannedBaseline){const base=assignmentSeries(a,'baseline',bc.plannedBaseline);if(base.size)mergeMap(prev,base);else noBaseline++}else mergeMap(prev,current)}}
      else{noAssignment++;const cur=fallbackDaily(t.start,t.finish,Number(t.workHours)||0);mergeMap(replan,cur);if(!bc.plannedBaseline)mergeMap(prev,cur);if(Number(t.actualWorkHours)>0)mergeMap(real,fallbackDaily(t.actualStart||t.start,t.actualFinish||model.project?.statusDate||t.finish,Number(t.actualWorkHours)));fallback++}
    }
    if(bc.plannedBaseline&&!prev.size&&replan.size){mergeMap(prev,replan);noBaseline+=tasks.length}
    if(!replan.size&&prev.size)mergeMap(replan,prev);
    const prevTotal=sumMap(prev),replanTotal=sumMap(replan),realTotal=sumMap(real);results.push({label,tasks:tasks.length,prev,replan,real,prevTotal,replanTotal,realTotal,realPct:prevTotal?realTotal/prevTotal:0});
  }
  return{results,baseline:bc,fallback,noAssignment,noBaseline};
}
function allDatesCurve(series,model){const keys=[];for(const g of series.results)for(const m of[g.prev,g.replan,g.real])keys.push(...m.keys());const sorted=[...new Set(keys)].sort();const min=sorted[0]||dateKey(model.project?.start),max=sorted.at(-1)||dateKey(model.project?.finish);const s=parseDate(min),f=parseDate(max);if(!s||!f||f<s)throw new Error('Não foi possível determinar as datas da Curva S.');const out=[];for(let d=s;d<=f;d=addDays(d,1))out.push(new Date(+d));if(out.length>(CURVE_LAST_COL-CURVE_FIRST_COL+1))throw new Error(`O cronograma possui ${out.length} dias no intervalo da curva e o template comporta ${CURVE_LAST_COL-CURVE_FIRST_COL+1}. Ajuste o intervalo/template antes de exportar.`);return out}
function mapValue(map,d){return Number(map.get(iso(d)))||0}

function createCurveTemplate(){
  const wb=new ExcelJS.Workbook(),ws=wb.addWorksheet('CURVA');wb.creator='Lean Performance Solutions';ws.getColumn(1).width=28;ws.getColumn(2).width=15;for(let c=CURVE_FIRST_COL;c<=CURVE_LAST_COL;c++)ws.getColumn(c).width=12;ws.views=[{state:'frozen',xSplit:2,topLeftCell:'C1',activeCell:'C1'}];
  const labelStyle={font:{name:'Calibri',size:11,bold:true,color:{argb:'FFFFFFFF'}},fill:{type:'pattern',pattern:'solid',fgColor:{argb:'FF1E3A8A'}},alignment:{horizontal:'center',vertical:'middle'}};
  const border={bottom:{style:'thin',color:{argb:'FFD1D5DB'}}};
  for(const[label,r]of CURVE_BLOCKS){ws.getCell(r,1).value=label;['Data','Semana','Dia','Previsto','Replan','Realizado'].forEach((v,i)=>{const c=ws.getCell(r+i,2);c.value=v;c.font={...labelStyle.font};c.fill={...labelStyle.fill};c.alignment={...labelStyle.alignment}});for(let rr=r;rr<=r+5;rr++)for(let c=CURVE_FIRST_COL;c<=CURVE_LAST_COL;c++){const cell=ws.getCell(rr,c);cell.border=border;if(rr===r)cell.numFmt='dd/mm/yyyy';else if(rr>=r+3)cell.numFmt='0.000000%'}}return wb;
}
async function buildCurveWorkbook(model){
  await ensureExcelJS();const series=buildCurveSeries(model),dates=allDatesCurve(series,model),wb=createCurveTemplate(),ws=wb.getWorksheet('CURVA');
  for(const g of series.results){const r=CURVE_BLOCKS.find(x=>x[0]===g.label)?.[1];if(!r)continue;for(let c=CURVE_FIRST_COL;c<=CURVE_LAST_COL;c++){for(let rr=r;rr<=r+5;rr++)ws.getCell(rr,c).value=null}
    dates.forEach((d,j)=>{const c=CURVE_FIRST_COL+j;ws.getCell(r,c).value=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));ws.getCell(r+1,c).value='S'+String(isoWeek(d)).padStart(2,'0');ws.getCell(r+2,c).value=dayLabel(d);ws.getCell(r+3,c).value=g.prevTotal?mapValue(g.prev,d)/g.prevTotal:0;ws.getCell(r+4,c).value=g.replanTotal?mapValue(g.replan,d)/g.replanTotal:0;ws.getCell(r+5,c).value=g.prevTotal?mapValue(g.real,d)/g.prevTotal:0})
  }
  return{wb,name:`Curvas_S_Unificadas_${safe(model.project?.name||model.sourceName)}.xlsx`,series,dates};
}
function renderCurvePreview(out){const canvas=$('#curveChart');if(!canvas||!window.Chart)return;Chart.getChart(canvas)?.destroy();const target=out.series.results.find(x=>x.label==='Elétrica'&&x.prevTotal>0)||out.series.results.find(x=>x.prevTotal>0);if(!target)return;const labels=out.dates.map(d=>d.toLocaleDateString('pt-BR',{timeZone:'UTC'})),planned=[],real=[];let p=0,r=0;for(const d of out.dates){p+=target.prevTotal?mapValue(target.prev,d)/target.prevTotal*100:0;r+=target.prevTotal?mapValue(target.real,d)/target.prevTotal*100:0;planned.push(p);real.push(r)}new Chart(canvas,{type:'line',data:{labels,datasets:[{label:`Previsto · ${target.label}`,data:planned,borderColor:'#1e3a8a',tension:.2,pointRadius:0},{label:`Realizado · ${target.label}`,data:real,borderColor:'#dc2626',tension:.2,pointRadius:0}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{beginAtZero:true,ticks:{callback:v=>v+'%'}}}}});$('#curveBasis').textContent='Uso da Tarefa diário · Fase → disciplina · Real = Trabalho Real / Trabalho Previsto da disciplina';}

function roleType(role,group=''){
  const g=norm(group);if(/\bmod\b|mao de obra direta|direta/.test(g))return'MOD';if(/\bmoi\b|mao de obra indireta|indireta/.test(g))return'MOI';const inMoi=MOI_ROLES.includes(role),inMod=MOD_ROLES.includes(role);if(inMoi&&!inMod)return'MOI';if(inMod&&!inMoi)return'MOD';if(role==='VIGIA'||role==='X')return'MOD';return'MOI';
}
function resourceRole(name,group=''){
  const n=norm(name),g=norm(group);if(!n)return null;if(/guindaste|munck|pemt|plataforma|caminhao munck|equipamento|gerador/.test(n))return null;
  const standards=[...new Set([...MOI_ROLES,...MOD_ROLES])];const exact=standards.find(x=>norm(x)===n);if(exact)return{role:exact,type:roleType(exact,g)};
  const text=`${n} ${g}`;const aliases=[
    [/mecanico montador|mec montador/,'MECANICO MONTADOR'],[/mecanico ajustador/,'MECANICO AJUSTADOR'],[/eletricista.*forca|eletricista.*controle|eletricista fc|\bfc\b/,'ELETRICISTA FORÇA E CONTROLE'],[/eletricista/,'ELETRICISTA MONTADOR'],[/instrumentista/,'INSTRUMENTISTA'],[/caldeireiro/,'CALDEIREIRO'],[/soldador.*rx/,'SOLDADOR RX'],[/soldador/,'SOLDADOR TIG / ER'],[/encanador industrial/,'ENCANADOR INDUSTRIAL'],[/tubista/,'TUBISTA'],[/ajudante|ajudante geral/,'AJUDANTE'],[/auxiliar.*servico.*geral/,'AUXILIAR DE SERVIÇOS GERAIS'],[/montador.*andaime|andaimeiro/,'MONTADOR DE ANDAIME'],[/pintor/,'PINTOR'],[/pedreiro/,'PEDREIRO'],[/carpinteiro/,'CARPINTEIRO'],[/sinaleiro/,'SINALEIRO'],[/operador.*veiculo|operador.*pesado/,'OPERADOR DE VEICULOS PESADOS'],[/rigger/,'RIGGER'],[/tecnico.*automacao/,'TÉCNICO DE AUTOMAÇÃO'],[/supervisor.*mecan/,'SUPERVISOR DE MECANICA'],[/supervisor.*tub/,'SUPERVISOR DE TUBULAÇÃO'],[/supervisor.*solda/,'SUPERVISOR DE SOLDA'],[/supervisor.*estrutura/,'SUPERVISOR DE ESTRUTURAS'],[/supervisor.*eletr/,'SUPERVISOR DE ELETRICA'],[/supervisor.*instrument/,'SUPERVISOR DE INSTRUMENTAÇÃO'],[/supervisor.*andaime/,'SUPERVISOR DE ANDAIME'],[/tecnico.*planejamento|planejador/,'TECNICO DE PLANEJAMENTO'],[/supervisor.*planejamento/,'SUPERVISOR DE PLANEJAMENTO'],[/gerente.*planejamento/,'GERENTE DE PLANEJAMENTO'],[/tecnico.*seguranca/,'TÉCNICO DE SEGURANÇA'],[/engenheiro.*seguranca/,'ENGENHEIRO DE SEGURANÇA'],[/coordenador.*hse/,'COORDENADOR HSE'],[/almoxarife/,'ALMOXARIFE'],[/motorista/,'MOTORISTA'],[/vigia.*noite/,'VIGIA - NOITE'],[/vigia/,'VIGIA'],[/encarregado.*mestre|mestre.*obra/,'ENCARREGADO / MESTRE']];
  for(const[re,role]of aliases)if(re.test(text))return{role,type:roleType(role,g)};return{unmapped:true,name:String(name),group:String(group||'')};
}
function weekKeyFromDate(k){const d=parseDate(k);return d?iso(monday(d)):''}
function addWeek(map,date,h){const k=weekKeyFromDate(date);if(k&&h)add(map,k,h)}
function buildHistogramSeries(model){
  const resMap=new Map((model.resources||[]).map(r=>[String(r.uid),r])),bc=baselineChoice(model),roles={MOI:new Map(),MOD:new Map()},unmapped=new Map();
  for(const a of model.assignments||[]){const r=resMap.get(String(a.resourceUid))||{},name=String(a.resourceName||r.name||''),group=String(a.resourceGroup||r.group||''),rr=resourceRole(name,group);if(!rr)continue;if(rr.unmapped){const key=`${name}|${group}`;unmapped.set(key,(unmapped.get(key)||0)+1);continue}const bucket=roles[rr.type];if(!bucket.has(rr.role))bucket.set(rr.role,{prev:new Map(),real:new Map(),proj:new Map()});const b=bucket.get(rr.role),daily=a.dailyTimephased||[];
    if(daily.length){for(const d of daily){const day=dateKey(d.date),current=Number(d.workHours)||((Number(d.actualHours)||0)+(Number(d.remainingHours)||0))||Number(d.plannedHours)||0,actual=Number(d.actualHours)||0,base=bc.plannedBaseline?(Number(d.baseline?.[String(bc.plannedBaseline)])||0):current;addWeek(b.prev,day,base);addWeek(b.real,day,actual);addWeek(b.proj,day,current)}}
    else{const t=(model.tasks||[]).find(x=>String(x.uid)===String(a.taskUid)),cur=fallbackDaily(t?.start,t?.finish,Number(a.workHours)||0),act=fallbackDaily(t?.actualStart||t?.start,t?.actualFinish||model.project?.statusDate||t?.finish,Number(a.actualWorkHours)||0);for(const[k,v]of cur){addWeek(b.prev,k,v);addWeek(b.proj,k,v)}for(const[k,v]of act)addWeek(b.real,k,v)}
  }
  const allWeeks=[];for(const type of['MOI','MOD'])for(const b of roles[type].values())for(const m of[b.prev,b.real,b.proj])allWeeks.push(...m.keys());const sorted=[...new Set(allWeeks)].sort();let s=parseDate(sorted[0]||iso(monday(parseDate(model.project?.start)||new Date()))),f=parseDate(sorted.at(-1)||iso(monday(parseDate(model.project?.finish)||new Date())));if(!s||!f||f<s)throw new Error('Não foi possível determinar as semanas do histograma.');const weeks=[];for(let d=s;d<=f;d=addDays(d,7))weeks.push(new Date(+d));if(weeks.length>(HIST_LAST_COL-HIST_FIRST_COL+1))throw new Error(`O cronograma exige ${weeks.length} semanas e o template comporta ${HIST_LAST_COL-HIST_FIRST_COL+1}.`);return{roles,weeks,baseline:bc,unmapped:[...unmapped.keys()].map(k=>{const[name,group]=k.split('|');return{name,group,count:unmapped.get(k)}})};
}
function fontFor(kind){if(kind==='prev')return{name:'Calibri',size:11,bold:true,color:{argb:'FF008000'}};if(kind==='real')return{name:'Calibri',size:11,color:{argb:'FFFF0000'}};return{name:'Calibri',size:11,color:{argb:'FF0000FF'}}}
function createHistogramTemplate(){
  const wb=new ExcelJS.Workbook();wb.creator='Lean Performance Solutions';
  for(const[type,roles,totalRow,totalText]of[['MOI',MOI_ROLES,161,'TOTAL MÃO DE OBRA INDIRETA'],['MOD',MOD_ROLES,89,'TOTAL MÃO DE OBRA DIRETA']]){const ws=wb.addWorksheet(`Histograma_${type}`);ws.getColumn(1).width=7;ws.getColumn(2).width=32;ws.getColumn(3).width=10;for(let c=HIST_FIRST_COL;c<=HIST_LAST_COL;c++)ws.getColumn(c).width=11;ws.views=[{state:'frozen',xSplit:3,ySplit:4,topLeftCell:'D5',activeCell:'D5'}];const headerFill={type:'pattern',pattern:'solid',fgColor:{argb:'FFD9E2F3'}},headFont={name:'Calibri',size:11,bold:true,color:{argb:'FF1F2937'}};ws.getCell('A2').value='ID';ws.getCell('B2').value='DESCRIÇÃO';for(let c=1;c<=HIST_LAST_COL;c++){for(let r=2;r<=4;r++){const cell=ws.getCell(r,c);if(c<=3&&r>2)continue;cell.fill=headerFill;cell.font=headFont;if(c>=4)cell.alignment={horizontal:'center'}}}let row=5,id=1;for(const role of roles){ws.getCell(row,1).value=id++;ws.getCell(row,2).value=role;ws.getCell(row,3).value='Prev.';ws.getCell(row+1,3).value='Real.';ws.getCell(row+2,3).value='Proj.';for(const[rr,kind]of[[row,'prev'],[row+1,'real'],[row+2,'proj']]){ws.getCell(rr,3).font=fontFor(kind);for(let c=HIST_FIRST_COL;c<=HIST_LAST_COL;c++){const cell=ws.getCell(rr,c);cell.value=0;cell.numFmt='0.00';cell.font=fontFor(kind)}}row+=3}const totalFill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF3F4F6'}};ws.getCell(totalRow,1).value=totalText;ws.getCell(totalRow,1).font={name:'Calibri',size:11,bold:true};for(let rr=totalRow;rr<=totalRow+2;rr++){for(let c=1;c<=HIST_LAST_COL;c++)ws.getCell(rr,c).fill=totalFill;const kind=rr===totalRow?'prev':rr===totalRow+1?'real':'proj';ws.getCell(rr,3).value=kind==='prev'?'Prev.':kind==='real'?'Real.':'Proj.';ws.getCell(rr,3).font=fontFor(kind);for(let c=HIST_FIRST_COL;c<=HIST_LAST_COL;c++){ws.getCell(rr,c).value=0;ws.getCell(rr,c).numFmt='0.00';ws.getCell(rr,c).font=fontFor(kind)}}}
  return wb;
}
function roleRows(ws){const m=new Map();for(let r=5;r<=ws.rowCount;r+=3){const name=String(ws.getCell(r,2).value||'').trim();if(name)m.set(name,r)}return m}
function fillHistogramSheet(ws,type,h){
  const rows=roleRows(ws),map=h.roles[type];for(let c=HIST_FIRST_COL;c<=HIST_LAST_COL;c++){for(let r=2;r<=ws.rowCount;r++){if(r>=5)ws.getCell(r,c).value=0}else{} }
  h.weeks.forEach((mon,j)=>{const c=HIST_FIRST_COL+j,fr=addDays(mon,4),prevMonth=j?monthPt(addDays(h.weeks[j-1],4)):'';ws.getCell(2,c).value=(j===0||monthPt(fr)!==prevMonth)?monthPt(fr):'';ws.getCell(3,c).value=new Date(Date.UTC(fr.getUTCFullYear(),fr.getUTCMonth(),fr.getUTCDate()));ws.getCell(3,c).numFmt='dd/mm/yy';ws.getCell(4,c).value='S'+String(isoWeek(fr)).padStart(2,'0')});
  for(const[role,b]of map){const row=rows.get(role);if(!row)continue;h.weeks.forEach((mon,j)=>{const k=iso(mon),c=HIST_FIRST_COL+j;ws.getCell(row,c).value=(b.prev.get(k)||0)/WEEK_HOURS;ws.getCell(row+1,c).value=(b.real.get(k)||0)/WEEK_HOURS;ws.getCell(row+2,c).value=(b.proj.get(k)||0)/WEEK_HOURS})}
  const totalRow=type==='MOI'?161:89;h.weeks.forEach((mon,j)=>{const k=iso(mon),c=HIST_FIRST_COL+j;let p=0,r=0,q=0;for(const b of map.values()){p+=(b.prev.get(k)||0)/WEEK_HOURS;r+=(b.real.get(k)||0)/WEEK_HOURS;q+=(b.proj.get(k)||0)/WEEK_HOURS}ws.getCell(totalRow,c).value=p;ws.getCell(totalRow+1,c).value=r;ws.getCell(totalRow+2,c).value=q});
}
async function buildHistogramWorkbook(model){await ensureExcelJS();const h=buildHistogramSeries(model),wb=createHistogramTemplate();fillHistogramSheet(wb.getWorksheet('Histograma_MOI'),'MOI',h);fillHistogramSheet(wb.getWorksheet('Histograma_MOD'),'MOD',h);return{wb,name:`Histograma_MO_${safe(model.project?.name||model.sourceName)}.xlsx`,hist:h}}
function renderHistPreview(out){const canvas=$('#histChart');if(!canvas||!window.Chart)return;Chart.getChart(canvas)?.destroy();const h=out.hist,labels=h.weeks.map(m=>'S'+String(isoWeek(addDays(m,4))).padStart(2,'0')),prev=[],real=[],proj=[];for(const mon of h.weeks){const k=iso(mon);let p=0,r=0,q=0;for(const type of['MOI','MOD'])for(const b of h.roles[type].values()){p+=(b.prev.get(k)||0)/WEEK_HOURS;r+=(b.real.get(k)||0)/WEEK_HOURS;q+=(b.proj.get(k)||0)/WEEK_HOURS}prev.push(p);real.push(r);proj.push(q)}new Chart(canvas,{type:'bar',data:{labels,datasets:[{label:'Prev.',data:prev,backgroundColor:'#1e3a8a'},{label:'Real.',data:real,backgroundColor:'#dc2626'},{label:'Proj.',data:proj,backgroundColor:'#2563eb'}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{beginAtZero:true,title:{display:true,text:'Pessoas'}}}}});$('#histBasis').textContent='Uso da Tarefa/recursos em HH · semanal ÷ 44 h/pessoa · Prev./Real./Proj. por função';}

async function runCurve(){const btn=$('#btnGenerateCurves'),old=btn?.textContent;try{if(btn){btn.disabled=true;btn.textContent='Gerando Curva S…'}status('Lendo todas as atribuições e Uso da Tarefa diário do MPP…');const model=await parseMpp(selectedFile()),out=await buildCurveWorkbook(model);renderCurvePreview(out);await saveWorkbook(out.wb,out.name);const e=out.series.results.find(x=>x.label==='Elétrica'),f=out.series.results.find(x=>x.label==='Fabricação de Tubulação');status(`Curva S baixada no layout fixo. Elétrica ${((e?.realPct||0)*100).toFixed(2)}% · Fabricação Tub ${((f?.realPct||0)*100).toFixed(2)}%.`,'ok')}catch(e){console.error(e);status(e.message||'Erro ao gerar Curva S.','error')}finally{if(btn){btn.disabled=false;btn.textContent=old||'Gerar Curva S'}}}
async function runHistogram(){const btn=$('#btnExportWorkbook'),old=btn?.textContent;try{if(btn){btn.disabled=true;btn.textContent='Gerando Histograma…'}status('Lendo recursos, Trabalho, Trabalho Real e distribuição semanal…');const model=await parseMpp(selectedFile()),out=await buildHistogramWorkbook(model);renderHistPreview(out);await saveWorkbook(out.wb,out.name);const unm=out.hist.unmapped;if(unm.length){const sample=unm.slice(0,4).map(x=>x.name).join(', ');status(`Histograma baixado. ${unm.length} recurso(s) ficaram sem mapeamento e NÃO foram jogados em linha genérica: ${sample}${unm.length>4?'…':''}`,'error')}else status('Histograma baixado no layout fixo com Prev./Real./Proj. preenchidos por função e semana.','ok')}catch(e){console.error(e);status(e.message||'Erro ao gerar Histograma.','error')}finally{if(btn){btn.disabled=false;btn.textContent=old||'Gerar Histograma'}}}
function install(){const curve=$('#btnGenerateCurves'),hist=$('#btnExportWorkbook');if(curve){curve.textContent='Gerar Curva S';curve.title='Gera e baixa a Curva S no layout fixo do template LPS'}if(hist){hist.textContent='Gerar Histograma';hist.title='Gera e baixa o Histograma MOI/MOD no layout fixo do template LPS'}document.addEventListener('click',e=>{if(e.target.closest?.('#btnGenerateCurves')){e.preventDefault();e.stopImmediatePropagation();runCurve();return}if(e.target.closest?.('#btnExportWorkbook')){e.preventDefault();e.stopImmediatePropagation();runHistogram()}},true)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
