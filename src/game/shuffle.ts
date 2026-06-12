export type Rng = () => number;

export function createRng(seed: number): Rng {
   let s = seed >>> 0;
   return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
   };
}

export function seedFromString(str: string): number {
   let h = 2166136261;
   for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
   }
   return h >>> 0;
}

export function shuffle<T>(input: readonly T[], rng: Rng): T[] {
   const out = input.slice();
   for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const a = out[i] as T;
      const b = out[j] as T;
      out[i] = b;
      out[j] = a;
   }
   return out;
}
