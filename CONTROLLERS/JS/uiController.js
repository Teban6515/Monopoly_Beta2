
// CONTROLLERS/JS/uiController.js
const $ = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

export const UI = {
  money(n){ return "$" + Number(n).toLocaleString("es-CO"); },
  flag(c){ return `https://flagsapi.com/${c.toUpperCase()}/flat/64.png`; },
  clearActions(){ $("#actionArea").innerHTML=""; },
  button(label, cb, cls="btn btn-outline-primary"){ const b=document.createElement("button"); b.textContent=label; b.className=cls; b.addEventListener("click",cb); return b; },
  log(msg){ const el=document.createElement("div"); el.className="event"; el.textContent=msg; $("#log").prepend(el); },

  renderBoard(game){
    const board=$("#board"); board.innerHTML="";
    const center=document.createElement("div"); center.className="center-logo display-4 fw-bold text-white"; center.textContent="MONOPOLY"; board.appendChild(center);
    const map=[]; for(let c=10;c>=0;c--) map.push([10,c]); for(let r=9;r>=1;r--) map.push([r,0]); for(let c=0;c<=10;c++) map.push([0,c]); for(let r=1;r<=9;r++) map.push([r,10]);
    for(let i=0;i<40;i++){
      const [row,col]=map[i]; const cell=game.board.linear[i];
      const el=document.createElement("div"); el.className=`square ${typeClass(cell.type)}`; el.style.gridRow=row+1; el.style.gridColumn=col+1; el.dataset.id=String(cell.id);
      if(cell.type==="property"){
        el.innerHTML=`<div class="band ${cell.color} band"></div><div class="owner"></div><div class="buildings"></div><div class="name">${cell.name}</div>`;
      }else{
        el.innerHTML=`<div class="owner"></div><div class="buildings"></div><div class="name">${cell.name}</div>`;
      }
      board.appendChild(el);
    }
    this.renderTokens(game);
  },
  renderTokens(game){
    $$(".token").forEach(t=>t.remove());
    for(const p of game.players){
      const cell=$(`.square[data-id="${p.position}"]`); if(!cell) continue;
      const dot=document.createElement("div"); dot.className="token"; dot.style.background=p.color; dot.style.left=(6+(p.id%3)*20)+"px"; dot.title=p.nick;
      cell.appendChild(dot);
    }
    for(const [id,st] of Object.entries(game.board.state)){
      const cell=$(`.square[data-id="${id}"]`); if(!cell) continue;
      const own=$(".owner",cell), b=$(".buildings",cell);
      if(own) own.style.background= st.owner!=null ? game.players[st.owner].color : "transparent";
      if(b){
        b.innerHTML=""; if(st.hotel){ const h=document.createElement("div"); h.className="hotel"; b.appendChild(h); }
        else for(let i=0;i<st.houses;i++){ const h=document.createElement("div"); h.className="house"; b.appendChild(h); }
        if(st.mortgaged){ const m=document.createElement("div"); m.className="house"; m.style.background="#555"; m.title="Hipotecada"; b.appendChild(m); }
      }
    }
  },
  renderPlayers(game){
    const wrap=$("#playersPanel"); wrap.innerHTML="";
    for(const p of game.players){
      const card=document.createElement("div"); card.className="player-card card mb-2";
      card.innerHTML=`<div class="card-body d-flex align-items-center gap-2">
        <div class="chip" style="background:${p.color}"></div>
        <div class="flex-grow-1">
          <div><strong>${p.nick}</strong> <span class="text-muted">(${p.country})</span></div>
          <div class="text-muted small">Pos: ${p.position} ${p.inJail?"| 🚔 Cárcel":""} ${p.consecutiveDoubles?`| dobles:${p.consecutiveDoubles}`:""}</div>
          <div class="text-muted small">Props: ${p.properties.length}</div>
        </div>
        <div class="fw-bold">${this.money(p.money)}</div></div>`;
      wrap.appendChild(card);
    }
  },
  renderCurrent(game){
    const p=game.players[game.current];
    $("#currentPlayer").innerHTML=`<div class="player-card card"><div class="card-body d-flex align-items-center justify-content-between">
      <div class="d-flex align-items-center gap-2"><img src="${this.flag(p.country)}" width="32" height="24" class="rounded border"><div><div class="fw-bold">${p.nick}</div><div class="text-muted small">Turno actual</div></div></div>
      <div class="chip" style="background:${p.color}"></div></div></div>`;
  }
};
function typeClass(t){
  switch(t){
    case "property": return "property";
    case "railroad": return "railroad";
    case "tax": return "tax";
    case "chance": return "chance";
    case "community_chest": return "community";
    case "special": return "special";
    default: return "";
  }
}
