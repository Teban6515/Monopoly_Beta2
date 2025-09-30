/**
 * @file gameController.js
 * Orquestador del juego: carga datos, crea modelos, conecta UI y aplica reglas.
 * Áreas de responsabilidad:
 *  - Bootstrap resiliente (API o fallback local).
 *  - Setup de jugadores (modal).
 *  - Bucle de turno: tirar dados, cárcel/dobles, movimiento, caída y resolución.
 *  - Mercado: comprar, subastar, pagar rentas, construir/vender, (des)hipotecar, comerciar.
 *  - Persistencia simple en localStorage.
 *  - Finalización y cálculo de puntuaciones.
 */

import { API, CONFIG } from "../../MODELS/JS/constants.js";
import { GameState } from "../../MODELS/JS/gameState.js";
import { BoardModel } from "../../MODELS/JS/boardModel.js";
import { Player } from "../../MODELS/JS/player.js";
import { ApiService } from "./apiService.js";
import { UI } from "./uiController.js";

const $ = (s, r = document) => r.querySelector(s);

export class GameController {
  constructor() {
    /** @type {GameState} Estado global de la partida. */
    this.game = new GameState();
  }

  /**
   * Carga tablero y países desde API; si falla, usa assets locales.
   * Crea modelos (BoardModel) y arranca la UI y el Setup.
   */
  async bootstrap() {
    try {
      const [rawBoard, rawCountries] = await Promise.all([
        ApiService.strictGet(API.BOARD),
        ApiService.strictGet(API.COUNTRIES)
      ]);

      // Transformar [{ "co": "Colombia" }, { "us": "Estados Unidos" }] 
      // → [{ code: "CO", name: "Colombia" }, { code: "US", name: "Estados Unidos" }]
      this.game.board = new BoardModel(rawBoard);
      this.game.countries = rawCountries.map(obj => {
        const code = Object.keys(obj)[0];      // ej. "co"
        const name = obj[code];                // ej. "Colombia"
        return { code: code.toUpperCase(), name };
      });

      console.log("DEBUG countries:", this.game.countries);

      // 3) Primer render y Setup
      UI.renderBoard(this.game);
      UI.renderPlayers(this.game);
      this.buildSetup();

      // 4) Listeners UI
      const $ = (s, r = document) => r.querySelector(s);
      $("#btnShowRanking")?.addEventListener("click", () => this.showRanking());
      $("#btnEndGame")?.addEventListener("click", () => this.finalizeGame());
      $("#btnRoll")?.addEventListener("click", () => this.roll());
      $("#btnEndTurn")?.addEventListener("click", () => this.endTurn());
      $("#btnSave")?.addEventListener("click", () => this.saveState());
      $("#btnLoad")?.addEventListener("click", () => this.loadState());

    } catch (err) {
      // Puedes personalizar este manejo (modal, toast, etc.)
      console.error(err);
      alert("No fue posible obtener datos del backend (tablero y/o países). Revisa el servidor o los endpoints en constants.js.");
    }
  }


  /**
   * Modal de Setup: define # de jugadores y crea Player[].
   * Inicia la partida en estado 'running'.
   */
  buildSetup() {
    const m = $("#setupModal");
    const preset = ["#5B9BD5", "#7FB77E", "#F5B971", "#4EA1D3"]; // Colores por defecto

    // Redibuja filas del formulario según n
    const draw = () => {
      const wrap = $("#playersSetup"); wrap.innerHTML = "";
      const n = Number($("#numPlayers").value);

      for (let i = 0; i < n; i++) {
        const row = document.createElement("div");
        row.className = "row g-2";
        row.innerHTML = `
          <div class="col-md-6"><label class="form-label">Nickname
            <input class="form-control" type="text" required name="nick_${i}" placeholder="Jugador ${i + 1}"></label></div>
          <div class="col-md-3"><label class="form-label">País
            <select class="form-select" name="country_${i}" required>
              ${this.game.countries.map(c => `<option value="${c.code}">${c.name}</option>`).join("")}
            </select></label></div>
          <div class="col-md-3"><label class="form-label">Color ficha
            <input class="form-control form-control-color" type="color" name="color_${i}" value="${preset[i % preset.length]}"></label></div>`;
        wrap.appendChild(row);
      }
    };

    $("#numPlayers").addEventListener("change", draw);
    draw();

    // Crear jugadores y arrancar
    $("#btnStart").addEventListener("click", (ev) => {
      ev.preventDefault();
      const n = Number($("#numPlayers").value);
      const form = $("#setupForm");

      this.game.players = [];
      for (let i = 0; i < n; i++) {
        const nick = (form[`nick_${i}`].value || "").trim() || `J${i + 1}`;
        const country = form[`country_${i}`].value;
        const color = form[`color_${i}`].value;
        this.game.addPlayer(new Player(i, nick, country, color));
      }

      this.game.state = "running";
      m.close();
      UI.renderPlayers(this.game);
      UI.renderCurrent(this.game);
      UI.log(`Comienza el juego con ${n} jugadores.`);
    });

    m.showModal();
  }

