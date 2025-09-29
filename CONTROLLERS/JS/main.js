
// CONTROLLERS/JS/main.js
import { GameController } from "./gameController.js";
window.addEventListener("DOMContentLoaded", async ()=>{
  const controller = new GameController();
  await controller.bootstrap();
  window._gameController = controller;
});
