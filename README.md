# 7Metros — versión web estática

Esta carpeta está lista para publicarse en GitHub Pages.

## Archivos principales
- `index.html`: dashboard
- `style.css`: diseño compartido
- `script.js`: navegación, datos demo, filtros y formularios demo
- páginas HTML adicionales para cada sección

## Probar en la PC
Podés abrir `index.html` con doble clic. Para una prueba más parecida a GitHub Pages, desde esta carpeta ejecutá:

```bash
python -m http.server 8000
```

y abrí `http://localhost:8000`.

## Publicar en GitHub Pages
Subí **todos** los archivos de esta carpeta a la raíz del repositorio `7Metros`. GitHub Pages servirá `index.html` automáticamente.

## Importante
Los formularios de carga usan `localStorage` como modo demo. No modifican una base real. El paso siguiente será reemplazar esa persistencia por llamadas a una API Flask conectada a SQLite.


## Datos
Esta versión no incluye partidos, jugadores, clubes ni estadísticas ficticias. Hasta conectar Flask + SQLite, las secciones de datos quedan vacías y los formularios de carga están deshabilitados.


## Seguridad de datos
- Esta versión de GitHub Pages es sólo frontend y no escribe en SQLite.
- Las pantallas públicas de carga quedaron bloqueadas.
- `handball.db`, archivos `.env` y secretos NO deben subirse al repositorio público.
- Cuando se conecte Flask, toda operación POST/PUT/DELETE deberá exigir autenticación y autorización del lado del servidor.
- Los visitantes sólo tendrán endpoints de lectura. La seguridad nunca dependerá de ocultar botones con JavaScript.


## v4 — arco de handball
La ilustración inferior del menú lateral ya no se dibuja con SVG. Usa directamente `assets/arco-handball.jpeg`, la referencia visual suministrada, para conservar exactamente el arco, la red y las líneas de cancha.
