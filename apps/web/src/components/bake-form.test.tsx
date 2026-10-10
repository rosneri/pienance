import type { BakePieInput, PieView } from "@pienance/core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Outcome } from "@/server/outcome";
import type { Asked } from "@/server/pie-actions";
import { pieView } from "@/testing/fixtures";
import { BakeForm } from "./bake-form";

function setup(outcome: Outcome<PieView>) {
  const baked: Asked<BakePieInput>[] = [];

  const bakePie = async (input: Asked<BakePieInput>) => {
    baked.push(input);

    return outcome;
  };

  render(<BakeForm defaultCurrency="USD" bakePie={bakePie} />);

  return { baked, user: userEvent.setup() };
}

describe("BakeForm", () => {
  it("offers every currency, starting on the default", () => {
    setup({ ok: true, value: pieView });

    expect(screen.getByLabelText("Currency")).toHaveValue("USD");
    expect(screen.getByRole("option", { name: "JPY — Japanese Yen" })).toBeInTheDocument();
  });

  it("bakes in the chosen currency", async () => {
    const { baked, user } = setup({ ok: true, value: pieView });

    await user.selectOptions(screen.getByLabelText("Currency"), "EUR");
    await user.type(screen.getByLabelText("What comes in each month?"), "2450,50");
    await user.click(screen.getByRole("button", { name: "Bake my pie" }));

    await waitFor(() => expect(baked).toEqual([{ monthlyIncome: "2450,50", currency: "EUR" }]));
  });

  it("shows why a pie could not be baked", async () => {
    const { user } = setup({ ok: false, error: '"lots" is not an amount of money' });

    await user.type(screen.getByLabelText("What comes in each month?"), "lots");
    await user.click(screen.getByRole("button", { name: "Bake my pie" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent('"lots" is not an amount of money'),
    );
    expect(screen.getByLabelText("What comes in each month?")).toHaveValue("lots");
  });
});
