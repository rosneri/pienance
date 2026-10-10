import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageFrame } from "@/components/page-frame";

export const metadata: Metadata = {
  title: "Admin · pienance",
  robots: { index: false, follow: false },
};

/** Chrome only: each admin page checks access itself (requireTelemetryReader). */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <PageFrame>
      <header className="flex items-center justify-between gap-4">
        <Link
          href="/"
          className="font-display text-xl font-[650] tracking-tight [font-variation-settings:'SOFT'_100] after:ml-1 after:inline-block after:size-[0.35em] after:rounded-full after:bg-berry after:content-['']"
        >
          pienance
        </Link>
        <Link
          href="/admin"
          className="text-sm whitespace-nowrap text-muted-foreground hover:text-foreground"
        >
          Admin
        </Link>
      </header>
      {children}
    </PageFrame>
  );
}
