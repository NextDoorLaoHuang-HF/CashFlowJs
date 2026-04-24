export type ShuffledResult<T> = { list: T[]; rngState: number };

export const createRngSeed = (): number => (Date.now() % 2 ** 32) >>> 0;

export const nextRngFloat = (rngState: number): { value: number; rngState: number } => {
  let nextState = (rngState + 0x6d2b79f5) | 0;
  let t = nextState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, rngState: nextState >>> 0 };
};

export const nextRngIntInclusive = (
  rngState: number,
  min: number,
  max: number
): {
  value: number;
  rngState: number;
} => {
  const safeMin = Number.isFinite(min) ? Math.ceil(min) : 0;
  const safeMax = Number.isFinite(max) ? Math.floor(max) : safeMin;
  const resolvedMin = Math.min(safeMin, safeMax);
  const resolvedMax = Math.max(safeMin, safeMax);
  const { value: floatValue, rngState: nextState } = nextRngFloat(rngState);
  const span = resolvedMax - resolvedMin + 1;
  const normalizedSpan = span > 0 ? span : 1;
  const value = resolvedMin + Math.floor(floatValue * normalizedSpan);
  return { value, rngState: nextState };
};

export const shuffleWithRng = <T>(list: T[], rngState: number): ShuffledResult<T> => {
  const copy = [...list];
  let state = rngState;
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const { value: index, rngState: nextState } = nextRngIntInclusive(state, 0, i);
    state = nextState;
    [copy[i], copy[index]] = [copy[index], copy[i]];
  }
  return { list: copy, rngState: state };
};
