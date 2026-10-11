import { ownerOf } from "@pienance/auth";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ImportForm } from "@/components/import-form";
import { Masthead } from "@/components/masthead";
import { PageFrame } from "@/components/page-frame";
import { auth, clock } from "@/pienance";
import { readPie, readStatement, signOut, takeBites } from "../actions";

export const dynamic = "force-dynamic";

const monthName = new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" });

const actions = { readStatement, takeBites };

export default async function Import() {
  if (!(await ownerOf(auth(), await headers()))) redirect("/sign-in");

  const pie = await readPie();

  if (!pie) redirect("/");

  return (
    <PageFrame>
      <Masthead month={monthName.format(clock())} signOut={signOut} />

      <main className="grid content-start gap-6">
        <Link
          href="/"
          className="text-sm whitespace-nowrap underline decoration-berry underline-offset-4"
        >
          Back to the pie
        </Link>
        <ImportForm
          slices={pie.slices.filter((slice) => !slice.retired)}
          currency={pie.currency}
          actions={actions}
        />
      </main>
    </PageFrame>
  );
}
