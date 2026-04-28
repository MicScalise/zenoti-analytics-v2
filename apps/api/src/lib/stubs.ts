// =============================================================================
// Type stubs for missing dependencies
// BUG 2 FIX: Use real bcryptjs instead of stub that always returns false
// =============================================================================

import * as bcryptjs from 'bcryptjs';

/** UUID v4 generator (lightweight, no external dep) */
export function _uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Real bcrypt using bcryptjs — works in all Node.js environments */
export const _bcrypt = {
  hash: async (data: string, salt: number | string): Promise<string> => {
    const saltRounds = typeof salt === 'number' ? salt : 12;
    return bcryptjs.hash(data, saltRounds);
  },
  compare: async (password: string, hash: string): Promise<boolean> => {
    return bcryptjs.compare(password, hash);
  },
  genSalt: async (rounds: number): Promise<string> => {
    return bcryptjs.genSalt(rounds);
  },
};
