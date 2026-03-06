# Hotel Booking Management System - Implementation Checklist

## Project Overview
- **Stack**: Next.js 14 + TypeScript + PostgreSQL + Prisma + Tailwind/shadcn/ui
- **Users**: General Manager (full access) | Staff (limited access)
- **Deploy**: Vercel

---

## Phase 1: Project Setup

### Step 1.1: Initialize Project
- [x] Create Next.js project with TypeScript
  ```bash
  npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir
  ```
- [x] Install core dependencies
  ```bash
  npm install prisma @prisma/client next-auth @auth/prisma-adapter
  npm install @tanstack/react-query zod react-hook-form @hookform/resolvers
  npm install date-fns lucide-react bcryptjs
  npm install --save-dev @types/bcryptjs
  ```
- [x] Initialize shadcn/ui
  ```bash
  npx shadcn@latest init
  npx shadcn@latest add button input card table dialog form select badge label textarea separator avatar dropdown-menu sheet tabs calendar popover
  ```

### Step 1.2: Setup Prisma & Database
- [x] Initialize Prisma
  ```bash
  npx prisma init
  ```
- [x] Create `prisma/schema.prisma` with models:
  - User (id, email, password, name, role, isActive)
  - Room (id, roomNumber, roomType) - simplified
  - Booking (id, bookingRef, roomId, guestName, guestEmail, guestPhone, checkIn, checkOut, status, notes)
  - AuditLog (id, userId, action, entityType, entityId, details)
- [x] Create enums: Role, RoomType, BookingStatus
- [x] Run migration
  ```bash
  npx prisma migrate dev --name init
  ```
- [x] Create `src/lib/prisma.ts` (Prisma client singleton)
- [x] Create `prisma/seed.ts` with sample data
- [x] Run seed
  ```bash
  npx prisma db seed
  ```

### Step 1.3: Setup Authentication
- [x] Create `src/lib/auth.ts` (NextAuth config with credentials provider)
- [x] Create `src/app/api/auth/[...nextauth]/route.ts`
- [x] Create `src/middleware.ts` (protect /dashboard routes)
- [x] Create `src/app/(auth)/login/page.tsx`
- [x] Create `src/app/(auth)/layout.tsx`
- [x] Add password hashing utility (bcrypt) - *installed in Step 1.1*

**Checkpoint**: Can login as GM or Staff, redirects work

---

## Phase 2: Dashboard Layout & Navigation

### Step 2.1: Create Dashboard Shell
- [x] Create `src/app/(dashboard)/layout.tsx`
  - Sidebar navigation
  - Header with user info
  - Role-based menu items
- [x] Create `src/components/layout/Sidebar.tsx`
- [x] Create `src/components/layout/Header.tsx`
- [x] Navigation integrated into Sidebar

### Step 2.2: Navigation Items
- [ ] Dashboard (home) - Both roles
- [ ] Bookings - Both roles
- [ ] Rooms - Both roles
- [ ] Calendar - Both roles
- [ ] Reports - Both roles (limited for Staff)
- [ ] Settings - GM only
- [ ] Users - GM only

**Checkpoint**: Dashboard layout renders, navigation works, role-based menu shows

---

## Phase 3: Room Management

### Step 3.1: Room List Page
- [x] Create `src/app/(dashboard)/rooms/page.tsx`
- [x] Create `src/components/room/room-table.tsx`
- [x] Create `src/components/room/room-type-badge.tsx`
- [x] Create API route `src/app/api/rooms/route.ts` (GET, POST)

### Step 3.2: Room CRUD Operations
- [x] Create `src/components/room/room-dialog.tsx` (Add/Edit room form)
- [x] Create `src/components/room/delete-room-dialog.tsx`
- [x] Create API route `src/app/api/rooms/[id]/route.ts` (GET, PUT, DELETE)

**Checkpoint**: Can create, view, edit, delete rooms

---

## Phase 4: Booking Management

