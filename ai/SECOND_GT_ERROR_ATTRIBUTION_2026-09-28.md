# Atribución de errores — segundo GT difícil Ferro–Luján

## Alcance

Se auditó el baseline high-only histórico exacto contra el segundo ground truth humano, antes del filtro temporal de roles. El intervalo es fixture frames 2915–3004, 90 cuadros, 1.125 anotaciones y 13 identidades. El matching diagnóstico usa asignación uno-a-uno con IoU ≥0,5 y reproduce los conteos del baseline: 917 TP, 208 FN y 171 FP.

Esta auditoría explica dónde se concentran los errores; no reemplaza HOTA/CLEAR/Identity.

## Falsos negativos por identidad GT

| GT ID | visibles | TP | FN | recall | observación |
|---|---:|---:|---:|---:|---|
| 215 | 90 | 16 | **74** | 17,8% | caja junto al borde superior durante gran parte del intervalo |
| 205 | 89 | 51 | **38** | 57,3% | caja junto al borde superior |
| 222 | 90 | 59 | **31** | 65,6% | contacto/caída; asociación repartida entre IDs 217/222/225/226 |
| 217 | 89 | 61 | **28** | 68,5% | contacto/caída; asociación repartida entre IDs 217/222/225/226 |
| 212 | 48 | 36 | 12 | 75,0% | pérdida parcial |
| 211 | 89 | 76 | 13 | 85,4% | pérdida parcial |
| 162 | 90 | 78 | 12 | 86,7% | pérdida parcial |
| 208, 213, 216, 218, 219, 221 | — | — | **0 cada uno** | 100% | estables en este intervalo |

Los cuatro primeros IDs concentran 171/208 FN = **82,2%**. Sólo los dos IDs próximos al borde superior (215 y 205) explican 112/208 FN = **53,8%**.

Con los artefactos actuales no se puede atribuir esas pérdidas de borde específicamente a `detector <0,25` versus filtro geométrico, porque la caché exacta de confianza 0,10 no está persistida. Esa distinción debe medirse antes de modificar detector o cancha.

## Asociación durante el contacto

Las identidades GT 217 y 222 no están sólo fragmentadas: las cajas que sí hacen match cambian entre varios IDs del tracker.

- GT 217: 61 matches; IDs principales 222 (24), 225 (24), 217 (11), 226 (2).
- GT 222: 59 matches; IDs principales 217 (38), 226 (17), 222 (2), 225 (2).

Esto muestra un problema de asociación/reidentificación durante la caída y el solapamiento, separado de las pérdidas del borde. La interpolación corta puede cerrar huecos, pero no corrige un ID ya intercambiado.

## Falsos positivos

| Track ID | FP |
|---|---:|
| 202 | **90** |
| 224 | **61** |
| 217 | 9 |
| 223 | 6 |
| 225 | 3 |
| 215 | 1 |
| 222 | 1 |

Los tracks 202 y 224 explican **151/171 FP = 88,3%**. Son los mismos candidatos de rol que motivaron el filtro temporal. El guardrail del filtro actual ya verificó que las observaciones que elimina no alcanzan IoU 0,5 con GT en este intervalo.

## Frames más difíciles

El pico ocurre alrededor de la caída/reentrada: frame 2959 tiene 5 FN; frames 2953–2956 y 2960 tienen 4 FN. Más adelante vuelven a aparecer grupos de 4 FN durante 2965–2966, 2980–2984 y otros cuadros donde las identidades de borde/contacto siguen ausentes.

## Decisión

No se mezcla todo en una única mejora. Los próximos diagnósticos quedan separados:

1. **Borde superior / recall:** determinar si IDs 215 y 205 faltan antes o después del filtro de cancha, usando detecciones pre-filtro cuando se recupere/regenerе la caché 0,10.
2. **Contacto / identidad:** usar GT 217/222 para evaluar asociación/ReID; no intentar resolver sus intercambios con interpolación.
3. **Roles / precisión:** mantener el filtro temporal como opt-in mientras se completa la comparación de los tres trackers en este segundo GT.

No se promueve ningún cambio nuevo a default con esta auditoría.