/**
 * @file uiController.js
 * Controlador de presentación (render puro, sin reglas).
 * Responsabilidades:
 *  - Pintar el tablero (grid 11x11) y todas sus casillas en el perímetro.
 *  - Pintar tokens de jugadores y el estado inmobiliario (dueño, casas, hotel, hipoteca).
 *  - Tarjetas de jugadores y del turno actual.
 *  - Log visual y zona de acciones.
 * NOTA: No modifica reglas ni estado del juego; sólo “lee y dibuja”.
 */

const $  = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

export const UI = {
  /** Formatea dinero con locale colombiano. */
  money(n){ return "$" + Number(n).toLocaleString("es-CO"); },

  /** URL de bandera por código ISO-2 (usa FlagsAPI). */
  flag(c){ return `https://flagsapi.com/${c.toUpperCase()}/flat/64.png`; },

  /** Limpia el contenedor de acciones contextuales. */
  clearActions(){ $("#actionArea").innerHTML = ""; },

  /** Crea un botón estilizado con callback. */
  button(label, cb, cls="btn btn-outline-primary"){
    const b=document.createElement("button");
    b.textContent=label;
    b.className=cls;
    b.addEventListener("click",cb);
    return b;
  },

  /** Agrega una entrada visual al log (último arriba). */
  log(text){
    const el=document.createElement("div");
    el.className="event";
    el.textContent=text;
    $("#log").prepend(el);
  },

  /**
   * Dibuja tablero completo:
   * 1) Limpia #board y coloca logo central.
   * 2) Calcula mapeo perimetral de 40 casillas en un grid 11x11.
   * 3) Crea cada casilla (.square) con clases por tipo y contenido semántico.
   * 4) Pinta tokens y estado inmobiliario (renderTokens).
   */
  renderBoard(game){
    const board = $("#board");
    board.innerHTML = "";

    // Logo central
    const center = document.createElement("div");
    center.className = "center-logo display-4 fw-bold text-white";
    center.textContent = "MONOPOLY";
    board.appendChild(center);

    // Mapa de coordenadas perimetrales (0..39)
    const map=[];
    for(let c=10;c>=0;c--) map.push([10,c]); // bottom:  0..10
    for(let r=9;r>=1;r--)  map.push([r,0]);  // left:   11..19
    for(let c=0;c<=10;c++) map.push([0,c]);  // top:    20..30
    for(let r=1;r<=9;r++)  map.push([r,10]); // right:  31..39

    // Pintar 40 casillas
    for(let i=0;i<40;i++){
      const [row,col] = map[i];
      const cell = game.board.linear[i];

      const el = document.createElement("div");
      el.className = `square ${typeClass(cell.type)}`;
      el.style.gridRow = row + 1;
      el.style.gridColumn = col + 1;
      el.dataset.id = String(cell.id);

      // Estructura interna
      if(cell.type==="property"){
        el.innerHTML = `
          <div class="band ${cell.color} band"></div>
          <div class="owner"></div>
          <div class="buildings"></div>
          <div class="name">${cell.name}</div>`;
      }else{
        el.innerHTML = `
          <div class="owner"></div>
          <div class="buildings"></div>
          <div class="name">${cell.name}</div>`;
      }
      board.appendChild(el);
    }

    // Tokens + estado inmobiliario
    this.renderTokens(game);
  },

  /**
   * Pinta fichas de jugadores y los indicadores de cada propiedad (dueño, casas, hotel, hipoteca).
   * Estrategia:
   *  - Elimina todas las fichas previas para evitar duplicados.
   *  - Coloca una “bolita” por jugador en su .square actual.
   *  - Recorre board.state para colorear dueño y construir mini-iconos (casas/hotel/hipoteca).
   */
  renderTokens(game){
    // Borrar fichas previas
    $$(".token").forEach(el=>el.remove());

    // Fichas de jugadores
    for(const p of game.players){
      const cell = $(`.square[data-id="${p.position}"]`);
      if(!cell) continue;
      const dot=document.createElement("div");
      dot.className="token";
      dot.style.background=p.color;
      // Separación horizontal simple para evitar superposición total
      dot.style.left=(6+(p.id%3)*20)+"px";
      dot.title=p.nick;
      cell.appendChild(dot);
    }

    // Estado inmobiliario por casilla
    for(const [id, st] of Object.entries(game.board.state)){
      const cell=$(`.square[data-id="${id}"]`);
      if(!cell) continue;

      const own = $(".owner", cell);
      const bld = $(".buildings", cell);

      // Color del dueño en una “esquina”
      if(own) own.style.background = (st.owner!=null) ? game.players[st.owner].color : "transparent";

      // Casas/hotel/hipoteca
      if(bld){
        bld.innerHTML="";
        if(st.hotel){
          const h=document.createElement("div"); h.className="hotel"; bld.appendChild(h);
        }else{
          for(let i=0;i<st.houses;i++){
            const h=document.createElement("div"); h.className="house"; bld.appendChild(h);
          }
        }
        if(st.mortgaged){
          const m=document.createElement("div");
          m.className="house";
          m.style.background="#555";
          m.title="Hipotecada";
          bld.appendChild(m);
        }
      }
    }
  },

  /** Tarjetas con resumen de cada jugador en el panel lateral. */
  renderPlayers(game){
    const wrap=$("#playersPanel");
    wrap.innerHTML="";
    for(const p of game.players){
      const card=document.createElement("div");
      card.className="player-card card mb-2";
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

  /** Tarjeta que destaca quién juega ahora. */
  renderCurrent(game){
    const p=game.players[game.current];
    $("#currentPlayer").innerHTML=`<div class="player-card card">
      <div class="card-body d-flex align-items-center justify-content-between">
        <div class="d-flex align-items-center gap-2">
          <img src="${this.flag(p.country)}" width="32" height="24" class="rounded border" alt="Bandera ${p.country}">
          <div>
            <div class="fw-bold">${p.nick}</div>
            <div class="text-muted small">Turno actual</div>
          </div>
        </div>
        <div class="chip" style="background:${p.color}" aria-label="Color de ficha"></div>
      </div>
    </div>`;
  }
};

/** Mapea tipos del tablero a clases CSS para tematizar casillas. */
function typeClass(t){
  switch(t){
    case "property":        return "property";
    case "railroad":        return "railroad";
    case "tax":             return "tax";
    case "chance":          return "chance";
    case "community_chest": return "community";
    case "special":         return "special";
    default:                return "";
  }
}
