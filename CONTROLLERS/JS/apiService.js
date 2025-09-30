/**
 * @file apiService.js
 * Capa de red mínima para GET/POST con manejo defensivo de errores.
 * Importante: Nunca lanza; normaliza a null/false para que la app no se caiga sin backend.
 */

export const ApiService = {
  /**
   * GET JSON sin cache. Si falla, devuelve null (no lanza).
   * @param {string} url
   * @returns {Promise<any|null>}
   */
  async tryFetch(url){
    try{
      const r = await fetch(url, { cache: "no-store" });
      if(!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    }catch(_){
      return null;
    }
  },

  /**
   * POST JSON simple. Devuelve true/false según r.ok (no lanza).
   * @param {string} url
   * @param {any} data
   * @returns {Promise<boolean>}
   */
  async postJSON(url, data){
    try{
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      return r.ok;
    }catch(_){
      return false;
    }
  },
  
  // +++ AGREGA ESTE MÉTODO EN ApiService +++
/** GET JSON estricto: lanza error si falla (para flujos donde backend es obligatorio). */
  async strictGet(url){
  const r = await fetch(url, { cache: "no-store" });
  if(!r.ok){
    const msg = `Error HTTP ${r.status} al consultar ${url}`;
    throw new Error(msg);
  }
  return r.json();
}

};


