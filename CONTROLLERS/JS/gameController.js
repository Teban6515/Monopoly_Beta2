
// CONTROLLERS/JS/gameController.js
import { API, CONFIG } from "../../MODELS/JS/constants.js";
import { GameState } from "../../MODELS/JS/gameState.js";
import { BoardModel } from "../../MODELS/JS/boardModel.js";
import { Player } from "../../MODELS/JS/player.js";
import { ApiService } from "./apiService.js";
import { UI } from "./uiController.js";

const $ = (s, r=document)=>r.querySelector(s);

export class GameController {
  constructor(){
    this.game = new GameState();
  }

  async bootstrap(){
    const rawBoard = await ApiService.tryFetch(API.BOARD) || await (await fetch("../../assets/board.json")).json();
    const countries = await ApiService.tryFetch(API.COUNTRIES) || await (await fetch("../../assets/countries.json")).json();
    this.game.board = new BoardModel(rawBoard);
    this.game.countries = countries;

    UI.renderBoard(this.game);
    UI.renderPlayers(this.game);
    this.buildSetup();

    $("#btnShowRanking").addEventListener("click", ()=>this.showRanking());
    $("#btnEndGame").addEventListener("click", ()=>this.finalizeGame());
    $("#btnRoll").addEventListener("click", ()=>this.roll());
    $("#btnEndTurn").addEventListener("click", ()=>this.endTurn());
    $("#btnSave").addEventListener("click", ()=>this.saveState());
    $("#btnLoad").addEventListener("click", ()=>this.loadState());
  }

  buildSetup(){
    const m=$("#setupModal");
    const preset=["#5B9BD5","#7FB77E","#F5B971","#4EA1D3"];
    const draw=()=>{
      const wrap=$("#playersSetup"); wrap.innerHTML="";
      const n=Number($("#numPlayers").value);
      for(let i=0;i<n;i++){
        const row=document.createElement("div"); row.className="row g-2";
        row.innerHTML=`
          <div class="col-md-6"><label class="form-label">Nickname
            <input class="form-control" type="text" required name="nick_${i}" placeholder="Jugador ${i+1}"></label></div>
          <div class="col-md-3"><label class="form-label">País
            <select class="form-select" name="country_${i}" required>
              ${this.game.countries.map(c=>`<option value="${c.code}">${c.name}</option>`).join("")}
            </select></label></div>
          <div class="col-md-3"><label class="form-label">Color ficha
            <input class="form-control form-control-color" type="color" name="color_${i}" value="${preset[i%preset.length]}"></label></div>`;
        wrap.appendChild(row);
      }
    };
    $("#numPlayers").addEventListener("change", draw); draw();
    $("#btnStart").addEventListener("click",(ev)=>{
      ev.preventDefault();
      const n=Number($("#numPlayers").value);
      const form=$("#setupForm");
      this.game.players=[];
      for(let i=0;i<n;i++){
        const nick=form[`nick_${i}`].value?.trim()||`J${i+1}`;
        const country=form[`country_${i}`].value;
        const color=form[`color_${i}`].value;
        this.game.addPlayer(new Player(i,nick,country,color));
      }
      this.game.state="running";
      m.close();
      UI.renderPlayers(this.game); UI.renderCurrent(this.game);
      UI.log(`Comienza el juego con ${n} jugadores.`);
    });
    m.showModal();
  }

  async showRanking(){
    const list=$("#rankingList");
    list.innerHTML="Cargando...";
    $("#rankingModal").showModal();
    const data=await ApiService.tryFetch(API.RANKING);
    if(!data){ list.textContent="No fue posible obtener el ranking."; return; }
    list.innerHTML="";
    data.forEach((row,i)=>{
      const el=document.createElement("div"); el.className="d-flex align-items-center justify-content-between border rounded p-2 mb-2";
      el.innerHTML=`<div class="fw-bold">#${i+1}</div><div><img src="https://flagsapi.com/${row.country_code}/flat/64.png" width="32" height="24" class="rounded border"> <strong>${row.nick_name}</strong></div><div class="fw-bold">${UI.money(row.score)}</div>`;
      list.appendChild(el);
    });
  }

