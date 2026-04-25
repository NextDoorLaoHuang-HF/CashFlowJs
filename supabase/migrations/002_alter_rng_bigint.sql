-- Fix rng_seed / rng_state overflow: game engine uses unsigned 32-bit ints,
-- but PostgreSQL INT is signed 32-bit. Promote to BIGINT to avoid overflow.
ALTER TABLE game_states ALTER COLUMN rng_seed TYPE BIGINT;
ALTER TABLE game_states ALTER COLUMN rng_state TYPE BIGINT;
