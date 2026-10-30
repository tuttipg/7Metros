# Probe de apariencia simple en cruce denso — 28/09/2026

## Pregunta

Después del segundo GT, las identidades 217 y 222 muestran swaps/fragmentación durante un contacto denso. Antes de integrar ReID o BoT-SORT se probó si una señal mucho más barata —histograma HSV del torso— podía separar las dos identidades.

Este probe es diagnóstico offline sobre cajas GT humanas; no modifica el tracker y no es una métrica MOT.

## Método

- video real Ferro–N. S. de Luján;
- segundo GT humano, 90 frames;
- IDs 217 y 222;
- crop central del torso dentro de cada caja;
- histograma HSV H/S normalizado (12×8 bins);
- similitud coseno entre frames consecutivos;
- para cada identidad se compara `sim(misma identidad)` contra `sim(identidad opuesta)` en el frame siguiente.

Hubo 87 transiciones consecutivas donde ambas identidades estaban anotadas.

## Resultado

En 85/87 transiciones para cada identidad, la apariencia de la misma identidad fue más similar que la apariencia cruzada.

Sin embargo, las dos excepciones son precisamente las transiciones del cruce inicial más ambiguo:

- task 2 → 3;
- task 3 → 4.

En 2→3:
- ID 217: misma=0,362; cruzada=0,983;
- ID 222: misma=0,519; cruzada=0,956.

En 3→4:
- ID 217: misma=0,625; cruzada=0,966;
- ID 222: misma=0,565; cruzada=0,969.

La oclusión y la mezcla de cuerpos dentro de las cajas hacen que un descriptor cromático simple prefiera exactamente la asociación cruzada durante el evento que queremos corregir.

## Decisión

No incorporar histogramas de color/HSV como término de asociación para resolver este cruce. Aunque discriminan bien en frames fáciles, fallan en el caso difícil y podrían dar una falsa sensación de mejora global.

Tampoco se justifica integrar un ReID pesado sólo por este probe. El siguiente paso para 217/222 debe conservar el problema aislado y comparar una señal más robusta a oclusión (por ejemplo pose/partes visibles o embeddings de apariencia específicamente auditados) contra ambos GT antes de modificar el tracker.

En paralelo, los misses 205/215 tienen un origen distinto y más claro: detección contra el borde superior. No mezclar ambos problemas en una misma modificación.
