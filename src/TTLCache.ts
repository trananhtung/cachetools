export interface TTLCacheOptions {
  /** Maximum number of entries. Must be ≥ 1. */
  maxSize: number;
  /** Time-to-live in milliseconds. Entries expire after this duration. */
  ttl: number;
  /** Called whenever an entry is evicted (expired or capacity). */
  onEvict?: <K, V>(key: K, value: V) => void;
  /** Optional: override Date.now() for testing. */
  clock?: () => number;
}

interface TTLEntry<V> {
  value: V;
  expiresAt: number;
}

/**
 * TTL (Time-To-Live) cache. Entries expire after a fixed duration.
 * Expired entries are lazily removed on access; also pruned on `set` when full.
 *
 * Port of Python cachetools.TTLCache.
 *
 * @example
 * const cache = new TTLCache<string, number>({ maxSize: 100, ttl: 5000 });
 * cache.set("token", 42);
 * // 5 seconds later:
 * cache.get("token"); // undefined — expired
 */
export class TTLCache<K, V> {
  private readonly _maxSize: number;
  private readonly _ttl: number;
  private readonly _onEvict?: (key: K, value: V) => void;
  private readonly _clock: () => number;
  private readonly _map = new Map<K, TTLEntry<V>>();

  constructor(options: TTLCacheOptions) {
    if (options.maxSize < 1 || !Number.isInteger(options.maxSize)) {
      throw new RangeError("maxSize must be a positive integer");
    }
    if (options.ttl <= 0) throw new RangeError("ttl must be positive");
    this._maxSize = options.maxSize;
    this._ttl = options.ttl;
    this._onEvict = options.onEvict as ((key: K, value: V) => void) | undefined;
    this._clock = options.clock ?? (() => Date.now());
  }

  private _isExpired(entry: TTLEntry<V>): boolean {
    return this._clock() >= entry.expiresAt;
  }

  /** Get a value. Returns `undefined` if not found or expired. */
  get(key: K): V | undefined {
    const entry = this._map.get(key);
    if (!entry) return undefined;
    if (this._isExpired(entry)) {
      this._map.delete(key);
      this._onEvict?.(key, entry.value);
      return undefined;
    }
    return entry.value;
  }

  /** Returns true if the key exists and has not expired. */
  has(key: K): boolean {
    const entry = this._map.get(key);
    if (!entry) return false;
    if (this._isExpired(entry)) {
      this._map.delete(key);
      this._onEvict?.(key, entry.value);
      return false;
    }
    return true;
  }

  /** Set a value with the configured TTL. Prunes expired entries before evicting by size. */
  set(key: K, value: V): this {
    const now = this._clock();
    const expiresAt = now + this._ttl;

    const existing = this._map.get(key);
    if (existing) {
      existing.value = value;
      existing.expiresAt = expiresAt;
      return this;
    }

    if (this._map.size >= this._maxSize) {
      // Lazy-prune expired entries first
      this._pruneExpired(now);
    }
    if (this._map.size >= this._maxSize) {
      // Still full — evict oldest (first inserted)
      const oldest = this._map.keys().next().value as K;
      const oldestEntry = this._map.get(oldest)!;
      this._map.delete(oldest);
      this._onEvict?.(oldest, oldestEntry.value);
    }

    this._map.set(key, { value, expiresAt });
    return this;
  }

  private _pruneExpired(now = this._clock()): void {
    for (const [key, entry] of this._map) {
      if (now >= entry.expiresAt) {
        this._map.delete(key);
        this._onEvict?.(key, entry.value);
      }
    }
  }

  /** Remove expired entries. Useful to call periodically to free memory. */
  expire(): void {
    this._pruneExpired();
  }

  /** Delete an entry. Returns true if it existed and had not expired. */
  delete(key: K): boolean {
    const entry = this._map.get(key);
    if (!entry) return false;
    this._map.delete(key);
    if (!this._isExpired(entry)) {
      this._onEvict?.(key, entry.value);
      return true;
    }
    return false;
  }

  /** Remove all entries. */
  clear(): void {
    this._map.clear();
  }

  /** Peek at a value without checking expiry. Useful for debugging. */
  peek(key: K): V | undefined {
    return this._map.get(key)?.value;
  }

  /** Remaining TTL for a key in ms, or -1 if expired/missing. */
  remainingTTL(key: K): number {
    const entry = this._map.get(key);
    if (!entry) return -1;
    const remaining = entry.expiresAt - this._clock();
    return remaining > 0 ? remaining : -1;
  }

  get size(): number {
    return this._map.size;
  }

  get maxSize(): number { return this._maxSize; }
  get ttl(): number { return this._ttl; }

  /** Live entries only (excludes expired). */
  keys(): K[] {
    const now = this._clock();
    return [...this._map.entries()].filter(([, e]) => now < e.expiresAt).map(([k]) => k);
  }

  values(): V[] {
    const now = this._clock();
    return [...this._map.entries()].filter(([, e]) => now < e.expiresAt).map(([, e]) => e.value);
  }

  entries(): [K, V][] {
    const now = this._clock();
    return [...this._map.entries()].filter(([, e]) => now < e.expiresAt).map(([k, e]) => [k, e.value]);
  }

  [Symbol.iterator](): Iterator<[K, V]> {
    return this.entries()[Symbol.iterator]();
  }
}
