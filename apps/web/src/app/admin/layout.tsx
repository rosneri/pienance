import { ownerOf } from "@pienance/auth";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { PageFrame } from "@/components/page-frame";
import { auth, isAdmin } from "@/pienance";

export const metadata: Metadata = {
  title: "Admin · pienance",
  robots: { index: false, follow: false },
};

/** Only the people in ADMIN_USER_IDS get in; everyone else sees a plain 404. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const userId = await ownerOf(auth(), await headers());

  if (!userId) redirect("/sign-in");

  if (!isAdmin(userId)) notFound();

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
