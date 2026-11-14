const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export type AllowedMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';

const EXT_MAP: Record<AllowedMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

/**
 * Inspects binary magic bytes rather than trusting browser-supplied Content-Type headers.
 */
export function detectValidatedMimeType(buffer: ArrayBuffer): AllowedMime | null {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 12) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WEBP: "RIFF" .... "WEBP"
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }

  // PDF: "%PDF-" (25 50 44 46 2D)
  if (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return 'application/pdf';
  }

  return null;
}

export function validateUploadFile(
  buffer: ArrayBuffer,
  allowedMimes: AllowedMime[]
): { mime: AllowedMime; ext: string } {
  if (buffer.byteLength === 0) {
    throw new Error('Uploaded file is empty.');
  }
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error('File exceeds maximum allowed size of 10 MB.');
  }
  const detected = detectValidatedMimeType(buffer);
  if (!detected || !allowedMimes.includes(detected)) {
    throw new Error(`Invalid or unsupported file format. Allowed: ${allowedMimes.join(', ')}`);
  }
  return { mime: detected, ext: EXT_MAP[detected] };
}

function assertSigningSecret(secret: string): void {
  if (typeof secret !== 'string' || new TextEncoder().encode(secret).byteLength < 32) {
    throw new Error('Document signing secret must contain at least 32 bytes.');
  }
}

async function hmacSignHex(secret: string, message: string): Promise<string> {
  assertSigningSecret(secret);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function createSignedDocumentToken(
  documentId: string,
  userId: string,
  secret: string,
  ttlSeconds = 300
): Promise<{ token: string; expiresAt: string }> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(documentId) || !/^[A-Za-z0-9_-]{1,128}$/.test(userId)) {
    throw new Error('Invalid document or user identifier.');
  }
  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > 300) {
    throw new Error('Document access token lifetime must be between 1 and 300 seconds.');
  }
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${documentId}.${userId}.${exp}`;
  const sig = await hmacSignHex(secret, payload);
  return {
    token: `${payload}.${sig}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

export async function verifySignedDocumentToken(
  token: string,
  secret: string
): Promise<{ documentId: string; userId: string }> {
  assertSigningSecret(secret);
  if (typeof token !== 'string' || token.length > 512) {
    throw new Error('Malformed document access token.');
  }
  const parts = token.split('.');
  if (parts.length !== 4) {
    throw new Error('Malformed document access token.');
  }
  const [documentId, userId, expStr, providedSig] = parts as [string, string, string, string];
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(documentId) || !/^[A-Za-z0-9_-]{1,128}$/.test(userId) || !/^\d{1,12}$/.test(expStr) || !/^[a-f0-9]{64}$/.test(providedSig)) {
    throw new Error('Malformed document access token.');
  }
  const exp = Number(expStr);
  if (!Number.isSafeInteger(exp) || exp <= Math.floor(Date.now() / 1000) || exp > Math.floor(Date.now() / 1000) + 300) {
    throw new Error('Document access link has expired.');
  }
  const expectedSig = await hmacSignHex(secret, `${documentId}.${userId}.${expStr}`);
  if (expectedSig.length !== providedSig.length) {
    throw new Error('Invalid document token signature.');
  }
  // Constant-time comparison
  let diff = 0;
  for (let i = 0; i < expectedSig.length; i++) {
    diff |= expectedSig.charCodeAt(i) ^ providedSig.charCodeAt(i);
  }
  if (diff !== 0) {
    throw new Error('Invalid document token signature.');
  }
  return { documentId, userId };
}
