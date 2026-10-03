# FEMEBAL 1.1.3 — límites de campos de perfil

Fecha: 2026-10-02.

Sobre el plantel completo de control Ferro `teamId=1843`, `tournamentId=775` (16 atletas), se revisaron de forma read-only:

```text
GET /athletes/{athleteId}
GET /users/athlete-profile/{athleteId}
GET /athletes/{athleteId}/federative-card
```

La sonda buscó únicamente nombres de claves relacionados con peso y lateralidad/mano hábil. No persistió ni mostró valores personales escalares.

Resultado:

```text
athlete identity      16 registros -> 0 claves compatibles
user athlete profile 16 registros -> 0 claves compatibles
federative card      16 registros -> 0 claves compatibles
```

Se buscaron familias semánticas como `weight`, `peso`, `handedness`, `dominantHand`, `laterality`, `lateralidad`, `left/right hand`, `zurdo/diestro`, `mano` y `brazo`.

## Consecuencia para 7Metros

En las superficies de jugador confirmadas del cliente 1.1.3 no existe una fuente evidenciada para:

- peso;
- brazo/mano hábil;
- lateralidad.

Por lo tanto esos campos deben quedar `null/unknown` en una importación FEMEBAL 1.1.3 salvo que otro frente aporte una fuente explícita y verificable.

No inferir mano hábil desde posición, dorsal, video, nombre, foto ni ninguna otra señal indirecta.

Evidencia machine-readable:

`data/femebal/discovery/rosters/player-profile-weight-handedness-boundary-2026-10-02.json`
