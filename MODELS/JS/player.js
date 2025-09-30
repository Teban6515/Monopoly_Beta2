/**
 * @file player.js
 * Modelo de jugador: encapsula todo el estado individual de una persona en la partida.
 */

/**
 * Representa a un jugador del juego.
 * Invariantes:
 *  - position ∈ [0..39]
 *  - Si bankrupt=true, properties debe vaciarse y transferirse cuando aplique.
 */
export class Player {
  /**
   * @param {number} id       Índice único (0..n-1). Se usa también como referencia de dueño.
   * @param {string} nick     Apodo visible.
   * @param {string} country  Código ISO-2 del país (banderita en UI).
   * @param {string} color    Color CSS de la ficha.
   */
  constructor(id, nick, country, color) {
    this.id = id;
    this.nick = nick;
    this.country = country;
    this.color = color;

    /** @type {number} Posición en el tablero (0..39). */
    this.position = 0;

    /** @type {number} Dinero disponible. */
    this.money = 1500;

    /** @type {boolean} Estado de cárcel. */
    this.inJail = false;

    /** @type {number} Turnos cumplidos en cárcel (resetea al salir). */
    this.jailTurns = 0;

    /**
     * Propiedades poseídas, espejo del estado del tablero:
     * { id:number, type:'property'|'railroad', houses:number, hotel:boolean, mortgaged:boolean }
     */
    this.properties = [];

    /** @type {boolean} Bancarrota; si true ya no juega y transfiere propiedades. */
    this.bankrupt = false;

    /** @type {number} Conteo de dobles consecutivos (a 3 → cárcel). */
    this.consecutiveDoubles = 0;
  }

  /** Serializa el jugador tal cual, útil para localStorage. */
  toJSON(){ return { ...this }; }
}
