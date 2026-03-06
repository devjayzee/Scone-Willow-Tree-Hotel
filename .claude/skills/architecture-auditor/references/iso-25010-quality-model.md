# ISO/IEC 25010 Software Quality Model

The ISO/IEC 25010 standard defines 8 quality characteristics for software product quality. Use this reference to map architectural findings to standardized quality impacts.

---

## Quality Model Overview

```
Software Product Quality
├── 1. Functional Suitability
├── 2. Performance Efficiency
├── 3. Compatibility
├── 4. Usability
├── 5. Reliability
├── 6. Security
├── 7. Maintainability
└── 8. Portability
```

---

## 1. Functional Suitability

**Definition**: Degree to which the product provides functions that meet stated and implied needs.

### Sub-characteristics

| Sub-characteristic | Definition | Architecture Audit Focus |
|--------------------|------------|-------------------------|
| Functional Completeness | Coverage of all specified tasks | API endpoint coverage, feature completeness |
| Functional Correctness | Accurate results | Error handling, edge cases, validation |
| Functional Appropriateness | Facilitates task accomplishment | API design, workflow support |

### Audit Checklist

- [ ] All specified use cases have corresponding endpoints/handlers
- [ ] Input validation covers all edge cases
- [ ] Error responses are meaningful and actionable
- [ ] Business rules are consistently enforced
- [ ] API contracts match documented specifications

### Common Violations

| Finding | Impact | Severity |
|---------|--------|----------|
| Missing error handling for edge cases | Functional Correctness | Medium |
| Incomplete CRUD operations | Functional Completeness | High |
| Validation gaps in DTOs | Functional Correctness | High |

---

## 2. Performance Efficiency

**Definition**: Performance relative to resources used under stated conditions.

### Sub-characteristics

| Sub-characteristic | Definition | Architecture Audit Focus |
|--------------------|------------|-------------------------|
| Time Behaviour | Response times, throughput | Query optimization, caching strategy |
| Resource Utilization | CPU, memory, storage usage | Memory leaks, connection pooling |
| Capacity | Maximum limits | Pagination, rate limiting, scaling |

### Audit Checklist

- [ ] Database queries use proper indexing
- [ ] N+1 query patterns are avoided
- [ ] Pagination implemented for list endpoints
- [ ] Connection pooling configured
- [ ] Caching strategy defined for read-heavy operations
- [ ] Async operations for I/O-bound tasks
- [ ] Resource cleanup in error paths

### Common Violations

| Finding | Impact | Severity |
|---------|--------|----------|
| N+1 queries in service methods | Time Behaviour | High |
| Missing pagination on list endpoints | Capacity | High |
| Unbounded data fetching | Resource Utilization | Critical |
| No connection pooling | Resource Utilization | Medium |
| Synchronous I/O in request path | Time Behaviour | High |

### NestJS-Specific Checks

```typescript
// BAD: N+1 query
const users = await this.prisma.user.findMany();
for (const user of users) {
  user.posts = await this.prisma.post.findMany({ where: { userId: user.id } });
}

// GOOD: Eager loading
const users = await this.prisma.user.findMany({
  include: { posts: true }
});
```

---

## 3. Compatibility

**Definition**: Degree to which a product can exchange information and perform functions while sharing the same environment.

### Sub-characteristics

| Sub-characteristic | Definition | Architecture Audit Focus |
|--------------------|------------|-------------------------|
| Co-existence | Operate with other products sharing resources | Port conflicts, resource contention |
| Interoperability | Exchange and use information | API standards, message formats |

### Audit Checklist

- [ ] API versioning strategy defined
- [ ] Standard message formats (JSON:API, RFC 7807 errors)
- [ ] Content negotiation supported
- [ ] CORS configured appropriately
- [ ] Webhook signatures follow standards
- [ ] OpenAPI/Swagger documentation available

### Common Violations

| Finding | Impact | Severity |
|---------|--------|----------|
| No API versioning | Interoperability | High |
| Inconsistent error response format | Interoperability | Medium |
| Missing CORS configuration | Co-existence | Medium |
| Non-standard date formats | Interoperability | Low |

---

