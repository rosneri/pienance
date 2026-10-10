"use client";

import { Button } from "@pienance/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@pienance/ui/components/field";
import { Input } from "@pienance/ui/components/input";
import Link from "next/link";
import { useActionState } from "react";
import type { Credentials, SignUpDetails } from "@/server/account-actions";
import type { Outcome } from "@/server/outcome";
import { Answer } from "./answer";

type AccountFormProps =
  | { mode: "sign-in"; submit: (credentials: Credentials) => Promise<Outcome<null>> }
  | { mode: "sign-up"; submit: (details: SignUpDetails) => Promise<Outcome<null>> };

const copy = {
  "sign-in": {
    button: "Sign in",
    pending: "Signing in…",
    other: "New here? Create an account",
    otherHref: "/sign-up",
  },
  "sign-up": {
    button: "Create account",
    pending: "Creating…",
    other: "Have an account? Sign in",
    otherHref: "/sign-in",
  },
} as const;

/** What a refused attempt hands back: the reason, and what was typed (React resets the form). */
interface Refusal {
  readonly error: string;
  readonly name: string;
  readonly email: string;
}

export function AccountForm(props: AccountFormProps) {
  const words = copy[props.mode];

  const [refusal, dispatch, pending] = useActionState(
    async (_previous: Refusal | null, form: FormData): Promise<Refusal | null> => {
      const name = String(form.get("name") ?? "");
      const email = String(form.get("email") ?? "");
      const password = String(form.get("password") ?? "");

      const outcome =
        props.mode === "sign-up"
          ? await props.submit({ name, email, password })
          : await props.submit({ email, password });

      return outcome.ok ? null : { error: outcome.error, name, email };
    },
    null,
  );

  return (
    <form action={dispatch} aria-busy={pending}>
      <FieldGroup className="gap-5">
        {props.mode === "sign-up" && (
          <Field>
            <FieldLabel htmlFor="name">Name</FieldLabel>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              defaultValue={refusal?.name}
              required
              className="h-12"
            />
          </Field>
        )}

        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={refusal?.email}
            required
            className="h-12"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={props.mode === "sign-up" ? "new-password" : "current-password"}
            minLength={8}
            required
            aria-invalid={refusal !== null}
            className="h-12"
          />
        </Field>

        <div className="flex flex-wrap items-center gap-4">
          <Button size="lg" disabled={pending}>
            {pending ? words.pending : words.button}
          </Button>
          <Link
            href={words.otherHref}
            className="text-sm underline decoration-berry underline-offset-4"
          >
            {words.other}
          </Link>
        </div>

        <Answer tone={refusal ? "error" : undefined}>{refusal?.error}</Answer>
      </FieldGroup>
    </form>
  );
}
