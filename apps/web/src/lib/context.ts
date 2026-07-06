import { AsyncLocalStorage } from "node:async_hooks";
import type { AstroCookies } from "astro";

export interface RequestContext {
  cookies: AstroCookies;
  tags: Set<string>;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export const getCookies = () => requestContext.getStore()?.cookies;
export const getTags = () => requestContext.getStore()?.tags;

export function addTags(tags: string[]) {
  const store = requestContext.getStore();

  if (store) {
    for (const tag of tags) {
      store.tags.add(tag);
    }
  }
}
