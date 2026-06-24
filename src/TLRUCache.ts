/**
 * TLRUCache — Time-aware LRU cache (TTL + LRU combined).
 *
 * Combines TTL expiry with LRU eviction:
 * - Entries expire after `ttl` ms regardless of access.
 * - When over capacity, evicts the least-recently-used non-expired entry.
 * - Inspired by Python cachetools.TLRUCache and Java Caffeine's expireAfterWrite.
 */

interface TLRUNode<K, V> {
  key: K;
  value: V;
  expiresAt: number;
  prev: TLRUNode<K, V> | null;
  next: TLRUNode<K, V> | null;
}

export interface TLRUCacheOptions {
  maxSize: number;
  ttl: number;
  onEvict?: <K, V>(key: K, value: V) => void;
  clock?: () => number;
}

export class TLRUCache<K, V> {
  private readonly _maxSize: number;
  private readonly _ttl: number;
  private readonly _onEvict?: (key: K, value: V) => void;
  private readonly _clock: () => number;
  private readonly _map = new Map<K, TLRUNode<K, V>>();
  private readonly _head: TLRUNode<K, V>;
  private readonly _tail: TLRUNode<K, V>;

  constructor(options: TLRUCacheOptions) {
    if (options.maxSize < 1 || !Number.isInteger(options.maxSize)) throw new RangeError("maxSize must be a positive integer");
    if (options.ttl <= 0) throw new RangeError("ttl must be positive");
    this._maxSize = options.maxSize;
    this._ttl = options.ttl;
    this._onEvict = options.onEvict as ((key: K, value: V) => void) | undefined;
    this._clock = options.clock ?? (() => Date.now());
    this._head = { key: null as unknown as K, value: null as unknown as V, expiresAt: 0, prev: null, next: null };
    this._tail = { key: null as unknown as K, value: null as unknown as V, expiresAt: 0, prev: null, next: null };
    this._head.next = this._tail;
    this._tail.prev = this._head;
  }

  private _remove(node: TLRUNode<K, V>): void {
    node.prev!.next = node.next;
    node.next!.prev = node.prev;
  }

  private _prepend(node: TLRUNode<K, V>): void {
    node.next = this._head.next;
    node.prev = this._head;
    this._head.next!.prev = node;
    this._head.next = node;
  }

  get(key: K): V | undefined {
    const node = this._map.get(key);
    if (!node) return undefined;
    if (this._clock() >= node.expiresAt) {
      this._remove(node); this._map.delete(key);
      this._onEvict?.(key, node.value);
      return undefined;
    }
    this._remove(node); this._prepend(node);
    return node.value;
  }

  has(key: K): boolean {
    const node = this._map.get(key);
    if (!node) return false;
    if (this._clock() >= node.expiresAt) {
      this._remove(node); this._map.delete(key);
      this._onEvict?.(key, node.value);
      return false;
    }
    return true;
  }

  set(key: K, value: V): this {
    const now = this._clock();
    const existing = this._map.get(key);
    if (existing) {
      existing.value = value;
      existing.expiresAt = now + this._ttl;
      this._remove(existing); this._prepend(existing);
      return this;
    }
    if (this._map.size >= this._maxSize) {
      // Evict LRU (tail.prev)
      const lru = this._tail.prev!;
      this._remove(lru); this._map.delete(lru.key);
      this._onEvict?.(lru.key, lru.value);
    }
    const node: TLRUNode<K, V> = { key, value, expiresAt: now + this._ttl, prev: null, next: null };
    this._prepend(node); this._map.set(key, node);
    return this;
  }

  delete(key: K): boolean {
    const node = this._map.get(key);
    if (!node) return false;
    this._remove(node); this._map.delete(key);
    this._onEvict?.(key, node.value);
    return true;
  }

  clear(): void {
    this._map.clear();
    this._head.next = this._tail;
    this._tail.prev = this._head;
  }

  peek(key: K): V | undefined { return this._map.get(key)?.value; }

  expire(): void {
    const now = this._clock();
    let node = this._tail.prev!;
    while (node !== this._head) {
      const prev = node.prev!;
      if (now >= node.expiresAt) {
        this._remove(node); this._map.delete(node.key);
        this._onEvict?.(node.key, node.value);
      }
      node = prev;
    }
  }

  remainingTTL(key: K): number {
    const node = this._map.get(key);
    if (!node) return -1;
    const r = node.expiresAt - this._clock();
    return r > 0 ? r : -1;
  }

  get size(): number { return this._map.size; }
  get maxSize(): number { return this._maxSize; }
  get ttl(): number { return this._ttl; }

  keys(): K[] {
    const result: K[] = []; const now = this._clock();
    let n = this._head.next!;
    while (n !== this._tail) { if (now < n.expiresAt) result.push(n.key); n = n.next!; }
    return result;
  }

  entries(): [K, V][] {
    const result: [K, V][] = []; const now = this._clock();
    let n = this._head.next!;
    while (n !== this._tail) { if (now < n.expiresAt) result.push([n.key, n.value]); n = n.next!; }
    return result;
  }

  [Symbol.iterator](): Iterator<[K, V]> { return this.entries()[Symbol.iterator](); }
}
