import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MonthNav } from "./month-nav";
import { ResetPie } from "./reset-pie";

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
