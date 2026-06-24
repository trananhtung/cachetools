import { LRUCache, LFUCache, TTLCache, TLRUCache, cached } from "../src/index.js";

// ── LRUCache ──────────────────────────────────────────────────────────────────
describe("LRUCache", () => {
  it("basic get/set/has", () => {
    const c = new LRUCache<string, number>({ maxSize: 3 });
    c.set("a", 1).set("b", 2).set("c", 3);
    expect(c.get("a")).toBe(1);
    expect(c.has("b")).toBe(true);
    expect(c.has("z")).toBe(false);
    expect(c.size).toBe(3);
  });

  it("evicts LRU on overflow", () => {
    const evicted: string[] = [];
    const c = new LRUCache<string, number>({
      maxSize: 2,
      onEvict: (k) => evicted.push(k as string),
    });
    c.set("a", 1); c.set("b", 2);
    c.get("a"); // "a" now MRU, "b" is LRU
    c.set("c", 3); // evicts "b"
    expect(c.has("b")).toBe(false);
    expect(c.has("a")).toBe(true);
    expect(evicted).toContain("b");
  });

  it("set on existing key updates value and promotes to MRU", () => {
    const c = new LRUCache<string, number>({ maxSize: 2 });
    c.set("a", 1); c.set("b", 2);
    c.set("a", 10); // promote "a"
    c.set("c", 3);  // should evict "b" not "a"
    expect(c.get("a")).toBe(10);
    expect(c.has("b")).toBe(false);
  });

  it("delete removes entry", () => {
    const c = new LRUCache<string, number>({ maxSize: 3 });
    c.set("a", 1);
    expect(c.delete("a")).toBe(true);
    expect(c.has("a")).toBe(false);
    expect(c.delete("z")).toBe(false);
  });

  it("clear empties cache", () => {
    const c = new LRUCache<string, number>({ maxSize: 3 });
    c.set("a", 1); c.set("b", 2);
    c.clear();
    expect(c.size).toBe(0);
    expect(c.has("a")).toBe(false);
  });

  it("peek does not update recency", () => {
    const c = new LRUCache<string, number>({ maxSize: 2 });
    c.set("a", 1); c.set("b", 2);
    c.peek("a"); // no promotion
    c.set("c", 3); // evicts LRU = "a"
    expect(c.has("a")).toBe(false);
    expect(c.has("b")).toBe(true);
  });

  it("keys() returns most-recent-first order", () => {
    const c = new LRUCache<string, number>({ maxSize: 3 });
    c.set("a", 1); c.set("b", 2); c.set("c", 3);
    expect(c.keys()[0]).toBe("c"); // most recent
    expect(c.keys()[2]).toBe("a"); // least recent
  });

  it("throws for non-positive maxSize", () => {
    expect(() => new LRUCache({ maxSize: 0 })).toThrow(RangeError);
    expect(() => new LRUCache({ maxSize: -1 })).toThrow(RangeError);
  });

  it("iterable entries", () => {
    const c = new LRUCache<string, number>({ maxSize: 3 });
    c.set("x", 10); c.set("y", 20);
    const pairs = [...c];
    expect(pairs.length).toBe(2);
  });
});

