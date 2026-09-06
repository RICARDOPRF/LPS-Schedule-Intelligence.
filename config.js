(()=>{
  const API='https://lps-schedule-api-v2-production.up.railway.app';
  // V1 uses the official LPS parser endpoint. Force-refresh stale URLs left by older builds.
  localStorage.setItem('lps_api_base', API);
  window.LPS_SCHEDULE_CONFIG={apiBase:API};
})();