  roll(){
    if(this.game.state!=="running") return;
    const p=this.game.currentPlayer();
    if(p.bankrupt){ UI.log(`${p.nick} está en bancarrota.`); return; }

    // In Jail
    if(p.inJail){
      const d1=Number($("#dbgD1").value)||(1+Math.floor(Math.random()*6));
      const d2=Number($("#dbgD2").value)||(1+Math.floor(Math.random()*6));
      $("#dbgD1").value=""; $("#dbgD2").value="";
      $("#diceValues").textContent=`${d1} + ${d2} = ${d1+d2}`;
      if(d1===d2){
        p.inJail=false; p.jailTurns=0; UI.log(`${p.nick} saca dobles y sale de la cárcel.`); this.move(p,d1+d2);
      }else{
        p.jailTurns++; UI.log(`${p.nick} no saca dobles (${p.jailTurns}/${CONFIG.MAX_JAIL_TURNS}).`);
        if(p.jailTurns>=CONFIG.MAX_JAIL_TURNS){ p.inJail=false; p.jailTurns=0; UI.log(`${p.nick} cumplió condena y sale.`); }
        UI.renderPlayers(this.game);
      }
      return;
    }

    const d1=Number($("#dbgD1").value)||(1+Math.floor(Math.random()*6));
    const d2=Number($("#dbgD2").value)||(1+Math.floor(Math.random()*6));
    $("#dbgD1").value=""; $("#dbgD2").value="";
    $("#diceValues").textContent=`${d1} + ${d2} = ${d1+d2}`;

    if(d1===d2){
      p.consecutiveDoubles++;
      if(p.consecutiveDoubles===3){
        UI.log(`${p.nick} obtiene 3 dobles consecutivos. Va a la cárcel.`);
        p.position=10; p.inJail=true; p.jailTurns=0; p.consecutiveDoubles=0;
        UI.renderTokens(this.game); UI.renderPlayers(this.game); return;
      }
    }else p.consecutiveDoubles=0;

    this.move(p,d1+d2);
    if(d1===d2){ UI.log(`Dobles: ${p.nick} juega de nuevo.`); UI.renderCurrent(this.game); }
  }

  move(p, steps){
    const prev=p.position; let next=(p.position+steps)%40;
    if(p.position+steps>=40){ p.money+=CONFIG.PASS_GO; UI.log(`${p.nick} pasa por Salida y recibe ${UI.money(CONFIG.PASS_GO)}.`); }
    p.position=next; UI.renderTokens(this.game); UI.renderPlayers(this.game); this.handleLanding(p,next);
  }

  endTurn(){ if(this.game.state!=="running") return; UI.clearActions(); this.game.nextTurn(); UI.renderCurrent(this.game); UI.log(`Turno de ${this.game.currentPlayer().nick}.`); }

  handleLanding(p, id){
    const cell=this.game.board.cellById(id);
    UI.log(`${p.nick} cae en "${cell.name}".`); UI.clearActions();

    if(cell.type==="special"){
      if(cell.name.includes("Ve a la Cárcel") || (cell.action && cell.action.goTo==="jail")){
        p.position=10; p.inJail=true; p.jailTurns=0; p.consecutiveDoubles=0; UI.renderTokens(this.game); UI.renderPlayers(this.game); UI.log(`${p.nick} va a la cárcel.`); return;
      }
      if(cell.name.includes("Salida") && cell.action?.money){ p.money+=Number(cell.action.money); UI.renderPlayers(this.game); UI.log(`${p.nick} recibe ${UI.money(cell.action.money)} por caer en Salida.`); }
      return;
    }

    if(cell.type==="tax"){
      const amount=Math.abs(Number(cell.action?.money||0)); p.money += Number(cell.action?.money||0); UI.renderPlayers(this.game); UI.log(`${p.nick} paga impuestos por ${UI.money(amount)}.`); return;
    }

    if(cell.type==="chance"||cell.type==="community_chest"){
      const deck=cell.type==="chance"?this.game.board.raw.chance:this.game.board.raw.community_chest;
      const card=deck[Math.floor(Math.random()*deck.length)];
      const delta=Number(card.action?.money||0); p.money+=delta;
      if(card.action?.goTo==="jail"){ p.position=10; p.inJail=true; p.jailTurns=0; }
      if(typeof card.action?.moveTo==="number"){ p.position = card.action.moveTo; }
      UI.renderTokens(this.game); UI.renderPlayers(this.game); UI.log(`Carta: ${card.description} (${delta>=0?"+":""}${UI.money(delta)}).`); return;
    }

    if(cell.type==="railroad"||cell.type==="property"){
      const st=this.game.board.state[cell.id];
      if(st.owner===null){
        const area=$("#actionArea");
        area.appendChild(this.btnBuy(p,cell));
        area.appendChild(this.btnAuction(cell));
        area.appendChild(UI.button("Pasar",()=>{}, "btn btn-light"));
      }else if(st.owner===p.id){
        this.ownerOptions(p,cell,st);
      }else{
        if(st.mortgaged){ UI.log(`La propiedad está hipotecada; no se cobra renta.`); return; }
        const owner=this.game.players[st.owner]; const rent=this.computeRent(cell,st,owner);
        this.payRent(p,owner,rent);
      }
    }
  }

