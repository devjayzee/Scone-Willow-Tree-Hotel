import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExpiredLinkScreenProps {
  description: string;
  primaryHref: string;
  primaryLabel: string;
}

export function ExpiredLinkScreen({
  description,
  primaryHref,
  primaryLabel,
}: ExpiredLinkScreenProps) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-destructive bg-destructive/15">
        <X className="h-[26px] w-[26px] text-destructive" />
      </div>
      <h1 className="font-display text-4xl leading-[1.1] font-semibold text-foreground">
        This link has expired
      </h1>
      <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">
        {description}
      </p>
      <Button
        asChild
        className="mt-8 h-12 w-full rounded-lg text-[15px] font-semibold transition-[filter] hover:brightness-[1.12]"
      >
        <Link href={primaryHref}>{primaryLabel}</Link>
      </Button>
    </div>
  );
}
