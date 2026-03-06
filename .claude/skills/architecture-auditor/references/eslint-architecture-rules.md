# ESLint Architecture Rules Reference

Configure ESLint to enforce architectural constraints automatically. This reference covers plugins and rules for maintaining code quality and module boundaries.

---

## Quick Setup

```bash
# Install recommended plugins
npm install -D eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
npm install -D eslint-plugin-import eslint-plugin-boundaries
npm install -D eslint-plugin-sonarjs  # Cognitive complexity

# NestJS-specific (optional)
npm install -D @darraghor/eslint-plugin-nestjs-typed
```

---

## Recommended Configuration

### Base Configuration (eslint.config.js - Flat Config)

```javascript
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import boundaries from 'eslint-plugin-boundaries';
import sonarjs from 'eslint-plugin-sonarjs';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      import: importPlugin,
      boundaries: boundaries,
      sonarjs: sonarjs,
    },
    rules: {
      // Complexity rules
      'complexity': ['warn', 10],
      'max-depth': ['warn', 3],
      'max-lines-per-function': ['warn', { max: 50, skipBlankLines: true, skipComments: true }],
      'max-params': ['warn', 4],
      'sonarjs/cognitive-complexity': ['warn', 15],

      // Import organization
      'import/order': ['error', {
        'groups': ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
        'alphabetize': { order: 'asc' }
      }],
      'import/no-cycle': 'error',
      'import/no-self-import': 'error',

      // TypeScript specific
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    }
  }
);
```

### Legacy Configuration (.eslintrc.js)

```javascript
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    sourceType: 'module',
  },
  plugins: [
    '@typescript-eslint',
    'import',
    'boundaries',
    'sonarjs',
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:sonarjs/recommended',
  ],
  rules: {
    // See rules below
  },
};
```

---

## Complexity Rules

### Cyclomatic Complexity

```javascript
// Built-in ESLint rule
'complexity': ['warn', 10],  // Warning at 10, matches our threshold

// More granular with SonarJS
'sonarjs/cognitive-complexity': ['warn', 15],
```

**Thresholds alignment:**
| Metric | Warning | Critical | ESLint Config |
|--------|---------|----------|---------------|
| Cyclomatic | >10 | >20 | `'complexity': ['warn', 10]` |
| Cognitive | >15 | >25 | `'sonarjs/cognitive-complexity': ['warn', 15]` |

### Function Size

```javascript
'max-lines-per-function': ['warn', {
  max: 50,              // Critical threshold from metrics
  skipBlankLines: true,
  skipComments: true,
  IIFEs: true,
}],

'max-statements': ['warn', 15],  // Statements per function
'max-depth': ['warn', 3],        // Nesting depth
'max-params': ['warn', 4],       // Parameter count (warning at 4)
```

### File Size

```javascript
'max-lines': ['warn', {
  max: 300,             // Warning threshold
  skipBlankLines: true,
  skipComments: true,
}],
```

---

## Import Rules (eslint-plugin-import)

### Prevent Circular Dependencies

```javascript
'import/no-cycle': ['error', { maxDepth: 3 }],
'import/no-self-import': 'error',
```

### Enforce Import Order

```javascript
'import/order': ['error', {
  'groups': [
    'builtin',      // Node.js built-ins
    'external',     // npm packages
    'internal',     // Aliased imports (@/*)
    'parent',       // ../
    'sibling',      // ./
    'index',        // ./index
    'type',         // Type imports
  ],
  'pathGroups': [
    {
      pattern: '@nestjs/**',
      group: 'external',
      position: 'before',
    },
    {
      pattern: '@/**',
      group: 'internal',
    },
  ],
  'newlines-between': 'always',
  'alphabetize': {
    order: 'asc',
    caseInsensitive: true,
  },
}],
```

### Prevent Problematic Imports

```javascript
'import/no-unresolved': 'error',
'import/no-extraneous-dependencies': ['error', {
  devDependencies: ['**/*.spec.ts', '**/*.test.ts', '**/test/**'],
}],
'import/no-mutable-exports': 'error',
'import/no-default-export': 'warn',  // Prefer named exports
```