  /** Ranking remoto (si existe). Muestra lista básica en modal. */
  async showRanking() {
    const list = $("#rankingList");
    list.innerHTML = "Cargando...";
    $("#rankingModal").showModal();

    const data = await ApiService.tryFetch(API.RANKING);
    if (!data) { list.textContent = "No fue posible obtener el ranking."; return; }

    list.innerHTML = "";
    data.forEach((row, i) => {
      const el = document.createElement("div");
      el.className = "d-flex align-items-center justify-content-between border rounded p-2 mb-2";
      el.innerHTML = `<div class="fw-bold">#${i + 1}</div>
        <div><img src="https://flagsapi.com/${row.country_code}/flat/64.png" width="32" height="24" class="rounded border" alt="bandera"> <strong>${row.nick_name}</strong></div>
        <div class="fw-bold">${UI.money(row.score)}</div>`;
      list.appendChild(el);
    });
  }

  /**
   * Tirar dados y aplicar reglas:
   * - Si está en cárcel: sale con dobles o al cumplir turnos.
   * - Maneja dobles consecutivos (a la 3ª → cárcel).
   * - Mueve y resuelve casilla. Con dobles (no 3ª), conserva turno.
   */
  roll() {
    if (this.game.state !== "running") return;
    const p = this.game.currentPlayer();
    if (p.bankrupt) { UI.log(`${p.nick} está en bancarrota.`); return; }

    // Rama: jugador en cárcel
    if (p.inJail) {
      const d1 = Number($("#dbgD1").value) || (1 + Math.floor(Math.random() * 6));
      const d2 = Number($("#dbgD2").value) || (1 + Math.floor(Math.random() * 6));
      $("#dbgD1").value = ""; $("#dbgD2").value = "";
      $("#diceValues").textContent = `${d1} + ${d2} = ${d1 + d2}`;

      if (d1 === d2) {
        p.inJail = false; p.jailTurns = 0;
        UI.log(`${p.nick} saca dobles y sale de la cárcel.`);
        this.move(p, d1 + d2);
      } else {
        p.jailTurns++;
        UI.log(`${p.nick} no saca dobles (${p.jailTurns}/${CONFIG.MAX_JAIL_TURNS}).`);
        if (p.jailTurns >= CONFIG.MAX_JAIL_TURNS) {
          p.inJail = false; p.jailTurns = 0;
          UI.log(`${p.nick} cumplió condena y sale.`);
        }
        UI.renderPlayers(this.game);
      }
      return;
    }

    // Rama: jugador libre
    const d1 = Number($("#dbgD1").value) || (1 + Math.floor(Math.random() * 6));
    const d2 = Number($("#dbgD2").value) || (1 + Math.floor(Math.random() * 6));
    $("#dbgD1").value = ""; $("#dbgD2").value = "";
    $("#diceValues").textContent = `${d1} + ${d2} = ${d1 + d2}`;

    // Dobles consecutivos
    if (d1 === d2) {
      p.consecutiveDoubles++;
      if (p.consecutiveDoubles === 3) {
        UI.log(`${p.nick} obtiene 3 dobles consecutivos. Va a la cárcel.`);
        p.position = 10; p.inJail = true; p.jailTurns = 0; p.consecutiveDoubles = 0;
        UI.renderTokens(this.game); UI.renderPlayers(this.game);
        return;
      }
    } else {
      p.consecutiveDoubles = 0;
    }

    // Mover y, si fueron dobles (sin ser la 3ª), conservar turno
    this.move(p, d1 + d2);
    if (d1 === d2) {
      UI.log(`Dobles: ${p.nick} juega de nuevo.`);
      UI.renderCurrent(this.game);
    }
  }

