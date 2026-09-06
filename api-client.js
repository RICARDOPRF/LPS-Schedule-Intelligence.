(()=>{
'use strict';
const nativeFetch=window.fetch.bind(window);
const TOKEN_KEY='lps_api_session';
const DEFAULT_API='https://lps-schedule-api-production.up.railway.app';
if(!localStorage.getItem('lps_api_base')) localStorage.setItem('lps_api_base',DEFAULT_API);
let loginPromise=null;

function base(){return (localStorage.getItem('lps_api_base')||window.LPS_SCHEDULE_CONFIG?.apiBase||DEFAULT_API).trim().replace(/\/$/,'')}
function token(){return sessionStorage.getItem(TOKEN_KEY)||''}
function isApiRequest(input){const b=base();if(!b)return false;const url=typeof input==='string'?input:input?.url||'';return url.startsWith(b+'/')||url===b}
function isLoginRequest(input){const url=typeof input==='string'?input:input?.url||'';return url.endsWith('/v1/auth/login')}
function withAuth(init={}){const h=new Headers(init.headers||{});const t=token();if(t&&!h.has('Authorization'))h.set('Authorization','Bearer '+t);return{...init,headers:h}}
async function login(){
 if(loginPromise)return loginPromise;
 loginPromise=(async()=>{
   const b=base();if(!b)throw new Error('Configure a URL da API LPS em “API / Privacidade”.');
   const password=window.prompt('A API LPS exige autenticação. Digite a senha de acesso:');
   if(password===null)throw new Error('Autenticação cancelada.');
   if(!password)throw new Error('Senha não informada.');
   const r=await nativeFetch(b+'/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});
   const j=await r.json().catch(()=>({}));
   if(!r.ok||!j.accessToken)throw new Error(j.error||'Falha na autenticação da API.');
   sessionStorage.setItem(TOKEN_KEY,j.accessToken);
   window.dispatchEvent(new CustomEvent('lps-api-auth',{detail:{authenticated:true,expiresIn:j.expiresIn||0}}));
   return j.accessToken;
 })();
 try{return await loginPromise}finally{loginPromise=null}
}
window.lpsApi={
 login,
 logout(){sessionStorage.removeItem(TOKEN_KEY);window.dispatchEvent(new CustomEvent('lps-api-auth',{detail:{authenticated:false}}));},
 get authenticated(){return !!token()},
 async health(){const b=base();if(!b)throw new Error('API não configurada.');return nativeFetch(b+'/health').then(r=>r.json())}
};

window.fetch=async function(input,init={}){
 if(!isApiRequest(input)||isLoginRequest(input))return nativeFetch(input,init);
 let response=await nativeFetch(input,withAuth(init));
 if(response.status!==401)return response;
 sessionStorage.removeItem(TOKEN_KEY);
 await login();
 response=await nativeFetch(input,withAuth(init));
 return response;
};
})();
