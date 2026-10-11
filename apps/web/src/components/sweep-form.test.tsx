import type { PieView, ResliceView, SweepChoice } from "@pienance/core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Outcome } from "@/server/outcome";
import { pieView } from "@/testing/fixtures";
import { SweepForm } from "./sweep-form";

const view: ResliceView = {
  currency: "EUR",
  income: "3000.00",
  slices: [
    { id: "needs", name: "Needs", percent: 50, eaten: false, stocked: false },
    { id: "savings", name: "Savings", percent: 50, eaten: false, stocked: false },
  ],
  sweepSteps: ["1.00", "5.00", "10.00"],
};

function setup(start: ResliceView = view) {
  const choices: SweepChoice[] = [];

  const setSweep = async (choice: SweepChoice): Promise<Outcome<PieView>> => {
    choices.push(choice);

    return {
      ok: true,
      value:
        "off" in choice
          ? pieView
          : {
              ...pieView,
              sweep: { sliceId: choice.sliceId, sliceName: "Savings", step: choice.step },
            },
    };
  };

  render(<SweepForm view={start} setSweep={setSweep} />);

  return { choices, user: userEvent.setup() };
}

describe("SweepForm", () => {
  it("turns rounding up on into Savings, then follows the step in its example", async () => {
    const { choices, user } = setup();

    expect(screen.queryByText(/bite sweeps/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Round bites up" }));

    expect(screen.getByRole("radio", { name: "Savings" })).toBeChecked();
    expect(screen.getByText("A 4.30 € bite sweeps 0.70 € into Savings.")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "10.00 €" }));

    expect(screen.getByText("A 43.00 € bite sweeps 7.00 € into Savings.")).toBeInTheDocument();
    await waitFor(() =>
      expect(choices).toEqual([
        { sliceId: "savings", step: "1.00" },
        { sliceId: "savings", step: "10.00" },
      ]),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Bites now round up to the next 10.00 into Savings.",
    );
  });

  it("turns it off at once, keeping past sweeps", async () => {
    const { choices, user } = setup({ ...view, sweep: { sliceId: "savings", step: "5.00" } });

    await user.click(screen.getByRole("checkbox", { name: "Round bites up" }));

    await waitFor(() => expect(choices).toEqual([{ off: true }]));
    expect(screen.getByRole("status")).toHaveTextContent("The sweep is off. Past sweeps stay.");
  });
});