  computeRent(cell, st, owner){
    if(cell.type==="railroad"){
      const count=owner.properties.filter(q=>q.type==="railroad").length;
      return Number(cell.rent[count]||0);
    }
    if(cell.type==="property"){
      if(st.hotel) return Number(cell.rent.withHotel);
      if(st.houses>0) return Number(cell.rent.withHouse[st.houses-1]||0);
      return Number(cell.rent.base||0);
    }
    return 0;
  }

  btnBuy(p,cell){
    const b=document.createElement("button"); b.className="btn btn-outline-primary"; b.textContent=`Comprar por ${UI.money(cell.price)}`;
    b.onclick=()=>{
      if(p.money<cell.price){ UI.log("Fondos insuficientes."); return; }
      const st=this.game.board.state[cell.id]; p.money-=cell.price; st.owner=p.id; st.type=cell.type;
      p.properties.push({id:cell.id,type:cell.type,houses:0,hotel:false,mortgaged:false});
      UI.renderPlayers(this.game); UI.renderTokens(this.game); UI.log(`${p.nick} compra ${cell.name}.`); UI.clearActions();
    };
    return b;
  }
  btnAuction(cell){
    const b=document.createElement("button"); b.className="btn btn-outline-secondary"; b.textContent="Subastar";
    b.onclick=()=>this.openAuction(cell);
    return b;
  }

