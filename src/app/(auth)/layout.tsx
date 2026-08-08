import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <aside
        className="flex flex-col items-center p-8 text-cream lg:w-[44%] lg:min-w-[380px] lg:items-stretch lg:justify-between lg:p-12"
        style={{
          background:
            "linear-gradient(165deg, var(--color-auth-panel-from) 0%, var(--color-auth-panel-via) 70%, var(--color-auth-panel-to) 100%)",
        }}
      >
        <p className="hidden text-xs font-semibold tracking-[0.22em] text-gold lg:block">
          SCONE &middot; NSW
        </p>
        <div className="flex flex-col items-center gap-7 text-center">
          <Image
            src="/logo.png"
            alt="Scone Willow Tree Hotel"
            width={483}
            height={353}
            priority
            className="h-auto w-full max-w-[200px] drop-shadow-[0_24px_40px_rgb(0_0_0/0.45)] lg:w-[78%] lg:max-w-[340px]"
          />
          <div className="hidden h-px w-11 bg-gold lg:block" aria-hidden />
          <p className="hidden max-w-80 font-display text-[22px] leading-normal italic text-cream/90 lg:block">
            Hotel &middot; Restaurant &middot; Bar &middot; Gelato — booking
            management for the Willow Tree team.
          </p>
        </div>
        <p className="hidden text-xs text-cream/50 lg:block">
          &copy; 2026 Scone Willow Tree Hotel
        </p>
      </aside>
      <main className="flex flex-1 items-center justify-center bg-auth-surface px-5 py-8 text-foreground transition-colors duration-[350ms] sm:px-8 lg:py-12">
        <div className="w-full sm:max-w-100">{children}</div>
      </main>
    </div>
  );
}