---

## Module Boundaries (eslint-plugin-boundaries)

### Configuration

```javascript
// In eslint.config.js or .eslintrc.js
settings: {
  'boundaries/elements': [
    { type: 'auth', pattern: 'src/auth/*' },
    { type: 'users', pattern: 'src/users/*' },
    { type: 'creators', pattern: 'src/creators/*' },
    { type: 'dashboard', pattern: 'src/dashboard/*' },
    { type: 'common', pattern: 'src/common/*' },
    { type: 'prisma', pattern: 'src/prisma/*' },
  ],
  'boundaries/ignore': ['**/*.spec.ts', '**/*.test.ts'],
},
rules: {
  'boundaries/element-types': ['error', {
    default: 'disallow',
    rules: [
      // Common can be imported by anyone
      { from: '*', allow: ['common', 'prisma'] },

      // Auth module rules
      { from: 'auth', allow: ['users'] },

      // Users module rules
      { from: 'users', allow: ['auth'] },  // Allow if needed, or remove

      // Dashboard can import from domain modules
      { from: 'dashboard', allow: ['users', 'creators'] },
    ],
  }],
  'boundaries/no-unknown': 'error',
  'boundaries/no-private': 'error',
}
```

### Visualizing Allowed Dependencies

```
┌─────────────────────────────────────────┐
│                 common                   │
│              (shared utils)              │
└─────────────────────────────────────────┘
                    ▲
                    │ (all modules can import)
    ┌───────────────┼───────────────┐
    │               │               │
┌───┴───┐     ┌─────┴─────┐    ┌────┴────┐
│  auth │ ──► │   users   │    │ creators│
└───────┘     └───────────┘    └─────────┘
                    ▲               ▲
                    │               │
                ┌───┴───────────────┴───┐
                │       dashboard       │
                └───────────────────────┘
```

---

## NestJS-Specific Rules (@darraghor/eslint-plugin-nestjs-typed)

### Installation

```bash
npm install -D @darraghor/eslint-plugin-nestjs-typed
```

### Configuration

```javascript
extends: [
  'plugin:@darraghor/nestjs-typed/recommended',
],
rules: {
  // Enforce return types on controllers
  '@darraghor/nestjs-typed/api-method-should-specify-api-response': 'warn',

  // Ensure DTOs have validation decorators
  '@darraghor/nestjs-typed/validated-non-primitive-property-needs-type-decorator': 'error',

  // Injectable classes should use DI
  '@darraghor/nestjs-typed/injectable-should-be-provided': 'warn',

  // Prevent parameter property issues
  '@darraghor/nestjs-typed/param-decorator-name-matches-route-param': 'error',
}
```

### Key NestJS Rules

| Rule | Purpose |
|------|---------|
| `api-method-should-specify-api-response` | Ensure Swagger responses are documented |
| `validated-non-primitive-property-needs-type-decorator` | Require @Type() for nested DTOs |
| `injectable-should-be-provided` | Verify injectables are in module providers |
| `controllers-should-supply-api-tags` | Require @ApiTags() on controllers |

---

## SonarJS Rules (Code Smells)

### Recommended Rules

```javascript
extends: ['plugin:sonarjs/recommended'],
rules: {
  // Cognitive complexity (more intuitive than cyclomatic)
  'sonarjs/cognitive-complexity': ['warn', 15],

  // Code smells
  'sonarjs/no-duplicate-string': ['warn', { threshold: 3 }],
  'sonarjs/no-identical-functions': 'error',
  'sonarjs/no-collapsible-if': 'warn',
  'sonarjs/no-redundant-jump': 'error',
  'sonarjs/no-small-switch': 'warn',
  'sonarjs/prefer-immediate-return': 'warn',
  'sonarjs/prefer-single-boolean-return': 'warn',

  // Security-related
  'sonarjs/no-hardcoded-credentials': 'error',
}
```

### SonarJS Rule Mapping to Code Smells

