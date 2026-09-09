# 7Metros vs Handball.ai — benchmark de producto

Revisión: 2026-09-09. Fuentes públicas de Handball.ai consultadas: homepage, pricing, APIs, scouting, cloud y downloads.

## Referencia actual

Handball.ai comunica una plataforma profesional con analítica avanzada, video, mapas de tiro, insights con IA, datos en tiempo real, gestión de equipo, scouting, APIs y almacenamiento de video. Sus planes públicos parten de €38,50/mes (Team, facturación anual), €59,90/mes (Scouting) y €75/mes (My Team). También publica APIs para partidos, planteles, estadísticas en vivo, post-partido y mejores alineaciones.

## Matriz competitiva

| Capacidad | Handball.ai público | 7Metros actual | Objetivo 7Metros |
|---|---|---|---|
| Fixture/partidos | Sí | Sí, FEMEBAL | Cobertura completa y trazable |
| Clubes/equipos | Sí | Sí | Todas las ramas/categorías/divisiones FEMEBAL |
| Perfiles jugadores | Sí | UI + schema listos, sin datos productivos | Planteles completos |
| Estadística avanzada | Sí | Estructura + vistas; faltan eventos | Igualar métricas útiles de handball |
| Mapas de tiro | Sí | Schema `lanzamientos` listo | Origen/destino/arquero/contexto |
| Video automático | Sí | Pipeline y contratos listos | Detección + tracking + eventos |
| Clips por evento | Sí | Contrato por timestamp listo | Generación automática de clips |
| Comparación jugador/equipo | Sí | Equipo listo; jugador depende de datos | Comparador completo |
| Scouting | Sí | Roadmap | Búsqueda + video + filtros por evento |
| Live stats | Sí | No | Fase posterior |
| Team management | Sí | Admin técnico | Portal para cuerpos técnicos/jugadores |
| API externa | Sí | Supabase Data API interna | API pública versionada cuando madure |
| Apps móvil/desktop | Sí | Web responsive | PWA primero; app nativa solo si aporta valor |
| Foco FEMEBAL Argentina | No es su foco principal | Sí | Ventaja de profundidad local |
| Transparencia de fuente | Variable | Diseñada como principio | Fuente y timestamp por dato/evento |

## Estrategia para competir

7Metros no debería intentar ganar por cantidad global de ligas en la primera etapa. La ventaja alcanzable es **profundidad y automatización en el handball argentino**, especialmente FEMEBAL:

1. Fixture completo y navegación superior a portales tradicionales.
2. Planillas oficiales convertidas en perfiles y estadísticas históricas.
3. Video vinculado al partido y a cada evento.
4. IA orientada a condiciones reales de transmisiones argentinas, no solo cámaras ideales.
5. Producto público útil para aficionados + capa avanzada para jugadores/cuerpos técnicos.
6. Coste operativo bajo mediante importación automática, revisión por excepción y modelos medibles.

## Criterios de comparación de IA

No declarar que 7Metros “supera” a Handball.ai por percepción visual. Medir:

- detección de jugadores: precision/recall/mAP;
- detección de pelota: AP y recall en objetos pequeños;
- tracking: HOTA, IDF1, ID switches;
- dorsal/OCR: exactitud por frame y por track;
- equipo: accuracy por track;
- eventos: precision/recall/F1 por tipo;
- timestamp: error absoluto mediano;
- tiempo de procesamiento por minuto de video;
- porcentaje de eventos que requieren corrección humana;
- coste por partido procesado.

## Gaps que hoy impiden una comparación 1:1

- 7Metros todavía no tiene dataset audiovisual etiquetado de producción.
- No hay jugadores/participaciones productivos suficientes para validar estadísticas individuales.
- No existe infraestructura GPU desplegada ni almacenamiento de video operativo.
- Handball.ai ya opera con escala internacional y productos comerciales maduros.

La respuesta correcta a estos gaps es convertirlos en métricas y entregables, no ocultarlos con demos simuladas.

## Fuentes públicas

- https://handball.ai/
- https://handball.ai/pricing/
- https://handball.ai/apis/
- https://handball.ai/scouting/
- https://handball.ai/cloud/
- https://handball.ai/downloads/
