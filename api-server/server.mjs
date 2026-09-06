import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose';
import { XMLParser } from 'fast-xml-parser';
import { convert } from '@byteink/mppjs';
import { mkdtemp, writeFile, readFile, rm, mkdir, appendFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, basename, dirname } from 'node:path';
import { randomBytes, createCipheriv, createHash, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';

const app=express();
const PORT=Number(process.env.PORT||8787);
const origins=(process.env.LPS_ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
app.set('trust proxy',1);
app.use(helmet({crossOriginResourcePolicy:{policy:'cross-origin'}}));
app.use(cors({origin(origin,cb){if(!origin||origins.includes(origin))return cb(null,true);cb(new Error('Origin not allowed'));},credentials:true}));
app.use(express.json({limit:'1mb'}));
app.use(rateLimit({windowMs:60_000,limit:30,standardHeaders:true,legacyHeaders:false}));
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:80*1024*1024,files:1}});

let jwks=null;
if(process.env.AUTH_JWKS_URL)jwks=createRemoteJWKSet(new URL(process.env.AUTH_JWKS_URL));
const sessionKey=process.env.LPS_SESSION_SECRET?Buffer.from(process.env.LPS_SESSION_SECRET,'base64'):null;

async function auth(req,res,next){
 try{
  const h=req.headers.authorization||'';const token=h.startsWith('Bearer ')?h.slice(7):'';
  if(sessionKey&&sessionKey.length===32&&token){
   try{const {payload}=await jwtVerify(token,sessionKey,{issuer:'lps-schedule-intelligence',audience:'lps-app'});if(payload.scope==='app')return next();}catch{}
  }
  if(jwks&&token){await jwtVerify(token,jwks,{issuer:process.env.AUTH_ISSUER||undefined,audience:process.env.AUTH_AUDIENCE||undefined});return next();}
  if(process.env.LPS_API_TOKEN&&token&&safeTextEqual(token,process.env.LPS_API_TOKEN))return next();
  if(!jwks&&!process.env.LPS_API_TOKEN&&!sessionKey)return res.status(503).json({error:'API authentication is not configured.'});
  return res.status(401).json({error:'Unauthorized'});
 }catch{return res.status(401).json({error:'Unauthorized'});}
}
function safeTextEqual(a,b){const A=createHash('sha256').update(String(a)).digest(),B=createHash('sha256').update(String(b)).digest();return timingSafeEqual(A,B)}
function arr(v){return v==null?[]:Array.isArray(v)?v:[v]}
function n(v){const x=Number(v);return Number.isFinite(x)?x:0}
function bool(v){return v===true||v===1||v==='1'||String(v).toLowerCase()==='true'}
function dur(v){if(!v)return 0;if(typeof v==='number')return v;const m=String(v).match(/P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?/i);return m?(n(m[1])*24+n(m[2])+n(m[3])/60+n(m[4])/3600):n(v)}
function relationType(v){const s=String(v??'').toLowerCase();if(['0','fs','finish-to-start','finish to start'].includes(s))return'FS';if(['1','ss','start-to-start','start to start'].includes(s))return'SS';if(['2','ff','finish-to-finish','finish to finish'].includes(s))return'FF';if(['3','sf','start-to-finish','start to finish'].includes(s))return'SF';return String(v||'FS').toUpperCase()}
function tp(x){if(!x)return null;return{type:String(x.Type??''),start:String(x.Start??''),finish:String(x.Finish??''),valueHours:dur(x.Value)}}
function sanitizeName(name){return basename(name||'schedule.mpp').replace(/[^a-zA-Z0-9._-]/g,'_')}
function keyFromEnv(name){const raw=process.env[name];if(!raw)return null;const b=Buffer.from(raw,'base64');if(b.length!==32)throw new Error(`${name} must decode to 32 bytes`);return b}
function encrypt(buf,key){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv),body=Buffer.concat([cipher.update(buf),cipher.final()]),tag=cipher.getAuthTag();return Buffer.concat([Buffer.from('LPS1'),iv,tag,body])}

