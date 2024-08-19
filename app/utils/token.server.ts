import jwt from '@tsndr/cloudflare-worker-jwt';
import { z } from 'zod';

// Ensure your key is of the correct length
const normalizeKey = (key: string, length = 32) => {
  const encoder = new TextEncoder();
  const keyBuffer = encoder.encode(key);

  if (keyBuffer.length === length) {
    return keyBuffer;
  }

  if (keyBuffer.length > length) {
    // Truncate the key if it's too long
    return keyBuffer.slice(0, length);
  } else {
    // Pad the key if it's too short
    const paddedKey = new Uint8Array(length);
    paddedKey.set(keyBuffer);
    return paddedKey;
  }
};

// Encryption
export const encrypt = async (text: string, key: string) => {
  const enc = new TextEncoder();
  const keyBuffer = await crypto.subtle.importKey(
    'raw',
    normalizeKey(key),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    keyBuffer,
    enc.encode(text)
  );

  return Buffer.from([...iv, ...new Uint8Array(ciphertext)]).toString(
    'base64url'
  );
};

// Decryption
export const decrypt = async (ciphertext: string, key: string) => {
  const enc = new TextEncoder();
  const keyBuffer = await crypto.subtle.importKey(
    'raw',
    normalizeKey(key),
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
  const data = Uint8Array.from(Buffer.from(ciphertext, 'base64url'));

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: data.slice(0, 12) },
    keyBuffer,
    data.slice(12)
  );
  return new TextDecoder().decode(decrypted);
};

export const verifyChallenge = async (
  codeVerifier: string,
  codeChallenge: string
): Promise<boolean> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const base64Hash = Buffer.from(hashBuffer).toString('base64url');

  return base64Hash === codeChallenge;
};

const CodeTokenPayloadEncSchema = z.object({
  userId: z.string(),
  projectId: z.string(),
  codeChallenge: z.string(),
});

type CodeTokenPayload = z.infer<typeof CodeTokenPayloadEncSchema>;

export const createCodeToken = async (
  payload: CodeTokenPayload,
  secret: string,
  options: { maxAge: number }
) => {
  const expiresAt = Math.round((Date.now() + options.maxAge) / 1000);

  const jwtKey = await jwt.sign(
    {
      iss: 'webstudio',
      sub: `${payload.userId}:${payload.projectId}`,
      exp: expiresAt,
      iat: Math.round(Date.now() / 1000),
      ...payload,
    },
    secret
  );

  return await encrypt(jwtKey, secret);
};

export const readCodeToken = async (
  accessToken: string,
  secret: string
): Promise<CodeTokenPayload | undefined> => {
  const jwtToken = await decrypt(accessToken, secret);

  if (false === (await jwt.verify(jwtToken, secret))) {
    return;
  }

  const token = await jwt.decode(jwtToken);

  const parsedToken = CodeTokenPayloadEncSchema.parse(token.payload);

  return parsedToken;
};

const AccessTokenPayloadSchema = z.object({
  userId: z.string(),
  projectId: z.string(),
});

type AccessTokenPayload = z.infer<typeof AccessTokenPayloadSchema>;

export const createAccessToken = async (
  payload: AccessTokenPayload,
  secret: string,
  options: { maxAge: number }
) => {
  const expiresAt = Math.round((Date.now() + options.maxAge) / 1000);

  return await jwt.sign(
    {
      iss: 'webstudio',
      sub: `${payload.userId}:${payload.projectId}`,
      exp: expiresAt,
      iat: Math.round(Date.now() / 1000),
      ...payload,
    },
    secret
  );
};

export const readAccessToken = async (
  accessToken: string,
  secret: string
): Promise<AccessTokenPayload | undefined> => {
  if (false === (await jwt.verify(accessToken, secret))) {
    return;
  }

  const token = jwt.decode(accessToken);

  const parsedToken = AccessTokenPayloadSchema.parse(token.payload);

  return parsedToken;
};
