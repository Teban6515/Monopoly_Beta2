
// MODELS/JS/player.js
export class Player {
  constructor(id, nick, country, color) {
    this.id = id;
    this.nick = nick;
    this.country = country;
    this.color = color;
    this.position = 0;
    this.money = 1500;
    this.inJail = false;
    this.jailTurns = 0;
    this.properties = []; // { id, type, houses, hotel, mortgaged }
    this.bankrupt = false;
    this.consecutiveDoubles = 0;
  }
  toJSON(){ return {...this}; }
}