### Step 4.1: Booking List Page
- [x] Create `src/app/(dashboard)/bookings/page.tsx`
- [x] Create `src/components/booking/booking-table.tsx`
- [x] Create `src/components/booking/booking-status-badge.tsx`
- [x] Create API route `src/app/api/bookings/route.ts` (GET, POST)

### Step 4.2: Create Booking
- [x] Create `src/components/booking/booking-dialog.tsx`
  - Date picker for check-in/check-out
  - Room selector
  - Guest information fields
- [x] Booking reference generation (BK-YYYYMMDD-XXX)
- [x] Room availability check in API

### Step 4.3: Booking Details & Actions
- [x] Create `src/components/booking/booking-details-dialog.tsx`
  - View booking details
  - Check-in button
  - Check-out button
  - Cancel button
- [x] Create API route `src/app/api/bookings/[id]/route.ts` (GET, PUT, DELETE)

### Step 4.4: Double-Booking Prevention
- [x] Application-level check in booking creation
- [x] Show error message when conflict detected

**Checkpoint**: Can create bookings, check-in/out, cancel, no double bookings

---

## Phase 5: Calendar & Availability View

### Step 5.1: Install Calendar Library
- [ ] Install react-big-calendar
  ```bash
  npm install react-big-calendar date-fns
  npm install --save-dev @types/react-big-calendar
  ```

### Step 5.2: Build Calendar Component
- [ ] Create `src/app/(dashboard)/calendar/page.tsx`
- [ ] Create `src/components/calendar/AvailabilityCalendar.tsx`
  - Month/week view toggle
  - Color coding by booking status
  - Room filter/selector
- [ ] Create `src/components/calendar/CalendarEvent.tsx`
- [ ] Create API route `src/app/api/calendar/route.ts`

### Step 5.3: Calendar Interactions
- [ ] Click on empty slot → Open new booking dialog
- [ ] Click on booking → View booking details
- [ ] Drag booking to reschedule (GM only)

**Checkpoint**: Calendar shows all bookings, can interact to create/view

---

## Phase 6: Reports & Analytics

### Step 6.1: Install Charting Library
- [ ] Install Recharts
  ```bash
  npm install recharts
  ```

### Step 6.2: Dashboard Overview
- [ ] Create `src/app/(dashboard)/page.tsx` (Dashboard home)
- [ ] Create `src/components/dashboard/StatsCards.tsx`
  - Today's check-ins
  - Today's check-outs
  - Current occupancy
  - Pending bookings
- [ ] Create `src/components/dashboard/RecentBookings.tsx`
- [ ] Create `src/components/dashboard/QuickActions.tsx`

### Step 6.3: Reports Page
- [ ] Create `src/app/(dashboard)/reports/page.tsx`
- [ ] Create `src/components/reports/OccupancyChart.tsx`
- [ ] Create `src/components/reports/RevenueChart.tsx`
- [ ] Create `src/components/reports/BookingTrendsChart.tsx`
- [ ] Create `src/components/reports/RoomPerformanceTable.tsx`
- [ ] Create API route `src/app/api/reports/route.ts`
  - Occupancy rate calculation
  - Revenue aggregation
  - Booking statistics

### Step 6.4: Export Functionality
- [ ] Add CSV export for bookings
- [ ] Add CSV export for reports

**Checkpoint**: Dashboard shows stats, reports render with charts

---

## Phase 7: User Management (GM Only)

### Step 7.1: User List
- [ ] Create `src/app/(dashboard)/settings/users/page.tsx`
- [ ] Create `src/components/settings/UserTable.tsx`
- [ ] Create API route `src/app/api/users/route.ts`

### Step 7.2: User CRUD
- [ ] Create `src/components/settings/UserForm.tsx`
  - Create new staff/manager
  - Edit user details
  - Change role
  - Deactivate user
- [ ] Create API route `src/app/api/users/[id]/route.ts`

### Step 7.3: Audit Logs
- [ ] Create `src/app/(dashboard)/settings/logs/page.tsx`
- [ ] Create `src/components/settings/AuditLogTable.tsx`
- [ ] Add audit logging to all critical actions

