# Baseline funcional de pelota — Ferro–Luján — 01/10/2026

## Objetivo

Después de cerrar y rechazar la guardia ambigua de tracking, el desarrollo deja de optimizar MOT y avanza hacia la demo funcional de handball. El primer requisito para posesión, lanzamiento y eventos es observar la pelota.

## Baseline

Se agregó `YoloSportsBallDetector`, un wrapper conservador sobre la clase COCO 32 (`sports ball`) del mismo YOLO11n usado como detector de control.

- no interpola posiciones ausentes;
- no infiere posesión;
- no genera eventos;
- cada salida es solamente un **candidato de pelota** con caja y confianza;
- Ultralytics se mantiene como dependencia opcional de visión.

`run_ball_demo.py` combina candidatos de pelota con el JSONL existente de jugadores para producir una salida visible con `track_id`, equipo y pelota cuando hay evidencia.

## Ejecución real

Fixture Ferro–N. S. de Luján, GT1 frames 105–209:

- 105 frames;
- 936×524 @ 30 FPS;
- `yolo11n.pt` SHA256 `0ebbc80d4a7680d14987a577cd21342b65ecfd94632bd9a8da63ae6417644ee1`;
- Ultralytics 8.4.163;
- clase 32 `sports ball`;
- `imgsz=640`;
- confianza mínima 0,05;
- **12 candidatos en 12/105 frames**.

El candidato más fuerte del probe alcanzó confianza 0,524 y una caja aproximada de 13×14 px. Una inspección visual de los candidatos de mayor confianza muestra señal útil sobre la pelota real, pero no existe todavía ground truth humano específico de pelota, así que **no se reporta precision/recall**.

## Demo visible

El runner dibuja:

- caja + ID persistente de jugador;
- equipo `Ferro` / `Lujan` / `unknown`;
- círculo `BALL?` y confianza sólo cuando YOLO devuelve candidato;
- `ball: not detected` en el resto de cuadros.

Esa ausencia explícita es intencional: no se quiere construir posesión sobre posiciones inventadas.

## Próximo paso

El cuello inmediato pasa a ser continuidad de pelota. Antes de inferir posesión se necesita una pequeña referencia humana de pelota o una auditoría visual estructurada para medir:

1. recall del detector genérico;
2. falsos positivos;
3. tamaño/movimiento real de la pelota;
4. si un tracker específico de pelota puede cerrar huecos sin inventar trayectorias.

Sólo después se incorporará `player ↔ ball` para candidatos de posesión.
