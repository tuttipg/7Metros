import { createHash } from 'node:crypto';
import { validatePdfWorkItem } from './planilla-dry-run-core.mjs';

const DEFAULT_MAX_BYTES = 12 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_TIMEOUT_MS = 30_000;
const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);

function assertPdfMagic(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < PDF_MAGIC.length) throw new Error('Respuesta PDF demasiado corta');
  for (let i = 0; i < PDF_MAGIC.length; i += 1) if (bytes[i] !== PDF_MAGIC[i]) throw new Error('La respuesta no comienza con firma PDF válida');
}

function parseContentLength(value) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!/^\d+$/.test(raw)) throw new Error('Content-Length inválido');
  const n = Number(raw);
  if (!Number.isSafeInteger(n)) throw new Error('Content-Length inválido');
  return n;
}

function parsePdfContentType(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  const mediaType = raw.split(';', 1)[0].trim();
  if (mediaType !== 'application/pdf') throw new Error(`Content-Type inesperado: ${raw || 'ausente'}`);
  return raw;
}

function assertIdentityContentEncoding(value) {
  if (value === null || value === undefined) return;
  const raw = String(value).trim().toLowerCase();
  if (raw !== '' && raw !== 'identity') throw new Error(`Content-Encoding no permitido en modo SAFE: ${raw}`);
}

async function readBodyBounded(response, maxBytes, signal) {
  const reader = response.body?.getReader?.();
  if (!reader) throw new Error('Respuesta sin body streaming legible; SAFE requiere streaming acotado');
  const cancelReaderOnAbort = () => { Promise.resolve(reader.cancel?.('PDF fetch aborted by SAFE timeout')).catch(() => {}); };
  if (signal?.aborted) cancelReaderOnAbort(); else signal?.addEventListener?.('abort', cancelReaderOnAbort, { once: true });
  const chunks = []; let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) throw new Error('Chunk HTTP binario inválido');
      total += value.byteLength;
      if (total > maxBytes) { await reader.cancel?.('PDF exceeds SAFE byte limit'); throw new Error(`PDF excede límite real de ${maxBytes} bytes`); }
      chunks.push(value);
    }
  } finally {
    signal?.removeEventListener?.('abort', cancelReaderOnAbort); reader.releaseLock?.();
  }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

export async function fetchOfficialFemebalPdf(workItem, { fetchImpl = globalThis.fetch, maxBytes = DEFAULT_MAX_BYTES, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const sourceUrl = validatePdfWorkItem(workItem);
  if (typeof fetchImpl !== 'function') throw new Error('fetch no disponible');
  if (!Number.isInteger(maxBytes) || maxBytes < 1024 || maxBytes > DEFAULT_MAX_BYTES) throw new Error(`maxBytes inválido: debe estar entre 1024 y ${DEFAULT_MAX_BYTES}`);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > MAX_TIMEOUT_MS) throw new Error(`timeoutMs inválido: debe estar entre 100 y ${MAX_TIMEOUT_MS}`);
  if (typeof globalThis.AbortController !== 'function') throw new Error('AbortController no disponible; SAFE requiere timeout abortable');

  const controller = new AbortController(); let timedOut = false; let timer;
  const timeoutPromise = new Promise((_, reject) => { timer = setTimeout(() => { timedOut = true; controller.abort(); reject(new Error(`Descarga FEMEBAL excedió timeout SAFE de ${timeoutMs} ms`)); }, timeoutMs); });
  const operation = (async () => {
    const response = await fetchImpl(sourceUrl, { method: 'GET', redirect: 'manual', credentials: 'omit', headers: { Accept: 'application/pdf', 'Accept-Encoding': 'identity' }, signal: controller.signal });
    if (!response || typeof response !== 'object') throw new Error('Respuesta HTTP inválida');
    const status = Number(response.status);
    if (status >= 300 && status < 400) throw new Error(`Redirect FEMEBAL rechazado: HTTP ${status}`);
    if (status !== 200) throw new Error(`Descarga FEMEBAL falló: HTTP ${status}`);
    const contentType = parsePdfContentType(response.headers?.get?.('content-type'));
    assertIdentityContentEncoding(response.headers?.get?.('content-encoding'));
    const declaredLength = parseContentLength(response.headers?.get?.('content-length'));
    if (declaredLength !== null && declaredLength > maxBytes) throw new Error(`PDF excede límite declarado de ${maxBytes} bytes`);
    const bytes = await readBodyBounded(response, maxBytes, controller.signal);
    if (declaredLength !== null && declaredLength !== bytes.byteLength) throw new Error(`Content-Length no coincide: declarado=${declaredLength} real=${bytes.byteLength}`);
    assertPdfMagic(bytes);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    return { dry_run: true, write_enabled: false, auth_used: false, source_url: sourceUrl, content_type: contentType, byte_length: bytes.byteLength, sha256, bytes };
  })();
  try { return await Promise.race([operation, timeoutPromise]); }
  catch (error) { if (timedOut) throw new Error(`Descarga FEMEBAL excedió timeout SAFE de ${timeoutMs} ms`); throw error; }
  finally { clearTimeout(timer); }
}
