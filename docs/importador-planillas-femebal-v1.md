# Importador de planillas FEMEBAL v1

## Objetivo

Incorporar resultados, jugadores y estadísticas explícitas de las planillas digitales oficiales FEMEBAL sin completar datos por inferencia.

## Datos que se extraen

De cada planilla se pueden cargar, cuando estén presentes y sean inequívocos:

- fecha y hora;
- categoría y división;
- equipo local y visitante;
- marcador final;
- dorsal utilizado;
- apellido y nombre del jugador;
- goles;
- tarjeta amarilla;
- exclusiones de 2 minutos;
- tarjeta roja;
- tarjeta azul.

No se infieren minutos de sanciones, posiciones, asistencias, lanzamientos, altura, peso, brazo hábil ni otros campos que la planilla no publique.

## Reglas de seguridad

1. La fuente de verdad es la planilla oficial FEMEBAL enlazada en `partidos.planilla_url`.
2. El parser ignora oficiales de equipo y árbitros: solo acepta filas cuyo primer campo es un dorsal numérico.
3. Los guiones de las columnas estadísticas significan cero para esa planilla.
4. La suma de goles de los jugadores de cada equipo debe coincidir exactamente con el marcador. Si no coincide, la planilla se rechaza antes de escribir datos.
5. Una planilla debe resolverse contra un partido y dos equipos del mismo scope antes de escribir participaciones.
6. No se crean datos biográficos que no estén presentes en la fuente.
7. Las sanciones sin minuto se guardan con minuto/segundo nulos, sin inventar tiempos.
8. Las cargas deben ser idempotentes: reejecutar una planilla no puede duplicar participaciones ni sanciones.

## Primera verificación de producción

Planilla oficial de prueba:

`https://djfhz848yeeat.cloudfront.net/pdf_planillas/5/c/e/5ce377051ea0acb1.pdf`

Partido: Argentinos Juniors 20–27 Ferro Carril Oeste, Mayores LHC, 2026-03-21.

Verificado al iniciar este pipeline:

- 16 jugadores locales;
- 16 jugadores visitantes;
- 20 goles locales sumados por jugador;
- 27 goles visitantes sumados por jugador;
- 4 exclusiones de 2 minutos;
- 1 tarjeta roja;
- 0 amarillas;
- 0 azules.

## Integración con n8n

`n8n/planilla-core.mjs` contiene la lógica pura de parseo. La intención es reutilizar esta misma lógica o su equivalente exacto en el workflow n8n para que n8n siga siendo el orquestador, pero con reglas testeables y versionadas.

Flujo recomendado:

1. descubrir `planilla_url` oficial;
2. descargar PDF;
3. extraer texto;
4. parsear con las reglas de `planilla-core`;
5. resolver partido/equipos;
6. validar marcador y scope;
7. upsert de jugadores/planteles/participaciones;
8. guardar sanciones explícitas;
9. enlazar la planilla al partido;
10. ejecutar reporte de integridad.

La carga masiva no debe comenzar si no se puede demostrar de forma determinística a qué partido corresponde cada planilla.
