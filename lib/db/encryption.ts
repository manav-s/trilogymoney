import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const VERSION = 'v1';

// Get encryption key from environment
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-hex-char (32-byte) key');
  }
  return Buffer.from(key, 'hex');
}

/**
 * Encrypts sensitive data using AES-256-GCM
 * Returns format: vX:iv:authTag:encrypted (all hex encoded)
 */
export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts data encrypted with encrypt()
 * Expects format: vX:iv:authTag:encrypted (all hex encoded)
 */
export function decrypt(encryptedData: string): string {
  const parts = encryptedData.split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted data format');
  }
  const version = parts[0];
  const ivHex = parts[1];
  const tagHex = parts[2];
  const encHex = parts[3];

  // In future, route based on version for key rotation
  void version;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/** Helpers */
export function encryptPlaidToken(accessToken: string): string {
  return encrypt(accessToken);
}

export function decryptPlaidToken(encryptedToken: string): string {
  return decrypt(encryptedToken);
}

export function encryptMessage(message: string): string {
  return encrypt(message);
}

export function decryptMessage(encryptedMessage: string): string {
  return decrypt(encryptedMessage);
}

export function generateEncryptionKey(): string {
  return randomBytes(32).toString('hex');
}
