// localStorage puede estar bloqueado por políticas del navegador, sandbox o cuota.
// Las preferencias son opcionales: nunca deben impedir que carguen los datos públicos.
export function readLocalPreference(key) {
  try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
}

export function writeLocalPreference(key, value) {
  try {
    if (!globalThis.localStorage) return false;
    globalThis.localStorage.setItem(key, value);
    return true;
  } catch { return false; }
}

export function removeLocalPreference(key) {
  try {
    if (!globalThis.localStorage) return false;
    globalThis.localStorage.removeItem(key);
    return true;
  } catch { return false; }
}
