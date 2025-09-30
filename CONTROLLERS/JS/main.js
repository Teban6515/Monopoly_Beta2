/**
 * @file main.js
 * Punto de entrada del front: instancia el GameController al cargar el DOM
 * y expone la instancia para depuración con window._gameController.
 */

import { GameController } from "./gameController.js";

window.addEventListener("DOMContentLoaded", async ()=>{
  const controller = new GameController();
  await controller.bootstrap();
  // Útil para inspeccionar estado en consola: _gameController.game
  window._gameController = controller;
});
