(()=>{
  const API='https://lps-schedule-api-production.up.railway.app';
  if(!localStorage.getItem('lps_api_base')) localStorage.setItem('lps_api_base', API);
  window.LPS_SCHEDULE_CONFIG={apiBase:API};
})();
