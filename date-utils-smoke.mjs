globalThis.window = {};

const { ageFromBirthDate, localISODate } = await import('./utils.js');

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: esperado ${expected}, recibido ${actual}`);
  }
}

const birthdayEve = new Date('2026-09-11T02:30:00Z'); // 10/09 23:30 en Buenos Aires
assertEqual(localISODate(birthdayEve), '2026-09-10', 'La fecha local debe respetar America/Argentina/Buenos_Aires');
assertEqual(ageFromBirthDate('2006-09-11', birthdayEve), 19, 'Antes del cumpleaños en Buenos Aires');

const birthday = new Date('2026-09-11T03:30:00Z'); // 11/09 00:30 en Buenos Aires
assertEqual(localISODate(birthday), '2026-09-11', 'La fecha local cambia al iniciar el día en Buenos Aires');
assertEqual(ageFromBirthDate('2006-09-11', birthday), 20, 'El cumpleaños debe incrementar la edad');

assertEqual(ageFromBirthDate('2000-02-29', new Date('2026-03-01T12:00:00Z')), 26, 'Debe aceptar fechas bisiestas válidas');
assertEqual(ageFromBirthDate('2001-02-29', birthday), null, 'Debe rechazar fechas inexistentes');
assertEqual(ageFromBirthDate('2026-02-30', birthday), null, 'Debe rechazar días fuera del calendario');
assertEqual(ageFromBirthDate('11/09/2006', birthday), null, 'Debe exigir formato ISO YYYY-MM-DD');
assertEqual(ageFromBirthDate('2030-01-01', birthday), null, 'Debe rechazar edades futuras');
assertEqual(ageFromBirthDate('1900-01-01', birthday), null, 'Debe rechazar edades de 100 años o más');

console.log('Date utilities smoke test passed');