  /**
   * Avanza 'steps' casillas, cobra salida si cruza y resuelve la casilla destino.
   * Actualiza UI tras mover.
   */
  move(p, steps) {
    const next = (p.position + steps) % 40;

    // Cobro por pasar por salida
    if (p.position + steps >= 40) {
      p.money += CONFIG.PASS_GO;
      UI.log(`${p.nick} pasa por Salida y recibe ${UI.money(CONFIG.PASS_GO)}.`);
    }

    p.position = next;
    UI.renderTokens(this.game);
    UI.renderPlayers(this.game);
    this.handleLanding(p, next);
  }

  /** Pasa el turno al siguiente jugador. */
  endTurn() {
    if (this.game.state !== "running") return;
    UI.clearActions();
    this.game.nextTurn();
    UI.renderCurrent(this.game);
    UI.log(`Turno de ${this.game.currentPlayer().nick}.`);
  }

  /**
   * Resuelve la casilla al caer:
   * - special: cárcel/salida
   * - tax: suma/resta action.money
   * - chance/community_chest: toma carta, aplica money y movimientos
   * - property/railroad: comprar/subastar/acciones de dueño/cobrar renta
   */
  handleLanding(p, id) {
    const cell = this.game.board.cellById(id);
    UI.log(`${p.nick} cae en "${cell.name}".`);
    UI.clearActions();

    // Especiales
    if (cell.type === "special") {
      // Ve a la cárcel (por nombre o por action)
      if (cell.name.includes("Ve a la Cárcel") || (cell.action && cell.action.goTo === "jail")) {
        p.position = 10; p.inJail = true; p.jailTurns = 0; p.consecutiveDoubles = 0;
        UI.renderTokens(this.game); UI.renderPlayers(this.game);
        UI.log(`${p.nick} va a la cárcel.`);
        return;
      }
      // Caer en Salida con bono
      if (cell.name.includes("Salida") && cell.action?.money) {
        p.money += Number(cell.action.money);
        UI.renderPlayers(this.game);
        UI.log(`${p.nick} recibe ${UI.money(cell.action.money)} por caer en Salida.`);
      }
      return;
    }

    // Impuestos
    if (cell.type === "tax") {
      const delta = Number(cell.action?.money || 0);
      p.money += delta; // suele ser negativo
      UI.renderPlayers(this.game);
      UI.log(`${p.nick} paga impuestos por ${UI.money(Math.abs(delta))}.`);
      return;
    }

    // Cartas
    if (cell.type === "chance" || cell.type === "community_chest") {
      const deck = cell.type === "chance" ? this.game.board.raw.chance : this.game.board.raw.community_chest;
      const card = deck[Math.floor(Math.random() * deck.length)];
      const delta = Number(card.action?.money || 0);
      p.money += delta;

      if (card.action?.goTo === "jail") {
        p.position = 10; p.inJail = true; p.jailTurns = 0;
      }
      if (typeof card.action?.moveTo === "number") {
        p.position = card.action.moveTo;
      }

      UI.renderTokens(this.game);
      UI.renderPlayers(this.game);
      UI.log(`Carta: ${card.description} (${delta >= 0 ? "+" : ""}${UI.money(delta)}).`);
      return;
    }

    // Propiedades y Ferrocarriles
    if (cell.type === "railroad" || cell.type === "property") {
      const st = this.game.board.state[cell.id];

      // Sin dueño → acciones: comprar / subastar / pasar
      if (st.owner === null) {
        const area = $("#actionArea");
        area.appendChild(this.btnBuy(p, cell));
        area.appendChild(this.btnAuction(cell));
        area.appendChild(UI.button("Pasar", () => { }, "btn btn-light"));
        return;
      }

      // Dueño = jugador actual → opciones de propietario
      if (st.owner === p.id) {
        this.ownerOptions(p, cell, st);
        return;
      }

      // Dueño = otro → cobrar renta (si no está hipotecada)
      if (st.mortgaged) {
        UI.log(`La propiedad está hipotecada; no se cobra renta.`);
        return;
      }
      const owner = this.game.players[st.owner];
      const rent = this.computeRent(cell, st, owner);
      this.payRent(p, owner, rent);
    }
  }

  /** Calcula la renta según tipo y construcciones. */
  computeRent(cell, st, owner) {
    if (cell.type === "railroad") {
      const count = owner.properties.filter(q => q.type === "railroad").length;
      return Number(cell.rent[count] || 0);
    }
    if (cell.type === "property") {
      if (st.hotel) return Number(cell.rent.withHotel);
      if (st.houses > 0) return Number(cell.rent.withHouse[st.houses - 1] || 0);
      return Number(cell.rent.base || 0);
    }
    return 0;
  }