## 4. Usability (API Usability)

**Definition**: Degree to which a product can be used by specified users to achieve specified goals effectively.

### Sub-characteristics

| Sub-characteristic | Definition | Architecture Audit Focus |
|--------------------|------------|-------------------------|
| Appropriateness Recognizability | Users can recognize suitability | API discoverability, documentation |
| Learnability | Users can learn to use | Consistent naming, intuitive design |
| Operability | Easy to operate and control | Error messages, status codes |
| User Error Protection | Prevents user errors | Validation, confirmations |
| Accessibility | Usable by people with disabilities | N/A for backend APIs |

### Audit Checklist

- [ ] Consistent naming conventions across endpoints
- [ ] RESTful resource naming (nouns, not verbs)
- [ ] Appropriate HTTP methods and status codes
- [ ] Descriptive error messages with remediation hints
- [ ] HATEOAS links where appropriate
- [ ] Request/response examples in documentation

### Common Violations

| Finding | Impact | Severity |
|---------|--------|----------|
| Inconsistent endpoint naming | Learnability | Medium |
| Generic error messages | Operability | Medium |
| Wrong HTTP status codes | Operability | Medium |
| Missing request validation feedback | User Error Protection | High |

### Naming Consistency Checks

```
# Good: Consistent plural nouns
GET /users
GET /users/:id
POST /users
GET /users/:id/posts

# Bad: Inconsistent
GET /user          # Singular
POST /createUser   # Verb in URL
GET /getUserPosts  # Verb, camelCase
```

---

## 5. Reliability

**Definition**: Degree to which a system performs specified functions under specified conditions for a specified period.

### Sub-characteristics

| Sub-characteristic | Definition | Architecture Audit Focus |
|--------------------|------------|-------------------------|
| Maturity | Meets reliability needs under normal operation | Error rates, exception handling |
| Availability | Operational and accessible when required | Health checks, graceful degradation |
| Fault Tolerance | Operates despite faults | Circuit breakers, fallbacks |
| Recoverability | Recover data and state after failure | Transaction handling, idempotency |

### Audit Checklist

- [ ] Health check endpoints implemented
- [ ] Graceful shutdown handling
- [ ] Circuit breakers for external services
- [ ] Retry strategies with exponential backoff
- [ ] Idempotency keys for critical operations
- [ ] Transaction boundaries properly defined
- [ ] Dead letter queues for failed messages
- [ ] Timeout configurations for all external calls

### Common Violations

| Finding | Impact | Severity |
|---------|--------|----------|
| Missing health checks | Availability | High |
| No circuit breakers for external APIs | Fault Tolerance | High |
| Missing transaction boundaries | Recoverability | Critical |
| No retry strategy for transient failures | Fault Tolerance | Medium |
| Unbounded timeouts | Availability | High |

### NestJS Reliability Patterns

```typescript
// Health check
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}

// Graceful shutdown
app.enableShutdownHooks();

// Circuit breaker (with external library)
@UseInterceptors(CircuitBreakerInterceptor)
async callExternalService() { }
```

---

## 6. Security

**Definition**: Degree to which a product protects information and data.

### Sub-characteristics

| Sub-characteristic | Definition | Architecture Audit Focus |
|--------------------|------------|-------------------------|
| Confidentiality | Data accessible only to authorized | Encryption, access control |
| Integrity | Prevents unauthorized modification | Input validation, checksums |
| Non-repudiation | Actions can be proven | Audit logging |
| Accountability | Actions traceable to entity | Authentication, logging |
| Authenticity | Identity can be proven | Authentication mechanisms |

### Audit Note

**Defer detailed security analysis to the `security-auditor` agent.**

Architecture audit should flag:
- [ ] Authentication mechanism exists
- [ ] Authorization checks on protected routes
- [ ] Sensitive data encryption at rest
- [ ] Secrets not hardcoded
- [ ] Audit logging for sensitive operations

### Quick Security Checks

| Finding | Impact | Severity |
|---------|--------|----------|
| Missing auth guards on routes | Confidentiality | Critical |
| Hardcoded secrets | Confidentiality | Critical |
| No input sanitization | Integrity | High |
| Missing audit logs | Non-repudiation | Medium |

