// Never coerce malformed URL IDs into a different valid record.
export function canonicalPositiveId(value) {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? value : null;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

// Missing means no requested context; empty/duplicate means invalid.
export function readRouteParam(params, name) {
  const values = params.getAll(name);
  return values.length === 0 ? null : values.length === 1 ? values[0] : '';
}
