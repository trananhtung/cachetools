export interface LFUCacheOptions {
  /** Maximum number of entries. Must be ≥ 1. */
  maxSize: number;
  /** Called whenever an entry is evicted. */
  onEvict?: <K, V>(key: K, value: V) => void;
}

/**
 * LFU (Least Frequently Used) cache with O(1) operations.
 *
 * Uses the algorithm by Shah, Mitra, Matani (2010):
 * - Each entry has a frequency counter.
 * - On overflow, the entry with the lowest frequency is evicted.
 * - Ties broken by LRU order within the same frequency bucket.
 *
 * Port of Python cachetools.LFUCache.
 *
 * @example
 * const cache = new LFUCache<string, number>({ maxSize: 3 });
 * cache.set("a", 1); cache.set("b", 2); cache.set("c", 3);
 * cache.get("a"); cache.get("a"); // freq("a") = 2
 * cache.set("d", 4); // evicts "b" or "c" (freq=1)
 */
export class LFUCache<K, V> {
  private readonly _maxSize: number;
  private readonly _onEvict?: (key: K, value: V) => void;
  private readonly _keyMap = new Map<K, { value: V; freq: number }>();
  /** freq → ordered set of keys (insertion order = LRU within freq) */
  private readonly _freqMap = new Map<number, Set<K>>();
  private _minFreq = 0;

  constructor(options: LFUCacheOptions) {
    if (options.maxSize < 1 || !Number.isInteger(options.maxSize)) {
      throw new RangeError("maxSize must be a positive integer");
    }
    this._maxSize = options.maxSize;
    this._onEvict = options.onEvict as ((key: K, value: V) => void) | undefined;
  }

  private _incrFreq(key: K, entry: { value: V; freq: number }): void {
    const oldFreq = entry.freq;
    const bucket = this._freqMap.get(oldFreq)!;
    bucket.delete(key);
    if (bucket.size === 0) {
      this._freqMap.delete(oldFreq);
      if (this._minFreq === oldFreq) this._minFreq = oldFreq + 1;
    }
    entry.freq++;
    let newBucket = this._freqMap.get(entry.freq);
    if (!newBucket) { newBucket = new Set(); this._freqMap.set(entry.freq, newBucket); }
    newBucket.add(key);
  }

  /** Get a value and increment its frequency. Returns `undefined` if not found. */
  get(key: K): V | undefined {
    const entry = this._keyMap.get(key);
    if (!entry) return undefined;
    this._incrFreq(key, entry);
    return entry.value;
  }

  /** Set a value. Evicts the least-frequently-used (LRU within ties) entry on overflow. */
  set(key: K, value: V): this {
    if (this._maxSize === 0) return this;
    const existing = this._keyMap.get(key);
    if (existing) {
      existing.value = value;
      this._incrFreq(key, existing);
      return this;
    }
    if (this._keyMap.size >= this._maxSize) {
      const minBucket = this._freqMap.get(this._minFreq)!;
      const lfu = minBucket.keys().next().value as K;
      minBucket.delete(lfu);
      if (minBucket.size === 0) this._freqMap.delete(this._minFreq);
      const evicted = this._keyMap.get(lfu)!;
      this._keyMap.delete(lfu);
      this._onEvict?.(lfu, evicted.value);
    }
    const entry = { value, freq: 1 };
    this._keyMap.set(key, entry);
    let bucket = this._freqMap.get(1);
    if (!bucket) { bucket = new Set(); this._freqMap.set(1, bucket); }
    bucket.add(key);
    this._minFreq = 1;
    return this;
  }

  /** Returns true if the key exists (does NOT update frequency). */
  has(key: K): boolean { return this._keyMap.has(key); }

  /** Peek at a value without updating frequency. */
  peek(key: K): V | undefined { return this._keyMap.get(key)?.value; }

  /** Delete an entry. Returns true if it existed. */
  delete(key: K): boolean {
    const entry = this._keyMap.get(key);
    if (!entry) return false;
    const bucket = this._freqMap.get(entry.freq)!;
    bucket.delete(key);
    if (bucket.size === 0) this._freqMap.delete(entry.freq);
    this._keyMap.delete(key);
    this._onEvict?.(key, entry.value);
    return true;
  }

  /** Remove all entries. */
  clear(): void {
    this._keyMap.clear();
    this._freqMap.clear();
    this._minFreq = 0;
  }

  get size(): number { return this._keyMap.size; }
  get maxSize(): number { return this._maxSize; }

  keys(): K[] { return [...this._keyMap.keys()]; }
  values(): V[] { return [...this._keyMap.values()].map(e => e.value); }
  entries(): [K, V][] { return [...this._keyMap.entries()].map(([k, e]) => [k, e.value]); }

  [Symbol.iterator](): Iterator<[K, V]> {
    return this.entries()[Symbol.iterator]();
  }
}
