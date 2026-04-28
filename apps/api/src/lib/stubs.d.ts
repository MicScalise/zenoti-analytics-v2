declare module '../lib/stubs.js' {
  export function uuidv4(): string;
  export const bcrypt: {
    hash: (data: string, salt: number | string) => Promise<string>;
    compare: (data: string, hash: string) => Promise<boolean>;
    genSalt: (rounds: number) => Promise<string>;
  };
}
