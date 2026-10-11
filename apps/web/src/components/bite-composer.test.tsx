import type {
  StapleView,
  StockStapleInput,
  TakeBiteInput,
  WeighBiteInput,
  WeighingView,
} from "@pienance/core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Outcome } from "@/server/outcome";
import type { Asked } from "@/server/pie-actions";
import { pieView } from "@/testing/fixtures";
import { BiteComposer } from "./bite-composer";
import { FocusProvider } from "./focus";
import { Legend } from "./legend";

const fits: WeighingView = {
  sliceName: "Wants",
  portion: "1/5",
  ofSlice: "about a fifth",
  ofLeftover: "about a quarter",
  ofPie: "a sliver",
  leftAfter: "about half",
  stapled: "nothing",
  verdict: "fits",
};

const rent = pieView.staples[0]!;

function setup(weighed: Outcome<WeighingView> = { ok: true, value: fits }) {
  const weighs: Asked<WeighBiteInput>[] = [];
  const takes: Asked<TakeBiteInput>[] = [];
  const stocks: Asked<StockStapleInput>[] = [];

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
    stockStaple: async (input: Asked<StockStapleInput>): Promise<Outcome<StapleView>> => {
      stocks.push(input);

      return { ok: true, value: { ...rent, note: input.note, stockedThisMonth: true } };
    },
  };

  const row = (changing: StapleView | null = null) => (
    <FocusProvider focuses={pieView.focuses}>
      <Legend slices={pieView.slices} />
      <ul>
        <BiteComposer
          slices={pieView.slices}
          currency="EUR"
          actions={actions}
          changing={changing}
        />
      </ul>
    </FocusProvider>
  );

  const { rerender } = render(row());

  return {
    weighs,
    takes,
    stocks,
    change: (staple: StapleView) => rerender(row(staple)),
    user: userEvent.setup(),
  };
}

const price = () => screen.getByLabelText("Price (€)");

describe("BiteComposer", () => {
  it("is a + row until it is opened", async () => {
    const { user } = setup();

    expect(screen.queryByLabelText("Price (€)")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add a bite" }));

    expect(price()).toHaveFocus();
    expect(screen.getByRole("radio", { name: "Needs" })).toBeChecked();
  });

  it("weighs the bite as the price is typed: its portion and the verdict", async () => {
    const { weighs, user } = setup();

    await user.click(screen.getByRole("button", { name: "Add a bite" }));
    await user.click(screen.getByRole("radio", { name: "Wants" }));
    await user.type(price(), "80");

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "1/5 of Wants · Fits: leaves about half of Wants.",
      ),
    );
    // Typing pauses are what get weighed, not every key.
    expect(weighs).toEqual([{ sliceId: "wants", amount: "80" }]);
  });

  it("starts on the focused slice", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: /^Savings/ }));
    await user.click(screen.getByRole("button", { name: "Add a bite" }));

    expect(screen.getByRole("radio", { name: "Savings" })).toBeChecked();
  });

  it("takes the bite silently and closes", async () => {
    const { takes, user } = setup();

    await user.click(screen.getByRole("button", { name: "Add a bite" }));
    await user.type(screen.getByLabelText("What is it?"), "Tea");
    await user.type(price(), "12.50");
    await user.click(screen.getByRole("button", { name: "Take the bite" }));

    await waitFor(() =>
      expect(takes).toEqual([{ sliceId: "needs", amount: "12.50", note: "Tea" }]),
    );
    expect(screen.getByRole("button", { name: "Add a bite" })).toBeInTheDocument();
  });

  it("shows why a bite could not be weighed or taken", async () => {
    const { user } = setup({ ok: false, error: "Bake a pie first" });

    await user.click(screen.getByRole("button", { name: "Add a bite" }));
    await user.type(price(), "5");

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Bake a pie first"));
    expect(price()).toHaveAttribute("aria-invalid", "true");

    await user.clear(price());
    await user.type(price(), "0");
    await user.click(screen.getByRole("button", { name: "Take the bite" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Nothing to take"));
  });

  it("adds a staple instead when every month is ticked", async () => {
    const { takes, stocks, user } = setup();

    await user.click(screen.getByRole("button", { name: "Add a bite" }));
    await user.type(screen.getByLabelText("What is it?"), "Rent");
    await user.type(price(), "900");
    await user.click(screen.getByRole("checkbox", { name: "Every month" }));

    expect(screen.queryByRole("button", { name: "Take the bite" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add to every month" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Added. Rent takes about half of Needs every month.",
      ),
    );
    expect(stocks).toEqual([{ sliceId: "needs", amount: "900", note: "Rent" }]);
    expect(takes).toEqual([]);
  });

  it("cancels without taking anything", async () => {
    const { takes, user } = setup();

    await user.click(screen.getByRole("button", { name: "Add a bite" }));
    await user.type(price(), "5");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(takes).toEqual([]);
    expect(screen.getByRole("button", { name: "Add a bite" })).toBeInTheDocument();
  });

  it("opens with a staple to change its amount, replacing the old one", async () => {
    const scrolled: Element[] = [];

    // jsdom does not lay pages out, so it cannot scroll.
    Element.prototype.scrollIntoView = function scrollIntoView(this: Element) {
      scrolled.push(this);
    };

    const { stocks, change, user } = setup();

    change(rent);

    expect(scrolled).toHaveLength(1);
    expect(price()).toHaveFocus();
    expect(screen.getByLabelText("What is it?")).toHaveValue("Rent");
    expect(price()).toHaveValue("1000.00");
    expect(screen.getByRole("checkbox", { name: "Every month" })).toBeChecked();

    await user.clear(price());
    await user.type(price(), "1100");
    await user.click(screen.getByRole("button", { name: "Add to every month" }));

    await waitFor(() => expect(stocks).toHaveLength(1));
    expect(stocks[0]).toEqual({ sliceId: "needs", amount: "1100", note: "Rent", replaces: "rent" });
  });
});
