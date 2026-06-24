# cachetools

[![All Contributors](https://img.shields.io/badge/all_contributors-1-orange.svg?style=flat-square)](#contributors-)

> Zero-dependency multi-strategy cache for TypeScript and JavaScript.
> LRU · LFU · TTL · TLRU (TTL+LRU) · memoization helper

TypeScript port of Python's [cachetools](https://pypi.org/project/cachetools/) (60M+ downloads/month). Choose the eviction strategy that fits your use case without installing a single runtime dependency.

[![npm](https://img.shields.io/npm/v/@billdaddy/cachetools)](https://www.npmjs.com/package/@billdaddy/cachetools)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Install

```bash
npm install @billdaddy/cachetools
```

## Strategies at a glance

| Class | Eviction policy | When to use |
|---|---|---|
| `LRUCache` | Least Recently Used | General purpose — discard what hasn't been accessed |
| `LFUCache` | Least Frequently Used | Long-lived caches — keep hot items regardless of recency |
| `TTLCache` | Time-To-Live (expiry) | Token caches, session data, anything that goes stale |
| `TLRUCache` | TTL + LRU combined | Hot paths that also have hard expiry requirements |
| `cached()` | n/a (wrapper) | Memoize any function with any of the above caches |

## LRUCache

```typescript
import { LRUCache } from "@billdaddy/cachetools";

const cache = new LRUCache<string, number>({ maxSize: 100 });

cache.set("a", 1);
cache.set("b", 2);
cache.get("a");          // 1 — marks "a" as recently used
cache.has("b");          // true
cache.peek("b");         // 2 — does NOT update recency
cache.delete("b");       // true
cache.size;              // 1
cache.keys();            // ["a"] — most-recent first
```

Backed by a doubly-linked list + Map for **O(1)** get, set, delete.

```typescript
const cache = new LRUCache<string, string>({
  maxSize: 1000,
  onEvict: (key, value) => console.log(`evicted ${key}`),
});
```

## LFUCache

```typescript
import { LFUCache } from "@billdaddy/cachetools";

const cache = new LFUCache<string, number>({ maxSize: 3 });

cache.set("a", 1);  // freq("a") = 1
cache.set("b", 2);  // freq("b") = 1
cache.get("a");     // freq("a") = 2
cache.get("a");     // freq("a") = 3
cache.set("c", 3);  // freq("c") = 1
cache.set("d", 4);  // evicts "b" or "c" (lowest freq = 1, LRU tiebreak)
```

Uses the O(1) LFU algorithm (Shah et al. 2010). Ties within the same frequency bucket are broken by LRU order.

## TTLCache

```typescript
import { TTLCache } from "@billdaddy/cachetools";

const cache = new TTLCache<string, string>({
  maxSize: 500,
  ttl: 5 * 60 * 1000,  // 5 minutes
});

cache.set("session:abc", userData);
// 5 minutes later:
cache.get("session:abc");  // undefined — expired

cache.remainingTTL("session:abc");  // ms until expiry, or -1 if expired/missing
cache.expire();                     // manually prune all expired entries
```

Expired entries are lazily removed on access. Call `expire()` periodically if you need proactive cleanup.

## TLRUCache — TTL + LRU combined

```typescript
import { TLRUCache } from "@billdaddy/cachetools";

const cache = new TLRUCache<string, Response>({
  maxSize: 200,
  ttl: 30_000,  // 30 seconds
});

cache.set("/api/users", usersResponse);
cache.get("/api/users");         // refreshes LRU position, but NOT the TTL
cache.remainingTTL("/api/users"); // ms until hard expiry
```

Evicts by LRU on capacity overflow; entries also hard-expire after `ttl` ms.

## cached() — memoize any function

```typescript
import { cached, LRUCache, TTLCache } from "@billdaddy/cachetools";

// Sync function with LRU cache
const lru = new LRUCache<string, number>({ maxSize: 100 });
const factorial = cached((n: number): number => n <= 1 ? 1 : n * factorial(n - 1), lru);
factorial(10);  // computed
factorial(10);  // cached

// Async function with TTL cache — results expire after 60 seconds
const ttl = new TTLCache<string, User>({ maxSize: 500, ttl: 60_000 });
const getUser = cached(
  async (id: string) => fetchUserFromDB(id),
  ttl,
  (id) => `user:${id}`,  // optional custom key function
);
await getUser("u1");  // fetches DB
await getUser("u1");  // returns cached
```

## Comparison with alternatives

| Package | Zero deps | TypeScript | LRU | LFU | TTL | TLRU |
|---|---|---|---|---|---|---|
| **cachetools** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| lru-cache | ❌ (3 deps) | ✅ | ✅ | ❌ | ✅ | ❌ |
| quick-lru | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| tiny-lru | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ |
| Python cachetools | n/a | n/a | ✅ | ✅ | ✅ | ✅ |

## API Reference

### LRUCache / LFUCache

```typescript
new LRUCache<K, V>({ maxSize: number, onEvict?: (key: K, value: V) => void })
new LFUCache<K, V>({ maxSize: number, onEvict?: (key: K, value: V) => void })

.get(key): V | undefined      // get + update recency/frequency
.set(key, value): this        // set + evict if over capacity
.has(key): boolean            // membership check (no side effects for LFU peek)
.peek(key): V | undefined     // get WITHOUT updating recency/frequency
.delete(key): boolean
.clear(): void
.size: number
.maxSize: number
.keys(): K[]
.values(): V[]
.entries(): [K, V][]
[Symbol.iterator](): Iterator<[K, V]>
```

### TTLCache / TLRUCache

```typescript
new TTLCache<K, V>({ maxSize, ttl, onEvict?, clock? })
new TLRUCache<K, V>({ maxSize, ttl, onEvict?, clock? })

.get(key): V | undefined
.set(key, value): this
.has(key): boolean            // false if key is expired
.peek(key): V | undefined     // bypasses expiry check
.delete(key): boolean
.clear(): void
.expire(): void               // manually prune expired entries
.remainingTTL(key): number    // ms remaining, or -1 if expired/missing
.size: number
.ttl: number
.maxSize: number
.keys(): K[]                  // live entries only
.entries(): [K, V][]
[Symbol.iterator](): Iterator<[K, V]>
```

### cached()

```typescript
function cached<Args, R>(
  fn: (...args: Args) => R,
  cache: { get, set, has },
  keyFn?: (...args: Args) => string,   // default: JSON.stringify(args)
): (...args: Args) => R
```

## Contributors ✨

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind are welcome — code, docs, bug reports, ideas, reviews! See the [emoji key](https://allcontributors.org/docs/en/emoji-key) for how each contribution is recognized, and open a PR or issue to get involved.

Thanks goes to these wonderful people:

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/trananhtung"><img src="https://avatars.githubusercontent.com/u/30992229?v=4?s=100" width="100px;" alt="Tung Tran"/><br /><sub><b>Tung Tran</b></sub></a><br /><a href="https://github.com/trananhtung/./commits?author=trananhtung" title="Code">💻</a> <a href="#maintenance-trananhtung" title="Maintenance">🚧</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

## License

MIT © [trananhtung](https://github.com/trananhtung)
