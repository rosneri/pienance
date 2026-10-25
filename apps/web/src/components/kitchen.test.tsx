import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { PieActions } from "@/server/pie-actions";
import { pieView } from "@/testing/fixtures";
import { Kitchen } from "./kitchen";

const refused = async () => ({ ok: false, error: "Not now" }) as const;

const actions: Pick<
  PieActions,
  "weighBite" | "takeBite" | "stockStaple" | "dropStaple" | "recutPie" | "resetPie"
> = {
  weighBite: refused,
  takeBite: refused,
  stockStaple: refused,
  dropStaple: refused,
  recutPie: refused,
  resetPie: refused,
};

describe("Kitchen", () => {
  it("shows the pantry, then the bites with a row to add one first", () => {
    render(<Kitchen pie={pieView} actions={actions} />);

    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Every month",
      "Eaten this month",
      "Slices",
      "Start over",
    ]);

    const [first] = screen.getAllByRole("list").at(-1)!.querySelectorAll("li");

    expect(first).toHaveTextContent("Add a bite");
  });

  it("points an empty month at staples", () => {
    render(<Kitchen pie={{ ...pieView, bites: [], staples: [] }} actions={actions} />);

    expect(
      screen.getByText(/Rent or subscriptions\? Add them with “Every month”/),
    ).toBeInTheDocument();
  });

  it("opens the add row with a staple to change its amount", async () => {
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
