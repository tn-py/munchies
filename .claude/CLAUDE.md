# Ultracite Code Standards

This project uses **Ultracite**, a zero-config preset that enforces strict code quality standards through automated formatting and linting.

## Quick Reference

- **Format code**: `pnpm dlx ultracite fix`
- **Check for issues**: `pnpm dlx ultracite check`
- **Diagnose setup**: `pnpm dlx ultracite doctor`

Biome (the underlying engine) provides robust linting and formatting. Most issues are automatically fixable.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Use proper image components (e.g., Astro `<Image>`) over `<img>` tags

### Framework-Specific Guidance

**React 19+:**

- Use ref as a prop instead of `React.forwardRef`

**Solid/Svelte/Vue/Qwik/Astro:**

- Use `class` and `for` attributes (not `className` or `htmlFor`)

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Biome Can't Help

Biome's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Biome can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Biome. Run `pnpm dlx ultracite fix` before committing to ensure compliance.

---

# Project Context — Best Vapes

This is a **vape e-commerce store** (rebranded from the Munchies demo template). The stack is Medusa v2 + Astro 5 + Sanity, running locally via Docker Compose.

## Running Locally

```bash
docker compose up -d          # start all 4 containers
docker compose logs -f medusa # watch backend logs
```

After a fresh DB wipe + reseed, force-recreate containers to reload `.env`:
```bash
docker compose up -d --force-recreate medusa
docker compose up -d --force-recreate web
```

> **Never use `docker restart`** for env changes — it reuses the original container config and ignores `.env` edits. Always use `--force-recreate`.

## Key Gotchas

### Prices are in whole display dollars
`amount: 15` → displays as `$15.00`. The `convertToLocale` utility in `apps/web/src/lib/utils/medusa/money.ts` passes amounts directly to `Intl.NumberFormat` without dividing by 100. Set seed prices accordingly.

### Sanity write access requires the editor token
The `SANITY_TOKEN` / `SANITY_API_TOKEN` used in both apps must be the **editor token** (`sk3e0q7...`). The viewer token (`skdz...`) is read-only for `production` — mutations and product syncs will return 401 errors silently.

### Sanity sync targets `production`
`@tinloof/medusa-sanity-sync` in `medusa-config.ts` is set to `dataset: "production"`. After seeding, touch products via the admin API to fire `product.updated` and trigger the sync.

### `workerd` needs `libc++1`
The dev Dockerfile uses `node:20-slim` + `apt-get install libc++1`. Do not switch to Alpine — `workerd` silently fails without glibc.

### Web container uses `network_mode: host`
`wrangler` reads `MEDUSA_BACKEND_URL` from the `.env` file at request time, bypassing the container's `process.env`. Host networking makes `http://localhost:9000` resolve to the Medusa container's mapped port.

## Sanity Home Page Sections

Sections are managed via the Sanity Studio at `/cms` or the Mutations API. Available types:
`section.hero`, `section.marquee`, `section.centeredText`, `section.featuredProducts`,
`section.assurance`, `section.collectionList`, `section.mediaText`, `section.testimonials`, `section.shopTheLook`

The `section.featuredProducts` section supports two modes:
- **Collection ref** (preferred): set `collection._ref` to a Medusa collection ID → products load dynamically
- **Products array** (manual fallback): list individual Sanity product `_ref` values

## Re-seeding

```bash
# Wipe DB
docker exec munchies-postgres psql -U medusa -d medusa_munchies \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO medusa, public;"

# Restart (runs migrations on boot)
docker compose up -d --force-recreate medusa

# Seed
docker exec munchies-medusa sh -c "cd /app/apps/medusa-backend && pnpm seed"

# Re-create admin user
docker exec munchies-medusa sh -c "cd /app/apps/medusa-backend && pnpm add-user"

# Update publishable key in both .env files after seed
```

## Product Images

Generate at **1000×1000 px** (1:1 square). Upload via Medusa admin → Products → Media tab.
