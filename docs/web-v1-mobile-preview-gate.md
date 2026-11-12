# Web V1 — gate de preview móvil para PR #82

Estado de referencia: guía operativa para el **HEAD vigente** de #82 (no fijar un SHA histórico). Antes de cada prueba, comparar `git rev-parse HEAD` con el HEAD de [PR #82](https://github.com/tuttipg/7Metros/pull/82) y su CI correspondiente. La cadena de revisión es `main → #75 → #81 → #82`. **Esta guía no declara que exista un deploy de preview.**

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

## Alternativa segura sin deploy remoto: Chrome Android por USB (ADB)

**No servir el checkout del repositorio en la Wi-Fi.** Un servidor HTTP sobre el checkout puede exponer `.git`, documentación y archivos internos. Esta opción usa un puerto enlazado exclusivamente a `127.0.0.1` en la computadora y el túnel USB de Android Debug Bridge (ADB); no abre un puerto LAN ni cambia producción. Requiere Git, Python, Android Platform Tools (`adb`), cable USB y habilitar temporalmente depuración USB en un dispositivo propio. La aplicación puede efectuar GET a fuentes públicas según su configuración: esto no es un entorno de datos aislado.

1. En una terminal de la computadora, descargar el HEAD actual de #82 en una carpeta independiente y comprobar el SHA con el mostrado en GitHub. **No continuar si difiere**:

   ```bash
   git clone https://github.com/tuttipg/7Metros.git 7metros-preview
   cd 7metros-preview
   git fetch origin pull/82/head
   git checkout --detach FETCH_HEAD
   git rev-parse HEAD
   ```

2. Conectar el Android propio por USB, aceptar la autorización de depuración en el teléfono y comprobar `adb devices` (estado `device`, no `unauthorized`). Ejecutar `adb reverse tcp:8765 tcp:8765`. En la terminal de la computadora, desde la carpeta `7metros-preview`, iniciar `python preview_safe.py`. Este servidor restringe las respuestas a archivos estáticos de la raíz (HTML/CSS/JS/imágenes/fuentes), bloquea `.git`, subdirectorios, documentos y archivos de datos, y escucha solo en `127.0.0.1`. No usar túneles externos ni dispositivos ajenos. Si faltan recursos legítimos, registrar el error y revisar la lista permitida antes de ampliarla; no volver al servidor genérico.
3. En **Chrome Android**, abrir `http://127.0.0.1:8765/` y comprobar la portada. Esta dirección es local al Android y **no es una preview remota verificada**. Ejecutar los siete casos de arriba, registrando SHA, dispositivo y capturas. Si hay errores de conexión, comprobar `adb devices`, `adb reverse --list` y el servidor; no abrir puertos del router.
4. Al terminar, detener Python con Ctrl+C, ejecutar `adb reverse --remove tcp:8765`, desconectar USB y desactivar la depuración USB si ya no se necesita.

**Limitación:** el túnel USB permite probar la navegación real en Chrome Android, pero no valida un despliegue remoto, la configuración del hosting ni la accesibilidad desde Internet. Para una URL pública independiente sigue faltando autorización explícita para crear un proyecto de preview separado, fijado al HEAD de #82 y sin credenciales de escritura.

## Registro rápido de aceptación (copiar al comentario del PR #82)

Completar **desde el Android real**, no desde CI ni emulación. No registrar credenciales, tokens, cookies ni datos personales.

```text
Fecha/hora local:
Dispositivo / versión Android / Chrome:
SHA (git rev-parse HEAD):
Origen: USB ADB local (http://127.0.0.1:8765/) / preview remota verificada
1. Inicio: OK / FALLA — evidencia:
2. Menú: OK / FALLA — evidencia:
3. Búsqueda: OK / FALLA — evidencia:
4. Fichas: OK / FALLA — evidencia:
5. Resultados sin 0–0 ficticio: OK / FALLA — evidencia:
6. Responsive vertical/horizontal: OK / FALLA — evidencia:
7. Atrás: OK / FALLA — evidencia:
Errores de consola/red visibles (sin secretos):
Decisión: APTO PARA REVISIÓN HUMANA / BLOQUEADO
```

**Comprobación previa al teléfono:** si `git rev-parse HEAD` no coincide con el HEAD actual de #82, detener la prueba y actualizar el checkout; un CI verde de otro SHA no valida el checkout local. En Windows PowerShell puede ser necesario usar `py preview_safe.py` en lugar de `python preview_safe.py`. Si `adb devices` muestra `unauthorized`, aceptar la autorización en el teléfono propio antes de repetir `adb reverse`. No abrir el puerto a la red local.
