import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { PieActions } from "@/server/pie-actions";
import { pieView } from "@/testing/fixtures";
import { Kitchen } from "./kitchen";

const refused = async () => ({ ok: false, error: "Not now" }) as const;

const actions: Pick<PieActions, "weighBite" | "takeBite" | "stockStaple" | "dropStaple"> = {
  weighBite: refused,
  takeBite: refused,
  stockStaple: refused,
  dropStaple: refused,
};

describe("Kitchen", () => {
  it("shows the pantry between the weigh form and the bites", () => {
    render(<Kitchen pie={pieView} actions={actions} />);

    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Is it worth it?",
      "Every month",
      "Eaten this month",
    ]);
  });

  it("points an empty month at staples", () => {
    render(<Kitchen pie={{ ...pieView, bites: [], staples: [] }} actions={actions} />);

    expect(screen.getByText(/Rent or subscriptions\? Tick “Every month”/)).toBeInTheDocument();
  });

  it("moves a staple into the weigh form to change its amount", async () => {
    Element.prototype.scrollIntoView = function scrollIntoView() {
      // jsdom does not lay pages out, so it cannot scroll.
    };

    const user = userEvent.setup();

    render(<Kitchen pie={pieView} actions={actions} />);

    await user.click(screen.getByRole("button", { name: "Options for Rent" }));
    await user.click(screen.getByRole("button", { name: "Change amount" }));

    expect(screen.getByLabelText("Price (€)")).toHaveValue("1000.00");
    expect(screen.getByRole("button", { name: "Add to every month" })).toBeInTheDocument();
  });
});