async function runCommand(command,args,timeoutMs=120000){
 return new Promise((resolve,reject)=>{
  const child=spawn(command,args,{stdio:['ignore','pipe','pipe']});let stderr='';
  child.stderr.on('data',d=>{stderr+=d.toString().slice(0,8000)});
  const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error(`Parser timeout after ${timeoutMs}ms`))},timeoutMs);
  child.on('error',e=>{clearTimeout(timer);reject(e)});
  child.on('close',code=>{clearTimeout(timer);code===0?resolve():reject(new Error(`Parser exited with code ${code}: ${stderr.slice(-3000)}`))});
 });
}
async function convertMppToXml(input,output){
 const javaJar=process.env.MPXJ_FAT_JAR;
 if(javaJar){
  try{await runCommand(process.env.JAVA_BIN||'java',['-jar',javaJar,input,output],180000);return'mpxj-java';}
  catch(e){console.warn('MPXJ Java parser failed; attempting native fallback:',e.message);}
 }
 await convert(input,output,{timeoutMs:120000});
 return'mppjs-native';
}

function canonicalizeMSPDI(xml,sourceName){
 const parser=new XMLParser({ignoreAttributes:false,parseTagValue:false,trimValues:true});const parsed=parser.parse(xml);const P=parsed.Project||parsed.project;if(!P)throw new Error('Converted MPP did not produce MSPDI Project XML.');
 const fieldDefs={};for(const f of arr(P.ExtendedAttributes?.ExtendedAttribute)){if(f.FieldID&&f.FieldName)fieldDefs[String(f.FieldID)]=String(f.FieldName)}
 const tasks=arr(P.Tasks?.Task).map((t,i)=>{
  const custom={};for(const e of arr(t.ExtendedAttribute)){const id=String(e.FieldID??'');if(e.Value!=null)custom[fieldDefs[id]||id]=String(e.Value)}
  const baselines=arr(t.Baseline).map(b=>({id:String(b.Number??'0'),start:String(b.Start??''),finish:String(b.Finish??''),workHours:dur(b.Work),cost:n(b.Cost)})).filter(b=>b.start||b.finish||b.workHours||b.cost);
  const predecessors=arr(t.PredecessorLink).map(p=>({uid:String(p.PredecessorUID??''),type:relationType(p.Type),lagHours:n(p.LinkLag)/600}));
  return{uid:String(t.UID??i+1),id:String(t.ID??i+1),wbs:String(t.WBS??t.OutlineNumber??''),name:String(t.Name??`Atividade ${i+1}`),outlineLevel:n(t.OutlineLevel),summary:bool(t.Summary),milestone:bool(t.Milestone),start:String(t.Start??''),finish:String(t.Finish??''),actualStart:String(t.ActualStart??''),actualFinish:String(t.ActualFinish??''),durationHours:dur(t.Duration),workHours:dur(t.Work),actualWorkHours:dur(t.ActualWork),remainingWorkHours:dur(t.RemainingWork),percentComplete:n(t.PercentComplete),physicalPercent:n(t.PhysicalPercentComplete),totalFloatHours:dur(t.TotalSlack),critical:bool(t.Critical),constraintType:String(t.ConstraintType??''),constraintDate:String(t.ConstraintDate??''),predecessors,successors:[],baselines,timephased:arr(t.TimephasedData).map(tp).filter(Boolean),resourceNames:[],custom,weight:0};
 }).filter(t=>t.name);
 const resources=arr(P.Resources?.Resource).map(r=>({uid:String(r.UID??''),name:String(r.Name??''),group:String(r.Group??''),type:String(r.Type??'')})).filter(r=>r.name),resMap=Object.fromEntries(resources.map(r=>[r.uid,r])),taskMap=Object.fromEntries(tasks.map(t=>[t.uid,t]));
 const assignments=arr(P.Assignments?.Assignment).map(a=>({uid:String(a.UID??''),taskUid:String(a.TaskUID??''),resourceUid:String(a.ResourceUID??''),workHours:dur(a.Work),actualWorkHours:dur(a.ActualWork),remainingWorkHours:dur(a.RemainingWork),timephased:arr(a.TimephasedData).map(tp).filter(Boolean)}));
 for(const a of assignments){const t=taskMap[a.taskUid],r=resMap[a.resourceUid];if(t){if(r?.name&&!t.resourceNames.includes(r.name))t.resourceNames.push(r.name);t.timephased.push(...a.timephased.map(v=>({...v,resource:r?.name||''})))}}
 for(const t of tasks)for(const r of t.predecessors){const p=taskMap[r.uid];if(p&&!p.successors.some(x=>x.uid===t.uid))p.successors.push({uid:t.uid,type:r.type,lagHours:r.lagHours})}
 const baselineMap=new Map();for(const t of tasks)for(const b of t.baselines){const cur=baselineMap.get(b.id)||{id:b.id,name:`Linha de Base ${b.id==='0'?'':b.id}`.trim(),count:0};cur.count++;baselineMap.set(b.id,cur)}
 return{format:'Microsoft Project MPP',sourceName,project:{name:String(P.Name??sourceName),title:String(P.Title??''),start:String(P.StartDate??''),finish:String(P.FinishDate??''),statusDate:String(P.StatusDate??P.CurrentDate??'')},tasks,resources,assignments,baselines:[...baselineMap.values()],hasTimephased:tasks.some(t=>t.timephased.some(x=>x.valueHours>0)),customFieldNames:[...new Set(Object.values(fieldDefs))]};
}

