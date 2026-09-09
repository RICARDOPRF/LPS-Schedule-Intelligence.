(()=>{
'use strict';

const state={model:null,analysisId:null,saving:false,lastSavedKey:'',pendingTimer:null};
const num=v=>Number(v)||0;
const clip=(v,n=300)=>String(v??'').slice(0,n);
const nowIso=()=>new Date().toISOString();
const safeKey=s=>String(s??'').replace(/[.#$\[\]/]/g,'_').slice(0,120)||'item';
const selectedCustom=custom=>{const out={};for(const[k,v]of Object.entries(custom||{})){if(/obra|setor|area|disciplina|fase|sub|tipo|respons|equipe|site|peso|status|prioridade|painel|fornecedor|contratada|equipamento/i.test(k)){out[clip(k,80)]=clip(v,180);if(Object.keys(out).length>=20)break}}return out};

function fb(){return window.LPS_FIREBASE||null}
function currentUser(){return fb()?.user||fb()?.auth?.currentUser||null}
function taskSnapshot(t){return{
 uid:clip(t.uid,40),id:clip(t.id,40),wbs:clip(t.wbs,160),name:clip(t.name,300),outlineLevel:num(t.outlineLevel),summary:!!t.summary,milestone:!!t.milestone,
 start:clip(t.start,40),finish:clip(t.finish,40),actualStart:clip(t.actualStart,40),actualFinish:clip(t.actualFinish,40),durationHours:num(t.durationHours),
 workHours:num(t.workHours),actualWorkHours:num(t.actualWorkHours),remainingWorkHours:num(t.remainingWorkHours),percentComplete:num(t.percentComplete),physicalPercent:num(t.physicalPercent),
 totalFloatHours:num(t.totalFloatHours),critical:!!t.critical,constraintType:clip(t.constraintType,100),constraintDate:clip(t.constraintDate,40),
 predecessors:(t.predecessors||[]).slice(0,40).map(r=>({uid:clip(r.uid,40),type:clip(r.type,8),lagHours:num(r.lagHours)})),
 baselines:(t.baselines||[]).slice(0,11).map(b=>({id:clip(b.id,12),start:clip(b.start,40),finish:clip(b.finish,40),workHours:num(b.workHours)})),
 resourceNames:(t.resourceNames||[]).slice(0,20).map(x=>clip(x,120)),custom:selectedCustom(t.custom),
 lpsObra:clip(t.lpsObra||t.custom?.Setor||t.custom?.Obra,180),lpsArea:clip(t.lpsArea||t.custom?.Area,180),lpsDiscipline:clip(t.lpsDiscipline||t.custom?.Disciplina,120)
}}
function resourceSnapshot(r){return{uid:clip(r.uid,40),name:clip(r.name,160),group:clip(r.group,140),type:clip(r.type,60)}}
function assignmentSnapshot(a){return{uid:clip(a.uid,40),taskUid:clip(a.taskUid,40),resourceUid:clip(a.resourceUid,40),resourceName:clip(a.resourceName,160),resourceGroup:clip(a.resourceGroup,140),workHours:num(a.workHours),actualWorkHours:num(a.actualWorkHours),remainingWorkHours:num(a.remainingWorkHours),dailyPointCount:(a.dailyTimephased||[]).length}}
function auditSnapshot(){return{
 healthScore:num(document.querySelector('#healthScore')?.textContent),healthLabel:clip(document.querySelector('#healthLabel')?.textContent,180),criticalCount:num(document.querySelector('#criticalCount')?.textContent),negativeFloatCount:num(document.querySelector('#negativeFloatCount')?.textContent),orphanCount:num(document.querySelector('#orphanCount')?.textContent),
 issues:[...document.querySelectorAll('#issuesBody tr')].slice(0,300).map(tr=>{const td=tr.querySelectorAll('td');return td.length>=5?{severity:clip(td[0].innerText,40),rule:clip(td[1].innerText,160),activity:clip(td[2].innerText,260),evidence:clip(td[3].innerText,420),impact:clip(td[4].innerText,420)}:null}).filter(Boolean)
}}
function metaSnapshot(model,user){const leaves=(model.tasks||[]).filter(t=>!t.summary);return{
 schemaVersion:1,product:'LPS Schedule Intelligence',savedAt:nowIso(),ownerUid:user.uid,ownerEmail:clip(user.email,180),sourceName:clip(model.sourceName,220),format:clip(model.format,100),parserEngine:clip(model.parserEngine,100),
 project:{name:clip(model.project?.name,220),title:clip(model.project?.title,220),start:clip(model.project?.start,40),finish:clip(model.project?.finish,40),statusDate:clip(model.project?.statusDate,40)},
 counts:{tasks:(model.tasks||[]).length,leafTasks:leaves.length,resources:(model.resources||[]).length,assignments:(model.assignments||[]).length,dailyTimephasedPoints:num(model.dailyTimephasedPoints),baselines:(model.baselines||[]).length},
 totals:{workHours:leaves.reduce((a,t)=>a+num(t.workHours),0),actualWorkHours:leaves.reduce((a,t)=>a+num(t.actualWorkHours),0),remainingWorkHours:leaves.reduce((a,t)=>a+num(t.remainingWorkHours),0)},
 privacy:{rawMppStored:false,dailyTimephasedStored:false,structuredSnapshotStored:true}
}}
function chunks(items,size){const out=[];for(let i=0;i<items.length;i+=size)out.push(items.slice(i,i+size));return out}
function keyFor(model){return [model.sourceName,model.project?.name,model.project?.statusDate,model.tasks?.length,model.assignments?.length].join('|')}
async function ensureAnalysisId(model,user){if(state.analysisId)return state.analysisId;const F=fb(),D=F?.database;if(!F?.db||!D)throw new Error('Firebase Realtime Database não inicializado.');const parent=D.ref(F.db,`users/${safeKey(user.uid)}/scheduleAnalyses`);state.analysisId=D.push(parent).key;return state.analysisId}
async function saveCurrent(reason='analysis'){
 const model=state.model||window.LPS_LAST_MODEL,user=currentUser(),F=fb(),D=F?.database;if(!model||!user||!F?.db||!D||state.saving)return false;
 const saveKey=keyFor(model)+'|'+(window.LPS_AI_ANALYSIS?.responseId||'no-ai');if(reason!=='force'&&state.lastSavedKey===saveKey)return true;
 state.saving=true;
 try{
   const id=await ensureAnalysisId(model,user),root=`users/${safeKey(user.uid)}/scheduleAnalyses/${id}`;
   await D.update(D.ref(F.db,root),{
     meta:metaSnapshot(model,user),
     hierarchy:model.lpsHierarchy||null,
     baselines:model.baselines||[],
     audit:auditSnapshot(),
     ai:window.LPS_AI_ANALYSIS?.analysis||null,
     aiMeta:window.LPS_AI_ANALYSIS?{model:clip(window.LPS_AI_ANALYSIS.model,100),responseId:clip(window.LPS_AI_ANALYSIS.responseId,120),processingMs:num(window.LPS_AI_ANALYSIS.processingMs)}:null,
     updatedAt:D.serverTimestamp()
   });
   const taskChunks=chunks((model.tasks||[]).map(taskSnapshot),200);for(let i=0;i<taskChunks.length;i++)await D.set(D.ref(F.db,`${root}/taskChunks/${String(i).padStart(4,'0')}`),taskChunks[i]);
   const resourceChunks=chunks((model.resources||[]).map(resourceSnapshot),250);for(let i=0;i<resourceChunks.length;i++)await D.set(D.ref(F.db,`${root}/resourceChunks/${String(i).padStart(4,'0')}`),resourceChunks[i]);
   const assignmentChunks=chunks((model.assignments||[]).map(assignmentSnapshot),250);for(let i=0;i<assignmentChunks.length;i++)await D.set(D.ref(F.db,`${root}/assignmentChunks/${String(i).padStart(4,'0')}`),assignmentChunks[i]);
   await D.update(D.ref(F.db,root),{complete:true,completedAt:D.serverTimestamp()});
   state.lastSavedKey=saveKey;window.dispatchEvent(new CustomEvent('lps-schedule-saved',{detail:{analysisId:id,reason}}));console.info('LPS Firebase: análise salva',id);return true;
 }catch(e){console.warn('LPS Firebase: análise não salva',e);window.dispatchEvent(new CustomEvent('lps-schedule-save-error',{detail:{message:e?.message||String(e)}}));return false}finally{state.saving=false}
}
function scheduleSave(reason){clearTimeout(state.pendingTimer);state.pendingTimer=setTimeout(()=>saveCurrent(reason),1200)}
function resetForModel(model){state.model=model;state.analysisId=null;state.lastSavedKey='';if(currentUser())scheduleSave('model-ready')}
function install(){
 window.addEventListener('lps-model-ready',e=>resetForModel(e.detail?.model||window.LPS_LAST_MODEL));
 window.addEventListener('lps-ai-ready',()=>scheduleSave('ai-ready'));
 window.addEventListener('lps-auth-state',e=>{if(e.detail?.signedIn&&state.model)scheduleSave('auth-ready')});
 if(window.LPS_LAST_MODEL)resetForModel(window.LPS_LAST_MODEL);
}
window.LPS_SCHEDULE_HISTORY={saveCurrent,get analysisId(){return state.analysisId},get ready(){return !!fb()?.db}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
