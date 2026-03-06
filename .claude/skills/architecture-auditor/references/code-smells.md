# Code Smells & Anti-Patterns

> **Source**: Martin Fowler — "Refactoring: Improving the Design of Existing Code" (2nd Edition, 2018)
> **References**:
> - [Refactoring Catalog](https://refactoring.com/catalog/)
> - [Martin Fowler's Bliki: Code Smell](https://martinfowler.com/bliki/CodeSmell.html)
> - [Code Smell - Wikipedia](https://en.wikipedia.org/wiki/Code_smell)

A code smell is a surface indication that usually corresponds to a deeper problem in the system. The term was first coined by Kent Beck while helping Martin Fowler with the Refactoring book.

> "Code smells are usually not bugs; they are not technically incorrect and do not prevent the program from functioning. Instead, they indicate weaknesses in design that may slow down development or increase the risk of bugs or failures in the future."

---

## Bloaters

Code that has grown too large and unwieldy.

### Long Method

**Signs**: Method exceeds 20-30 lines, multiple levels of abstraction, hard to name.

```typescript
// BAD: Long method doing too much
async processOrder(order: Order) {
  // Validate order (10 lines)
  // Calculate prices (15 lines)
  // Apply discounts (20 lines)
  // Check inventory (10 lines)
  // Process payment (15 lines)
  // Update inventory (10 lines)
  // Send notifications (10 lines)
  // Generate invoice (15 lines)
}
```

**Fix**: Extract Method — break into smaller, well-named methods.

```typescript
// GOOD: Decomposed into focused methods
async processOrder(order: Order) {
  this.validateOrder(order);
  const pricing = this.calculatePricing(order);
  await this.processPayment(order, pricing);
  await this.fulfillOrder(order);
  await this.notifyCustomer(order);
}
```

---

### Large Class (God Class)

**Signs**: Class >500 LOC, >10 dependencies, >20 methods, multiple unrelated responsibilities.

```typescript
// BAD: God class
class ApplicationManager {
  // User management (10 methods)
  // Order processing (15 methods)
  // Inventory control (10 methods)
  // Reporting (8 methods)
  // Email sending (5 methods)
  // 2000+ lines of code
}
```

**Fix**: Extract Class — split by responsibility.

---

### Primitive Obsession

**Signs**: Using primitives (string, number) instead of small objects for domain concepts.

```typescript
// BAD: Primitive obsession
function createUser(
  email: string,
  phone: string,
  zipCode: string,
  currency: string,
  amount: number,
) { }
```

**Fix**: Replace Primitive with Object.

```typescript
// GOOD: Value objects
function createUser(
  email: Email,
  phone: PhoneNumber,
  address: Address,
  price: Money,
) { }
```

---

### Long Parameter List

**Signs**: Method has >3-4 parameters.

```typescript
// BAD: Too many parameters
function createOrder(
  customerId: string,
  productId: string,
  quantity: number,
  price: number,
  discount: number,
  shippingAddress: string,
  billingAddress: string,
  paymentMethod: string,
) { }
```

**Fix**: Introduce Parameter Object.

```typescript
// GOOD: Parameter object
interface CreateOrderRequest {
  customerId: string;
  items: OrderItem[];
  shipping: Address;
  billing: Address;
  payment: PaymentMethod;
}

function createOrder(request: CreateOrderRequest) { }
```

---

## Object-Orientation Abusers

### Feature Envy

**Signs**: A method uses more features of another class than its own.

```typescript
// BAD: Feature envy - OrderService knows too much about Customer
class OrderService {
  calculateDiscount(order: Order) {
    const customer = order.customer;
    if (customer.tier === 'gold' &&
        customer.totalSpent > 1000 &&
        customer.memberSince < oneYearAgo &&
        customer.orders.length > 10) {
      return 0.2;
    }
    return 0;
  }
}
```

**Fix**: Move Method to the class whose data it uses.

```typescript
// GOOD: Logic belongs to Customer
class Customer {
  isEligibleForDiscount(): boolean {
    return this.tier === 'gold' &&
           this.totalSpent > 1000 &&
           this.memberSince < oneYearAgo &&
           this.orders.length > 10;
  }

  getDiscountRate(): number {
    return this.isEligibleForDiscount() ? 0.2 : 0;
  }
}

class OrderService {
  calculateDiscount(order: Order) {
    return order.customer.getDiscountRate();
  }
}
```

---

### Data Class (Anemic Domain Model)

**Signs**: Class has only fields and getters/setters, no behavior.

```typescript
// BAD: Anemic domain model
class Order {
  items: OrderItem[];
  status: string;
  total: number;
}

class OrderService {
  calculateTotal(order: Order) { /* logic */ }
  canBeCancelled(order: Order) { /* logic */ }
  cancel(order: Order) { /* logic */ }
  ship(order: Order) { /* logic */ }
}
```

**Fix**: Move behavior into the domain object.

```typescript
// GOOD: Rich domain model
class Order {
  private items: OrderItem[];
  private status: OrderStatus;

  get total(): number {
    return this.items.reduce((sum, item) => sum + item.subtotal, 0);
  }

  canBeCancelled(): boolean {
    return this.status === OrderStatus.PENDING;
  }

  cancel(): void {
    if (!this.canBeCancelled()) {
      throw new Error('Order cannot be cancelled');
    }
    this.status = OrderStatus.CANCELLED;
  }
}
```

---

### Switch Statements (Type Checking)

**Signs**: Repeated switch/if-else chains checking the same type.

```typescript
// BAD: Type checking scattered throughout codebase
function calculateArea(shape: Shape) {
  switch (shape.type) {
    case 'circle': return Math.PI * shape.radius ** 2;
    case 'rectangle': return shape.width * shape.height;
    case 'triangle': return 0.5 * shape.base * shape.height;
  }
}

function draw(shape: Shape) {
  switch (shape.type) {
    case 'circle': /* draw circle */
    case 'rectangle': /* draw rectangle */
    case 'triangle': /* draw triangle */
  }
}
```

**Fix**: Replace Conditional with Polymorphism.

```typescript
// GOOD: Polymorphism
interface Shape {
  calculateArea(): number;
  draw(): void;
}

class Circle implements Shape {
  constructor(private radius: number) {}
  calculateArea() { return Math.PI * this.radius ** 2; }
  draw() { /* draw circle */ }
}
```

---

## Change Preventers

### Divergent Change

**Signs**: One class is commonly changed for different reasons.

```typescript
// BAD: Changed for both database and UI reasons
class Customer {
  // Changed when database schema changes
  saveToDatabase() { }
  loadFromDatabase() { }

  // Changed when UI requirements change
  renderAsHtml() { }
  renderAsJson() { }
}
```

**Fix**: Extract Class — separate concerns.

---

### Shotgun Surgery

**Signs**: A single change requires modifications across many classes.

```typescript
// BAD: Adding a new field requires changes everywhere
// User.ts - add field
// UserDto.ts - add field
// UserCreateDto.ts - add field
// UserUpdateDto.ts - add field
// UserMapper.ts - add mapping
// UserValidator.ts - add validation
// UserController.ts - add to response
// UserService.ts - add to logic
```

**Fix**: Move Method/Field — consolidate related changes.

---

### Parallel Inheritance Hierarchies

**Signs**: Creating a subclass in one hierarchy requires creating a subclass in another.

**Fix**: Move Method/Field to eliminate one hierarchy.

---

## Couplers

### Inappropriate Intimacy

**Signs**: Classes access each other's private parts excessively.

```typescript
// BAD: Classes know too much about each other
class Order {
  customer: Customer;

  getCustomerDiscount() {
    // Directly accessing customer internals
    return this.customer['_privateDiscountRate'];
  }
}
```

**Fix**: Move Method, Extract Class, or use proper interfaces.

---

### Middle Man

**Signs**: A class delegates most of its work to another class.

```typescript
// BAD: OrderService just delegates everything
class OrderService {
  getCustomer(orderId: string) {
    return this.orderRepository.find(orderId).customer;
  }
  getItems(orderId: string) {
    return this.orderRepository.find(orderId).items;
  }
  getTotal(orderId: string) {
    return this.orderRepository.find(orderId).total;
  }
}
```

**Fix**: Remove Middle Man — let clients call the delegate directly.

---

### Message Chains

**Signs**: Client asks object A for object B, then asks B for object C, etc.

```typescript
// BAD: Long chain of calls
const street = order.getCustomer().getAddress().getStreet();
```

**Fix**: Hide Delegate or Extract Method.

```typescript
// GOOD: Encapsulate the chain
class Order {
  getShippingStreet(): string {
    return this.customer.shippingAddress.street;
  }
}
```

---

## Dispensables

### Dead Code

**Signs**: Unused variables, parameters, methods, or classes.

**Fix**: Remove Dead Code.

---

### Speculative Generality

**Signs**: Abstract classes, hooks, or parameters that aren't used yet ("we might need this someday").

**Fix**: Collapse Hierarchy, Remove Parameter — YAGNI (You Aren't Gonna Need It).

---

### Comments (Deodorant)

**Signs**: Comments explaining what confusing code does.

```typescript
// BAD: Comment as deodorant
// Check if user can access resource based on role and ownership
if ((user.role === 'admin' || user.role === 'superuser') ||
    (resource.ownerId === user.id && !resource.isLocked) ||
    (user.permissions.includes('resource:read') && resource.isPublic)) {
  // ...
}
```

**Fix**: Extract Method with a good name.

```typescript
// GOOD: Self-documenting code
if (user.canAccess(resource)) {
  // ...
}
```

---

## Quick Reference: Smell → Refactoring

| Smell | Primary Refactoring |
|-------|---------------------|
| Long Method | Extract Method |
| Large Class | Extract Class |
| Primitive Obsession | Replace Primitive with Object |
| Long Parameter List | Introduce Parameter Object |
| Feature Envy | Move Method |
| Data Class | Move Method into Class |
| Switch Statements | Replace Conditional with Polymorphism |
| Divergent Change | Extract Class |
| Shotgun Surgery | Move Method/Field |
| Middle Man | Remove Middle Man |
| Message Chains | Hide Delegate |
| Dead Code | Remove Dead Code |
| Comments | Extract Method |

---

## Quantitative Smell Detection Thresholds

Use these metrics to objectively identify code smells during audits. Reference: [architecture-metrics.md](architecture-metrics.md)

### Size-Based Smell Detection

| Smell | Metric | Warning | Critical | ESLint Rule |
|-------|--------|---------|----------|-------------|
| Long Method | Function LOC | >30 | >50 | `max-lines-per-function` |
| Long Method | Cyclomatic Complexity | >10 | >20 | `complexity` |
| Long Method | Cognitive Complexity | >15 | >25 | `sonarjs/cognitive-complexity` |
| Large Class | Class LOC | >200 | >400 | `max-lines` (file) |
| Large Class | Method Count | >10 | >20 | Manual |
| Large Class | Dependencies (Ce) | >8 | >12 | `import/no-cycle` |
| Long Parameter List | Parameters | >4 | >6 | `max-params` |
| Deep Nesting | Nesting Depth | >3 | >5 | `max-depth` |

### Coupling-Based Smell Detection

| Smell | Metric | Warning | Critical | Detection |
|-------|--------|---------|----------|-----------|
| Feature Envy | External field access | >5 per method | >10 | Manual review |
| Inappropriate Intimacy | Shared mutables | Any | - | Grep for `['private']` |
| Middle Man | Delegation ratio | >80% | >90% | Manual review |
| Shotgun Surgery | Files changed together | >3 | >5 | `analyze-git-history.sh` |

### Churn-Based Smell Detection

| Smell | Metric | Warning | Critical | Detection |
|-------|--------|---------|----------|-----------|
| Hotspot (multiple smells) | Commits/month | >10 | >20 | `analyze-git-history.sh` |
| Unstable Module | Churn + Complexity | High both | - | Churn × Complexity matrix |
| Shotgun Surgery | Co-change frequency | >70% | >85% | `analyze-git-history.sh` |

### Quick Detection Commands

```bash
# Find long methods (>50 lines between function signatures)
grep -n "function\|async.*=>" src/**/*.ts | head -20

# Find large files
wc -l src/**/*.ts | sort -rn | head -10

# Find high import counts (Large Class indicator)
for f in src/**/*.ts; do
  count=$(grep -c "^import" "$f" 2>/dev/null || echo 0)
  if [ "$count" -gt 8 ]; then
    echo "$count imports: $f"
  fi
done

# Find potential God Classes (>300 LOC + >8 imports)
for f in src/**/*.ts; do
  loc=$(wc -l < "$f" | tr -d ' ')
  imports=$(grep -c "^import" "$f" 2>/dev/null || echo 0)
  if [ "$loc" -gt 300 ] && [ "$imports" -gt 8 ]; then
    echo "REVIEW: $f (LOC=$loc, imports=$imports)"
  fi
done
```

### Smell Severity Mapping

| Severity | Smell Examples | Quantitative Trigger |
|----------|---------------|---------------------|
| 🔴 Critical | God Class, Circular Deps | LOC>500 + Ce>12, any cycle |
| 🟠 High | Long Method, High Coupling | CC>20, Ce>12, LOC>400 |
| 🟡 Medium | Feature Envy, Long Params | CC>10, Params>4, mixed concerns |
| 🟢 Low | Comments as Deodorant | Subjective, review needed |

### Automated Detection with ESLint

See [eslint-architecture-rules.md](eslint-architecture-rules.md) for ESLint configuration that automatically flags these thresholds.
