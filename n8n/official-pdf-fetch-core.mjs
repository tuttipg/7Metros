import { createHash } from 'node:crypto';
import { validatePdfWorkItem } from './planilla-dry-run-core.mjs';

const DEFAULT_MAX_BYTES = 12 * 1024 * 1024;
const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);

function assertPdfMagic(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < PDF_MAGIC.length) throw new Error('Respuesta PDF demasiado corta');
  for (let i = 0; i < PDF_MAGIC.length; i += 1) if (bytes[i] !== PDF_MAGIC[i]) throw new Error('La respuesta no comienza con firma PDF válida');
}

function parseContentLength(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new Error('Content-Length inválido');
  return n;
}

export async function fetchOfficialFemebalPdf(workItem, { fetchImpl = globalThis.fetch, maxBytes = DEFAULT_MAX_BYTES } = {}) {
  const sourceUrl = validatePdfWorkItem(workItem);
  if (typeof fetchImpl !== 'function') throw new Error('fetch no disponible');
  if (!Number.isInteger(maxBytes) || maxBytes < 1024) throw new Error('maxBytes inválido');
  const response = await fetchImpl(sourceUrl, { method: 'GET', redirect: 'manual', credentials: 'omit', headers: { Accept: 'application/pdf' } });
  if (!response || typeof response !== 'object') throw new Error('Respuesta HTTP inválida');
  const status = Number(response.status);
  if (status >= 300 && status < 400) throw new Error(`Redirect FEMEBAL rechazado: HTTP ${status}`);
  if (status !== 200) throw new Error(`Descarga FEMEBAL falló: HTTP ${status}`);
  const contentType = String(response.headers?.get?.('content-type') ?? '').toLowerCase();
  if (!contentType.startsWith('application/pdf')) throw new Error(`Content-Type inesperado: ${contentType || 'ausente'}`);
  const declaredLength = parseContentLength(response.headers?.get?.('content-length'));
  if (declaredLength !== null && declaredLength > maxBytes) throw new Error(`PDF excede límite declarado de ${maxBytes} bytes`);
  if (typeof response.arrayBuffer !== 'function') throw new Error('Respuesta sin arrayBuffer()');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > maxBytes) throw new Error(`PDF excede límite real de ${maxBytes} bytes`);
  if (declaredLength !== null && declaredLength !== bytes.byteLength) throw new Error(`Content-Length no coincide: declarado=${declaredLength} real=${bytes.byteLength}`);
  assertPdfMagic(bytes);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  return { dry_run: true, write_enabled: false, auth_used: false, source_url: sourceUrl, content_type: contentType, byte_length: bytes.byteLength, sha256, bytes };
}
