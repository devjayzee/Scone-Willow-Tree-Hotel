# Next.js Architecture Patterns

> **Source**: Next.js Official Documentation
> **References**:
> - [Next.js Documentation](https://nextjs.org/docs)
> - [App Router](https://nextjs.org/docs/app)
> - [React Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)

Next.js is a React framework for building full-stack web applications with server-side rendering, static generation, and App Router architecture.

---

## App Router Architecture

### Directory Structure (App Router)

Next.js App Router uses file-based routing with special file conventions.

```
src/
├── app/                          # App Router root
│   ├── layout.tsx               # Root layout (required)
│   ├── page.tsx                 # Home page (/)
│   ├── loading.tsx              # Loading UI (optional)
│   ├── error.tsx                # Error boundary (optional)
│   ├── not-found.tsx            # 404 page (optional)
│   ├── api/                     # API routes
│   │   ├── auth/[...nextauth]/  # NextAuth.js routes
│   │   │   └── route.ts
│   │   ├── bookings/
│   │   │   ├── route.ts         # GET, POST /api/bookings
│   │   │   └── [id]/
│   │   │       └── route.ts     # GET, PUT, DELETE /api/bookings/:id
│   │   └── rooms/
│   │       └── route.ts
│   ├── (auth)/                  # Route group (no URL segment)
│   │   ├── layout.tsx           # Auth-specific layout
│   │   └── login/
│   │       └── page.tsx
│   └── (dashboard)/             # Protected dashboard group
│       ├── layout.tsx           # Dashboard layout with sidebar
│       ├── dashboard/
│       │   └── page.tsx
│       ├── bookings/
│       │   └── page.tsx
│       └── rooms/
│           └── page.tsx
├── components/
│   ├── ui/                      # Reusable UI components (shadcn/ui)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   └── ...
│   ├── booking/                 # Domain-specific components
│   │   ├── booking-table.tsx
│   │   └── booking-dialog.tsx
│   ├── layout/                  # Layout components
│   │   ├── sidebar.tsx
│   │   └── header.tsx
│   └── providers/               # Context providers
│       └── session-provider.tsx
├── lib/                         # Utilities and configurations
│   ├── prisma.ts               # Prisma client singleton
│   ├── auth.ts                 # NextAuth configuration
│   └── utils.ts                # Helper functions
├── types/                       # TypeScript type definitions
│   └── next-auth.d.ts
└── middleware.ts               # Route protection middleware
```

### Route Groups

Use parentheses `(groupname)` for organizational folders that don't affect the URL:

```typescript
// Good: Route groups for layout separation
app/
├── (marketing)/        # Marketing pages with marketing layout
│   ├── layout.tsx
│   ├── page.tsx        # /
│   └── about/
│       └── page.tsx    # /about
└── (dashboard)/        # Dashboard with dashboard layout
    ├── layout.tsx
    └── dashboard/
        └── page.tsx    # /dashboard
```

**Audit Checklist**:
- [ ] Route groups used for layout organization
- [ ] No business logic in layout files
- [ ] Proper loading and error boundaries
- [ ] Middleware for route protection

---

## Server Components vs Client Components

### Server Components (Default)

All components in App Router are Server Components by default.

```typescript
// Server Component (default) - NO 'use client' directive
// Can: fetch data, access backend resources, keep secrets on server
// Cannot: use hooks, event handlers, browser APIs

export default async function BookingsPage() {
  // Direct data fetching - no API call needed
  const bookings = await prisma.booking.findMany({
    include: { room: true },
  });

  return (
    <div>
      <h1>Bookings</h1>
      <BookingTable bookings={bookings} />
    </div>
  );
}
```

### Client Components

Use `'use client'` directive for interactivity:

```typescript
'use client';

// Client Component - interactive features
// Can: use hooks, event handlers, browser APIs
// Cannot: directly access backend, must use fetch

import { useState } from 'react';

export function BookingDialog({ booking }: { booking: Booking }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = async (data: FormData) => {
    const response = await fetch('/api/bookings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    // ...
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {/* Interactive UI */}
    </Dialog>
  );
}
```

### Composition Pattern

Server Components can render Client Components, but not vice versa:

```typescript
// Server Component
export default async function BookingsPage() {
  const bookings = await getBookings(); // Server-side data fetch

  return (
    <div>
      <BookingFilters /> {/* Client Component for interactivity */}
      <BookingList bookings={bookings} /> {/* Can be Server Component */}
    </div>
  );
}
```

**Audit Checklist**:
- [ ] 'use client' only where needed (interactivity, hooks)
- [ ] Data fetching in Server Components
- [ ] Proper composition (Server wraps Client)
- [ ] No unnecessary client-side data fetching

---

## API Route Handlers

### Route Handler Pattern (App Router)

```typescript
// app/api/bookings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GOOD: Route handler delegates to service layer
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const bookings = await bookingService.findAll();
  return NextResponse.json(bookings);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  // Validate with Zod
  const result = createBookingSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: result.error.flatten() },
      { status: 400 }
    );
  }

  const booking = await bookingService.create(result.data);
  return NextResponse.json(booking, { status: 201 });
}
```

### Dynamic Route Parameters

```typescript
// app/api/bookings/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
  });

  if (!booking) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(booking);
}
```

### Anti-Pattern: Business Logic in Route Handlers

```typescript
// BAD: Too much logic in route handler
export async function POST(request: NextRequest) {
  const body = await request.json();

  // Validation logic here
  if (!body.roomId) throw new Error('Room required');

  // Check availability logic here
  const existingBooking = await prisma.booking.findFirst({
    where: {
      roomId: body.roomId,
      OR: [
        { checkIn: { lte: body.checkOut }, checkOut: { gte: body.checkIn } }
      ]
    }
  });
  if (existingBooking) throw new Error('Room not available');

  // Calculate pricing logic here
  const room = await prisma.room.findUnique({ where: { id: body.roomId } });
  const nights = calculateNights(body.checkIn, body.checkOut);
  const total = room.pricePerNight * nights;

  // Create booking
  const booking = await prisma.booking.create({ ... });

  return NextResponse.json(booking);
}

// GOOD: Delegate to service layer
export async function POST(request: NextRequest) {
  const body = await request.json();
  const validation = createBookingSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const booking = await bookingService.create(validation.data);
  return NextResponse.json(booking, { status: 201 });
}
```

---

## Layered Architecture for Next.js

### Recommended Layers

```
┌─────────────────────────────────────┐
│         Pages / API Routes          │  ← Route handling, request parsing
│  (Thin layer, delegates to services)│
├─────────────────────────────────────┤
│            Services                 │  ← Business logic
│  (Domain logic, orchestration)      │
├─────────────────────────────────────┤
│          Prisma Client              │  ← Data access
│  (ORM, direct database operations)  │
├─────────────────────────────────────┤
│           Database                  │  ← PostgreSQL
└─────────────────────────────────────┘
```

### Service Layer Pattern

```typescript
// lib/services/booking-service.ts
import { prisma } from '@/lib/prisma';
import { CreateBookingInput, Booking } from '@/types';

export const bookingService = {
  async findAll(): Promise<Booking[]> {
    return prisma.booking.findMany({
      include: { room: true },
      orderBy: { checkIn: 'desc' },
    });
  },

  async create(data: CreateBookingInput): Promise<Booking> {
    // Validate availability
    await this.checkAvailability(data.roomId, data.checkIn, data.checkOut);

    // Generate booking reference
    const bookingRef = await this.generateBookingRef();

    return prisma.booking.create({
      data: {
        ...data,
        bookingRef,
        status: 'CONFIRMED',
      },
    });
  },

  async checkAvailability(roomId: string, checkIn: Date, checkOut: Date): Promise<void> {
    const conflict = await prisma.booking.findFirst({
      where: {
        roomId,
        status: { not: 'CANCELLED' },
        OR: [
          { checkIn: { lt: checkOut }, checkOut: { gt: checkIn } }
        ]
      }
    });

    if (conflict) {
      throw new Error('Room is not available for these dates');
    }
  },

  async generateBookingRef(): Promise<string> {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `BK-${date}-${random}`;
  },
};
```

---

## Middleware

### Route Protection

```typescript
// middleware.ts
import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    // Additional middleware logic if needed
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/bookings/:path*',
    '/rooms/:path*',
    '/api/bookings/:path*',
    '/api/rooms/:path*',
  ],
};
```

---

## Data Fetching Patterns

### Server Component Data Fetching

```typescript
// Preferred: Direct database access in Server Components
export default async function BookingsPage() {
  const bookings = await prisma.booking.findMany({
    include: { room: true },
  });

  return <BookingTable bookings={bookings} />;
}
```

### Client-Side Data Fetching (React Query)

```typescript
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useBookings() {
  return useQuery({
    queryKey: ['bookings'],
    queryFn: async () => {
      const res = await fetch('/api/bookings');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });
}

export function useCreateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateBookingInput) => {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}
```

---

## Quick Reference: Layer Responsibilities

| Layer | Responsibility | Should NOT |
|-------|----------------|------------|
| **Page** | Render UI, compose components | Contain business logic |
| **API Route** | HTTP handling, request/response mapping | Contain business logic |
| **Service** | Business logic, orchestration | Access HTTP context directly |
| **Prisma** | Data access | Contain business rules |
| **Component** | UI rendering | Fetch data (unless Client Component) |

---

## Component Health Metrics

Use these Next.js-specific metrics to assess component health during architecture audits.

### Page-Level Thresholds

| Metric | Warning | Critical | Rationale |
|--------|---------|----------|-----------|
| Components per page | >10 | >15 | Page doing too much |
| Direct DB calls | >3 | >5 | Consider service layer |
| Lines of code | >200 | >300 | Consider splitting |

### API Route Thresholds

| Metric | Warning | Critical | Rationale |
|--------|---------|----------|-----------|
| Lines per handler | >50 | >80 | Extract to service |
| Direct Prisma calls | >5 | >8 | Use service layer |
| Cyclomatic complexity | >10 | >15 | Too complex |

### Component Thresholds

| Metric | Warning | Critical | Rationale |
|--------|---------|----------|-----------|
| Props count | >8 | >12 | Consider composition |
| useEffect hooks | >3 | >5 | Too many side effects |
| Lines of code | >200 | >300 | Split component |
| useState hooks | >5 | >8 | Consider reducer |

### Quick Detection Script

```bash
#!/bin/bash
# Check Next.js project health

# Count 'use client' directives
echo "=== Client Components ==="
grep -r "'use client'" src/ --include="*.tsx" | wc -l
echo "client components found"

# Large files
echo ""
echo "=== Large Files (>300 LOC) ==="
find src/ -name "*.tsx" -o -name "*.ts" | while read f; do
  loc=$(wc -l < "$f" | tr -d ' ')
  if [ "$loc" -gt 300 ]; then
    echo "$loc lines: $f"
  fi
done | sort -rn

# API routes with direct Prisma
echo ""
echo "=== API Routes with Direct Prisma Access ==="
grep -rn "prisma\." src/app/api --include="*.ts" 2>/dev/null | head -10
```

### Audit Checklist for Next.js

**Per Page:**
- [ ] Uses Server Components where possible
- [ ] Data fetching at page level
- [ ] Proper loading/error states
- [ ] No business logic in page files

**Per API Route:**
- [ ] Delegates logic to services
- [ ] Proper error handling
- [ ] Input validation with Zod
- [ ] Consistent response format

**Per Component:**
- [ ] 'use client' only when needed
- [ ] Props well-typed
- [ ] Single responsibility
- [ ] No data fetching in non-page components

### Common Next.js Architecture Issues

| Issue | Detection | Fix |
|-------|-----------|-----|
| Business logic in API routes | LOC>80 per handler | Extract to service layer |
| Unnecessary client components | 'use client' with no hooks/events | Remove directive |
| Missing error boundaries | No error.tsx files | Add error handling |
| N+1 queries | Multiple sequential fetches | Use Prisma include |
| Missing loading states | No loading.tsx | Add loading UI |

### References

- [architecture-metrics.md](architecture-metrics.md) - General metrics thresholds
- [eslint-architecture-rules.md](eslint-architecture-rules.md) - ESLint rules for enforcement
- [Next.js Documentation](https://nextjs.org/docs)
