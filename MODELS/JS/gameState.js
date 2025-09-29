
// MODELS/JS/gameState.js
export class GameState {
  constructor(){
    this.players = [];
    this.current = 0;
    this.state = "setup"; // setup | running | over
    this.board = null;    // BoardModel
    this.countries = [];
  }
  addPlayer(player){ this.players.push(player); return player; }
  currentPlayer(){ return this.players[this.current]; }
  nextTurn(){ this.current = (this.current + 1) % this.players.length; }
  toJSON(){ return { players:this.players, current:this.current, state:this.state, boardState:this.board?.state }; }
  loadFrom(json){
    this.players = json.players;
    this.current = json.current;
    this.state = json.state;
    if(this.board && json.boardState){ this.board.state = json.boardState; }
  }
}
