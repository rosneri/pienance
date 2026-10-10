import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Credentials, SignUpDetails } from "@/server/account-actions";
import type { Outcome } from "@/server/outcome";
import { AccountForm } from "./account-form";

const refused: Outcome<null> = { ok: false, error: "Invalid email or password" };

describe("AccountForm", () => {
  it("signs in with email and password", async () => {
    const sent: Credentials[] = [];
    const user = userEvent.setup();

    render(
      <AccountForm
        mode="sign-in"
        submit={async (credentials) => {
          sent.push(credentials);

          return refused;
        }}
      />,
    );

    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /create an account/i })).toHaveAttribute(
      "href",
      "/sign-up",
    );

    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "correct horse");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(refused.ok ? "" : refused.error),
    );
    expect(sent).toEqual([{ email: "ada@example.com", password: "correct horse" }]);
    // A refused attempt keeps the email, so only the password needs retyping.
    expect(screen.getByLabelText("Email")).toHaveValue("ada@example.com");
  });

  it("signs up with a name", async () => {
    const sent: SignUpDetails[] = [];
    const user = userEvent.setup();

    render(
      <AccountForm
        mode="sign-up"
        submit={async (details) => {
          sent.push(details);

          return { ok: true, value: null };
        }}
      />,
    );

    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/sign-in");

    await user.type(screen.getByLabelText("Name"), "Ada");
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "correct horse");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() =>
      expect(sent).toEqual([{ name: "Ada", email: "ada@example.com", password: "correct horse" }]),
    );
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("asks the browser for at least eight characters", () => {
    render(<AccountForm mode="sign-up" submit={async () => refused} />);

    expect(screen.getByLabelText("Password")).toHaveAttribute("minLength", "8");
  });
});
