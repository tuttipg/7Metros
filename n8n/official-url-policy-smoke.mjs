import assert from 'node:assert/strict';
import { canonicalizeOfficialFemebalUrl } from './official-url-policy.mjs';

const ordinary = canonicalizeOfficialFemebalUrl(
  'https://www.femebal.com/fixture?season=2026&category=LHC&sortKey=date',
);
assert.equal(
  ordinary,
  'https://www.femebal.com/fixture?season=2026&category=LHC&sortKey=date',
  'Los filtros de lectura ordinarios deben seguir permitidos.',
);

const sensitiveNames = [
  'key',
  'apiKey',
  'apiKeyValue',
  'api_key_value',
  'accessKeyId',
  'accessToken',
  'authToken',
  'authorizationToken',
  'bearerToken',
  'clientKey',
  'clientKeyValue',
  'clientSecret',
  'clientSecretValue',
  'cookieValue',
  'credentialId',
  'csrfToken',
  'jwtToken',
  'passphrase',
  'passwordReset',
  'privateKey',
  'secretKey',
  'sessionId',
  'sessionValue',
  'signature',
  'X-Amz-Signature',
  'signingKey',
  'playerToken',
  'xsrfToken',
];

for (const name of sensitiveNames) {
  const url = `https://www.femebal.com/fixture?${encodeURIComponent(name)}=redacted`;
  assert.throws(
    () => canonicalizeOfficialFemebalUrl(url),
    /query sensible/,
    `La clave sensible compuesta debe rechazarse: ${name}`,
  );
}

const encodedSensitiveName = 'https://www.femebal.com/fixture?api%4BeyValue=redacted';
assert.throws(
  () => canonicalizeOfficialFemebalUrl(encodedSensitiveName),
  /query sensible/,
  'Las claves sensibles percent-encoded deben detectarse tras parsear la query.',
);

assert.throws(
  () => canonicalizeOfficialFemebalUrl('https://www.femebal.com/fixture?utm_source=redacted'),
  /tracking query/,
  'La protección existente contra tracking debe conservarse.',
);

console.log('Official FEMEBAL URL policy SAFE smoke OK');
