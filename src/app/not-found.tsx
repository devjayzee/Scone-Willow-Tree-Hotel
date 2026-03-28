import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileQuestion, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 space-y-6 px-4">
      <div className="flex items-center justify-center w-20 h-20 rounded-full bg-navy/10">
        <FileQuestion className="w-10 h-10 text-navy" />
      </div>
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold text-navy">404</h1>
        <h2 className="text-xl font-semibold text-gray-900">
          Page Not Found
        </h2>
        <p className="text-muted-foreground max-w-md">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>
      <Button asChild className="bg-navy hover:bg-navy-dark text-cream gap-2">
        <Link href="/">
          <Home className="w-4 h-4" />
          Go to Homepage
        </Link>
      </Button>
    </div>
  );
}
