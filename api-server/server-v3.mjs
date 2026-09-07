import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import { XMLParser } from 'fast-xml-parser';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { spawn } from 'node:child_process';

const app = express();
const PORT = Number(process.env.PORT || 8787);
const allowedOrigins = (process.env.LPS_ALLOWED_ORIGINS || 'https://ricardoprf.github.io')
  .split(',').map(x => x.trim()).filter(Boolean);

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin(origin, cb) {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Origin not allowed'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
}));
app.use(express.json({ limit: '1mb' }));

const parseLimiter = rateLimit({
  windowMs: 60_000,
  limit: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas análises em pouco tempo. Aguarde alguns segundos e tente novamente.' }
});
const upload = multer({storage: multer.memoryStorage(), limits: {fileSize: 80 * 1024 * 1024, files: 1}});

function arr(v){return v==null?[]:Array.isArray(v)?v:[v]}
function n(v){const x=Number(v);return Number.isFinite(x)?x:0}
function bool(v){return v===true||v===1||v==='1'||String(v).toLowerCase()==='true'}
function dur(v){
  if(!v)return 0;if(typeof v==='number')return v;const s=String(v).trim();
  const m=s.match(/^(-)?P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
  if(!m)return n(s);const sign=m[1]?-1:1;return sign*(n(m[2])*24+n(m[3])+n(m[4])/60+n(m[5])/3600);
}
function relationType(v){const s=String(v??'').toLowerCase().trim();if(['0','fs','finish-to-start','finish to start'].includes(s))return'FS';if(['1','ss','start-to-start','start to start'].includes(s))return'SS';if(['2','ff','finish-to-finish','finish to finish'].includes(s))return'FF';if(['3','sf','start-to-finish','start to finish'].includes(s))return'SF';return String(v||'FS').toUpperCase()}
function sanitizeName(name){return basename(name||'schedule.mpp').replace(/[^a-zA-Z0-9._-]/g,'_')}
function rawTimephased(x){if(!x)return null;const start=String(x.Start??''),finish=String(x.Finish??''),valueHours=dur(x.Value);if(!start&&!finish&&!valueHours)return null;return{type:String(x.Type??''),start,finish,valueHours}}

function runJava(input, outputXml, outputDaily, timeoutMs=180000){
  const jar=process.env.MPXJ_FAT_JAR||'/app/java/lps-mpp-converter.jar';
  return new Promise((resolve,reject)=>{
    const child=spawn(process.env.JAVA_BIN||'java',['-jar',jar,input,outputXml,outputDaily],{stdio:['ignore','pipe','pipe']});let stderr='';
    child.stderr.on('data',d=>{stderr+=d.toString().slice(0,12000)});
    const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error(`Parser timeout after ${timeoutMs}ms`))},timeoutMs);
    child.on('error',e=>{clearTimeout(timer);reject(e)});
    child.on('close',code=>{clearTimeout(timer);code===0?resolve():reject(new Error(`MPXJ exited ${code}: ${stderr.slice(-4000)}`))});
  });
}

