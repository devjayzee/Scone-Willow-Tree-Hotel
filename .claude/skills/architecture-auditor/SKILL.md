---
name: architecture-auditor
description: Architecture audit skill for evaluating codebase health, pattern compliance, and maintainability. Use when auditing existing systems for architectural consistency, SOLID violations, dependency issues, or technical debt assessment.
---

# Architecture Auditor Skill

This skill provides structured guidance for auditing existing codebases against industry-standard architectural principles and patterns. Adapted for Next.js App Router applications with React, Prisma, and modern TypeScript patterns.

## Quick Start

1. **Run core analysis scripts**:

```bash
# Core scripts (always run these first)
bash .claude/skills/architecture-auditor/scripts/check-circular-deps.sh src/
bash .claude/skills/architecture-auditor/scripts/analyze-structure.sh src/

# Metrics scripts (quantitative analysis)
bash .claude/skills/architecture-auditor/scripts/calculate-metrics.sh src/
bash .claude/skills/architecture-auditor/scripts/analyze-dependencies.sh src/

# Advanced scripts (optional, for deeper analysis)
bash .claude/skills/architecture-auditor/scripts/analyze-git-history.sh src/
bash .claude/skills/architecture-auditor/scripts/validate-adrs.sh docs/adr
```

2. **Use context7 MCP** for live, authoritative documentation:
   ```
   # Resolve library ID first
   context7.resolve-library-id("nextjs", "app router architecture")

   # Then query for specific guidance
   context7.query-docs("/vercel/next.js", "server components best practices")
   ```

3. **Cross-reference with static guides** (quick lookup):
   - SOLID Principles: See [references/solid-principles.md](references/solid-principles.md)
   - Code Smells: See [references/code-smells.md](references/code-smells.md)
   - DDD Patterns: See [references/ddd-patterns.md](references/ddd-patterns.md)
   - Next.js Architecture: See [references/nextjs-architecture.md](references/nextjs-architecture.md)

---

## Context7 MCP Integration

**IMPORTANT**: Always use context7 for authoritative, up-to-date documentation. Static references are for quick lookup only.

### When to Use Context7

| Scenario | Context7 Query |
|----------|----------------|
| Verifying Next.js patterns | `query-docs("/vercel/next.js", "app router best practices")` |
| Checking React patterns | `query-docs("/facebook/react", "server components")` |
| Checking Prisma patterns | `query-docs("/prisma/docs", "repository pattern")` |
| NextAuth.js patterns | `query-docs("/nextauthjs/next-auth", "session handling")` |

### Library IDs for Common Frameworks

| Framework | Context7 Library ID |
|-----------|---------------------|
| Next.js | `/vercel/next.js` |
| React | `/facebook/react` |
| Prisma | `/prisma/docs` |
| NextAuth.js | `/nextauthjs/next-auth` |
| Tailwind CSS | `/tailwindlabs/tailwindcss` |
| TypeScript | `/microsoft/typescript` |

### Context7 Workflow

```
1. Identify the technology in question
2. Resolve library ID: resolve-library-id("<library>", "<your question>")
3. Query documentation: query-docs("<library-id>", "<specific question>")
4. Cross-reference with static references for quick patterns
5. Provide recommendation based on authoritative source
```

### Example Usage

When auditing a Next.js API route with business logic:

```
# Step 1: Get live documentation
context7.resolve-library-id("nextjs", "api routes best practices")
→ Returns: /vercel/next.js

# Step 2: Query specific guidance
context7.query-docs("/vercel/next.js", "route handler patterns app router")
→ Returns: Current best practices from official docs

# Step 3: Cross-reference
Check references/nextjs-architecture.md for quick patterns

# Step 4: Provide finding with authoritative citation
```

## Audit Workflow

### Phase 1: Context Gathering

Before any audit, understand:

| Category        | Questions                                           |
| --------------- | --------------------------------------------------- |
| **Architecture** | App Router or Pages Router? Feature-based or layer-based? |
| **Boundaries**   | Primary features/domains? API route organization?   |
| **Constraints**  | Legacy components? Team size? Tech expertise?       |
| **Scope**        | Full audit or focused areas?                        |

### Phase 2: Automated Scanning

Run bundled scripts to identify high-risk areas:

| Script                       | Purpose                                    |
| ---------------------------- | ------------------------------------------ |
| `check-circular-deps.sh`     | Detect circular dependencies between modules |
| `analyze-structure.sh`       | Analyze project structure and file organization |
| `calculate-metrics.sh`       | Calculate Ca/Ce, Instability, LOC metrics |
| `analyze-dependencies.sh`    | Advanced dependency analysis (madge, dependency-cruiser) |
| `analyze-git-history.sh`     | Git churn and co-change analysis |
| `validate-adrs.sh`           | ADR validation and compliance |

### Phase 3: Manual Analysis

Focus manual review on:

