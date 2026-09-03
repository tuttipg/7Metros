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
