import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileQuestion, ArrowLeft } from "lucide-react";

export default function DashboardNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-navy/10">
        <FileQuestion className="w-8 h-8 text-navy" />
      </div>
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-navy">404</h1>
        <h2 className="text-xl font-semibold text-gray-900">
          Page Not Found
        </h2>
        <p className="text-muted-foreground max-w-md">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>
      <Button asChild variant="outline" className="gap-2">
        <Link href="/bookings">
          <ArrowLeft className="w-4 h-4" />
          Back to Bookings
        </Link>
      </Button>
    </div>
  );
}
