
// MODELS/JS/boardModel.js
export class BoardModel {
  constructor(raw){
    this.raw = raw;
    this.linear = [...raw.bottom, ...raw.left, ...raw.top, ...raw.right];
    this.state = {};
    for(const c of this.linear){
      if(c.type==="property"||c.type==="railroad"){
        this.state[c.id] = { owner:null, houses:0, hotel:false, mortgaged:false, type:c.type };
      }
    }
  }
  cellById(id){ return this.linear.find(c=>c.id===id); }
  getGroup(color){ return this.linear.filter(c=>c.type==="property"&&c.color===color); }
}