  ownerOptions(p,cell,st){
    const area=$("#actionArea"); area.innerHTML="";
    if(cell.type==="property" && this.canBuildHouse(p,cell)){
      area.appendChild(this.actionBtn(`Construir Casa (+${UI.money(CONFIG.HOUSE_COST)})`, ()=>{
        if(p.money<CONFIG.HOUSE_COST){ UI.log("Fondos insuficientes."); return; }
        p.money-=CONFIG.HOUSE_COST; st.houses++; this.getPlayerProp(p,cell.id).houses=st.houses; UI.renderPlayers(this.game); UI.renderTokens(this.game); UI.log(`${p.nick} construye una casa en ${cell.name}.`);
      }));
    }
    if(cell.type==="property" && this.canBuildHotel(p,cell)){
      area.appendChild(this.actionBtn(`Construir Hotel (+${UI.money(CONFIG.HOTEL_COST)})`, ()=>{
        if(p.money<CONFIG.HOTEL_COST){ UI.log("Fondos insuficientes."); return; }
        p.money-=CONFIG.HOTEL_COST; st.houses=0; st.hotel=true; const pr=this.getPlayerProp(p,cell.id); pr.houses=0; pr.hotel=true; UI.renderPlayers(this.game); UI.renderTokens(this.game); UI.log(`${p.nick} construye un hotel en ${cell.name}.`);
      }));
    }
    if(cell.type==="property" && (st.houses>0 || st.hotel)){
      area.appendChild(this.actionBtn(`Vender ${st.hotel?"Hotel":"Casa"} (+${UI.money(st.hotel?CONFIG.HOTEL_COST/2:CONFIG.HOUSE_COST/2)})`, ()=>{
        if(st.hotel){ st.hotel=false; this.getPlayerProp(p,cell.id).hotel=false; p.money+=CONFIG.HOTEL_COST/2; }
        else { st.houses--; this.getPlayerProp(p,cell.id).houses=st.houses; p.money+=CONFIG.HOUSE_COST/2; }
        UI.renderPlayers(this.game); UI.renderTokens(this.game); UI.log(`${p.nick} vende construcción en ${cell.name}.`);
      }));
    }
    if(!st.mortgaged){
      area.appendChild(this.actionBtn(`Hipotecar (+${UI.money(cell.mortgage)})`, ()=>{
        st.mortgaged=true; this.getPlayerProp(p,cell.id).mortgaged=true; p.money+=cell.mortgage; UI.renderPlayers(this.game); UI.renderTokens(this.game); UI.log(`${p.nick} hipoteca ${cell.name}.`);
      }));
    }else{
      const repay=Math.ceil(cell.mortgage*1.1);
      area.appendChild(this.actionBtn(`Deshipotecar (-${UI.money(repay)})`, ()=>{
        if(p.money<repay){ UI.log("Fondos insuficientes."); return; }
        st.mortgaged=false; this.getPlayerProp(p,cell.id).mortgaged=false; p.money-=repay; UI.renderPlayers(this.game); UI.renderTokens(this.game); UI.log(`${p.nick} deshipoteca ${cell.name}.`);
      }));
    }
    area.appendChild(this.actionBtn("Comerciar", ()=>this.openTrade(p)));
  }
  actionBtn(label,fn){ const b=document.createElement("button"); b.className="btn btn-outline-primary me-2"; b.textContent=label; b.onclick=fn; return b; }

  canBuildHouse(p,cell){
    const st=this.game.board.state[cell.id];
    if(!(cell.type==="property" && !st.hotel && st.houses<4)) return false;
    if(!this.hasMonopoly(p,cell.color)) return false;
    const group=this.game.board.getGroup(cell.color);
    const minH=Math.min(...group.map(c=>this.game.board.state[c.id].houses));
    return st.houses===minH;
  }
  canBuildHotel(p,cell){
    const st=this.game.board.state[cell.id];
    return cell.type==="property" && st.houses===4 && !st.hotel && this.hasMonopoly(p,cell.color);
  }
  hasMonopoly(player,color){ return this.game.board.getGroup(color).every(c=>this.game.board.state[c.id]?.owner===player.id); }
  getPlayerProp(p,id){ return p.properties.find(pr=>pr.id===id); }

  payRent(payer, owner, rent){
    if(rent<=0) return;
    if(payer.money>=rent){
      payer.money-=rent; owner.money+=rent; UI.renderPlayers(this.game); UI.log(`${payer.nick} paga renta ${UI.money(rent)} a ${owner.nick}.`);
    }else{
      UI.log(`${payer.nick} no alcanza a pagar la renta (${UI.money(rent)}).`);
      const area=$("#actionArea"); area.innerHTML="";
      area.appendChild(this.actionBtn("Declarar bancarrota", ()=>{
        payer.bankrupt=true;
        for(const pr of payer.properties){ const st=this.game.board.state[pr.id]; st.owner=owner.id; owner.properties.push(pr); }
        payer.properties=[]; UI.renderPlayers(this.game); UI.renderTokens(this.game); UI.log(`${payer.nick} entra en bancarrota. Propiedades pasan a ${owner.nick}.`);
      }));
    }
  }

