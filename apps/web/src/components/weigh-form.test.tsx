import type { WeighBiteInput, TakeBiteInput, WeighingView } from "@pienance/core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Outcome } from "@/server/outcome";
import type { Asked } from "@/server/pie-actions";
import { pieView } from "@/testing/fixtures";
import { WeighForm } from "./weigh-form";

const fits: WeighingView = {
  sliceName: "Wants",
  ofSlice: "about a fifth",
  ofLeftover: "about a quarter",
  ofPie: "a sliver",
  leftAfter: "about half",
  verdict: "fits",
};

function setup(weighed: Outcome<WeighingView> = { ok: true, value: fits }) {
  const weighs: Asked<WeighBiteInput>[] = [];
  const takes: Asked<TakeBiteInput>[] = [];

  const actions = {
    weighBite: async (input: Asked<WeighBiteInput>) => {
      weighs.push(input);

      return weighed;
    },
    takeBite: async (input: Asked<TakeBiteInput>): Promise<Outcome<string>> => {
      takes.push(input);

      return input.amount === "0"
        ? { ok: false, error: "Nothing to take" }
        : { ok: true, value: "bite" };
    },
  };

  render(<WeighForm slices={pieView.slices} currency="EUR" actions={actions} />);

  return { weighs, takes, user: userEvent.setup() };
}

describe("WeighForm", () => {
  it("shows the price in the pie's currency and starts on the first slice", () => {
    setup();

    expect(screen.getByLabelText("Price (€)")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Needs" })).toBeChecked();
  });

  it("weighs a bite and answers in words, keeping what was typed", async () => {
    const { weighs, user } = setup();

    await user.type(screen.getByLabelText("What is it?"), "Concert");
    await user.type(screen.getByLabelText("Price (€)"), "80");
    await user.click(screen.getByRole("radio", { name: "Wants" }));
    await user.click(screen.getByRole("button", { name: "Weigh it" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Fits. It is about a fifth of your Wants slice and leaves about half of it.",
      ),
    );
    expect(weighs).toEqual([{ sliceId: "wants", amount: "80", note: "Concert" }]);
    expect(screen.getByLabelText("Price (€)")).toHaveValue("80");
  });

  it("takes a bite silently", async () => {
    const { takes, user } = setup();

    await user.type(screen.getByLabelText("Price (€)"), "12.50");
    await user.click(screen.getByRole("button", { name: "Take the bite" }));

    await waitFor(() => expect(takes).toHaveLength(1));
    expect(takes[0]).toEqual({ sliceId: "needs", amount: "12.50", note: "" });
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("shows why a bite could not be weighed or taken", async () => {
    const { user } = setup({ ok: false, error: "Bake a pie first" });

    await user.type(screen.getByLabelText("Price (€)"), "5");
    await user.click(screen.getByRole("button", { name: "Weigh it" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Bake a pie first"));
    expect(screen.getByLabelText("Price (€)")).toHaveAttribute("aria-invalid", "true");

    await user.clear(screen.getByLabelText("Price (€)"));
    await user.type(screen.getByLabelText("Price (€)"), "0");
    await user.click(screen.getByRole("button", { name: "Take the bite" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Nothing to take"));
  });
});
