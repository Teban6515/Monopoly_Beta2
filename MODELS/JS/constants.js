/**
 * @file constants.js
 * PUNTO ÚNICO DE VERDAD: rutas de API (opcional) y parámetros del juego.
 * Editar aquí para ajustar reglas y endpoints sin tocar la lógica.
 */

/** Endpoints de backend (opcionales). El juego funciona sin ellos (fallback local). */
export const API = {
  BOARD: "http://127.0.0.1:5000/board",        // Devuelve JSON del tablero
  COUNTRIES: "http://127.0.0.1:5000/countries", // Devuelve JSON de países
  RANKING: "http://127.0.0.1:5000/ranking",         // Lista de mejores puntajes
  SCORE: "http://127.0.0.1:5000/score-recorder"     // Endpoint para registrar puntaje
};

/** Parámetros de regla de juego (ajustables). */
export const CONFIG = {
  START_MONEY: 1500,    // Dinero inicial por jugador
  PASS_GO: 200,         // Bono por pasar por "Salida"
  HOUSE_COST: 100,      // Costo de construir una casa
  HOTEL_COST: 250,      // Costo de construir un hotel
  JAIL_FINE: 50,        // Multa opcional (no utilizada en la lógica actual)
  MAX_JAIL_TURNS: 3,    // Turnos máx. en cárcel sin sacar dobles
  PASTEL_BLUE: "#8BBCE5"
};
