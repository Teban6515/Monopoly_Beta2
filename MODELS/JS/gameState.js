/**
 * @file gameState.js
 * Estado global de la partida: jugadores, turno actual, etapa, tablero y países.
 * Define utilidades de turno y (de)serialización de snapshots.
 */

export class GameState {
  constructor(){
    /** @type {import('./player.js').Player[]} */
    this.players = [];

    /** @type {number} Índice del jugador que tiene el turno. */
    this.current = 0;

    /** @type {'setup'|'running'|'over'} Etapa de la partida. */
    this.state = "setup";

    /** @type {import('./boardModel.js').BoardModel|null} */
    this.board = null;

    /** @type {{code:string,name:string}[]} Catálogo de países para Setup y banderas. */
    this.countries = [];
  }

  /** Agrega un jugador y lo retorna (fluidez en el controlador). */
  addPlayer(player){ this.players.push(player); return player; }

  /** Obtiene el jugador con el turno. */
  currentPlayer(){ return this.players[this.current]; }

  /** Avanza el índice del turno de manera circular. */
  nextTurn(){ this.current = (this.current + 1) % this.players.length; }

  /** Snapshot minimalista para persistencia (localStorage). */
  toJSON(){
    return {
      players: this.players,
      current: this.current,
      state:   this.state,
      boardState: this.board?.state
    };
  }

  /**
   * Restaura un snapshot. Requiere que `this.board` exista previamente,
   * porque aquí sólo reasignamos `board.state` (no re-creamos el board).
   */
  loadFrom(json){
    this.players = json.players;
    this.current = json.current;
    this.state   = json.state;
    if(this.board && json.boardState){
      this.board.state = json.boardState;
    }
  }
}
