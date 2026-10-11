import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { pastPieView, pieView } from "@/testing/fixtures";
import { BiteList } from "./bite-list";
import { Legend } from "./legend";
import { PieDiagram } from "./pie-diagram";
import { FocusProvider } from "./focus";
import { FocusStory } from "./focus-story";
import { StapleList } from "./staple-list";

function board(pie = pieView) {
  render(
    <FocusProvider focuses={pie.focuses}>
      <PieDiagram
        slices={pie.slices}
        label="Pie"
        interactive
        {...(pie.gone !== undefined && { gone: pie.gone })}
      />
      <FocusStory pie={pie} />
      <Legend slices={pie.slices} />
      <StapleList staples={pie.staples} monthName={pie.monthName} />
      <BiteList bites={pie.bites} />
    </FocusProvider>,
  );

  return userEvent.setup();
}

const wedge = (sliceId: string) => document.querySelector(`[data-slice="${sliceId}"]`)!;

describe("single views", () => {
  it("explains how to read the pie until a slice is chosen", () => {
    board();

    expect(screen.getByRole("status")).toHaveTextContent(/hatching shows how much/);
    expect(screen.getAllByRole("listitem").length).toBeGreaterThan(3);
  });

  it("isolates a tapped slice, tells its pace and filters the lists", async () => {
    const user = board();

    await user.click(wedge("wants"));

    expect(screen.getByRole("status")).toHaveTextContent(
      "Wants is going fast: about a quarter of it is left, with about two thirds of October to go.",
    );
    expect(wedge("needs")).toHaveClass("opacity-25");
    expect(wedge("wants")).not.toHaveClass("opacity-25");
    expect(screen.getByRole("button", { name: /^Wants/ })).toHaveAttribute("aria-pressed", "true");

    const bites = screen.getByRole("heading", { name: /Eaten this month/ }).parentElement!;

    expect(
      within(bites)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Shoes3/4 of Wants"]);
    expect(screen.getByRole("heading", { name: /Every month/ })).toHaveTextContent("Wants");
  });

  it("shows every slice again from the legend or the Show all button", async () => {
    const user = board();

    await user.click(screen.getByRole("button", { name: /^Needs/ }));
    expect(screen.getByRole("status")).toHaveTextContent("Needs is on pace");

    await user.click(screen.getByRole("button", { name: "Show all" }));
    expect(wedge("needs")).not.toHaveClass("opacity-25");
    expect(screen.getByRole("status")).toHaveTextContent(/hatching/);

    await user.click(screen.getByRole("button", { name: /^Savings/ }));
    await user.click(screen.getByRole("button", { name: /^Savings/ }));
    expect(screen.getByRole("button", { name: /^Savings/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("says when a focused slice has no bites, and tells a past month in the past tense", async () => {
    const user = board(pastPieView);

    await user.click(screen.getByRole("button", { name: /^Savings/ }));

    expect(screen.getByText("Nothing here for Savings.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("All of Savings was left in September.");
  });

  it("shows what comes back every month, or what was eaten once, across slices", async () => {
    const user = board();

    await user.click(screen.getByRole("button", { name: "Every month" }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "Every month, 2 staples take about a third of your pie.",
    );
    expect(wedge("needs")).not.toHaveClass("opacity-25");
    expect(screen.queryByRole("heading", { name: /Eaten this month/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "One time" }));

    expect(screen.getByRole("button", { name: "One time" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByRole("heading", { name: /Every month/ })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("2 bites taken once this month ate");
  });

  it("does nothing outside a pie that can be focused", async () => {
    render(<Legend slices={pieView.slices} />);

    expect(screen.getAllByRole("button")[0]).toBeDisabled();
  });
});
