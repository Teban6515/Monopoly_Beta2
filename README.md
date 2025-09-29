# MONOPOLY – Entrega Final (Frontend, MVC + Bootstrap)

Estructura MVC:
```
CONTROLLERS/
  JS/
MODELS/
  JS/
VIEWS/
  HTML/
  STYLES/
    CSS/
assets/
```

Cómo ejecutar:
1) Arranca un servidor estático en esta carpeta (para evitar CORS):
   - `npx http-server .`  (Node)
   - o **Live Server** (VSCode)
2) Abre `VIEWS/HTML/index.html` en el navegador.
3) Arranca el backend `ms-monopoly` en `http://127.0.0.1`.
   - Si cambias host/puerto, actualiza `MODELS/JS/constants.js`.

Funcionalidades:
- Config. de 2–4 jugadores. Estructura de jugador completa y consistente.
- Movimiento con **dobles** (turno extra; 3 dobles seguidos = cárcel).
- Cárcel: salir con dobles, fianza (50) o esperar (máx. 3 turnos).
- Compra/venta, hipoteca/deshipoteca (10%), renta (casas/hotel o RR por cantidad).
- **Construcción uniforme** en monopolios; **venta** de casas/hotel (50%).
- **Subasta** al declinar compra.
- **Comercio** entre jugadores.
- Cartas de Sorpresa/Comunidad desde `board.json`.
- **Guardar/Cargar** partida (LocalStorage).
- **Ranking** (GET `/ranking`) y **envío de puntajes** (POST `/score-recorder`).
- UI con **Bootstrap 5** y tema **azul pastel**.