// ── LFUCache ──────────────────────────────────────────────────────────────────
describe("LFUCache", () => {
  it("basic get/set/has", () => {
    const c = new LFUCache<string, number>({ maxSize: 3 });
    c.set("a", 1); c.set("b", 2);
    expect(c.get("a")).toBe(1);
    expect(c.has("b")).toBe(true);
    expect(c.size).toBe(2);
  });

  it("evicts least-frequently-used on overflow", () => {
    const c = new LFUCache<string, number>({ maxSize: 3 });
    c.set("a", 1); c.set("b", 2); c.set("c", 3);
    c.get("a"); c.get("a"); // freq("a") = 3 (1 set + 2 get)
    c.get("b");             // freq("b") = 2
    // "c" has freq=1 — should be evicted
    c.set("d", 4);
    expect(c.has("c")).toBe(false);
    expect(c.has("a")).toBe(true);
    expect(c.has("b")).toBe(true);
  });

  it("LRU tiebreak within same frequency", () => {
    const c = new LFUCache<string, number>({ maxSize: 2 });
    c.set("a", 1); c.set("b", 2); // both freq=1
    // "a" was inserted first — LRU within freq=1
    c.set("c", 3); // evicts "a"
    expect(c.has("a")).toBe(false);
    expect(c.has("b")).toBe(true);
  });

  it("update existing key resets eviction priority", () => {
    const c = new LFUCache<string, number>({ maxSize: 2 });
    c.set("a", 1); c.set("b", 2);
    c.set("a", 10); // bumps freq("a") to 2
    c.set("c", 3);  // should evict "b" (freq=1)
    expect(c.get("a")).toBe(10);
    expect(c.has("b")).toBe(false);
  });

  it("delete removes entry", () => {
    const c = new LFUCache<string, number>({ maxSize: 3 });
    c.set("a", 1);
    expect(c.delete("a")).toBe(true);
    expect(c.has("a")).toBe(false);
  });

  it("clear empties cache", () => {
    const c = new LFUCache<string, number>({ maxSize: 3 });
    c.set("a", 1); c.clear();
    expect(c.size).toBe(0);
  });

  it("peek does not update frequency", () => {
    const c = new LFUCache<string, number>({ maxSize: 2 });
    c.set("a", 1); c.set("b", 2);
    c.peek("a"); // no freq bump
    c.set("c", 3); // evicts LFU = "a" (freq=1, LRU in ties)
    expect(c.has("a")).toBe(false);
  });

  it("onEvict callback fires", () => {
    const evicted: string[] = [];
    const c = new LFUCache<string, number>({
      maxSize: 1,
      onEvict: (k) => evicted.push(k as string),
    });
    c.set("a", 1); c.set("b", 2);
    expect(evicted).toContain("a");
  });
});

// ── TTLCache ──────────────────────────────────────────────────────────────────
describe("TTLCache", () => {
  const makeClock = (start = 0) => {
    let t = start;
    return {
      tick: (ms: number) => { t += ms; },
      now: () => t,
    };
  };

  it("returns value within TTL", () => {
    const clock = makeClock();
    const c = new TTLCache<string, number>({ maxSize: 10, ttl: 1000, clock: clock.now });
    c.set("a", 42);
    clock.tick(500);
    expect(c.get("a")).toBe(42);
  });

  it("returns undefined after TTL expires", () => {
    const clock = makeClock();
    const c = new TTLCache<string, number>({ maxSize: 10, ttl: 1000, clock: clock.now });
    c.set("a", 42);
    clock.tick(1001);
    expect(c.get("a")).toBeUndefined();
    expect(c.has("a")).toBe(false);
  });

  it("has() returns false for expired entries", () => {
    const clock = makeClock();
    const c = new TTLCache<string, number>({ maxSize: 10, ttl: 500, clock: clock.now });
    c.set("x", 1);
    clock.tick(501);
    expect(c.has("x")).toBe(false);
  });

  it("remainingTTL returns positive within TTL", () => {
    const clock = makeClock();
    const c = new TTLCache<string, number>({ maxSize: 10, ttl: 1000, clock: clock.now });
    c.set("a", 1);
    clock.tick(300);
    expect(c.remainingTTL("a")).toBeCloseTo(700);
    expect(c.remainingTTL("missing")).toBe(-1);
  });

  it("remainingTTL returns -1 after expiry", () => {
    const clock = makeClock();
    const c = new TTLCache<string, number>({ maxSize: 10, ttl: 500, clock: clock.now });
    c.set("a", 1);
    clock.tick(600);
    expect(c.remainingTTL("a")).toBe(-1);
  });

  it("expire() prunes expired entries", () => {
    const clock = makeClock();
    const c = new TTLCache<string, number>({ maxSize: 10, ttl: 500, clock: clock.now });
    c.set("a", 1); c.set("b", 2);
    clock.tick(600);
    c.expire();
    expect(c.size).toBe(0);
  });

  it("set refreshes TTL on existing key", () => {
    const clock = makeClock();
    const c = new TTLCache<string, number>({ maxSize: 10, ttl: 500, clock: clock.now });
    c.set("a", 1);
    clock.tick(400);
    c.set("a", 2); // refresh TTL
    clock.tick(300); // 700ms total, but TTL reset at 400ms
    expect(c.get("a")).toBe(2);
  });

  it("evicts oldest when full (after pruning)", () => {
    const clock = makeClock();
    const c = new TTLCache<string, number>({ maxSize: 2, ttl: 10000, clock: clock.now });
    c.set("a", 1); c.set("b", 2);
    c.set("c", 3); // "a" evicted (oldest insertion order)
    expect(c.has("a")).toBe(false);
    expect(c.has("b")).toBe(true);
    expect(c.has("c")).toBe(true);
  });

  it("onEvict callback fires on expiry detection", () => {
    const clock = makeClock();
    const evicted: string[] = [];
    const c = new TTLCache<string, number>({
      maxSize: 10, ttl: 100,
      clock: clock.now,
      onEvict: (k) => evicted.push(k as string),
    });
    c.set("a", 1);
    clock.tick(200);
    c.get("a"); // triggers eviction
    expect(evicted).toContain("a");
  });

  it("clear empties cache", () => {
    const c = new TTLCache<string, number>({ maxSize: 5, ttl: 1000 });
    c.set("a", 1); c.clear();
    expect(c.size).toBe(0);
  });
});

