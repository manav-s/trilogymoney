import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

// Get encryption key from environment
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  // Ensure key is 32 bytes (256 bits) for AES-256
  return Buffer.from(key, 'hex');
}

/**
 * Encrypts sensitive data using AES-256-GCM
 * Returns format: iv:authTag:encryptedData (all hex encoded)
 */
export function encrypt(text: string): string {
  try {
    const key = getEncryptionKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Return format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypts data encrypted with encrypt()
 * Expects format: iv:authTag:encryptedData (all hex encoded)
 */
export function decrypt(encryptedData: string): string {
  try {
    const key = getEncryptionKey();
    const parts = encryptedData.split(':');
    
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Helper to encrypt Plaid access tokens
 */
export function encryptPlaidToken(accessToken: string): string {
  return encrypt(accessToken);
}

/**
 * Helper to decrypt Plaid access tokens
 */
export function decryptPlaidToken(encryptedToken: string): string {
  return decrypt(encryptedToken);
}

/**
 * Helper to encrypt SMS message content
 */
export function encryptMessage(message: string): string {
  return encrypt(message);
}

/**
 * Helper to decrypt SMS message content
 */
export function decryptMessage(encryptedMessage: string): string {
  return decrypt(encryptedMessage);
}

/**
 * Generate a new encryption key (for initial setup)
 * Run this once and store in your .env file
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString('hex');
}