function canonicalizeMSPDI(xml,sourceName){
  const parser=new XMLParser({ignoreAttributes:false,parseTagValue:false,trimValues:true});const parsed=parser.parse(xml);const P=parsed.Project||parsed.project;if(!P)throw new Error('MPXJ não retornou um Project XML válido.');
  const fieldDefs={};for(const f of arr(P.ExtendedAttributes?.ExtendedAttribute)){if(f.FieldID&&f.FieldName)fieldDefs[String(f.FieldID)]=String(f.FieldName)}
  const tasks=arr(P.Tasks?.Task).map((t,i)=>{
    const custom={};for(const e of arr(t.ExtendedAttribute)){const id=String(e.FieldID??'');if(e.Value!=null&&String(e.Value)!=='')custom[fieldDefs[id]||id]=String(e.Value)}
    const baselines=arr(t.Baseline).map(b=>({id:String(b.Number??'0'),start:String(b.Start??''),finish:String(b.Finish??''),workHours:dur(b.Work),cost:n(b.Cost)})).filter(b=>b.start||b.finish||b.workHours||b.cost);
    const predecessors=arr(t.PredecessorLink).map(p=>({uid:String(p.PredecessorUID??''),type:relationType(p.Type),lagHours:n(p.LinkLag)/600})).filter(p=>p.uid);
    return{uid:String(t.UID??i+1),id:String(t.ID??i+1),wbs:String(t.WBS??t.OutlineNumber??''),name:String(t.Name??`Atividade ${i+1}`),outlineLevel:n(t.OutlineLevel),summary:bool(t.Summary),milestone:bool(t.Milestone),start:String(t.Start??''),finish:String(t.Finish??''),actualStart:String(t.ActualStart??''),actualFinish:String(t.ActualFinish??''),durationHours:dur(t.Duration),workHours:dur(t.Work),actualWorkHours:dur(t.ActualWork),remainingWorkHours:dur(t.RemainingWork),percentComplete:n(t.PercentComplete),physicalPercent:n(t.PhysicalPercentComplete),totalFloatHours:dur(t.TotalSlack),critical:bool(t.Critical),constraintType:String(t.ConstraintType??''),constraintDate:String(t.ConstraintDate??''),predecessors,successors:[],baselines,timephased:arr(t.TimephasedData).map(rawTimephased).filter(Boolean),baselineTimephased:[],resourceNames:[],custom,weight:0};
  }).filter(t=>t.name);
  const resources=arr(P.Resources?.Resource).map(r=>({uid:String(r.UID??''),name:String(r.Name??''),group:String(r.Group??''),type:String(r.Type??'')})).filter(r=>r.name);
  const taskMap=Object.fromEntries(tasks.map(t=>[t.uid,t])),resMap=Object.fromEntries(resources.map(r=>[r.uid,r]));
  const assignments=arr(P.Assignments?.Assignment).map(a=>({uid:String(a.UID??''),taskUid:String(a.TaskUID??''),resourceUid:String(a.ResourceUID??''),workHours:dur(a.Work),actualWorkHours:dur(a.ActualWork),remainingWorkHours:dur(a.RemainingWork),timephased:arr(a.TimephasedData).map(rawTimephased).filter(Boolean),baselineTimephased:[],dailyTimephased:[]}));
  for(const a of assignments){const t=taskMap[a.taskUid],r=resMap[a.resourceUid];if(t&&r?.name&&!t.resourceNames.includes(r.name))t.resourceNames.push(r.name)}
  for(const t of tasks)for(const rel of t.predecessors){const p=taskMap[rel.uid];if(p&&!p.successors.some(x=>x.uid===t.uid))p.successors.push({uid:t.uid,type:rel.type,lagHours:rel.lagHours})}
  const baselineMap=new Map();for(const t of tasks)for(const b of t.baselines){const cur=baselineMap.get(b.id)||{id:b.id,name:`Linha de Base ${b.id==='0'?'':b.id}`.trim(),count:0};cur.count++;baselineMap.set(b.id,cur)}
  return{format:'Microsoft Project MPP',sourceName,project:{name:String(P.Name??sourceName),title:String(P.Title??''),start:String(P.StartDate??''),finish:String(P.FinishDate??''),statusDate:String(P.StatusDate??P.CurrentDate??'')},tasks,resources,assignments,baselines:[...baselineMap.values()],hasTimephased:false,hasDailyTimephased:false,customFieldNames:[...new Set(Object.values(fieldDefs))],parserEngine:'mpxj-java'};
}

