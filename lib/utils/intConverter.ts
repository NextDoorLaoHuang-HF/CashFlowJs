/**
 * Convert an unsigned 32-bit integer (as a JS number) to a signed 32-bit
 * representation suitable for PostgreSQL `integer` columns.
 *
 * PostgreSQL `integer` is signed (-2^31 .. 2^31-1). If a JS number exceeds
 * 2^31-1 we reinterpret it as a negative value using two's-complement.
 *
 * Rules: 0 → 0, positive ≤ 2^31-1 unchanged, > 2^31-1 → n - 2^32.
 */
export function toSignedInt32(n: number): number {
  if (n > 2147483647) return n - 4294967296;
  return n;
}

/**
 * Convert a signed 32-bit integer (from PostgreSQL) back to an unsigned
 * 32-bit JS number for RNG seed/state usage.
 *
 * Rules: negative → n + 2^32, non-negative unchanged.
 */
export function toUnsignedInt32(n: number): number {
  if (n < 0) return n + 4294967296;
  return n;
}