app.get('/health',(req,res)=>res.json({service:'LPS Schedule Intelligence API',status:'ok',version:'0.2.0',mppParser:process.env.MPXJ_FAT_JAR?'mpxj-java-primary':'mppjs-native'}));
app.post('/v1/auth/login',async(req,res)=>{
 if(!process.env.LPS_APP_PASSWORD||!sessionKey||sessionKey.length!==32)return res.status(503).json({error:'App login is not configured.'});
 const password=String(req.body?.password||'');if(!password||!safeTextEqual(password,process.env.LPS_APP_PASSWORD))return res.status(401).json({error:'Invalid credentials'});
 const token=await new SignJWT({scope:'app'}).setProtectedHeader({alg:'HS256'}).setIssuer('lps-schedule-intelligence').setAudience('lps-app').setIssuedAt().setExpirationTime('12h').sign(sessionKey);
 res.json({accessToken:token,expiresIn:43200});
});

app.post('/v1/parse/mpp',auth,upload.single('file'),async(req,res)=>{
 if(!req.file||!req.file.originalname.toLowerCase().endsWith('.mpp'))return res.status(400).json({error:'Send one .mpp file in field "file".'});
 const dir=await mkdtemp(join(tmpdir(),'lps-schedule-'));const input=join(dir,sanitizeName(req.file.originalname)),output=join(dir,'converted.xml');
 try{
  await writeFile(input,req.file.buffer,{mode:0o600});
  const parserEngine=await convertMppToXml(input,output);
  const xml=await readFile(output,'utf8');const model=canonicalizeMSPDI(xml,req.file.originalname);model.parserEngine=parserEngine;
  if(String(req.body?.retain)==='true'&&String(process.env.ALLOW_RAW_RETENTION).toLowerCase()==='true'){
   const key=keyFromEnv('LPS_DATA_KEY');if(!key)throw new Error('Retention requested but LPS_DATA_KEY is missing.');const targetDir=process.env.LPS_RETENTION_DIR||'./private-retention';await mkdir(targetDir,{recursive:true,mode:0o700});const encrypted=encrypt(req.file.buffer,key);const id=randomBytes(16).toString('hex');await writeFile(join(targetDir,`${id}.mpp.enc`),encrypted,{mode:0o600});model.retentionId=id;
  }
  res.json(model);
 }catch(e){console.error(e);res.status(422).json({error:'Could not parse MPP safely.',detail:process.env.NODE_ENV==='development'?String(e.message||e):undefined});}
 finally{await rm(dir,{recursive:true,force:true}).catch(()=>{})}
});

