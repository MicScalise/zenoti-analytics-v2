// =============================================================================
// BullMQ — Job queue stub (ioredis dependency not installed)
// =============================================================================

// Stubbed - BullMQ requires ioredis which is not installed
export function createJobQueue(name: string): unknown {
  return {
    name,
    add: async () => ({ id: 'stub-job-id' }),
    close: async () => {},
  };
}