  /** Botón contextual para comprar la casilla actual. */
  btnBuy(p, cell) {
    const b = document.createElement("button");
    b.className = "btn btn-outline-primary";
    b.textContent = `Comprar por ${UI.money(cell.price)}`;
    b.onclick = () => {
      if (p.money < cell.price) { UI.log("Fondos insuficientes."); return; }
      const st = this.game.board.state[cell.id];
      p.money -= cell.price;
      st.owner = p.id;
      st.type = cell.type;
      p.properties.push({ id: cell.id, type: cell.type, houses: 0, hotel: false, mortgaged: false });
      UI.renderPlayers(this.game);
      UI.renderTokens(this.game);
      UI.log(`${p.nick} compra ${cell.name}.`);
      UI.clearActions();
    };
    return b;
  }

  /** Botón contextual para subastar (abre modal). */
  btnAuction(cell) {
    const b = document.createElement("button");
    b.className = "btn btn-outline-secondary";
    b.textContent = "Subastar";
    b.onclick = () => this.openAuction(cell);
    return b;
  }

  /**
   * Opciones disponibles cuando el jugador es el dueño:
   * - Construir Casa / Hotel (si reglas lo permiten)
   * - Vender construcción
   * - (Des)hipotecar
   * - Comerciar
   */
  ownerOptions(p, cell, st) {
    const area = $("#actionArea");
    area.innerHTML = "";

    // Construir casa (monopolio + balance)
    if (cell.type === "property" && this.canBuildHouse(p, cell)) {
      area.appendChild(this.actionBtn(`Construir Casa (+${UI.money(CONFIG.HOUSE_COST)})`, () => {
        if (p.money < CONFIG.HOUSE_COST) { UI.log("Fondos insuficientes."); return; }
        p.money -= CONFIG.HOUSE_COST;
        st.houses++;
        this.getPlayerProp(p, cell.id).houses = st.houses;
        UI.renderPlayers(this.game);
        UI.renderTokens(this.game);
        UI.log(`${p.nick} construye una casa en ${cell.name}.`);
      }));
    }

    // Construir hotel (requiere 4 casas previas)
    if (cell.type === "property" && this.canBuildHotel(p, cell)) {
      area.appendChild(this.actionBtn(`Construir Hotel (+${UI.money(CONFIG.HOTEL_COST)})`, () => {
        if (p.money < CONFIG.HOTEL_COST) { UI.log("Fondos insuficientes."); return; }
        p.money -= CONFIG.HOTEL_COST;
        st.houses = 0; st.hotel = true;
        const pr = this.getPlayerProp(p, cell.id);
        pr.houses = 0; pr.hotel = true;
        UI.renderPlayers(this.game);
        UI.renderTokens(this.game);
        UI.log(`${p.nick} construye un hotel en ${cell.name}.`);
      }));
    }

    // Vender construcción
    if (cell.type === "property" && (st.houses > 0 || st.hotel)) {
      area.appendChild(this.actionBtn(
        `Vender ${st.hotel ? "Hotel" : "Casa"} (+${UI.money(st.hotel ? CONFIG.HOTEL_COST / 2 : CONFIG.HOUSE_COST / 2)})`,
        () => {
          if (st.hotel) {
            st.hotel = false;
            this.getPlayerProp(p, cell.id).hotel = false;
            p.money += CONFIG.HOTEL_COST / 2;
          } else {
            st.houses--;
            this.getPlayerProp(p, cell.id).houses = st.houses;
            p.money += CONFIG.HOUSE_COST / 2;
          }
          UI.renderPlayers(this.game);
          UI.renderTokens(this.game);
          UI.log(`${p.nick} vende construcción en ${cell.name}.`);
        }
      ));
    }

    // (Des)hipotecar
    if (!st.mortgaged) {
      area.appendChild(this.actionBtn(`Hipotecar (+${UI.money(cell.mortgage)})`, () => {
        st.mortgaged = true;
        this.getPlayerProp(p, cell.id).mortgaged = true;
        p.money += cell.mortgage;
        UI.renderPlayers(this.game);
        UI.renderTokens(this.game);
        UI.log(`${p.nick} hipoteca ${cell.name}.`);
      }));
    } else {
      const repay = Math.ceil(cell.mortgage * 1.1); // 10% interés
      area.appendChild(this.actionBtn(`Deshipotecar (-${UI.money(repay)})`, () => {
        if (p.money < repay) { UI.log("Fondos insuficientes."); return; }
        st.mortgaged = false;
        this.getPlayerProp(p, cell.id).mortgaged = false;
        p.money -= repay;
        UI.renderPlayers(this.game);
        UI.renderTokens(this.game);
        UI.log(`${p.nick} deshipoteca ${cell.name}.`);
      }));
    }

    // Comercio
    area.appendChild(this.actionBtn("Comerciar", () => this.openTrade(p)));
  }

