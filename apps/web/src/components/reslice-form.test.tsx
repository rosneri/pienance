import type { PieView, ReslicePreview, ResliceInput, ResliceView } from "@pienance/core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Outcome } from "@/server/outcome";
import type { Asked } from "@/server/pie-actions";
import { pieView } from "@/testing/fixtures";
import { ResliceForm } from "./reslice-form";

const view: ResliceView = {
  currency: "EUR",
  income: "3000.00",
  slices: [
    { id: "needs", name: "Needs", percent: 50, eaten: true, stocked: true },
    { id: "wants", name: "Wants", percent: 30, eaten: true, stocked: false },
    { id: "savings", name: "Savings", percent: 20, eaten: false, stocked: false },
  ],
  sweepSteps: ["1.00", "5.00", "10.00"],
};

function setup() {
  const previews: Asked<ResliceInput>[] = [];
  const saves: Asked<ResliceInput>[] = [];

  const actions = {
    previewReslice: async (input: Asked<ResliceInput>): Promise<Outcome<ReslicePreview>> => {
      previews.push(input);

      return input.slices.some((slice) => slice.percent === 15)
        ? { ok: true, value: { verdict: "overflows", sentence: "Wants would be all eaten." } }
        : { ok: true, value: { verdict: "fits", sentence: "Every slice still fits." } };
    },
    reslicePie: async (input: Asked<ResliceInput>): Promise<Outcome<PieView>> => {
      saves.push(input);

      return { ok: false, error: "Not now" };
    },
  };

  render(<ResliceForm view={view} actions={actions} />);

  return { previews, saves, user: userEvent.setup() };
}

const save = () => screen.getByRole("button", { name: "Save the pie" });

describe("ResliceForm", () => {
  it("starts from the pie and previews it without saving", async () => {
    const { saves } = setup();

    expect(screen.getByLabelText("What comes in each month? (€)")).toHaveValue("3000.00");
    expect(screen.getByRole("spinbutton", { name: "Share of Wants" })).toHaveAttribute(
      "aria-valuenow",
      "30",
    );
    expect(screen.getByText("about a third")).toBeInTheDocument();
    expect(screen.getByText("Shares add up to the whole pie.")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Every slice still fits."),
    );
    expect(saves).toEqual([]);
  });

  it("keeps Save disabled, with the reason, until the shares add up", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Less for Wants" }));

    expect(screen.getByText("Shares add up to 95%. Place 5% more.")).toBeInTheDocument();
    expect(save()).toBeDisabled();

    screen.getByRole("spinbutton", { name: "Share of Wants" }).focus();
    await user.keyboard("{ArrowUp}{ArrowUp}");

    expect(screen.getByText("Shares add up to 105%. Take 5% away.")).toBeInTheDocument();

    await user.keyboard("{ArrowDown}");

    expect(save()).toBeEnabled();
  });

  it("weighs the new shares as they change", async () => {
    const { previews, user } = setup();

    await user.click(screen.getByRole("button", { name: "Less for Wants" }));
    await user.click(screen.getByRole("button", { name: "Less for Wants" }));
    await user.click(screen.getByRole("button", { name: "Less for Wants" }));
    await user.click(screen.getByRole("button", { name: "More for Savings" }));
    await user.click(screen.getByRole("button", { name: "More for Savings" }));
    await user.click(screen.getByRole("button", { name: "More for Savings" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Wants would be all eaten."),
    );
    expect(previews.at(-1)?.slices.map((slice) => slice.percent)).toEqual([50, 15, 35]);
  });

  it("retires a slice with bites this month, greyed, with Keep to undo", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Retire Wants" }));

    expect(screen.getByText("Retired · still has bites this month")).toBeInTheDocument();
    expect(screen.getByText("Shares add up to 70%. Place 30% more.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Keep" }));

    expect(screen.getByRole("spinbutton", { name: "Share of Wants" })).toBeInTheDocument();
  });

  it("refuses to retire a slice with staples, and drops an empty one from the list", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Retire Needs" }));

    expect(screen.getByText("Stop Needs's staples first.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retire Savings" }));

    expect(screen.queryByRole("spinbutton", { name: "Share of Savings" })).not.toBeInTheDocument();
    expect(screen.queryByText("Retired · still has bites this month")).not.toBeInTheDocument();
  });

  it("adds a slice at 0% with its name ready to type over, and saves the draft", async () => {
    const { saves, user } = setup();

    await user.click(screen.getByRole("button", { name: "+ Add a slice" }));

    expect(screen.getByDisplayValue("New slice")).toHaveFocus();

    await user.keyboard("Travel");
    await user.click(screen.getByRole("button", { name: "Less for Savings" }));
    await user.click(screen.getByRole("button", { name: "More for Travel" }));
    await user.click(save());

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Not now"));
    expect(saves).toEqual([
      {
        monthlyIncome: "3000.00",
        slices: [
          { id: "needs", name: "Needs", percent: 50 },
          { id: "wants", name: "Wants", percent: 30 },
          { id: "savings", name: "Savings", percent: 15 },
          { id: undefined, name: "Travel", percent: 5 },
        ],
      },
    ]);
  });

  it("draws the small pie from the shares", () => {
    setup();

    expect(document.querySelectorAll("[data-slice]")).toHaveLength(pieView.slices.length);
  });
});