| Code Smell | SonarJS Rule |
|------------|--------------|
| Duplicated Code | `no-duplicate-string`, `no-identical-functions` |
| Long Method | `cognitive-complexity` |
| Complex Conditionals | `no-collapsible-if`, `prefer-single-boolean-return` |
| Dead Code | `no-redundant-jump` |

---

## TypeScript-ESLint Rules

### Strict Type Checking

```javascript
'@typescript-eslint/strict-boolean-expressions': 'warn',
'@typescript-eslint/no-floating-promises': 'error',
'@typescript-eslint/no-misused-promises': 'error',
'@typescript-eslint/await-thenable': 'error',
'@typescript-eslint/no-unnecessary-type-assertion': 'warn',
```

### Code Quality

```javascript
'@typescript-eslint/no-unused-vars': ['error', {
  argsIgnorePattern: '^_',
  varsIgnorePattern: '^_',
}],
'@typescript-eslint/explicit-member-accessibility': ['warn', {
  accessibility: 'explicit',
  overrides: { constructors: 'no-public' },
}],
'@typescript-eslint/member-ordering': ['warn', {
  default: [
    'static-field',
    'instance-field',
    'constructor',
    'static-method',
    'instance-method',
  ],
}],
```

---

## Pre-commit Hook Integration

### Using lint-staged

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix --max-warnings=0"
    ]
  }
}
```

### Using Husky

```bash
npm install -D husky lint-staged
npx husky init
echo "npx lint-staged" > .husky/pre-commit
```

---

## CI Integration

### GitHub Actions

```yaml
# .github/workflows/lint.yml
name: Lint
on: [push, pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run lint -- --max-warnings=0
```

---

## Complete Example Configuration

```javascript
// eslint.config.js (Flat Config - ESLint 9+)
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import sonarjs from 'eslint-plugin-sonarjs';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    plugins: {
      import: importPlugin,
      sonarjs: sonarjs,
    },
    rules: {
      // === Complexity (matches architecture-metrics.md) ===
      'complexity': ['warn', 10],
      'max-depth': ['warn', 3],
      'max-lines-per-function': ['warn', { max: 50, skipBlankLines: true, skipComments: true }],
      'max-lines': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-params': ['warn', 4],
      'sonarjs/cognitive-complexity': ['warn', 15],

      // === Imports ===
      'import/no-cycle': ['error', { maxDepth: 3 }],
      'import/no-self-import': 'error',
      'import/order': ['error', {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
      }],

      // === Code Smells ===
      'sonarjs/no-duplicate-string': ['warn', { threshold: 3 }],
      'sonarjs/no-identical-functions': 'error',

      // === TypeScript ===
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/*.spec.ts'],
  }
);
```

---

## Threshold Alignment Summary

| Metric | architecture-metrics.md | ESLint Rule | Config Value |
|--------|------------------------|-------------|--------------|
| Cyclomatic Complexity | Warning >10 | `complexity` | 10 |
| Cognitive Complexity | Warning >15 | `sonarjs/cognitive-complexity` | 15 |
| Function LOC | Warning >30, Critical >50 | `max-lines-per-function` | 50 |
| File LOC | Warning >300, Critical >500 | `max-lines` | 300 |
| Parameter Count | Warning >4 | `max-params` | 4 |
| Nesting Depth | Warning >3 | `max-depth` | 3 |
| Circular Deps | Critical >0 | `import/no-cycle` | error |

---

## References

- [ESLint Rules Reference](https://eslint.org/docs/rules/)
- [typescript-eslint Rules](https://typescript-eslint.io/rules/)
- [eslint-plugin-import](https://github.com/import-js/eslint-plugin-import)
- [eslint-plugin-boundaries](https://github.com/javierbrea/eslint-plugin-boundaries)
- [eslint-plugin-sonarjs](https://github.com/SonarSource/eslint-plugin-sonarjs)
- [@darraghor/eslint-plugin-nestjs-typed](https://github.com/darraghor/eslint-plugin-nestjs-typed)