---

## 7. Maintainability

**Definition**: Degree of effectiveness and efficiency with which a product can be modified.

### Sub-characteristics

| Sub-characteristic | Definition | Architecture Audit Focus |
|--------------------|------------|-------------------------|
| Modularity | Composed of discrete components | Module boundaries, coupling |
| Reusability | Assets usable in multiple systems | Shared libraries, abstractions |
| Analysability | Ease of assessing change impact | Code clarity, documentation |
| Modifiability | Ease of modification without defects | Coupling, cohesion, SOLID |
| Testability | Ease of establishing test criteria | Dependency injection, mocking |

### Audit Checklist

- [ ] Clear module boundaries (bounded contexts)
- [ ] Low coupling between modules (Ce < 8)
- [ ] High cohesion within modules (LCOM < 0.5)
- [ ] SOLID principles followed
- [ ] Dependency injection used consistently
- [ ] No circular dependencies
- [ ] Abstractions for external services
- [ ] Configuration externalized

### Common Violations

| Finding | Sub-characteristic | Severity |
|---------|-------------------|----------|
| Circular dependencies | Modularity | Critical |
| God class (>500 LOC) | Modularity | High |
| High coupling (Ce > 12) | Modifiability | High |
| Low cohesion (LCOM > 0.7) | Modularity | High |
| Missing DI for dependencies | Testability | Medium |
| Hardcoded configuration | Modifiability | Medium |

### Maintainability Metrics Mapping

| Metric | Sub-characteristic | Threshold |
|--------|-------------------|-----------|
| Cyclomatic Complexity | Analysability | < 10 |
| LCOM | Modularity | < 0.5 |
| Ce (Fan-out) | Modifiability | < 8 |
| Ca (Fan-in) | Reusability | Context-dependent |
| LOC per class | Analysability | < 300 |

---

## 8. Portability

**Definition**: Degree of effectiveness and efficiency with which a system can be transferred from one environment to another.

### Sub-characteristics

| Sub-characteristic | Definition | Architecture Audit Focus |
|--------------------|------------|-------------------------|
| Adaptability | Can be adapted for different environments | Environment configuration |
| Installability | Ease of installation | Docker, deployment scripts |
| Replaceability | Can replace another product | Interface abstractions |

### Audit Checklist

- [ ] Environment variables for all configuration
- [ ] No hardcoded paths or URLs
- [ ] Database abstraction (repository pattern or ORM)
- [ ] Docker/containerization support
- [ ] Infrastructure as Code available
- [ ] Feature flags for environment-specific behavior

### Common Violations

| Finding | Impact | Severity |
|---------|--------|----------|
| Hardcoded environment values | Adaptability | High |
| Direct database queries (no abstraction) | Replaceability | Medium |
| Missing Docker configuration | Installability | Medium |
| Environment-specific code without flags | Adaptability | Medium |

---

## Severity Mapping by Characteristic

| Characteristic | Critical Threshold | High Threshold |
|----------------|-------------------|----------------|
| Functional Suitability | Core feature missing | Edge case failures |
| Performance Efficiency | Unbounded queries | N+1 patterns |
| Compatibility | Breaking API changes | Version gaps |
| Usability | Unusable API | Inconsistent naming |
| Reliability | No error handling | Missing circuit breakers |
| Security | Auth bypass | Missing validation |
| Maintainability | Circular deps | God classes |
| Portability | Cannot deploy | Hardcoded config |

---

## Architecture Audit Report Integration

When reporting findings, include:

```markdown
### Finding: [Title]

**Quality Characteristic**: [e.g., Maintainability]
**Sub-characteristic**: [e.g., Modularity]
**Impact**: [How this degrades the quality attribute]

**Location**: `path/to/file.ts:42-88`
**Severity**: [Critical/High/Medium/Low]

**Current State**:
[Code or description]

**Recommended Fix**:
[Solution]
```

---

## References

- ISO/IEC 25010:2011 - Systems and software Quality Requirements and Evaluation (SQuaRE)
- ISO/IEC 25023:2016 - Measurement of system and software product quality
