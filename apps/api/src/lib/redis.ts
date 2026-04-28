// =============================================================================
// Redis — ioredis client setup (STUBBED for build)
// =============================================================================

// Stubbed - ioredis types not installed
let redis: unknown = undefined;

export function getRedis(): unknown {
  if (!redis) {
    throw new Error('Redis not configured (stubbed)');
  }
  return redis;
}
