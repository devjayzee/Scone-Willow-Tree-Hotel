---
paths:
  - "src/components/**/*.tsx"
  - "src/hooks/use-*-form.ts"
---

# Rule 6: Forms = custom form-state hook + presentational steps + server zod

This project does NOT use react-hook-form (it's in `package.json` but has zero
usages — do not introduce it piecemeal; adopting it is a project-wide decision).
The working pattern:

1. **State hook** — `src/hooks/use-<domain>-form.ts` owns every field as
   `useState`, step progression, edit-mode hydration, and the submit handler.
   See `src/hooks/use-booking-form.ts` (`"guest" | "stay" | "summary"` steps).
2. **Presentational components** — step components under
   `src/components/<domain>/steps/` receive values + setters as props and render
   shadcn inputs. No fetching, no business rules.
3. **Submission** — the dialog/page wires the hook's submit to a TanStack
   mutation (Rule 5). The API route re-validates with zod (Rule 1) — client
   checks are UX sugar, the server is the gate.

## Canonical pattern

```ts
// use-booking-form.ts
export function useBookingForm({ open, rooms, onSubmit, onClose, initialBooking }: UseBookingFormOptions) {
  const isEditMode = Boolean(initialBooking);
  const [step, setStep] = useState<BookingStep>("guest");
  const [guestName, setGuestName] = useState("");
  // ... one useState per field, defaults like checkInTime "14:00"
}
```

```tsx
// components/booking/steps/guest-details-step.tsx (shape)
export function GuestDetailsStep({ guestName, onGuestNameChange, ... }: Props) {
  return <Input value={guestName} onChange={(e) => onGuestNameChange(e.target.value)} />;
}
```

Requirements:

- Dialogs reset their state when `open` flips (the hook handles this via
  `useEffect` on `open`).
- Edit mode hydrates from the existing entity (`initialBooking`) instead of a
  separate edit form.
- User feedback via `sonner` toasts on mutation success/error.
- Use shadcn `components/ui` primitives; don't hand-roll inputs/selects.

## Anti-patterns

```tsx
// WRONG: introducing react-hook-form in one component
const form = useForm<Schema>({ resolver: zodResolver(schema) });

// WRONG: field state scattered inside step components — steps are controlled
// by the form hook via props

// WRONG: trusting client validation and skipping schema validation in the route
```

## Audit checks

```bash
# RHF sneaking in
grep -rn "useForm\|zodResolver" src --include="*.ts" --include="*.tsx"

# fetch inside form/step components (belongs in hooks/*-api.ts)
grep -rn "fetch(" src/components --include="*.tsx"
```
