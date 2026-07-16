# Arc42-Inspired Architecture Audit Report Template

This template adapts the Arc42 documentation framework for architecture audit reports. Use this structure when producing comprehensive audit findings.

---

## Template Structure

```markdown
# Architecture Audit Report: [Project Name]

**Audit Date**: YYYY-MM-DD
**Auditor**: [Name/Agent]
**Scope**: [Full system / Specific modules]
**Version**: [Codebase version/commit]

---

## 1. Introduction and Goals

### 1.1 Purpose of This Audit
[Why was this audit conducted? Periodic review, pre-release, after major changes?]

### 1.2 Quality Goals
[What quality attributes are prioritized for this system?]

| Priority | Quality Goal | Description |
|----------|-------------|-------------|
| 1 | Maintainability | Easy to modify and extend |
| 2 | Reliability | Consistent, predictable behavior |
| 3 | Performance | Responsive under expected load |

### 1.3 Stakeholders
[Who will use this report?]

| Role | Expectations |
|------|--------------|
| Development Team | Actionable findings with code examples |
| Tech Lead | Prioritized roadmap |
| Management | Executive summary, risk assessment |

---

## 2. Architecture Constraints

### 2.1 Technical Constraints
[Fixed technical decisions that cannot be changed]

| Constraint | Rationale |
|------------|-----------|
| TypeScript | Team expertise, type safety |
| PostgreSQL | Existing infrastructure |
| AWS | Corporate standard |

### 2.2 Organizational Constraints
[Team size, deadlines, budget limitations]

### 2.3 Conventions
[Coding standards, naming conventions, patterns that must be followed]

---

## 3. System Scope and Context

### 3.1 Business Context
[System's role in the business domain]

```
┌─────────────────────────────────────────────────┐
│                   [System Name]                  │
│                                                  │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐     │
│  │ Module A│    │ Module B│    │ Module C│     │
│  └─────────┘    └─────────┘    └─────────┘     │
└─────────────────────────────────────────────────┘
        ▲               ▲               ▲
        │               │               │
   [External A]    [External B]    [External C]
```

### 3.2 Technical Context
[Integration points, APIs, external services]

| External System | Interface | Protocol |
|-----------------|-----------|----------|
| [System] | [Description] | REST/gRPC/etc |

---

## 4. Solution Strategy

### 4.1 Intended Architecture Style
[What architecture was intended? Layered, Hexagonal, Microservices?]

### 4.2 Key Technology Decisions
[Major technology choices and their rationale]

### 4.3 Detected Deviations
[Where does the implementation deviate from the intended architecture?]

| Intended | Actual | Impact | Recommendation |
|----------|--------|--------|----------------|
| [Pattern] | [Deviation] | [Effect] | [Fix] |

---

## 5. Building Block View

### 5.1 Module Inventory

| Module | Responsibility | Files | LOC | Health |
|--------|---------------|-------|-----|--------|
| auth | Authentication & authorization | 12 | 850 | 🟢 |
| users | User management | 8 | 620 | 🟡 |
| [module] | [responsibility] | [count] | [loc] | [status] |

### 5.2 Module Health Metrics

| Module | Avg Ce | Avg Ca | Instability | Assessment |
|--------|--------|--------|-------------|------------|
| auth | 4.2 | 8.1 | 0.34 | Stable core |
| users | 6.8 | 3.2 | 0.68 | Balanced |

### 5.3 Dependency Diagram
[Visual representation of module dependencies]

```
auth ──────► prisma
  │
  ▼
users ─────► email
  │
  ▼
