// localStorage puede estar bloqueado por políticas del navegador, sandbox o cuota.
// En ese caso, las preferencias siguen aplicándose en la pestaña actual, sin
// afirmar que se guardaron en el navegador para visitas posteriores.
const temporaryPreferences = new Map();

export function readLocalPreference(key) {
  if (temporaryPreferences.has(key)) return temporaryPreferences.get(key);
  try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
}

export function writeLocalPreference(key, value) {
  try {
    if (globalThis.localStorage) {
      globalThis.localStorage.setItem(key, value);
      temporaryPreferences.delete(key);
      return true;
    }
  } catch { /* Preferencia temporal si la escritura está bloqueada. */ }
  temporaryPreferences.set(key, String(value));
  return false;
}

export function removeLocalPreference(key) {
  try {
    if (globalThis.localStorage) {
      globalThis.localStorage.removeItem(key);
      temporaryPreferences.delete(key);
      return true;
    }
  } catch { /* Borrado temporal si el almacenamiento está bloqueado. */ }
  temporaryPreferences.set(key, null);
  return false;
}
