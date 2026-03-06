# Architecture Metrics Reference

Quantitative thresholds for objective architectural assessment. Use these metrics to provide evidence-based findings rather than subjective judgments.

---

## Quick Reference Table

| Metric | Warning | Critical | Tool/Method |
|--------|---------|----------|-------------|
| Cyclomatic Complexity (CC) | >10 | >20 | ts-complexity, ESLint |
| Cognitive Complexity | >15 | >25 | SonarQube, ESLint |
| Function LOC | >30 | >50 | Manual count |
| File LOC | >300 | >500 | `wc -l` |
| Class LOC | >200 | >400 | Manual count |
| Fan-out (imports) | >8 | >12 | Import count |
| Fan-in (dependents) | >15 | >20 | Grep reverse lookup |
| Instability Index (I) | Context-dependent | See below | Ca/(Ca+Ce) |
| LCOM (Lack of Cohesion) | >0.5 | >0.8 | Method/field analysis |
| Module imports | >5 | >10 | NestJS module analysis |
| forwardRef usage | >1 | >3 | Grep count |
| Parameter count | >4 | >6 | Manual count |
| Nesting depth | >3 | >5 | Manual inspection |
| Dependency tree depth | >4 | >6 | madge |

---

## Complexity Metrics

### Cyclomatic Complexity (CC)

Measures the number of linearly independent paths through code.

**Calculation**: `CC = E - N + 2P`
- E = edges in control flow graph
- N = nodes in control flow graph
- P = connected components (usually 1)

**Simplified counting**: Start at 1, add 1 for each:
- `if`, `else if`, `case`
- `for`, `while`, `do-while`
- `&&`, `||` in conditions
- `catch` block
- `?:` ternary operator

**Thresholds**:
| CC | Risk Level | Action |
|----|------------|--------|
| 1-10 | Low | Acceptable |
| 11-20 | Moderate | Consider refactoring |
| 21-50 | High | Must refactor |
| >50 | Critical | Immediate attention |

**NestJS Context**:
- Service methods: Target CC < 10
- Controllers: Target CC < 5 (should delegate to services)
- Guards/Interceptors: Target CC < 8

### Cognitive Complexity

Measures how difficult code is to understand (more intuitive than CC).

**Adds complexity for**:
- Nested control structures (incremental penalty)
- Breaks in linear flow
- Recursion

**Thresholds**:
| Cognitive | Interpretation |
|-----------|----------------|
| 1-15 | Easy to understand |
| 16-25 | Requires careful reading |
| >25 | Too complex, refactor |

---

## Size Metrics

### Lines of Code (LOC)

**By component type**:

| Component | Warning | Critical | Rationale |
|-----------|---------|----------|-----------|
| Function/Method | >30 | >50 | Single responsibility |
| Class | >200 | >400 | Cohesion limit |
| File | >300 | >500 | Cognitive load |
| Module (NestJS) | >500 | >800 | Bounded context size |

