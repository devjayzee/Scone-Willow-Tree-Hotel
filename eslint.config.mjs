import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Rule 6 (form-patterns): react-hook-form is intentionally NOT a dependency.
// Reused in every no-restricted-imports block below because flat-config
// overrides REPLACE rule options rather than merging them.
const rhfMessage =
  "Rule 6: react-hook-form is intentionally NOT a dependency. Use custom `use-<domain>-form.ts` hooks (.claude/rules/form-patterns.md).";
const rhfPaths = [
  { name: "react-hook-form", message: rhfMessage },
  { name: "@hookform/resolvers", message: rhfMessage },
  { name: "@hookform/resolvers/zod", message: rhfMessage },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),

  // Global baseline: Rule 6 everywhere. Overridden (and re-included) by the
  // file-scoped blocks below.
  {
    rules: {
      "no-restricted-imports": ["error", { paths: rhfPaths }],
      // Honor the `_` prefix as "intentionally unused" for args, vars, and
      // destructured names. Standard convention; unblocks the "destructure
      // to remove a field" pattern used in validation tests.
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
    },
  },

  // Rule 1 (api-route-delegation): API routes cannot use Prisma directly.
  // Value imports of prisma or @prisma/client are denied; type imports are allowed.
  {
    files: ["src/app/api/**/*.ts"],
    ignores: ["src/app/api/auth/**"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [
          ...rhfPaths,
          {
            name: "@/lib/prisma",
            message: "Rule 1: API routes delegate — move Prisma calls into src/lib/services/. Routes are: auth → zod → one service call → handleApiError (.claude/rules/api-route-delegation.md).",
          },
        ],
        patterns: [
          {
            group: ["@prisma/client", "@prisma/client/*"],
            message: "Rule 1: API routes must not use @prisma/client at runtime. Delegate to a service. Type-only imports are allowed.",
            allowTypeImports: true,
          },
        ],
      }],
    },
  },

  // Rule 2 (service-layer): services are HTTP- and session-free.
  {
    files: ["src/lib/services/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [
          ...rhfPaths,
          {
            name: "next/server",
            message: "Rule 2: services are HTTP-free. Return domain values / throw domain errors from @/lib/errors; the API route shapes the response (.claude/rules/service-layer.md).",
          },
          {
            name: "next-auth",
            message: "Rule 2: services are session-free. Pass caller identity in as arguments (e.g. userId: string). Session reads belong in the route handler.",
          },
          {
            name: "next-auth/react",
            message: "Rule 2: services are session-free. Pass caller identity in as arguments (e.g. userId: string).",
          },
        ],
      }],
    },
  },

  // Rules 2 converse / 5 / 7 (client-side boundaries):
  // - Rule 2 converse: @/lib/prisma may only be imported by services + auth + tests
  // - Rule 5: components never call fetch — belongs in src/hooks/<domain>/*-api.ts
  // - Rule 7: services never imported by client components
  {
    files: ["src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [
          ...rhfPaths,
          {
            name: "@/lib/prisma",
            message: "Rule 2: Prisma only lives in src/lib/services/. Client code goes through /api routes via TanStack hooks (.claude/rules/service-layer.md).",
          },
        ],
        patterns: [
          {
            group: ["@/lib/services/*", "@/lib/services/**/*"],
            message: "Rule 7: components must not import services. Fetch server data from a page (server component) and pass it in, or use a TanStack hook (.claude/rules/rsc-boundary.md).",
          },
        ],
      }],
      "no-restricted-syntax": ["error", {
        selector: "CallExpression[callee.name='fetch']",
        message: "Rule 5: components never call fetch. Move the call to src/hooks/<domain>/<domain>-api.ts and consume it via a TanStack Query hook (.claude/rules/server-state-tanstack.md).",
      }],
    },
  },

  // Rule 2 converse for hooks: Prisma may not be imported from client hooks.
  // Hooks talk to the server via /api routes (through *-api.ts wrappers), not Prisma directly.
  {
    files: ["src/hooks/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [
          ...rhfPaths,
          {
            name: "@/lib/prisma",
            message: "Rule 2: Prisma only lives in src/lib/services/. Hooks go through /api routes via *-api.ts fetch wrappers.",
          },
        ],
      }],
    },
  },
]);

export default eslintConfig;