function mergeDailyTimephased(model,daily){
  const assignmentByUid=new Map(model.assignments.map(a=>[String(a.uid),a]));
  const assignmentByPair=new Map(model.assignments.map(a=>[`${a.taskUid}|${a.resourceUid}`,a]));
  const taskByUid=new Map(model.tasks.map(t=>[String(t.uid),t]));
  // Daily MPXJ output replaces raw XML blocks for calculations.
  model.tasks.forEach(t=>{t.timephased=[];t.baselineTimephased=[]});
  model.assignments.forEach(a=>{a.timephased=[];a.baselineTimephased=[];a.dailyTimephased=[]});
  let dailyPoints=0,baselinePoints=0;
  for(const src of arr(daily?.assignments)){
    const a=assignmentByUid.get(String(src.uid))||assignmentByPair.get(`${src.taskUid}|${src.resourceUid}`);if(!a)continue;
    const t=taskByUid.get(String(a.taskUid));
    for(const day of arr(src.days)){
      const date=String(day.date||'');if(!date)continue;const finish=`${date}T23:59:59`;
      const actual=n(day.actual),remaining=n(day.remaining),work=n(day.work),planned=n(day.planned);
      a.dailyTimephased.push({date,workHours:work,actualHours:actual,remainingHours:remaining,plannedHours:planned,baseline:day.baseline||{}});
      if(Math.abs(actual)>1e-9){const p={type:'actual',start:`${date}T00:00:00`,finish,valueHours:actual};a.timephased.push(p);if(t)t.timephased.push({...p,resourceUid:a.resourceUid});dailyPoints++}
      if(Math.abs(remaining)>1e-9){const p={type:'remaining',start:`${date}T00:00:00`,finish,valueHours:remaining};a.timephased.push(p);if(t)t.timephased.push({...p,resourceUid:a.resourceUid});dailyPoints++}
      // Some manually scheduled assignments expose planned work while actual/remaining are empty.
      if(Math.abs(actual)<=1e-9&&Math.abs(remaining)<=1e-9&&Math.abs(planned)>1e-9){const p={type:'planned',start:`${date}T00:00:00`,finish,valueHours:planned};a.timephased.push(p);if(t)t.timephased.push({...p,resourceUid:a.resourceUid});dailyPoints++}
      for(const [baselineId,valueRaw] of Object.entries(day.baseline||{})){const value=n(valueRaw);if(Math.abs(value)<=1e-9)continue;const p={baselineId:String(baselineId),start:`${date}T00:00:00`,finish,valueHours:value};a.baselineTimephased.push(p);if(t)t.baselineTimephased.push({...p,resourceUid:a.resourceUid});baselinePoints++}
    }
  }
  model.hasDailyTimephased=dailyPoints>0;model.hasTimephased=model.hasDailyTimephased;model.dailyTimephasedPoints=dailyPoints;model.baselineTimephasedPoints=baselinePoints;return model;
}

app.get('/health',(req,res)=>res.json({service:'LPS Schedule Intelligence API',status:'ok',version:'0.4.0',mppParser:'mpxj-java-daily',retention:false}));
app.get('/tools/lps-mpp-converter.jar',(req,res)=>res.download(process.env.MPXJ_FAT_JAR||'/app/java/lps-mpp-converter.jar','lps-mpp-converter.jar'));
app.post('/v1/parse/mpp',parseLimiter,upload.single('file'),async(req,res)=>{
  if(!req.file||!req.file.originalname.toLowerCase().endsWith('.mpp'))return res.status(400).json({error:'Selecione um arquivo .MPP válido.'});
  const dir=await mkdtemp(join(tmpdir(),'lps-schedule-')),input=join(dir,sanitizeName(req.file.originalname)),outputXml=join(dir,'converted.xml'),outputDaily=join(dir,'daily-timephased.json'),started=Date.now();
  try{
    await writeFile(input,req.file.buffer,{mode:0o600});await runJava(input,outputXml,outputDaily);
    const [xml,dailyText]=await Promise.all([readFile(outputXml,'utf8'),readFile(outputDaily,'utf8')]);
    const model=mergeDailyTimephased(canonicalizeMSPDI(xml,req.file.originalname),JSON.parse(dailyText));model.processingMs=Date.now()-started;res.json(model);
  }catch(e){console.error('MPP parse failed:',String(e?.message||e).slice(0,3000));res.status(422).json({error:'Não foi possível ler este arquivo MPP.',detail:String(e?.message||e).slice(0,900)})}
  finally{await rm(dir,{recursive:true,force:true}).catch(()=>{})}
});
app.post('/v1/learning/observe',(req,res)=>res.status(204).end());
app.post('/v1/learning/correction',(req,res)=>res.status(204).end());
app.post('/v1/ai/report',(req,res)=>res.status(503).json({error:'IA opcional ainda não configurada.'}));
app.use((err,req,res,next)=>{if(err?.code==='LIMIT_FILE_SIZE')return res.status(413).json({error:'Arquivo maior que 80 MB.'});if(String(err?.message||'').includes('Origin not allowed'))return res.status(403).json({error:'Origem não autorizada.'});console.error(err);res.status(500).json({error:'Erro interno da API.'})});
app.listen(PORT,'0.0.0.0',()=>console.log(`LPS Schedule Intelligence API v0.4.0 listening on ${PORT}`));
