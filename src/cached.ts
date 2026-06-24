export type CacheKey = string | number | symbol;

export interface Cache<K, V> {
  get(key: K): V | undefined;
  set(key: K, value: V): unknown;
  has(key: K): boolean;
}

/**
 * Memoize an async or sync function using any cache instance.
 * Results are stored in the cache; subsequent calls with the same key return
 * the cached value without re-executing `fn`.
 *
 * @param fn     The function to memoize.
 * @param cache  Any cache that implements `get/set/has` (LRUCache, LFUCache, TTLCache, etc.).
 * @param keyFn  Optional key derivation function. Defaults to `JSON.stringify(args)`.
 *
 * @example
 * const cache = new LRUCache<string, number>({ maxSize: 100 });
 * const cachedFetch = cached(expensiveFetch, cache);
 * await cachedFetch("url"); // fetches
 * await cachedFetch("url"); // returns cached
 */
export function cached<Args extends unknown[], R>(
  fn: (...args: Args) => R,
  cache: Cache<string, Awaited<R>>,
  keyFn: (...args: Args) => string = (...args) => JSON.stringify(args)
): (...args: Args) => R extends Promise<unknown> ? Promise<Awaited<R>> : R {
  return ((...args: Args) => {
    const key = keyFn(...args);
    if (cache.has(key)) return cache.get(key) as R;
    const result = fn(...args);
    if (result instanceof Promise) {
      return result.then((value: Awaited<R>) => {
        cache.set(key, value);
        return value;
      }) as R;
    }
    cache.set(key, result as Awaited<R>);
    return result;
  }) as (...args: Args) => R extends Promise<unknown> ? Promise<Awaited<R>> : R;
}