**Checkpoint**: GM can manage users, audit logs recorded

---

## Phase 8: Polish & Finalize

### Step 8.1: Error Handling
- [ ] Add error boundaries
- [ ] Add toast notifications
  ```bash
  npx shadcn@latest add toast sonner
  ```
- [ ] Add loading states/skeletons
- [ ] Add empty states

### Step 8.2: Responsive Design
- [ ] Test on mobile viewport
- [ ] Add mobile navigation (hamburger menu)
- [ ] Ensure tables are scrollable on mobile

### Step 8.3: Security Review
- [ ] Verify all routes are protected
- [ ] Verify role-based access on API routes
- [ ] Sanitize all user inputs
- [ ] Secure password handling

**Checkpoint**: App handles errors gracefully, works on mobile

---

## Phase 9: Deployment

### Step 9.1: Prepare for Production
- [ ] Create `.env.example` with required variables
- [ ] Configure Vercel Postgres (or Neon/Supabase)
- [ ] Set environment variables in Vercel

### Step 9.2: Deploy
- [ ] Push to GitHub
- [ ] Connect to Vercel
- [ ] Run production migration
- [ ] Verify deployment

### Step 9.3: Post-Deployment
- [ ] Test login flow
- [ ] Test booking creation
- [ ] Verify calendar loads
- [ ] Check reports data

**Checkpoint**: App is live and functional

---

## Database Schema Reference

```prisma
enum Role { GENERAL_MANAGER, STAFF }
enum RoomType { SINGLE, DOUBLE, TWIN, SUITE, DELUXE, PRESIDENTIAL }
enum RoomStatus { AVAILABLE, OCCUPIED, MAINTENANCE, CLEANING }
enum BookingStatus { PENDING, CONFIRMED, CHECKED_IN, CHECKED_OUT, CANCELLED, NO_SHOW }

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String
  name      String
  role      Role     @default(STAFF)
  bookings  Booking[]
}

model Room {
  id            String     @id @default(cuid())
  roomNumber    String     @unique
  roomType      RoomType
  floor         Int
  capacity      Int
  pricePerNight Decimal
  status        RoomStatus @default(AVAILABLE)
  amenities     String[]
  bookings      Booking[]
}

model Booking {
  id             String        @id @default(cuid())
  bookingRef     String        @unique
  room           Room          @relation(fields: [roomId], references: [id])
  roomId         String
  guestName      String
  guestEmail     String
  guestPhone     String?
  checkIn        DateTime
  checkOut       DateTime
  numberOfGuests Int
  totalPrice     Decimal
  status         BookingStatus @default(CONFIRMED)
  notes          String?
  createdBy      User          @relation(fields: [createdById], references: [id])
  createdById    String
}

model AuditLog {
  id         String   @id @default(cuid())
  userId     String
  action     String
  entityType String
  entityId   String
  details    Json?
  createdAt  DateTime @default(now())
}
```

---

## Verification Checklist

### Authentication
- [ ] GM can login successfully
- [ ] Staff can login successfully
- [ ] Unauthorized users cannot access dashboard
- [ ] Staff cannot access GM-only pages

### Rooms
- [ ] Create new room
- [ ] Edit room details
- [ ] Delete room
- [ ] Room status updates correctly

### Bookings
- [ ] Create booking with valid dates
- [ ] Cannot double-book same room
- [ ] Check-in updates booking status
- [ ] Check-out updates booking status
- [ ] Cancel booking works

### Calendar
- [ ] Shows all bookings
- [ ] Color-coded by status
- [ ] Can create booking from calendar
- [ ] Can view booking details

### Reports
- [ ] Occupancy chart displays
- [ ] Revenue report shows correct data
- [ ] Export to CSV works

---

## Phase 10: Security & Performance Audit Fixes

> **Audit Date**: March 2, 2026
> **Status**: Pending user approval for each step

### Critical Priority