  // Auction
  openAuction(cell){
    const modal=$("#auctionModal");
    $("#aucProp").textContent=cell.name;
    $("#aucWinner").innerHTML=this.game.players.map(p=>`<option value="${p.id}">${p.nick}</option>`).join("");
    $("#aucPrice").value=Math.ceil((cell.price||0)/2);
    modal.showModal();
    $("#btnAucCancel").onclick=()=>modal.close();
    $("#btnAucConfirm").onclick=()=>{
      const winnerId=Number($("#aucWinner").value); const price=Number($("#aucPrice").value);
      const w=this.game.players[winnerId]; if(w.money<price){ UI.log("El ganador no tiene fondos."); return; }
      w.money-=price; const st=this.game.board.state[cell.id]; st.owner=winnerId; st.type=cell.type;
      w.properties.push({id:cell.id,type:cell.type,houses:0,hotel:false,mortgaged:false});
      UI.renderPlayers(this.game); UI.renderTokens(this.game); UI.log(`${w.nick} gana la subasta de ${cell.name} por ${UI.money(price)}.`); modal.close();
    };
  }

  // Trade
  openTrade(fromPlayer){
    const modal=$("#tradeModal");
    $("#trFrom").innerHTML=`<option value="${fromPlayer.id}">${fromPlayer.nick}</option>`;
    $("#trTo").innerHTML=this.game.players.filter(p=>p.id!==fromPlayer.id).map(p=>`<option value="${p.id}">${p.nick}</option>`).join("");
    $("#trProp").innerHTML=fromPlayer.properties.map(pr=>{
      const c=this.game.board.cellById(pr.id); return `<option value="${pr.id}">${c.name}</option>`;
    }).join("");
    $("#trPrice").value=100;
    modal.showModal();
    $("#btnTrCancel").onclick=()=>modal.close();
    $("#btnTrConfirm").onclick=()=>{
      const toId=Number($("#trTo").value); const prId=Number($("#trProp").value); const price=Number($("#trPrice").value);
      const to=this.game.players[toId]; if(to.money<price){ UI.log("El comprador no tiene fondos."); return; }
      const st=this.game.board.state[prId]; st.owner=toId;
      fromPlayer.properties=fromPlayer.properties.filter(p=>p.id!=prId);
      to.properties.push({id:prId,type:st.type,houses:st.houses,hotel:st.hotel,mortgaged:st.mortgaged});
      to.money-=price; fromPlayer.money+=price;
      UI.renderPlayers(this.game); UI.renderTokens(this.game); UI.log(`${fromPlayer.nick} vende ${this.game.board.cellById(prId).name} a ${to.nick} por ${UI.money(price)}.`); modal.close();
    };
  }

  saveState(){ localStorage.setItem("monopoly_save", JSON.stringify(this.game.toJSON())); UI.log("Partida guardada."); }
  loadState(){
    const txt=localStorage.getItem("monopoly_save"); if(!txt){ UI.log("No hay partida guardada."); return; }
    const data=JSON.parse(txt); this.game.loadFrom(data); UI.renderBoard(this.game); UI.renderPlayers(this.game); UI.renderCurrent(this.game); UI.log("Partida cargada.");
  }

  finalizeGame(){
    if(this.game.state!=="running") return; this.game.state="over";
    const results=this.game.players.map(p=>({id:p.id,nick:p.nick,country:p.country,score:this.calcScore(p)})).sort((a,b)=>b.score-a.score);
    const list=$("#finalScores"); list.innerHTML="";
    results.forEach((r,i)=>{ const el=document.createElement("div"); el.className="d-flex align-items-center justify-content-between border rounded p-2 mb-2";
      el.innerHTML=`<div class="fw-bold">#${i+1}</div><div><img src="https://flagsapi.com/${r.country}/flat/64.png" width="32" height="24" class="rounded border"> <strong>${r.nick}</strong></div><div class="fw-bold">${UI.money(r.score)}</div>`; list.appendChild(el); });
    $("#finalModal").showModal();
    results.forEach(r=>ApiService.postJSON(API.SCORE,{nick_name:r.nick,score:r.score,country_code:r.country}).catch(()=>{}));
  }
  calcScore(p){
    let total=p.money;
    for(const pr of p.properties){
      const cell=this.game.board.cellById(pr.id); if(!cell) continue;
      if(!pr.mortgaged) total += Number(cell.price||0);
      total += (pr.houses||0)*100; if(pr.hotel) total+=200;
      if(pr.mortgaged) total -= Number(cell.price||0);
    } return total;
  }
}
