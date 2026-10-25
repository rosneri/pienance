import type { RecutPieInput } from "@pienance/core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Outcome } from "@/server/outcome";
import type { Asked } from "@/server/pie-actions";
import { pieView } from "@/testing/fixtures";
import { MonthNav } from "./month-nav";
import { ResetPie } from "./reset-pie";
import { SliceEditor } from "./slice-editor";

function slicing(outcome: Outcome<typeof pieView> = { ok: true, value: pieView }) {
  const recuts: Asked<RecutPieInput>[] = [];

  const actions = {
    recutPie: async (input: Asked<RecutPieInput>) => {
      recuts.push(input);

      return outcome;
    },
  };

  render(<SliceEditor slices={pieView.slices} actions={actions} />);

  return { recuts, user: userEvent.setup() };
}

describe("SliceEditor", () => {
  it("renames, resizes and adds slices, then saves them", async () => {
    const { recuts, user } = slicing();

    await user.click(screen.getByRole("button", { name: "Change slices" }));
    expect(screen.getByLabelText("Percent of slice 2")).toHaveValue("30");

    await user.clear(screen.getByLabelText("Name of slice 1"));
    await user.type(screen.getByLabelText("Name of slice 1"), "Home");
    await user.clear(screen.getByLabelText("Percent of slice 2"));
    await user.type(screen.getByLabelText("Percent of slice 2"), "20");
    expect(screen.getByText("10% of the pie is not in a slice yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save slices" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Add a slice" }));
    expect(screen.getByLabelText("Percent of slice 4")).toHaveValue("10");
    await user.type(screen.getByLabelText("Name of slice 4"), "Travel");
    await user.click(screen.getByRole("button", { name: "Save slices" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Change slices" })).toBeVisible(),
    );
    expect(recuts).toEqual([
      {
        slices: [
          { id: "needs", name: "Home", percent: "50" },
          { id: "wants", name: "Wants", percent: "20" },
          { id: "savings", name: "Savings", percent: "20" },
          { id: undefined, name: "Travel", percent: "10" },
        ],
      },
    ]);
  });

  it("warns that removing a slice removes what was eaten from it", async () => {
    const { recuts, user } = slicing();

    await user.click(screen.getByRole("button", { name: "Change slices" }));
    await user.click(screen.getByRole("button", { name: "Remove Savings" }));

    expect(
      screen.getByText("Removing Savings also removes everything eaten from it, in every month."),
    ).toBeInTheDocument();
    expect(screen.getByText("20% of the pie is not in a slice yet.")).toBeInTheDocument();
    expect(recuts).toEqual([]);
  });

  it("says why the slices were refused", async () => {
    const { user } = slicing({ ok: false, error: "Each slice needs its own name" });

    await user.click(screen.getByRole("button", { name: "Change slices" }));
    await user.click(screen.getByRole("button", { name: "Save slices" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Each slice needs its own name");
  });
});

describe("ResetPie", () => {
  it("asks once, then deletes everything", async () => {
    const resets: string[] = [];
    const user = userEvent.setup();

    render(
      <ResetPie
        actions={{
          resetPie: async () => {
            resets.push("reset");

            return { ok: true, value: null };
          },
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Reset my data" }));
    await user.click(screen.getByRole("button", { name: "Keep my pie" }));
    expect(resets).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Reset my data" }));
    await user.click(screen.getByRole("button", { name: "Delete everything" }));

    await waitFor(() => expect(resets).toEqual(["reset"]));
  });
});

describe("MonthNav", () => {
  const shelf = ["2026-10", "2026-09", "2026-08"].map((month, index) => ({
    month,
    label: month,
    name: ["October", "September", "August"][index] ?? "",
    slices: [],
    leftoverWords: "about half",
    current: false,
  }));

  it("steps to the month before and after", () => {
    render(<MonthNav months={shelf} month="2026-09" />);

    expect(screen.getByRole("link", { name: "← August" })).toHaveAttribute(
      "href",
      "/?month=2026-08",
    );
    expect(screen.getByRole("link", { name: "October →" })).toHaveAttribute("href", "/");
  });

  it("offers no step past this month or before the oldest", () => {
    const { unmount } = render(<MonthNav months={shelf} month="2026-10" />);

    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(["← September"]);
    unmount();

    render(<MonthNav months={shelf} month="2026-08" />);
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(["September →"]);
  });

  it("shows nothing before a month has passed", () => {
    const { container } = render(<MonthNav months={[]} month="2026-10" />);

    expect(container).toBeEmptyDOMElement();
  });
});
