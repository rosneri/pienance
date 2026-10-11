import { ownerOf } from "@pienance/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Headline } from "@/components/headline";
import { Masthead } from "@/components/masthead";
import { PageFrame } from "@/components/page-frame";
import { ResliceForm } from "@/components/reslice-form";
import { auth, clock } from "@/pienance";
import { previewReslice, readReslice, saveReslice, signOut } from "../actions";

export const dynamic = "force-dynamic";

const monthName = new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" });

const actions = { reslicePie: saveReslice, previewReslice };

export default async function Reslice() {
  if (!(await ownerOf(auth(), await headers()))) redirect("/sign-in");

  const view = await readReslice();

  if (!view) redirect("/");

  return (
    <PageFrame>
      <Masthead month={monthName.format(clock())} signOut={signOut} />

      <main className="grid content-start gap-8">
        <Headline id="reslice-heading">Re-slice your pie.</Headline>
        <p className="-mt-4 max-w-[60ch] text-muted-foreground">
          Change what comes in, or how it is cut. This month&rsquo;s bites stay where they are.
        </p>
        <ResliceForm view={view} actions={actions} />
      </main>
    </PageFrame>
  );
}
