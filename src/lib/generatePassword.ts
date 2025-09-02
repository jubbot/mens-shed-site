// src/lib/generatePassword.ts
import crypto from 'crypto';

const U = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const L = 'abcdefghijkmnopqrstuvwxyz';
const D = '23456789';
const S = '!@#$%^&*()-_=+[]{};:,.?'; // avoid quotes/backticks
const ALL = U + L + D + S;

export function generatePassword(length = 24) {
  // ensure at least one of each class
  const pick = (set: string) => set[crypto.randomInt(0, set.length)];
  const base = [pick(U), pick(L), pick(D), pick(S)];
  const rest = Array.from({ length: Math.max(0, length - base.length) }, () => pick(ALL));
  const bytes = crypto.randomBytes(length);
  const chars = [...base, ...rest].map((c, i) => (ALL[bytes[i] % ALL.length]));
  // Fisher–Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = bytes[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