  /** Helper UI para crear botones de acción contextuales. */
  actionBtn(label, fn) {
    const b = document.createElement("button");
    b.className = "btn btn-outline-primary me-2";
    b.textContent = label;
    b.onclick = fn;
    return b;
  }

  /** Reglas de construir casa: monopolio, <4 casas, sin hotel y construcción balanceada. */
  canBuildHouse(p, cell) {
    const st = this.game.board.state[cell.id];
    if (!(cell.type === "property" && !st.hotel && st.houses < 4)) return false;
    if (!this.hasMonopoly(p, cell.color)) return false;

    // Balance: no subir más que el mínimo del grupo
    const group = this.game.board.getGroup(cell.color);
    const minH = Math.min(...group.map(c => this.game.board.state[c.id].houses));
    return st.houses === minH;
  }

  /** Reglas de hotel: requiere 4 casas previas y monopolio. */
  canBuildHotel(p, cell) {
    const st = this.game.board.state[cell.id];
    return cell.type === "property" && st.houses === 4 && !st.hotel && this.hasMonopoly(p, cell.color);
  }

  /** ¿El jugador posee todas las propiedades del color? (Monopolio) */
  hasMonopoly(player, color) {
    return this.game.board.getGroup(color).every(c => this.game.board.state[c.id]?.owner === player.id);
  }

  /** Obtiene el registro de propiedad del jugador por id (para sincronizar con board.state). */
  getPlayerProp(p, id) { return p.properties.find(pr => pr.id === id); }

  /**
   * Cobra renta transfiriendo dinero de payer → owner.
   * Si no alcanza, ofrece bancarrota (transfiere propiedades).
   */
  payRent(payer, owner, rent) {
    if (rent <= 0) return;

    if (payer.money >= rent) {
      payer.money -= rent;
      owner.money += rent;
      UI.renderPlayers(this.game);
      UI.log(`${payer.nick} paga renta ${UI.money(rent)} a ${owner.nick}.`);
    } else {
      UI.log(`${payer.nick} no alcanza a pagar la renta (${UI.money(rent)}).`);
      const area = $("#actionArea"); area.innerHTML = "";
      area.appendChild(this.actionBtn("Declarar bancarrota", () => {
        payer.bankrupt = true;
        for (const pr of payer.properties) {
          const st = this.game.board.state[pr.id];
          st.owner = owner.id;
          owner.properties.push(pr);
        }
        payer.properties = [];
        UI.renderPlayers(this.game);
        UI.renderTokens(this.game);
        UI.log(`${payer.nick} entra en bancarrota. Propiedades pasan a ${owner.nick}.`);
      }));
    }
  }

  // ===== Subasta =====

  /** Abre el modal de subasta y asigna ganador si confirma. */
  openAuction(cell) {
    const modal = $("#auctionModal");
    $("#aucProp").textContent = cell.name;
    $("#aucWinner").innerHTML = this.game.players.map(p => `<option value="${p.id}">${p.nick}</option>`).join("");
    $("#aucPrice").value = Math.ceil((cell.price || 0) / 2);
    modal.showModal();

    $("#btnAucCancel").onclick = () => modal.close();
    $("#btnAucConfirm").onclick = () => {
      const winnerId = Number($("#aucWinner").value);
      const price = Number($("#aucPrice").value);
      const w = this.game.players[winnerId];
      if (w.money < price) { UI.log("El ganador no tiene fondos."); return; }

      w.money -= price;
      const st = this.game.board.state[cell.id];
      st.owner = winnerId;
      st.type = cell.type;
      w.properties.push({ id: cell.id, type: cell.type, houses: 0, hotel: false, mortgaged: false });

      UI.renderPlayers(this.game);
      UI.renderTokens(this.game);
      UI.log(`${w.nick} gana la subasta de ${cell.name} por ${UI.money(price)}.`);
      modal.close();
    };
  }

  // ===== Comercio =====

