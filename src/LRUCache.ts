/** Node in the doubly-linked list used for O(1) eviction. */
interface Node<K, V> {
  key: K;
  value: V;
  prev: Node<K, V> | null;
  next: Node<K, V> | null;
}

export interface LRUCacheOptions {
  /** Maximum number of entries. Must be ≥ 1. */
  maxSize: number;
  /** Called whenever an entry is evicted (either by size or explicit delete). */
  onEvict?: <K, V>(key: K, value: V) => void;
}

/**
 * LRU (Least Recently Used) cache backed by a Map + doubly-linked list.
 * O(1) get, set, delete, has. Evicts the least-recently-used entry on overflow.
 *
 * Port of Python cachetools.LRUCache.
 *
 * @example
 * const cache = new LRUCache<string, number>({ maxSize: 100 });
 * cache.set("a", 1);
 * cache.get("a"); // 1 — marks "a" as recently used
 */
export class LRUCache<K, V> {
  private readonly _maxSize: number;
  private readonly _onEvict?: (key: K, value: V) => void;
  private readonly _map = new Map<K, Node<K, V>>();
  // Sentinel head and tail nodes (never evicted, never stored in map)
  private readonly _head: Node<K, V>;
  private readonly _tail: Node<K, V>;

  constructor(options: LRUCacheOptions) {
    if (options.maxSize < 1 || !Number.isInteger(options.maxSize)) {
      throw new RangeError("maxSize must be a positive integer");
    }
    this._maxSize = options.maxSize;
    this._onEvict = options.onEvict as ((key: K, value: V) => void) | undefined;
    this._head = { key: null as unknown as K, value: null as unknown as V, prev: null, next: null };
    this._tail = { key: null as unknown as K, value: null as unknown as V, prev: null, next: null };
    this._head.next = this._tail;
    this._tail.prev = this._head;
  }

  private _remove(node: Node<K, V>): void {
    node.prev!.next = node.next;
    node.next!.prev = node.prev;
  }

  private _prepend(node: Node<K, V>): void {
    node.next = this._head.next;
    node.prev = this._head;
    this._head.next!.prev = node;
    this._head.next = node;
  }

  /** Get a value and mark it as recently used. Returns `undefined` if not found. */
  get(key: K): V | undefined {
    const node = this._map.get(key);
    if (!node) return undefined;
    this._remove(node);
    this._prepend(node);
    return node.value;
  }

  /** Set a value. Evicts LRU entry if at capacity. */
  set(key: K, value: V): this {
    const existing = this._map.get(key);
    if (existing) {
      existing.value = value;
      this._remove(existing);
      this._prepend(existing);
      return this;
    }
    if (this._map.size >= this._maxSize) {
      const lru = this._tail.prev!;
      this._remove(lru);
      this._map.delete(lru.key);
      this._onEvict?.(lru.key, lru.value);
    }
    const node: Node<K, V> = { key, value, prev: null, next: null };
    this._prepend(node);
    this._map.set(key, node);
    return this;
  }

  /** Returns true if the key exists (does NOT update recency). */
  has(key: K): boolean {
    return this._map.has(key);
  }

  /** Delete an entry. Returns true if it existed. */
  delete(key: K): boolean {
    const node = this._map.get(key);
    if (!node) return false;
    this._remove(node);
    this._map.delete(key);
    this._onEvict?.(key, node.value);
    return true;
  }

  /** Remove all entries. */
  clear(): void {
    this._map.clear();
    this._head.next = this._tail;
    this._tail.prev = this._head;
  }

  /** Peek at a value without updating recency. Returns `undefined` if not found. */
  peek(key: K): V | undefined {
    return this._map.get(key)?.value;
  }

  get size(): number { return this._map.size; }
  get maxSize(): number { return this._maxSize; }

  keys(): K[] {
    const result: K[] = [];
    let node = this._head.next!;
    while (node !== this._tail) { result.push(node.key); node = node.next!; }
    return result;
  }

  values(): V[] {
    const result: V[] = [];
    let node = this._head.next!;
    while (node !== this._tail) { result.push(node.value); node = node.next!; }
    return result;
  }

  entries(): [K, V][] {
    const result: [K, V][] = [];
    let node = this._head.next!;
    while (node !== this._tail) { result.push([node.key, node.value]); node = node.next!; }
    return result;
  }

  [Symbol.iterator](): Iterator<[K, V]> {
    return this.entries()[Symbol.iterator]();
  }
}
