# Acceso al fixture real: 25/09/2026

Base inspeccionada: PR #43, checkout 43f431583814101ce7d8fb6e9350b9c10d9ab090.

## Metadatos obtenidos directamente mediante yt-dlp

| ID YouTube | Título abreviado | Duración | Máxima resolución anunciada |
|---|---|---:|---|
| NwwwixJywHE | Ferro Carril Oeste vs SEDALO, Apertura, LH Caballeros | 6385 s | 1920×1080, 60 FPS |
| F2md352zH2Q | Ferro Carril Oeste vs N. S. de Luján, Apertura, LH Caballeros | 5967 s | 1920×1080, 60 FPS |

Ambos informaron availability=public. La fecha del partido no fue verificada.
No se inspeccionaron fotogramas: cámara estable, cancha visible y facilidad de
seguimiento permanecen SIN VERIFICAR.

Selección provisional: Ferro–N. S. de Luján. Ambos anuncian igual resolución y
frecuencia; su formato H.264 1080p anuncia 4448 kb/s frente a 3362 kb/s de
Ferro–SEDALO. Este desempate de metadatos no demuestra mejor calidad visual.

## Pruebas de acceso

Entorno: yt-dlp 2026.8.19, Node v24.19.0, FFmpeg instalado.
Sin cookies importadas, sin credenciales ni secretos.
La herramienta de consulta web devolvió Online fetch throttled para ambos enlaces.
yt-dlp sí obtuvo títulos, duraciones y formatos.

Para cada ID se intentó descargar solamente el rango 00:20:00–00:22:00,
formato 298 (H.264, 1280×720, 60 FPS), con:

```sh
yt-dlp --ignore-config --js-runtimes node --no-playlist \
  --socket-timeout 10 --retries 0 --extractor-retries 0 \
  -f 298 --download-sections '*00:20:00-00:22:00' \
  -o 'clip.%(ext)s' 'https://www.youtube.com/watch?v=VIDEO_ID'
```

Ambos intentos terminaron con:

```text
Response data has no m3u header
Error opening input: Invalid data found when processing input
ERROR: ffmpeg exited with code 183
```

La causa última de la respuesta no multimedia no está determinada.
Se omiten URLs temporales de entrega multimedia de este registro.
No existe clip decodificado, detección, tracking o MP4 anotado de estos partidos.
No hay métricas de precisión; frames reales procesados: 0.

## INTERVENCIÓN DE TOMÁS

Adjuntar un MP4 de 2–5 minutos de juego de Ferro–N. S. de Luján (F2md352zH2Q),
preferentemente a 720p o 1080p, para poder procesarlo sin depender de la descarga
de YouTube. Basta el archivo; no hacen falta credenciales ni etiquetas.