**Exclusions** (don't count):
- Blank lines
- Comment-only lines
- Import statements
- Type definitions (interfaces, types)

### Method Count per Class

| Count | Assessment |
|-------|------------|
| 1-7 | Healthy |
| 8-15 | Review for SRP violations |
| >15 | Likely violates SRP |

---

## Coupling Metrics

### Afferent Coupling (Ca) - Fan-in

Number of classes/modules that depend on this component.

**High Ca indicates**:
- Core/shared component
- Changes have wide impact
- Should be stable (low volatility)

**Thresholds**:
| Ca | Interpretation |
|----|----------------|
| 0-5 | Leaf component |
| 6-15 | Moderate coupling |
| >15 | High coupling - ensure stability |
| >20 | Critical - consider if appropriate |

### Efferent Coupling (Ce) - Fan-out

Number of classes/modules this component depends on.

**High Ce indicates**:
- Many dependencies
- Fragile to changes
- Consider dependency injection

**Thresholds**:
| Ce | Interpretation |
|----|----------------|
| 0-4 | Low coupling |
| 5-8 | Moderate coupling |
| >8 | High coupling - review |
| >12 | Critical - refactor |

### Instability Index (I)

**Formula**: `I = Ce / (Ca + Ce)`

**Range**: 0 (maximally stable) to 1 (maximally unstable)

**Target by layer**:

| Layer | Target I | Rationale |
|-------|----------|-----------|
| Domain/Core | 0.0-0.3 | Should be stable, few dependencies |
| Application/Services | 0.3-0.7 | Balanced |
| Infrastructure | 0.7-1.0 | Depends on many, few depend on it |
| Controllers | 0.8-1.0 | Entry points, highly unstable |

**Stable Dependencies Principle**: Components should depend on components more stable than themselves.

**Violation detection**:
```
If component A depends on component B:
  I(A) should be >= I(B)

Violation: I(A) < I(B) means stable depends on unstable
```

### Abstractness (A)

**Formula**: `A = Abstract classes / Total classes`

**Range**: 0 (concrete) to 1 (abstract)

### Distance from Main Sequence (D)

**Formula**: `D = |A + I - 1|`

**Interpretation**:
| D | Zone |
|---|------|
| 0 | Ideal - on main sequence |
| <0.3 | Acceptable |
| 0.3-0.5 | Review needed |
| >0.5 | Zone of Pain (too rigid) or Zone of Uselessness (too abstract) |

---

## Cohesion Metrics

### LCOM (Lack of Cohesion of Methods)

Measures how related methods are within a class.

**Simplified calculation**:
```
LCOM = 1 - (sum of methods using each field) / (methods * fields)
```

**Thresholds**:
| LCOM | Interpretation |
|------|----------------|
| 0-0.3 | High cohesion (good) |
| 0.3-0.5 | Moderate cohesion |
| 0.5-0.7 | Low cohesion - consider splitting |
| >0.7 | Very low cohesion - likely violates SRP |

**Signs of low cohesion**:
- Methods that don't use instance fields
- Distinct groups of methods using different fields
- God class symptoms

### Relational Cohesion (H)

**Formula**: `H = (R + 1) / N`
- R = number of internal relationships
- N = number of types in module

**Target**: H > 1.5 indicates good cohesion

---

## NestJS-Specific Metrics

### Module Health

| Metric | Warning | Critical |
|--------|---------|----------|
| Providers per module | >10 | >15 |
| Imports per module | >5 | >10 |
| Exports per module | >8 | >12 |
| Controllers per module | >3 | >5 |
| forwardRef count | >1 | >3 |

### Service Health

| Metric | Warning | Critical |
|--------|---------|----------|
| Injected dependencies | >5 | >8 |
| Public methods | >10 | >15 |
| Lines of code | >300 | >500 |

### Controller Health

| Metric | Warning | Critical |
|--------|---------|----------|
| Routes per controller | >10 | >15 |
| Injected services | >3 | >5 |
| Lines per route handler | >20 | >30 |

---

## Churn Metrics (Git History)

### Change Frequency

| Commits/Month | Interpretation |
|---------------|----------------|
| 0-2 | Stable |
| 3-10 | Active development |
| >10 | Hotspot - review for issues |

### Churn × Complexity Quadrant

```
High Complexity
     │
  ┌──┴──────────────┐
  │ Refactor        │ Prioritize
  │ Candidates      │ Refactoring
  │ (Low churn,     │ (High churn,
  │  high complex)  │  high complex)
  ├─────────────────┤
  │ Ignore          │ Monitor
  │ (Low churn,     │ (High churn,
  │  low complex)   │  low complex)
  └─────────────────┘
          │
     Low Complexity
          └──────────────────►
        Low Churn    High Churn
```

**Priority zones**:
1. **High churn + High complexity**: Immediate refactoring
2. **Low churn + High complexity**: Scheduled refactoring
3. **High churn + Low complexity**: Monitor for complexity growth
4. **Low churn + Low complexity**: No action needed

### Co-change Analysis

Files that frequently change together may indicate:
- Hidden coupling
- Missing abstraction
- Shotgun surgery smell

**Threshold**: Files changing together >70% of the time warrant review.

---

## Severity Mapping

Use metrics to objectively assign severity:

| Severity | Metric Triggers |
|----------|-----------------|
| Critical | CC>50, Ca>20, Circular deps, forwardRef>3, LCOM>0.9 |
| High | CC>20, Ce>12, LOC>500, LCOM>0.7, I violation |
| Medium | CC>10, Ce>8, LOC>300, LCOM>0.5 |
| Low | Any warning-level threshold breach |

---

## Measurement Commands

### Quick metrics (no external tools)

```bash
# File LOC
wc -l src/**/*.ts

# Import count (Fan-out proxy)
grep -c "^import" src/module/service.ts

# Files importing a component (Fan-in proxy)
grep -rl "from './component'" src/ | wc -l

# forwardRef usage
grep -r "forwardRef" src/ | wc -l

# Circular dependency candidates
grep -r "forwardRef\|circular" src/
```

### With external tools

```bash
# Cyclomatic complexity
npx ts-complexity src/

# Dependency graph and cycles
npx madge --circular src/
npx madge --image graph.svg src/

# Dependency rules validation
npx dependency-cruiser src/ --validate
```

---

## References

- McCabe, T. (1976). "A Complexity Measure" - Cyclomatic complexity
- Martin, R. (2003). "Agile Software Development" - Stability metrics
- Chidamber & Kemerer (1994). "A Metrics Suite for OOD" - LCOM
- Tornhill, A. (2015). "Your Code as a Crime Scene" - Churn analysis