app.post('/v1/learning/observe',auth,async(req,res)=>{
 try{
  const allowed={at:new Date().toISOString(),format:String(req.body?.format||'').slice(0,80),taskCount:Math.max(0,n(req.body?.taskCount)),resourceCount:Math.max(0,n(req.body?.resourceCount)),baselineCount:Math.max(0,n(req.body?.baselineCount)),hasTimephased:!!req.body?.hasTimephased,disciplineCoverage:Math.max(0,Math.min(1,n(req.body?.disciplineCoverage))),customFieldHashes:arr(req.body?.customFieldHashes).slice(0,100).map(x=>String(x).slice(0,128))};
  const key=keyFromEnv('LPS_LEARNING_KEY');if(!key)return res.status(503).json({error:'Learning store encryption key is not configured.'});const path=process.env.LPS_LEARNING_STORE||'./private-learning/events.ndjson.enc';await mkdir(dirname(path),{recursive:true,mode:0o700}).catch(()=>{});const enc=encrypt(Buffer.from(JSON.stringify(allowed)),key).toString('base64');await appendFile(path,enc+'\n',{mode:0o600});res.json({ok:true,stored:'anonymized-encrypted-event'});
 }catch(e){console.error(e);res.status(500).json({error:'Could not store learning event.'})}
});

app.post('/v1/learning/correction',auth,async(req,res)=>{
 try{const rule={at:new Date().toISOString(),patternHash:String(req.body?.patternHash||'').slice(0,128),fieldHash:String(req.body?.fieldHash||'').slice(0,128),classification:String(req.body?.classification||'').slice(0,100),confidence:Math.max(0,Math.min(1,n(req.body?.confidence)))};if(!rule.patternHash&&!rule.fieldHash)return res.status(400).json({error:'Hashed pattern or field is required.'});const key=keyFromEnv('LPS_LEARNING_KEY');if(!key)return res.status(503).json({error:'Learning store encryption key is not configured.'});const path=process.env.LPS_LEARNING_STORE||'./private-learning/events.ndjson.enc';await mkdir(dirname(path),{recursive:true,mode:0o700}).catch(()=>{});await appendFile(path,encrypt(Buffer.from(JSON.stringify(rule)),key).toString('base64')+'\n',{mode:0o600});res.json({ok:true})}catch(e){res.status(500).json({error:'Could not store correction.'})}
});

app.post('/v1/ai/report',auth,async(req,res)=>{
 if(!process.env.OPENAI_API_KEY||!process.env.OPENAI_MODEL)return res.status(503).json({error:'AI provider is not configured.'});
 const safe={mode:req.body?.mode==='client'?'cliente/fiscalização':'contratada',project:req.body?.project||{},metrics:req.body?.metrics||{},topIssues:arr(req.body?.topIssues).slice(0,25).map(x=>({severity:String(x.severity||''),rule:String(x.rule||''),evidence:String(x.evidence||'').slice(0,500),impact:String(x.impact||'').slice(0,500)}))};
 try{
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL,store:false,instructions:'Você é um especialista sênior em planejamento e controle de projetos industriais. Produza um parecer técnico objetivo em português do Brasil, sem inventar dados, separando fato calculado de recomendação. Máximo 180 palavras.',input:JSON.stringify(safe)})});
  if(!r.ok)return res.status(502).json({error:'AI provider error',status:r.status});const j=await r.json();const opinion=j.output_text||arr(j.output).flatMap(o=>arr(o.content)).find(c=>c.type==='output_text')?.text||'';res.json({opinion});
 }catch(e){console.error(e);res.status(502).json({error:'AI provider unavailable.'})
 }
});

app.use((err,req,res,next)=>{console.error(err);res.status(400).json({error:err.message||'Bad request'})});
app.listen(PORT,()=>console.log(`LPS Schedule Intelligence API listening on ${PORT}`));
