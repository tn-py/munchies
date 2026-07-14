import { defineMiddleware, sequence } from "astro:middleware";
import config from "./config";
import { requestContext } from "./lib/context";

const excludedPaths = [
  "/api",
  "/images",
  "/icons",
  "/favicon.ico",
  "/favicon-inactive.ico",
  "/_astro",
  "/_image",
  "/_server-islands",
  "/cms",
];

function isExcludedPath(pathname: string): boolean {
  return excludedPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

const contextMiddleware = defineMiddleware((context, next) => {
  const tags = new Set<string>();
  return requestContext.run({ cookies: context.cookies, tags }, next);
});

const countryCodeMiddleware = defineMiddleware((context, next) => {
  const { pathname } = context.url;

  if (isExcludedPath(pathname)) {
    return next();
  }

  const parts = pathname.split("/").filter(Boolean);
  const firstPart = parts[0]?.toLowerCase();

  if (firstPart === config.defaultCountryCode) {
    const restPath = `/${parts.slice(1).join("/")}`;
    return context.redirect(restPath || "/", 308);
  }

  const hasCountryCode =
    firstPart && config.supportedCountryCodes.includes(firstPart);

  context.locals.countryCode = hasCountryCode
    ? firstPart
    : config.defaultCountryCode;
  context.locals.defaultCountryCode = config.defaultCountryCode;

  return next();
});

export const onRequest = sequence(contextMiddleware, countryCodeMiddleware);