dashboard
```

---

## 6. Runtime View

### 6.1 Key Scenarios
[How does the system behave at runtime for critical use cases?]

#### Scenario: User Authentication
```
1. Request → AuthController
2. AuthController → AuthService.validateUser()
3. AuthService → PrismaService.user.findUnique()
4. AuthService → JwtService.sign()
5. Response ← AuthController
```

### 6.2 Identified Runtime Issues
[Performance bottlenecks, race conditions, etc.]

---

## 7. Deployment View

### 7.1 Infrastructure Overview
[How is the system deployed?]

### 7.2 Deployment Concerns
[Scaling, redundancy, monitoring gaps]

---

## 8. Cross-cutting Concepts

### 8.1 Error Handling
[Consistency of error handling across modules]

| Pattern | Adoption | Issues |
|---------|----------|--------|
| NestJS Exceptions | 85% | Inconsistent in [module] |
| Global Error Filter | ✓ | None |

### 8.2 Logging
[Logging standards compliance]

### 8.3 Security Patterns
[Authentication, authorization, data protection]

### 8.4 Data Validation
[Input validation consistency]

---

## 9. Quality Requirements (ISO/IEC 25010)

### 9.1 Findings by Quality Characteristic

| Characteristic | Sub-characteristic | Findings | Severity |
|----------------|-------------------|----------|----------|
| Maintainability | Modularity | Circular dep in auth↔users | High |
| Maintainability | Testability | Missing DI in [service] | Medium |
| Reliability | Fault Tolerance | No circuit breaker for [API] | High |
| Performance | Time Behaviour | N+1 query in [method] | Medium |

### 9.2 Quality Metrics Summary

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Test Coverage | >80% | 72% | 🟡 |
| Cyclomatic Complexity | <10 | avg 8.2 | 🟢 |
| Circular Dependencies | 0 | 2 | 🔴 |

---

## 10. Risks and Technical Debt

### 10.1 Critical Risks

| ID | Risk | Probability | Impact | Mitigation |
|----|------|-------------|--------|------------|
| R1 | [Risk] | High/Med/Low | High/Med/Low | [Action] |

### 10.2 Technical Debt Register

| ID | Debt Item | Location | Effort | Priority |
|----|-----------|----------|--------|----------|
| TD1 | God class | `dashboard.service.ts` | Large | High |
| TD2 | Missing abstraction | [location] | Medium | Medium |

### 10.3 Debt Quadrant

```
                    Reckless
                       │
        ┌──────────────┼──────────────┐
        │   Deliberate │   Inadvertent│
        │   Reckless   │   Reckless   │
        │              │              │
        │  "No time    │  "What's a   │
        │   for design"│   layer?"    │
   Deliberate──────────┼──────────────Inadvertent
        │              │              │
        │  Deliberate  │  Inadvertent │
        │  Prudent     │  Prudent     │
        │              │              │
        │  "Ship now,  │  "Now we know│
        │   refactor   │   how we     │
        │   later"     │   should've  │
        │              │   done it"   │
        └──────────────┼──────────────┘
                       │
                    Prudent
```

---

## 11. Detailed Findings

### 11.1 Critical Issues (🔴)

#### Finding C1: [Title]

**Location**: `path/to/file.ts:42-88`
**Metrics**: CC=25, Ce=14, LOC=520

**Quality Characteristic**: Maintainability
**Sub-characteristic**: Modularity

**Problem**:
[Clear explanation of the issue]

**Impact**:
[How this affects the system]

**Current State**:
```typescript
// Problematic code
```

**Recommended Fix**:
```typescript
// Improved code
```

**Effort**: Large
**Priority**: Immediate

---

### 11.2 High Priority Issues (🟠)

[Similar format for each finding]

---

### 11.3 Medium Priority Issues (🟡)

[Similar format for each finding]

---

### 11.4 Low Priority Issues (🟢)

[Similar format for each finding]

---

## 12. Positive Observations ✅

[What the architecture does well - important for balanced reporting]

1. **[Strength 1]**: Description
2. **[Strength 2]**: Description
3. **[Strength 3]**: Description

---

## 13. Recommended Roadmap

### 13.1 Immediate Actions (This Sprint)

| Priority | Action | Effort | Owner |
|----------|--------|--------|-------|
| 1 | [Action] | Small | [Team] |

### 13.2 Short-term (Next 2-4 Sprints)

| Priority | Action | Effort | Dependencies |
|----------|--------|--------|--------------|
| 1 | [Action] | Medium | [Deps] |

### 13.3 Long-term (Backlog)

| Priority | Action | Effort | Notes |
|----------|--------|--------|-------|
| 1 | [Action] | Large | [Notes] |

---

## 14. Glossary

| Term | Definition |
|------|------------|
| [Term] | [Definition] |

---

## 15. Appendix

### A. Metrics Raw Data
[Full metrics output from scripts]

### B. Tool Outputs
[Relevant tool outputs]

### C. References
- [Architecture Metrics Reference](architecture-metrics.md)
- Project hard rules: `.claude/rules/`
```

---

## Usage Guidelines

### When to Use Full Template

Use all sections for:
- Initial architecture audit of a new codebase
- Annual architecture reviews
- Pre-major-release audits
- Post-mortem after significant incidents

### Abbreviated Reports

For routine audits, focus on:
- Section 9 (Quality Requirements)
- Section 10 (Risks and Technical Debt)
- Section 11 (Detailed Findings)
- Section 13 (Recommended Roadmap)

### Section Mapping to Audit Phases

| Audit Phase | Arc42 Sections |
|-------------|----------------|
| Context Gathering | 1, 2, 3, 4 |
| Automated Scanning | 5, 6 (metrics) |
| Manual Analysis | 7, 8, 9, 11 |
| Reporting | 10, 12, 13 |

---

## References

- [Arc42 Template](https://arc42.org/overview)
- [ISO/IEC 25010:2011](https://www.iso.org/standard/35733.html)
- [Technical Debt Quadrant](https://martinfowler.com/bliki/TechnicalDebtQuadrant.html)
