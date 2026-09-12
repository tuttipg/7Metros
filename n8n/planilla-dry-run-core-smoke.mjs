import assert from 'node:assert/strict';
import { parsePlanillaDryRun } from './planilla-dry-run-core.mjs';

const sourceUrl='https://femebal.com/wp-content/uploads/2026/03/control.pdf';
const workItem={kind:'femebal_official_pdf',method:'GET',url:sourceUrl,allow_redirects:false,auth_used:false,write_enabled:false,source:{page_url:'https://femebal.com/programacion-fecha-1-torneo-metropolitano-apertura-2026/',page_title:'Programación Fecha 1',pdf_url:sourceUrl,anchor_text:'Sábado 21/3',source_type:'fecha_normal',phase:'apertura',round_number:1}};
const players=`Nº Local G TAm 2 TR TAz
1 Perznianko, Alan Nahuel - - - - -
2 Berardinelli, Mauro 2 - - - -
4 Sportelli Blejman, Lucas 2 - - - -
5 Gullo, Santino - - - - -
7 Dujaut, Ian 5 - 1 - -
8 Ghiotto, Matias - - - - -
9 Pereyra Oyarzun, Tobias - - - 1 -
10 Labartete, Ramiro - - - - -
11 Kelly, Steven 1 - - - -
13 Vazquez, Antonio 5 - - - -
14 Vienni, Enzo 1 - - - -
16 Trabella Ponce, Luciano - - - - -
17 Gimenez, Mateo 1 - 1 - -
18 Lugaro, Lautaro Nicolas - - - - -
33 Ochnio, Agustin 2 - - - -
37 Ingram Pautazzo, Eric Jhon 1 - - - -
Nº Visitante G TAm 2 TR TAz
1 Bartolomeo, Juan Martin - - - - -
2 Farina, Martin 1 - - - -
3 Goni, Ignacio - - - - -
4 Duhau, Santiago 1 - - - -
5 Cocco, Atilio - - 1 - -
6 Pallero, Federico Agustin 2 - - - -
8 Schankula, Valentin 6 - 1 - -
9 Bustamante, Mariano 1 - - - -
10 Ceccardi, Juan Francisco 4 - - - -
11 Santos, Julian 1 - - - -
12 Vazquez Palmieri, Fausto - - - - -
14 Umansky Gavi, Ivan Luca - - - - -
17 Unzner, Agustin 8 - - - -
19 Jacquemin, Matias - - - - -
21 Rubio, Emiliano 2 - - - -
22 Aguero, Juan Pablo 1 - - - -
Arbitros`;
const extractedText=`Torneo Metropolitano Apertura
Fecha:
2026-03-21
Hora:
20:15:00
Categoria - Division:
Mayores - LHC Hipotecario Seguros
Equipo local
Argentinos Juniors 20
Equipo visitante
Ferro Carril Oeste 27
${players}`;
const result=parsePlanillaDryRun({workItem,extractedText,expected:{fecha:'2026-03-21',local:'Argentinos Juniors',visitante:'Ferro Carril Oeste',goles_local:20,goles_visitante:27}});
assert.equal(result.dry_run,true); assert.equal(result.write_enabled,false); assert.equal(result.auth_used,false);
assert.equal(result.parsed.resumen.jugadores,32); assert.equal(result.parsed.resumen.goles,47);
assert.throws(()=>parsePlanillaDryRun({workItem:{...workItem,method:'POST'},extractedText}),/GET/);
assert.throws(()=>parsePlanillaDryRun({workItem,extractedText,expected:{goles_visitante:26}}),/Marcador visitante inesperado/);
console.log('✓ planilla-dry-run: contrato SAFE y partido control validados');
