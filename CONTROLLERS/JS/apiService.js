
// CONTROLLERS/JS/apiService.js
export const ApiService = {
  async tryFetch(url){
    try{ const r=await fetch(url,{cache:"no-store"}); if(!r.ok) throw new Error(); return await r.json(); }
    catch(_){ return null; }
  },
  async postJSON(url, data){
    try{ const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)}); return r.ok; }
    catch(_){ return false; }
  }
};