  /** Abre el modal de comercio desde el jugador 'fromPlayer'. */
  openTrade(fromPlayer) {
    const modal = $("#tradeModal");

    // Fijo: vendedor
    $("#trFrom").innerHTML = `<option value="${fromPlayer.id}">${fromPlayer.nick}</option>`;

    // Compradores
    $("#trTo").innerHTML = this.game.players
      .filter(p => p.id !== fromPlayer.id)
      .map(p => `<option value="${p.id}">${p.nick}</option>`)
      .join("");

    // Propiedades a la venta
    $("#trProp").innerHTML = fromPlayer.properties.map(pr => {
      const c = this.game.board.cellById(pr.id);
      return `<option value="${pr.id}">${c.name}</option>`;
    }).join("");

    $("#trPrice").value = 100;

    modal.showModal();
    $("#btnTrCancel").onclick = () => modal.close();
    $("#btnTrConfirm").onclick = () => {
      const toId = Number($("#trTo").value);
      const prId = Number($("#trProp").value);
      const price = Number($("#trPrice").value);
      const to = this.game.players[toId];
      if (to.money < price) { UI.log("El comprador no tiene fondos."); return; }

      // Transferir propiedad
      const st = this.game.board.state[prId];
      st.owner = toId;

      // Quitar del vendedor y agregar al comprador (conservando estado)
      fromPlayer.properties = fromPlayer.properties.filter(p => p.id != prId);
      to.properties.push({ id: prId, type: st.type, houses: st.houses, hotel: st.hotel, mortgaged: st.mortgaged });

      // Transacción
      to.money -= price;
      fromPlayer.money += price;

      UI.renderPlayers(this.game);
      UI.renderTokens(this.game);
      UI.log(`${fromPlayer.nick} vende ${this.game.board.cellById(prId).name} a ${to.nick} por ${UI.money(price)}.`);
      modal.close();
    };
  }

  // ===== Persistencia =====

  /** Guarda snapshot en localStorage. */
  saveState() {
    localStorage.setItem("monopoly_save", JSON.stringify(this.game.toJSON()));
    UI.log("Partida guardada.");
  }

  /** Carga snapshot desde localStorage (si existe) y re-renderiza. */
  loadState() {
    const txt = localStorage.getItem("monopoly_save");
    if (!txt) { UI.log("No hay partida guardada."); return; }
    const data = JSON.parse(txt);
    this.game.loadFrom(data);
    UI.renderBoard(this.game);
    UI.renderPlayers(this.game);
    UI.renderCurrent(this.game);
    UI.log("Partida cargada.");
  }

  // ===== Final =====

  /**
   * Termina partida, calcula y presenta ranking local.
   * Luego intenta enviar los puntajes (si hay endpoint).
   */
  finalizeGame() {
    if (this.game.state !== "running") return;
    this.game.state = "over";

    const results = this.game.players
      .map(p => ({ id: p.id, nick: p.nick, country: p.country, score: this.calcScore(p) }))
      .sort((a, b) => b.score - a.score);

    const list = $("#finalScores"); list.innerHTML = "";
    results.forEach((r, i) => {
      const el = document.createElement("div");
      el.className = "d-flex align-items-center justify-content-between border rounded p-2 mb-2";
      el.innerHTML = `<div class="fw-bold">#${i + 1}</div>
        <div><img src="https://flagsapi.com/${r.country}/flat/64.png" width="32" height="24" class="rounded border" alt="bandera"> <strong>${r.nick}</strong></div>
        <div class="fw-bold">${UI.money(r.score)}</div>`;
      list.appendChild(el);
    });
    $("#finalModal").showModal();

    // Telemetría no bloqueante
    results.forEach(r => ApiService.postJSON(API.SCORE, {
      nick_name: r.nick, score: r.score, country_code: r.country
    }).catch(() => { }));
  }

  /**
   * Heurística de puntuación:
   * dinero + precio de propiedades NO hipotecadas + valor de construcciones - precio de hipotecadas
   * (Puedes mejorarla sumando costos reales de casas/hoteles, etc.)
   */
  calcScore(p) {
    let total = p.money;
    for (const pr of p.properties) {
      const cell = this.game.board.cellById(pr.id);
      if (!cell) continue;
      if (!pr.mortgaged) total += Number(cell.price || 0);
      total += (pr.houses || 0) * 100;
      if (pr.hotel) total += 200;
      if (pr.mortgaged) total -= Number(cell.price || 0);
    }
    return total;
  }
}
