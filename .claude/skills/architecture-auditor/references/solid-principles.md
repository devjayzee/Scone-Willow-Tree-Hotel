# SOLID Principles

> **Source**: Robert C. Martin ("Uncle Bob") — Original author of SOLID principles
> **References**:
> - [SOLID - Wikipedia](https://en.wikipedia.org/wiki/SOLID)
> - [Clean Coders Episode 8](https://cleancoders.com/episode/clean-code-episode-8)
> - [Principles Wiki](http://principles-wiki.net/collections:robert_c._martin_s_principle_collection)

SOLID is an acronym for five fundamental object-oriented design principles formulated by Robert C. Martin. The acronym was coined around 2004 by Michael Feathers.

---

## S — Single Responsibility Principle (SRP)

> "A class should have one and only one reason to change."

### What It Means

- A module/class should be responsible to one, and only one, actor (stakeholder)
- If a class has multiple responsibilities, changes to one may break the other
- "Reason to change" = a single stakeholder whose needs might evolve

### Violation Signs

```typescript
// BAD: Multiple responsibilities
class UserService {
  createUser(data: CreateUserDto) { /* user creation logic */ }
  sendWelcomeEmail(user: User) { /* email logic */ }
  generateReport(users: User[]) { /* reporting logic */ }
  validatePassword(password: string) { /* validation logic */ }
}
```

### Correct Implementation

```typescript
// GOOD: Single responsibility per class
class UserService {
  constructor(
    private emailService: EmailService,
    private reportService: ReportService,
  ) {}

  createUser(data: CreateUserDto) {
    const user = /* create user */;
    this.emailService.sendWelcomeEmail(user);
    return user;
  }
}

class EmailService {
  sendWelcomeEmail(user: User) { /* email logic */ }
}

class ReportService {
  generateUserReport(users: User[]) { /* reporting logic */ }
}
```

### Audit Checklist

- [ ] Does the class have a single, clear purpose?
- [ ] Can you describe what the class does without using "and"?
- [ ] Would changes to one feature require modifying this class for unrelated reasons?

---

## O — Open/Closed Principle (OCP)

> "Software entities should be open for extension, but closed for modification."

### What It Means

- You should be able to extend a class's behavior without modifying its source code
- Use abstractions (interfaces, abstract classes) to allow new behavior
- New features = new code, not changed old code

### Violation Signs

```typescript
// BAD: Must modify class to add new payment types
class PaymentProcessor {
  process(payment: Payment) {
    if (payment.type === 'credit_card') {
      // credit card logic
    } else if (payment.type === 'paypal') {
      // paypal logic
    } else if (payment.type === 'crypto') {
      // crypto logic - had to modify existing class!
    }
  }
}
```

### Correct Implementation

```typescript
// GOOD: Open for extension via interface
interface PaymentStrategy {
  process(payment: Payment): Promise<PaymentResult>;
}

class CreditCardStrategy implements PaymentStrategy {
  process(payment: Payment) { /* credit card logic */ }
}

class PayPalStrategy implements PaymentStrategy {
  process(payment: Payment) { /* paypal logic */ }
}

// New payment type = new class, no modification to existing code
class CryptoStrategy implements PaymentStrategy {
  process(payment: Payment) { /* crypto logic */ }
}

class PaymentProcessor {
  constructor(private strategies: Map<string, PaymentStrategy>) {}

  process(payment: Payment) {
    const strategy = this.strategies.get(payment.type);
    return strategy.process(payment);
  }
}
```

### Audit Checklist

- [ ] Are there long if/else or switch statements based on type?
- [ ] Do you need to modify existing classes to add new features?
- [ ] Are behaviors abstracted behind interfaces?

---

## L — Liskov Substitution Principle (LSP)

> "Objects in a program should be replaceable with instances of their subtypes without altering the correctness of that program."

### What It Means

- Subtypes must be substitutable for their base types
- A subclass should enhance, not change, the behavior of its parent
- Derived classes must honor the contracts of their base classes

### Violation Signs

```typescript
// BAD: Square violates Rectangle's contract
class Rectangle {
  constructor(protected width: number, protected height: number) {}

  setWidth(w: number) { this.width = w; }
  setHeight(h: number) { this.height = h; }
  getArea() { return this.width * this.height; }
}

class Square extends Rectangle {
  setWidth(w: number) {
    this.width = w;
    this.height = w; // Violates LSP - unexpected behavior
  }
  setHeight(h: number) {
    this.width = h;
    this.height = h; // Violates LSP - unexpected behavior
  }
}

// This breaks with Square
function resizeRectangle(rect: Rectangle) {
  rect.setWidth(10);
  rect.setHeight(5);
  console.log(rect.getArea()); // Expects 50, Square gives 25
}
```

### Correct Implementation

```typescript
// GOOD: Separate abstractions
interface Shape {
  getArea(): number;
}

class Rectangle implements Shape {
  constructor(private width: number, private height: number) {}
  getArea() { return this.width * this.height; }
}

class Square implements Shape {
  constructor(private side: number) {}
  getArea() { return this.side * this.side; }
}
```

### Audit Checklist

- [ ] Do subclasses throw exceptions for inherited methods they can't support?
- [ ] Do subclasses change the expected behavior of parent methods?
- [ ] Can you substitute any subclass without breaking calling code?

---

## I — Interface Segregation Principle (ISP)

> "Clients should not be forced to depend on interfaces they do not use."

### What It Means

- Prefer many small, specific interfaces over one large "fat" interface
- Classes shouldn't be forced to implement methods they don't need
- Split interfaces by client needs, not by implementation convenience

### Violation Signs

```typescript
// BAD: Fat interface forces unnecessary implementations
interface Worker {
  work(): void;
  eat(): void;
  sleep(): void;
  attendMeeting(): void;
  writeReport(): void;
}

class Robot implements Worker {
  work() { /* works */ }
  eat() { throw new Error('Robots do not eat'); } // Forced to implement
  sleep() { throw new Error('Robots do not sleep'); } // Forced to implement
  attendMeeting() { /* attends */ }
  writeReport() { /* writes */ }
}
```

### Correct Implementation

```typescript
// GOOD: Segregated interfaces
interface Workable {
  work(): void;
}

interface Feedable {
  eat(): void;
}

interface Sleepable {
  sleep(): void;
}

interface MeetingAttendee {
  attendMeeting(): void;
}

class Human implements Workable, Feedable, Sleepable, MeetingAttendee {
  work() { /* works */ }
  eat() { /* eats */ }
  sleep() { /* sleeps */ }
  attendMeeting() { /* attends */ }
}

class Robot implements Workable, MeetingAttendee {
  work() { /* works */ }
  attendMeeting() { /* attends */ }
}
```

### Audit Checklist

- [ ] Are there interfaces with many methods that most implementers don't use?
- [ ] Do implementations throw "not supported" exceptions?
- [ ] Could the interface be split into smaller, cohesive interfaces?

---

## D — Dependency Inversion Principle (DIP)

> "High-level modules should not depend on low-level modules; both should depend on abstractions."

### What It Means

- Depend on abstractions (interfaces), not concretions (classes)
- High-level policy should not know about low-level implementation details
- Invert the dependency: low-level implements interfaces defined by high-level

### Violation Signs

```typescript
// BAD: High-level depends on low-level concrete class
class UserService {
  private repository = new PostgresUserRepository(); // Direct dependency

  getUser(id: string) {
    return this.repository.findById(id);
  }
}
```

### Correct Implementation

```typescript
// GOOD: Both depend on abstraction
interface UserRepository {
  findById(id: string): Promise<User>;
  save(user: User): Promise<void>;
}

class PostgresUserRepository implements UserRepository {
  findById(id: string) { /* Postgres implementation */ }
  save(user: User) { /* Postgres implementation */ }
}

class UserService {
  constructor(private repository: UserRepository) {} // Depends on abstraction

  getUser(id: string) {
    return this.repository.findById(id);
  }
}

// In NestJS module
@Module({
  providers: [
    UserService,
    { provide: 'UserRepository', useClass: PostgresUserRepository },
  ],
})
export class UsersModule {}
```

### Audit Checklist

- [ ] Do services instantiate their dependencies directly (new Class())?
- [ ] Are external services (DB, APIs) accessed directly or through interfaces?
- [ ] Can you swap implementations without changing the consuming code?

---

## Quick Reference Table

| Principle | One-Liner | Violation Sign |
|-----------|-----------|----------------|
| **SRP** | One class, one reason to change | Class does multiple unrelated things |
| **OCP** | Extend, don't modify | Adding features requires changing existing code |
| **LSP** | Subtypes must be substitutable | Subclass breaks parent's contract |
| **ISP** | Small, focused interfaces | Implementations throw "not supported" |
| **DIP** | Depend on abstractions | Direct instantiation of dependencies |