#### Step 1: Fix JSON parsing error handling in all API routes
- [ ] Wrap `await request.json()` in try-catch blocks
- [ ] Return 400 Bad Request for invalid JSON
- **Files**:
  - `src/app/api/bookings/route.ts`
  - `src/app/api/bookings/[id]/route.ts`
  - `src/app/api/rooms/route.ts`
  - `src/app/api/rooms/[id]/route.ts`
  - `src/app/api/staffs/route.ts`
  - `src/app/api/staffs/[id]/route.ts`

#### Step 2: Add authorization check to booking PUT endpoint
- [ ] Add role-based authorization to PUT endpoint
- [ ] Only GENERAL_MANAGER can modify booking status
- [ ] STAFF can only update guest details
- **File**: `src/app/api/bookings/[id]/route.ts`

#### Step 3: Fix booking reference generation race condition
- [ ] Use Prisma transaction with proper locking
- [ ] Prevent duplicate booking references under concurrent requests
- **File**: `src/app/api/bookings/route.ts` (lines 28-51)

#### Step 4: Fix N+1 query issues in reports endpoint
- [ ] Batch queries - fetch all data once
- [ ] Process in memory instead of querying inside loops
- [ ] Reduce from 12+ queries to 2-3 queries
- **File**: `src/app/api/reports/route.ts` (lines 97-180)

### High Priority

#### Step 5: Add missing database indexes
- [ ] Add index on `Booking.createdById`
- [ ] Add index on `Booking.createdAt`
- [ ] Add composite index on `[status, checkIn, checkOut]`
- **File**: `prisma/schema.prisma`

#### Step 6: Implement audit logging for sensitive operations
- [ ] Create audit logging utility function
- [ ] Log user login/logout
- [ ] Log booking create/update/delete
- [ ] Log room create/update/delete
- [ ] Log staff create/update/delete/activate/deactivate
- **Files**: All API routes + `src/lib/auth.ts`

#### Step 7: Add API pagination to list endpoints
- [ ] Add `page` and `limit` query parameters
- [ ] Implement default pagination (e.g., 20 items per page)
- [ ] Return total count for UI pagination
- **Files**:
  - `src/app/api/rooms/route.ts`
  - `src/app/api/bookings/route.ts`
  - `src/app/api/staffs/route.ts`

### Medium Priority

#### Step 8: Increase bcrypt salt rounds
- [ ] Change salt rounds from 10 to 12
- **File**: `src/lib/auth.ts` (line 96)

#### Step 9: Standardize error handling UI
- [ ] Use toast notifications for all user-facing errors
- [ ] Remove inline error divs where not needed
- **Files**:
  - `src/app/(dashboard)/rooms/page.tsx`
  - `src/app/(dashboard)/bookings/page.tsx`
  - `src/app/(dashboard)/settings/staffs/page.tsx`

#### Step 10: Extract duplicate authorization checks to middleware
- [ ] Create `src/lib/auth-utils.ts` with reusable functions
- [ ] Extract role check pattern to utility
- [ ] Refactor API routes to use utility
- **Files**: All API routes with role checks

---

## Audit Issues Reference

### Security Issues Found
| Severity | Issue | Status |
|----------|-------|--------|
| HIGH | Race condition in booking ref generation | Pending |
| HIGH | Missing auth check on booking PUT | Pending |
| MEDIUM | No rate limiting on API | Not Planned |
| MEDIUM | No CORS protection | Not Planned |
| MEDIUM | Weak bcrypt salt (10) | Pending |
| MEDIUM | No audit logging | Pending |

### Performance Issues Found
| Severity | Issue | Status |
|----------|-------|--------|
| HIGH | N+1 queries in reports (12+ queries) | Pending |
| MEDIUM | Missing database indexes | Pending |
| MEDIUM | No API pagination | Pending |
| LOW | Client-side filtering vs server-side | Not Planned |

### Code Quality Issues Found
| Severity | Issue | Status |
|----------|-------|--------|
| MEDIUM | No JSON parsing error handling | Pending |
| LOW | Duplicate authorization patterns | Pending |
| LOW | Inconsistent error UI | Pending |
