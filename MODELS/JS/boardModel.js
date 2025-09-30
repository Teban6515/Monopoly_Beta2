/**
 * @file boardModel.js
 * Modelo del tablero y su estado mutable (dueños/construcciones/hipoteca).
 * Separa datos crudos del JSON (estáticos) del "state" (dinámico).
 */

export class BoardModel {
  /**
   * @param {object} raw JSON crudo con { bottom[], left[], top[], right[], chance[], community_chest[] }
   */
  constructor(raw){
    /** @type {object} JSON crudo del tablero (inmutable). */
    this.raw = raw;

    /**
     * Arreglo lineal de 40 casillas en orden de recorrido oficial:
     * bottom (0..10), left (11..19), top (20..30), right (31..39)
     * Cada elemento conserva su { id, name, type, price?, mortgage?, rent?, color?, action? }
     */
    this.linear = [...raw.bottom, ...raw.left, ...raw.top, ...raw.right];

    /**
     * Estado mutable de casillas comprables.
     * Clave: id de casilla, Valor: { owner:null|playerId, houses:number, hotel:boolean, mortgaged:boolean, type }
     */
    this.state = {};
    for(const c of this.linear){
      if(c.type==="property" || c.type==="railroad"){
        this.state[c.id] = { owner:null, houses:0, hotel:false, mortgaged:false, type:c.type };
      }
    }
  }

  /**
   * Busca la casilla por ID (0..39) en el arreglo lineal.
   * @param {number} id
   * @returns {object|undefined}
   */
  cellById(id){ return this.linear.find(c=>c.id===id); }

  /**
   * Devuelve todas las propiedades de un color (para reglas de monopolio y balance).
   * @param {string} color
   * @returns {object[]}
   */
  getGroup(color){ return this.linear.filter(c=>c.type==="property" && c.color===color); }
}
