import type { CarryOfferView, PieView } from "@pienance/core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import type { Outcome } from "@/server/outcome";
import { pieView } from "@/testing/fixtures";
import { CarryNote, CarryOffer } from "./carry-offer";

const offer: CarryOfferView = {
  month: "2026-09",
  monthName: "September",
  leftoverWords: "about a fifth",
};

const carried: PieView = {
  ...pieView,
  carry: { sliceId: "savings", sliceName: "Savings", from: "September" },
};

function setup(shown: CarryOfferView | null = offer) {
  const calls: string[] = [];

  const actions = {
    carryOver: async ({ sliceId }: { sliceId: string }): Promise<Outcome<PieView>> => {
      calls.push(`carry ${sliceId}`);

      return { ok: true, value: carried };
    },
    dropCarry: async (): Promise<Outcome<PieView>> => {
      calls.push("drop");

      return { ok: true, value: pieView };
    },
  };

  const view = render(<CarryOffer offer={shown} slices={pieView.slices} actions={actions} />);

  return { calls, view, user: userEvent.setup() };
}

afterEach(() => window.localStorage.clear());

describe("CarryOffer", () => {
  it("offers last month's leftover, Savings first, and carries it", async () => {
    const { calls, user } = setup();

    expect(screen.getByText("September left about a fifth of your pie.")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Savings" })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: "Wants" }));
    await user.click(screen.getByRole("button", { name: "Carry it" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Carried into Savings. It is bigger this month.",
      ),
    );
    expect(calls).toEqual(["carry wants"]);

    await user.click(screen.getByRole("button", { name: "Undo" }));

    await waitFor(() => expect(calls).toEqual(["carry wants", "drop"]));
  });

  it("stays hidden for a viewer who dismissed it this month", async () => {
    const { user, view } = setup();

    await user.click(screen.getByRole("button", { name: "Not this month" }));

    expect(screen.queryByText(/left about a fifth/)).not.toBeInTheDocument();

    view.unmount();
    setup();

    expect(screen.queryByText(/left about a fifth/)).not.toBeInTheDocument();
    expect(window.localStorage.getItem("carry-dismissed:2026-09")).toBe("yes");
  });

  it("says nothing without an offer", () => {
    const { view } = setup(null);

    expect(view.container).toBeEmptyDOMElement();
  });
});

describe("CarryNote", () => {
  it("tells where the leftover went and undoes it", async () => {
    const calls: string[] = [];
    const user = userEvent.setup();

    render(
      <CarryNote
        carry={carried.carry!}
        actions={{
          dropCarry: async () => {
            calls.push("drop");

            return { ok: true, value: pieView };
          },
        }}
      />,
    );

    expect(screen.getByText("Savings holds September's leftover.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Undo the carry" }));

    await waitFor(() => expect(calls).toEqual(["drop"]));
  });
});