// ── TLRUCache ─────────────────────────────────────────────────────────────────
describe("TLRUCache", () => {
  const makeClock = (start = 0) => {
    let t = start;
    return { tick: (ms: number) => { t += ms; }, now: () => t };
  };

  it("basic get/set — returns value within TTL", () => {
    const clock = makeClock();
    const c = new TLRUCache<string, number>({ maxSize: 3, ttl: 1000, clock: clock.now });
    c.set("a", 1);
    clock.tick(500);
    expect(c.get("a")).toBe(1);
  });

  it("returns undefined after TTL", () => {
    const clock = makeClock();
    const c = new TLRUCache<string, number>({ maxSize: 3, ttl: 500, clock: clock.now });
    c.set("a", 1);
    clock.tick(600);
    expect(c.get("a")).toBeUndefined();
  });

  it("evicts LRU on overflow (within TTL)", () => {
    const clock = makeClock();
    const c = new TLRUCache<string, number>({ maxSize: 2, ttl: 9999, clock: clock.now });
    c.set("a", 1); c.set("b", 2);
    c.get("a"); // "a" now MRU
    c.set("c", 3); // evicts "b" (LRU)
    expect(c.has("b")).toBe(false);
    expect(c.has("a")).toBe(true);
  });

  it("remainingTTL works", () => {
    const clock = makeClock();
    const c = new TLRUCache<string, number>({ maxSize: 5, ttl: 1000, clock: clock.now });
    c.set("a", 1);
    clock.tick(300);
    expect(c.remainingTTL("a")).toBeCloseTo(700);
  });

  it("expire() removes expired entries", () => {
    const clock = makeClock();
    const c = new TLRUCache<string, number>({ maxSize: 5, ttl: 200, clock: clock.now });
    c.set("a", 1); c.set("b", 2);
    clock.tick(300);
    c.expire();
    expect(c.size).toBe(0);
  });

  it("clear empties", () => {
    const c = new TLRUCache<string, number>({ maxSize: 3, ttl: 1000 });
    c.set("a", 1); c.clear();
    expect(c.size).toBe(0);
  });
});

// ── cached() ──────────────────────────────────────────────────────────────────
describe("cached()", () => {
  it("memoizes sync function with LRU cache", () => {
    const c = new LRUCache<string, number>({ maxSize: 10 });
    let calls = 0;
    const fn = (x: number) => { calls++; return x * 2; };
    const memoized = cached(fn, c as Parameters<typeof cached>[1]);
    expect(memoized(5)).toBe(10);
    expect(memoized(5)).toBe(10);
    expect(calls).toBe(1); // only called once
    expect(memoized(6)).toBe(12);
    expect(calls).toBe(2);
  });

  it("memoizes async function", async () => {
    const c = new LRUCache<string, string>({ maxSize: 10 });
    let calls = 0;
    const fn = async (x: string) => { calls++; return x.toUpperCase(); };
    const memoized = cached(fn, c as Parameters<typeof cached>[1]);
    expect(await memoized("hello")).toBe("HELLO");
    expect(await memoized("hello")).toBe("HELLO");
    expect(calls).toBe(1);
  });

  it("custom key function", () => {
    const c = new LRUCache<string, number>({ maxSize: 10 });
    let calls = 0;
    const fn = (a: number, b: number) => { calls++; return a + b; };
    const memoized = cached(fn, c as Parameters<typeof cached>[1], (a, b) => `${a}+${b}`);
    expect(memoized(1, 2)).toBe(3);
    expect(memoized(1, 2)).toBe(3);
    expect(calls).toBe(1);
  });

  it("works with TTLCache", () => {
    const c = new TTLCache<string, number>({ maxSize: 10, ttl: 60000 });
    let calls = 0;
    const fn = (x: number) => { calls++; return x; };
    const memoized = cached(fn, c as Parameters<typeof cached>[1]);
    memoized(1); memoized(1);
    expect(calls).toBe(1);
  });
});