1. **Component Boundaries** — Single responsibility, proper encapsulation
2. **Server/Client Split** — Correct use of 'use client' and Server Components
3. **API Route Layer** — Controllers → Services pattern, no direct DB in routes
4. **SOLID Violations** — Check against [references/solid-principles.md](references/solid-principles.md)
5. **Code Smells** — Check against [references/code-smells.md](references/code-smells.md)

### Phase 4: Reporting

For each finding include:

- **Severity**: Critical / High / Medium / Low
- **Principle Violated**: SOLID, DDD, or pattern reference
- **Impact**: How it affects maintainability/scalability/testability
- **Remediation**: Specific fix with code example

## Severity Classification

| Severity     | Qualitative Criteria                             | Quantitative Triggers                        |
| ------------ | ------------------------------------------------ | -------------------------------------------- |
| **Critical** | Blocks development, cascading failures           | CC>50, Ca>20, Circular deps                  |
| **High**     | Significant maintenance burden                   | CC>20, Ce>12, LOC>500, LCOM>0.7              |
| **Medium**   | Inconsistency, minor coupling                    | CC>10, Ce>8, LOC>300, LCOM>0.5               |
| **Low**      | Best practice deviations                         | Any warning-level threshold breach           |

See [references/architecture-metrics.md](references/architecture-metrics.md) for detailed threshold definitions.

## References

### Metrics & Standards

- **Architecture Metrics**: [references/architecture-metrics.md](references/architecture-metrics.md) — Quantitative thresholds (CC, Ca/Ce, LCOM, Instability)
- **ISO/IEC 25010 Quality Model**: [references/iso-25010-quality-model.md](references/iso-25010-quality-model.md) — Software quality characteristics mapping

### Principles & Patterns

- **SOLID Principles**: [references/solid-principles.md](references/solid-principles.md) — Robert C. Martin's design principles
- **Code Smells**: [references/code-smells.md](references/code-smells.md) — Martin Fowler's refactoring patterns
- **DDD Patterns**: [references/ddd-patterns.md](references/ddd-patterns.md) — Eric Evans' domain modeling
- **Next.js Architecture**: [references/nextjs-architecture.md](references/nextjs-architecture.md) — Framework-specific patterns

---

## Metric Interpretation Guide

### Quick Threshold Reference

| Metric              | Warning | Critical | What It Measures |
|---------------------|---------|----------|------------------|
| Cyclomatic Complexity| >10    | >20      | Decision paths in code |
| Function LOC        | >30     | >50      | Function size |
| File LOC            | >300    | >500     | File size |
| Fan-out (Ce)        | >8      | >12      | Dependencies used |
| Fan-in (Ca)         | >15     | >20      | Components depending on this |
| LCOM                | >0.5    | >0.7     | Lack of cohesion (0=cohesive) |
| Instability (I)     | Context | Context  | Ce/(Ca+Ce), 0=stable, 1=unstable |

### Instability Index Decision Table

| Module Type      | Target I | If Current > Target | Action |
|------------------|----------|---------------------|--------|
| Lib/Utils        | 0.0-0.3  | >0.5                | Extract interfaces, reduce deps |
| Components       | 0.3-0.7  | >0.8                | Review coupling, add abstractions |
| API Routes       | 0.7-1.0  | N/A                 | Expected to be unstable |
| Pages            | 0.8-1.0  | N/A                 | Expected to be unstable |

### Churn × Complexity Priority Matrix

```
                    High Complexity
                          │
        ┌─────────────────┼─────────────────┐
        │  Refactor       │   PRIORITY      │
        │  Candidates     │   REFACTORING   │
        │  (Low churn,    │   (High churn,  │
        │   high complex) │    high complex)│
        ├─────────────────┼─────────────────┤
        │  Ignore         │   Monitor       │
        │  (Low churn,    │   (High churn,  │
        │   low complex)  │    low complex) │
        └─────────────────┼─────────────────┘
                          │
                    Low Complexity
        Low Churn ────────┴──────── High Churn
```

### ISO/IEC 25010 Finding Template

Every finding should include quality characteristic mapping:

```markdown
### Finding: [Title]

**Severity**: Critical/High/Medium/Low
**Metrics**: CC=X, Ce=X, LOC=X

**Quality Characteristic**: [Maintainability/Reliability/etc.]
**Sub-characteristic**: [Modularity/Testability/etc.]
**Impact**: [How this degrades the quality attribute]

**Location**: `path/to/file.ts:42-88`
**Current State**: [Code snippet]
**Recommended Fix**: [Solution]
```

## External Resources

For deeper study, consult:

- [Clean Code by Robert C. Martin](https://cleancoders.com/episode/clean-code-episode-8)
- [Refactoring Catalog by Martin Fowler](https://refactoring.com/catalog/)
- [DDD Reference by Eric Evans](https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf)
- [Next.js Official Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev/)
