# Domain-Driven Design Patterns

> **Source**: Eric Evans — "Domain-Driven Design: Tackling Complexity in the Heart of Software" (2003)
> **References**:
> - [DDD Reference (Official PDF)](https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf)
> - [Martin Fowler's Bliki: Domain Driven Design](https://martinfowler.com/bliki/DomainDrivenDesign.html)
> - [Martin Fowler's Bliki: Bounded Context](https://martinfowler.com/bliki/BoundedContext.html)
> - [Domain-driven design - Wikipedia](https://en.wikipedia.org/wiki/Domain-driven_design)

Domain-Driven Design is an approach to software development that centers the development on programming a domain model that has a rich understanding of the processes and rules of a domain.

---

## Strategic Design Patterns

### Bounded Context

> "Explicitly define the context within which a model applies. Explicitly set boundaries in terms of team organization, usage within specific parts of the application, and physical manifestations such as code bases and database schemas."
> — Eric Evans, DDD Reference

**What It Means**:
- A linguistic boundary where terms have specific, consistent meanings
- Each bounded context has its own ubiquitous language
- The same concept may have different models in different contexts

**Example**:

```
┌─────────────────────┐     ┌─────────────────────┐
│   Sales Context     │     │  Shipping Context   │
│                     │     │                     │
│  Customer:          │     │  Customer:          │
│  - name             │     │  - shippingAddress  │
│  - creditLimit      │     │  - deliveryPrefs    │
│  - orderHistory     │     │  - contactPhone     │
│                     │     │                     │
│  Product:           │     │  Package:           │
│  - price            │     │  - weight           │
│  - description      │     │  - dimensions       │
│  - inventory        │     │  - fragile          │
└─────────────────────┘     └─────────────────────┘
```

**Audit Checklist**:
- [ ] Are contexts explicitly defined with clear boundaries?
- [ ] Does each context have its own model (not shared entities)?
- [ ] Are terms consistent within each context?
- [ ] Is there a context map showing relationships?

---

### Context Mapping

Patterns for how bounded contexts relate to each other:

| Pattern | Description | When to Use |
|---------|-------------|-------------|
| **Partnership** | Two teams cooperate on shared interface | Close collaboration possible |
| **Shared Kernel** | Small shared subset of model | Minimal, carefully managed sharing |
| **Customer/Supplier** | Upstream supplies, downstream consumes | Clear dependency direction |
| **Conformist** | Downstream conforms to upstream model | No influence over upstream |
| **Anti-Corruption Layer** | Translation layer between contexts | Protect from external model pollution |
| **Open Host Service** | Well-defined API for multiple consumers | Many downstream consumers |
| **Published Language** | Shared language (JSON Schema, protobuf) | Integration standardization |

**Example: Anti-Corruption Layer**

```typescript
// BAD: Direct use of external model
class OrderService {
  async createOrder(data: CreateOrderDto) {
    const externalCustomer = await this.externalApi.getCustomer(data.customerId);
    // Using external model directly pollutes our domain
    const order = new Order(externalCustomer.CustomerID, externalCustomer.CustName);
  }
}

// GOOD: Anti-corruption layer
class CustomerAdapter {
  async getCustomer(customerId: string): Promise<Customer> {
    const external = await this.externalApi.getCustomer(customerId);
    // Translate external model to our domain model
    return new Customer({
      id: external.CustomerID,
      name: external.CustName,
      email: external.EmailAddr,
    });
  }
}

class OrderService {
  constructor(private customerAdapter: CustomerAdapter) {}

  async createOrder(data: CreateOrderDto) {
    const customer = await this.customerAdapter.getCustomer(data.customerId);
    const order = new Order(customer);
  }
}
```

---

## Tactical Design Patterns

### Entities

> Objects that have a distinct identity that runs through time and different states.

**Characteristics**:
- Identity matters (two entities with same attributes are different if IDs differ)
- Mutable state
- Lifecycle (created, modified, archived)

```typescript
class User {
  constructor(
    public readonly id: UserId,  // Identity
    private email: Email,
    private name: string,
  ) {}

  // Equality based on identity, not attributes
  equals(other: User): boolean {
    return this.id.equals(other.id);
  }

  changeEmail(newEmail: Email): void {
    this.email = newEmail;
    // Still the same user
  }
}
```

---

### Value Objects

> Objects that describe characteristics but have no conceptual identity.

**Characteristics**:
- No identity (two value objects with same attributes are equal)
- Immutable
- Replaceable

```typescript
class Money {
  constructor(
    public readonly amount: number,
    public readonly currency: Currency,
  ) {
    Object.freeze(this);
  }

  // Equality based on attributes
  equals(other: Money): boolean {
    return this.amount === other.amount &&
           this.currency === other.currency;
  }

  // Operations return new instances
  add(other: Money): Money {
    if (!this.currency.equals(other.currency)) {
      throw new Error('Currency mismatch');
    }
    return new Money(this.amount + other.amount, this.currency);
  }
}

class Address {
  constructor(
    public readonly street: string,
    public readonly city: string,
    public readonly zipCode: string,
    public readonly country: string,
  ) {
    Object.freeze(this);
  }
}
```

---

### Aggregates

> "A cluster of associated objects that we treat as a unit for the purpose of data changes."
> — Eric Evans

**Characteristics**:
- Boundary defining what's inside
- Root entity (only external reference point)
- Consistency boundary (invariants enforced within)
- Transactional boundary (one aggregate per transaction)

```typescript
// Order is the Aggregate Root
class Order {
  private readonly items: OrderItem[] = [];
  private status: OrderStatus = OrderStatus.DRAFT;

  constructor(
    public readonly id: OrderId,
    private readonly customerId: CustomerId,  // Reference to another aggregate
  ) {}

  // All access through the root
  addItem(product: ProductId, quantity: number, price: Money): void {
    if (this.status !== OrderStatus.DRAFT) {
      throw new Error('Cannot modify confirmed order');
    }

    const existingItem = this.items.find(i => i.productId.equals(product));
    if (existingItem) {
      existingItem.increaseQuantity(quantity);
    } else {
      this.items.push(new OrderItem(product, quantity, price));
    }

    // Invariant: order total cannot exceed credit limit
    // (would need to check via domain service)
  }

  confirm(): void {
    if (this.items.length === 0) {
      throw new Error('Cannot confirm empty order');
    }
    this.status = OrderStatus.CONFIRMED;
  }

  get total(): Money {
    return this.items.reduce(
      (sum, item) => sum.add(item.subtotal),
      Money.zero(Currency.USD),
    );
  }
}

// OrderItem is an Entity within the Order aggregate
class OrderItem {
  constructor(
    public readonly productId: ProductId,
    private quantity: number,
    private unitPrice: Money,
  ) {}

  increaseQuantity(amount: number): void {
    this.quantity += amount;
  }

  get subtotal(): Money {
    return this.unitPrice.multiply(this.quantity);
  }
}
```

**Aggregate Design Rules**:
1. Reference other aggregates by ID only
2. One aggregate per transaction
3. Keep aggregates small
4. Protect invariants within aggregate boundary

**Audit Checklist**:
- [ ] Is the aggregate root clearly identified?
- [ ] Are invariants enforced within the aggregate?
- [ ] Are external references by ID only?
- [ ] Is the aggregate small and focused?

---

### Domain Services

> Operations that don't naturally belong to an Entity or Value Object.

**When to Use**:
- Operation involves multiple aggregates
- Operation doesn't fit naturally on any entity
- Operation is a significant domain concept

```typescript
// Domain Service - business logic involving multiple aggregates
class TransferService {
  transfer(
    from: Account,
    to: Account,
    amount: Money,
  ): TransferResult {
    if (!from.canWithdraw(amount)) {
      return TransferResult.insufficientFunds();
    }

    from.withdraw(amount);
    to.deposit(amount);

    return TransferResult.success();
  }
}

// NOT a domain service - this is an application service
class TransferApplicationService {
  async executeTransfer(command: TransferCommand): Promise<void> {
    const from = await this.accountRepo.findById(command.fromId);
    const to = await this.accountRepo.findById(command.toId);

    const result = this.transferService.transfer(from, to, command.amount);

    if (result.isSuccess) {
      await this.accountRepo.save(from);
      await this.accountRepo.save(to);
      await this.eventBus.publish(new TransferCompleted(command));
    }
  }
}
```

---

### Repositories

> "A Repository mediates between the domain and data mapping layers, acting like an in-memory domain object collection."
> — Martin Fowler

**Characteristics**:
- One repository per aggregate root
- Domain-focused interface (not CRUD)
- Hides persistence details

```typescript
// Repository interface (domain layer)
interface OrderRepository {
  findById(id: OrderId): Promise<Order | null>;
  findByCustomer(customerId: CustomerId): Promise<Order[]>;
  findPendingOrders(): Promise<Order[]>;
  save(order: Order): Promise<void>;
  delete(order: Order): Promise<void>;
}

// Implementation (infrastructure layer)
class PrismaOrderRepository implements OrderRepository {
  constructor(private prisma: PrismaService) {}

  async findById(id: OrderId): Promise<Order | null> {
    const data = await this.prisma.order.findUnique({
      where: { id: id.value },
      include: { items: true },
    });
    return data ? this.toDomain(data) : null;
  }

  private toDomain(data: PrismaOrder): Order {
    // Map from persistence model to domain model
  }
}
```

---

### Domain Events

> "Something that happened that domain experts care about."

```typescript
class OrderConfirmed implements DomainEvent {
  constructor(
    public readonly orderId: OrderId,
    public readonly customerId: CustomerId,
    public readonly total: Money,
    public readonly occurredAt: Date = new Date(),
  ) {}
}

class Order {
  private events: DomainEvent[] = [];

  confirm(): void {
    if (this.items.length === 0) {
      throw new Error('Cannot confirm empty order');
    }
    this.status = OrderStatus.CONFIRMED;

    this.events.push(new OrderConfirmed(
      this.id,
      this.customerId,
      this.total,
    ));
  }

  pullEvents(): DomainEvent[] {
    const events = [...this.events];
    this.events = [];
    return events;
  }
}
```

---

## Quick Reference: When to Use What

| Pattern | Use When |
|---------|----------|
| **Entity** | Object has identity and lifecycle |
| **Value Object** | Object describes attributes, is immutable |
| **Aggregate** | Group of objects with consistency rules |
| **Domain Service** | Operation spans multiple aggregates |
| **Repository** | Need to retrieve/persist aggregates |
| **Domain Event** | Something significant happened in domain |
| **Bounded Context** | Different parts of system need different models |
| **Anti-Corruption Layer** | Integrating with external/legacy systems |
