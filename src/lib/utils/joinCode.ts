import crypto from 'crypto';

/**
 * Generates an 8-character, uppercase alphanumeric join code.
 * Excludes visually ambiguous characters (0, O, I, 1).
 */
export function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  const randomBytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return result;
}
