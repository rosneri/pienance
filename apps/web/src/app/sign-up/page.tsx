import { ownerOf } from "@pienance/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AccountForm } from "@/components/account-form";
import { Headline } from "@/components/headline";
import { Masthead } from "@/components/masthead";
import { PageFrame } from "@/components/page-frame";
import { auth, clock } from "@/pienance";
import { signUp } from "../actions";

export const dynamic = "force-dynamic";

const monthName = new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" });

export default async function SignUpPage() {
  if (await ownerOf(auth(), await headers())) redirect("/");

  return (
    <PageFrame>
      <Masthead month={monthName.format(clock())} />
      <main className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start lg:gap-16">
        <section className="grid content-start gap-6" aria-labelledby="sign-up-heading">
          <Headline id="sign-up-heading">Start your first pie.</Headline>
          <p className="max-w-[60ch] text-muted-foreground">
            An account keeps your pie yours: only you see what is left.
          </p>
        </section>
        <AccountForm mode="sign-up" submit={signUp} />
      </main>
    </PageFrame>
  );
}
