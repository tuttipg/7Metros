# Web V1 — gate de preview móvil para PR #82

Estado de referencia: 2026-11-08. La cadena de revisión es `main → #75 → #81 → #82`. **Esta guía no declara que exista un deploy de preview.**

## Condiciones previas para publicar una preview

1. Confirmar HEAD actuales de los tres PR y que #82 incluya #81 y #75 sin commits pendientes; comprobar CI del **HEAD exacto** de #82. Los smoke tests de Node/Python no sustituyen pruebas de navegador.
2. Crear un **deploy de preview aislado**, con origen fijado al commit de #82, en un proyecto/entorno distinto del sitio público. No cambiar Pages de producción, el dominio público ni la rama `main`. No publicar una URL hasta comprobar que carga y que el deploy informa el SHA correcto.
3. Revisar la configuración antes de exponer el deploy: solo credenciales públicas/publishable, consultas GET de solo lectura, RLS activo y sin datos sensibles; no introducir tokens de servicio ni usar escrituras/DDL. La preview puede leer datos públicos existentes si se aprueba expresamente esa dependencia; para aislamiento total, usar fixtures sin datos reales.
4. Registrar URL final, proveedor, SHA desplegado, fecha y resultado HTTP en el PR #82. Si no existe proveedor de preview autorizado, solicitar **aprobación de un entorno de preview aislado**, sin desplegar por cuenta propia en producción.

## Pruebas manuales — Chrome Android (anotar OK / falla, URL, dispositivo y fecha)

1. **Inicio:** abrir la URL en una pestaña de incógnito, comprobar que se ve la portada y que no queda en pantalla de carga/error.
2. **Menú:** abrir y cerrar el menú móvil; elegir una sección; comprobar foco, botones accesibles y que no queda un overlay tapando la pantalla.
3. **Búsqueda:** buscar un club/jugador conocido, abrir resultado, cerrar búsqueda y verificar que vuelve el foco al control correcto.
4. **Fichas:** entrar a club, jugador y partido desde enlaces reales; comprobar nombre, contexto de competencia y ausencia de enlaces rotos.
5. **Resultados:** revisar partido sin resultado verificado; **no debe aparecer 0–0 como marcador final** ni computarse como resultado/tabla. Contrastar con un partido que sí tenga resultado verificable.
6. **Responsive:** probar pantalla vertical y horizontal, tablas con scroll, sin desbordes horizontales involuntarios ni botones fuera de pantalla.
7. **Volver atrás:** navegar inicio → listado → ficha, usar Atrás de Chrome dos veces y comprobar que ruta, filtros y menú quedan coherentes.

## Criterio de aceptación y revisión

- No aprobar publicación de la cadena web solo por CI verde: requerir evidencia de los siete pasos en Chrome Android, y si es posible un navegador de escritorio y teclado.
- Revisar primero #75 (marcadores/alcance), luego #81 (almacenamiento/navegación/a11y), luego #82 (deduplicación de cargas y temporadas). Cada PR conserva su base; **no fusionar a main sin aprobación**.
- Mantener #35 (contratos SQL) separado, en Draft, con staging y revisión de DDL independiente. #34 FEMEBAL SAFE/DRY RUN y #43 IA/GT tampoco se cierran por limpieza del backlog.
- Registrar fallos reproducibles en #82 y corregirlos en la rama existente con regresión automatizada cuando sea posible.
