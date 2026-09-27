# Segundo ground truth independiente: reentrada difícil Ferro–Luján

Después del primer TrackEval humano sobre frames 105–209, se evitó reutilizar ese mismo contacto o elegir un recorte sólo por conveniencia. Se analizaron las reapariciones internas del baseline `memory30` sobre los 3.600 frames y se buscaron gaps de 10–30 frames en escenas pobladas.

Se descartó como segunda validación principal el cruce ya documentado en frames 1065–1154 porque la auditoría sparse previa había mostrado continuidad estable en los puntos asignables; seguía siendo útil visualmente, pero ofrecía menor poder discriminativo.

## Intervalo seleccionado

- fixture frames: 2915–3004 inclusive;
- duración: 90 frames / 3,0 s;
- tiempo fixture: 97,1667–100,1667 s;
- tiempo en el MP4 original: 127,1667–130,1667 s;
- resolución: 936×524;
- FPS: 30;
- seed: `baseline_high_only` / `memory30`, no el tracker ganador de dos etapas;
- seed: 1.088 cajas y 18 IDs;
- manifest SHA256: `384ce079ec837f72fd5aaaef2e7a61b071b0f2d69bf937f4edf08b0d0d18260f`;
- paquete local del revisor SHA256: `9f72e60afbd96ccd350e76a55c9b50123ddda9d6aa34254e4e96cb108e840a7e`.

El evento central es el track 222: visible en frame 2938, ausente durante 21 frames y nuevamente observado en 2960. En esa ventana hay contacto, caída al piso, varias cajas superpuestas y presencia de árbitro, por lo que prueba simultáneamente oclusión/reentrada, asociación en una escena densa y exclusión de personas no jugador.

## Protocolo

La revisión debe incluir todos los jugadores de campo y arqueros visibles en cancha, excluir árbitros/banco/personal/público y conservar identidad sólo mientras sea visualmente verificable. Si una reaparición no puede vincularse con seguridad a la identidad anterior, se usa un ID nuevo.

El revisor local usa las propuestas de `memory30` sólo como seed. El botón final fue simplificado para generar un único JSON y evitar el fallo observado en la primera tarea con descargas múltiples.

No se calculan HOTA/IDF1/MOTA de este intervalo antes de completar revisión humana. Después del GT se repetirá exactamente el protocolo TrackEval 1.3.0 ya usado en el primer contacto para baseline ≥.25, dos etapas .10/.25 y ByteTrack estándar.
