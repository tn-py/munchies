import { addTags } from "./context";

const BUILD_VERSION = import.meta.env.BUILD_VERSION;
const cache = new Map<string, unknown>();
const keysByTag = new Map<string, Set<string>>();

export function invalidateTags(tags: string[]): number {
  const keys = new Set<string>();

  for (const tag of tags) {
    for (const key of keysByTag.get(tag) ?? []) {
      keys.add(key);
    }
    keysByTag.delete(tag);
  }

  for (const key of keys) {
    cache.delete(key);
  }

  return keys.size;
}

export function withCache<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>,
  tagsOption: string[] | ((...args: Args) => string[])
): (...args: Args) => Promise<T> {
  const fnKey = fn.toString();

  return async (...args: Args): Promise<T> => {
    const tags =
      typeof tagsOption === "function" ? tagsOption(...args) : tagsOption;
    const key = `v${BUILD_VERSION}-${fnKey}-${tags.join(",")}-${JSON.stringify(args)}`;

    addTags(tags);

    if (cache.has(key)) {
      return cache.get(key) as T;
    }

    const data = await fn(...args);
    cache.set(key, data);

    for (const tag of tags) {
      const keys = keysByTag.get(tag) ?? new Set<string>();
      keys.add(key);
      keysByTag.set(tag, keys);
    }

    return data;
  };
}
