/**
 * Runs tasks that share a key one after another, so a read-modify-write over
 * the same records never interleaves with itself.
 *
 * This holds inside one process, which is what the service is today: a single
 * Fastify instance with no broker in front of it. A second instance needs the
 * ordering enforced by the store instead — a version on the record, or a
 * transaction — because two processes cannot share this map.
 */
export function createKeyedQueue(): <T>(key: string, task: () => Promise<T>) => Promise<T> {
  const tails = new Map<string, Promise<unknown>>();

  return function enqueue<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = tails.get(key) ?? Promise.resolve();
    // The queue must survive a failed task, so both settlements start the next
    // one; a rejection still reaches the caller through `result`.
    const result = previous.then(task, task);

    const forget = () => {
      if (tails.get(key) === tail) {
        tails.delete(key);
      }
    };
    const tail: Promise<void> = result.then(forget, forget);

    tails.set(key, tail);

    return result;
  };
}
