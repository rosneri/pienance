import type { BiteView, MoveBiteInput, PutBackBiteInput } from "@pienance/core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import type { Outcome } from "@/server/outcome";
import type { Asked } from "@/server/pie-actions";
import { pieView } from "@/testing/fixtures";
import { BiteList } from "./bite-list";
import { FocusProvider } from "./focus";

const [shoes] = pieView.bites;

/** The list as the page serves it: a put back bite leaves on the next render. */
function Eaten({ moved, calls }: { moved: Outcome<BiteView>; calls: string[] }) {
  const [bites, setBites] = useState(pieView.bites);

  const actions = {
    putBackBite: async ({ biteId }: Asked<PutBackBiteInput>): Promise<Outcome<null>> => {
      calls.push(`put back ${biteId}`);
      setBites((current) => current.filter((bite) => bite.id !== biteId));

      return { ok: true, value: null };
    },
    moveBite: async ({ biteId, sliceId }: Asked<MoveBiteInput>): Promise<Outcome<BiteView>> => {
      calls.push(`move ${biteId} ${sliceId}`);

      return moved;
    },
  };

  return (
    <FocusProvider focuses={pieView.focuses}>
      <BiteList bites={bites} slices={pieView.slices} actions={actions} />
    </FocusProvider>
  );
}

function setup(
  moved: Outcome<BiteView> = {
    ok: true,
    value: { ...shoes!, sliceId: "needs", sliceName: "Needs", portionWords: "about a tenth" },
  },
) {
  const calls: string[] = [];

  render(<Eaten moved={moved} calls={calls} />);

  return { calls, user: userEvent.setup() };
}

describe("BiteList", () => {
  it("is read-only without actions", () => {
    render(
      <FocusProvider focuses={pieView.focuses}>
        <BiteList bites={pieView.bites} />
      </FocusProvider>,
    );

    expect(screen.queryByRole("button", { name: /Options/ })).not.toBeInTheDocument();
  });

  it("moves a bite to any other slice and says where it went", async () => {
    const { calls, user } = setup();

    await user.click(screen.getByRole("button", { name: "Options for Shoes" }));

    expect(screen.queryByRole("button", { name: "Move to Wants" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Move to Needs" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Moved. It is about a tenth of Needs."),
    );
    expect(calls).toEqual(["move shoes needs"]);
  });

  it("confirms a put back inline, with focus on Keep", async () => {
    const { calls, user } = setup();

    await user.click(screen.getByRole("button", { name: "Options for Shoes" }));
    await user.click(screen.getByRole("button", { name: "Put back" }));

    expect(screen.getByText("Put back Shoes?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Keep" }));

    expect(calls).toEqual([]);
    expect(screen.getByText("Shoes")).toBeInTheDocument();
  });

  it("puts a bite back and moves focus to the next row", async () => {
    const { calls, user } = setup();

    await user.click(screen.getByRole("button", { name: "Options for Shoes" }));
    await user.click(screen.getByRole("button", { name: "Put back" }));
    await user.click(screen.getByRole("button", { name: "Put back" }));

    await waitFor(() => expect(screen.queryByText("Shoes")).not.toBeInTheDocument());
    expect(calls).toEqual(["put back shoes"]);
    expect(screen.getByRole("button", { name: "Options for Something" })).toHaveFocus();
  });

  it("shows why a bite could not be moved", async () => {
    const { user } = setup({ ok: false, error: "That bite is not in this month's pie." });

    await user.click(screen.getByRole("button", { name: "Options for Shoes" }));
    await user.click(screen.getByRole("button", { name: "Move to Savings" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("That bite is not in this month's pie."),
    );
  });
});
