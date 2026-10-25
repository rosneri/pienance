import {
  wedgePath,
  type DropStapleInput,
  type ShelfMonthView,
  type StapleView,
} from "@pienance/core";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Outcome } from "@/server/outcome";
import type { Asked } from "@/server/pie-actions";
import { pieView } from "@/testing/fixtures";
import { Answer } from "./answer";
import { Appetite } from "./appetite";
import { BiteList } from "./bite-list";
import { Headline } from "./headline";
import { Legend } from "./legend";
import { Masthead } from "./masthead";
import { PageFrame } from "./page-frame";
import { PieDiagram } from "./pie-diagram";
import { Shelf } from "./shelf";
import { StapleList } from "./staple-list";

describe("PieDiagram", () => {
  it("draws every slice, labelled for screen readers", () => {
    const { container } = render(<PieDiagram slices={pieView.slices} label="What is left" />);

    expect(screen.getByRole("img", { name: "What is left" })).toBeInTheDocument();
    expect(container.querySelectorAll("g")).toHaveLength(3);
  });

  it("splits a slice into what is left and what was eaten", () => {
    const { container } = render(<PieDiagram slices={pieView.slices} label="Pie" />);
    const wants = container.querySelectorAll("g")[1];
    const [eaten, left] = wants ? [...wants.querySelectorAll("path")] : [];

    expect(eaten?.getAttribute("d")).not.toBe("");
    expect(left?.getAttribute("class")).toBe("fill-crust-2");
  });
});

describe("PieDiagram pace", () => {
  it("dots staples off a slice's end and hatches pace over the rest, only while it runs", () => {
    const { container, rerender } = render(<PieDiagram slices={pieView.slices} label="Pie" />);

    expect(container.querySelectorAll("[data-pace]")).toHaveLength(0);
    // Staples are a given whether or not the month runs.
    expect(container.querySelectorAll("[data-staples]")).toHaveLength(1);

    rerender(<PieDiagram slices={pieView.slices} label="Pie" gone={0.5} />);

    const needs = container.querySelector('[data-slice="needs"]')!;
    const wants = container.querySelector('[data-slice="wants"]')!;

    // Needs spans half the pie and rent takes half of it: the second quarter turn.
    expect(needs.querySelector("[data-staples]")?.getAttribute("d")).toBe(
      wedgePath(0.25, 0.5, 100),
    );
    // Half the month is gone: half of what rent leaves, just before the staples.
    expect(needs.querySelector("[data-pace]")?.getAttribute("d")).toBe(wedgePath(0.125, 0.25, 100));
    // Wants has no staples: the month's half is the end half of the slice.
    expect(wants.querySelector("[data-pace]")?.getAttribute("d")).toBe(wedgePath(0.65, 0.8, 100));
    expect(wants.querySelector("[data-staples]")).toBeNull();
  });

  it("shows no pace on the first day", () => {
    const { container } = render(<PieDiagram slices={pieView.slices} label="Pie" gone={0.01} />);

    expect(container.querySelectorAll("[data-pace]")).toHaveLength(0);
  });

  it("hides a pie that something around it already names", () => {
    const { container } = render(<PieDiagram slices={pieView.slices} />);

    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("Legend", () => {
  it("lists each slice with what is left", () => {
    render(<Legend slices={pieView.slices} />);

    expect(screen.getByText("Wants").nextSibling).toHaveTextContent("about a quarter left");
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("adds staples and the pace word to fast rows only", () => {
    render(<Legend slices={pieView.slices} />);

    expect(screen.getByText("Needs").nextSibling).toHaveTextContent(
      /^about a third left · about half staples$/,
    );
    expect(screen.getByText("Wants").nextSibling).toHaveTextContent(
      /^about a quarter left · going fast$/,
    );
    expect(screen.getByText("Savings").nextSibling).toHaveTextContent(/^all left$/);
  });

  it("tells a retired slice that still has bites, without focusing it", () => {
    const slices = pieView.slices.map((slice) =>
      slice.id === "wants" ? { ...slice, retired: true } : slice,
    );

    render(<Legend slices={slices} />);

    expect(screen.getByText("Wants").nextSibling).toHaveTextContent(
      "Retired · still has bites this month",
    );
    expect(screen.getByRole("button", { name: /^Wants/ })).toBeDisabled();
  });
});

describe("StapleList", () => {
  function setup(staples: readonly StapleView[] = pieView.staples) {
    const drops: Asked<DropStapleInput>[] = [];
    const changes: StapleView[] = [];

    const actions = {
      dropStaple: async (input: Asked<DropStapleInput>): Promise<Outcome<StapleView>> => {
        drops.push(input);

        return { ok: true, value: { ...pieView.staples[0]!, endsAfter: "October" } };
      },
    };

    render(
      <StapleList
        staples={staples}
        monthName="October"
        actions={actions}
        onChange={(staple) => changes.push(staple)}
      />,
    );

    return { drops, changes, user: userEvent.setup() };
  }

  it("is hidden while the pantry is empty", () => {
    const { container } = render(<StapleList staples={[]} monthName="October" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("lists staples with their portion, and stopped ones as ending", () => {
    setup();

    const [rent, gym] = screen.getAllByRole("listitem");

    expect(rent).toHaveTextContent("Rent1/2 (Needs)");
    expect(gym).toHaveTextContent("GymEnds after October");
    expect(screen.getAllByRole("button", { name: /Options/ })).toHaveLength(1);
  });

  it("stops a staple after this month, once confirmed", async () => {
    const { drops, user } = setup();

    await user.click(screen.getByRole("button", { name: "Options for Rent" }));
    await user.click(screen.getByRole("button", { name: "Stop after October" }));

    expect(drops).toEqual([]);
    expect(screen.getByText("Stop after October?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Stop" }));

    await waitFor(() => expect(drops).toEqual([{ stapleId: "rent" }]));
  });

  it("removes a staple stocked this month, and keeps one on second thought", async () => {
    const fresh = { ...pieView.staples[0]!, stockedThisMonth: true };
    const { drops, user } = setup([fresh]);

    await user.click(screen.getByRole("button", { name: "Options for Rent" }));
    await user.click(screen.getByRole("button", { name: "Remove" }));
    await user.click(screen.getByRole("button", { name: "Keep it" }));

    expect(drops).toEqual([]);
    expect(screen.queryByRole("button", { name: "Keep it" })).not.toBeInTheDocument();
  });

  it("hands a staple over to change its amount", async () => {
    const { changes, user } = setup();

    await user.click(screen.getByRole("button", { name: "Options for Rent" }));
    await user.click(screen.getByRole("button", { name: "Change amount" }));

    expect(changes.map((staple) => staple.id)).toEqual(["rent"]);
  });

  it("is read-only without actions", () => {
    render(<StapleList staples={pieView.staples} monthName="September" />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("Shelf", () => {
  const month = (key: string, name: string, current: boolean): ShelfMonthView => ({
    month: key,
    label: name.slice(0, 3),
    name,
    slices: pieView.slices,
    leftoverWords: "about a tenth",
    current,
  });

  it("is hidden without past months", () => {
    const { container } = render(<Shelf months={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("links this month first, then past months, marking the one on screen", () => {
    render(
      <Shelf months={[month("2026-10", "October", false), month("2026-09", "September", true)]} />,
    );

    const [october, september] = screen.getAllByRole("link");

    expect(october).toHaveAttribute("href", "/");
    expect(october).not.toHaveAttribute("aria-current");
    expect(september).toHaveAttribute("href", "/?month=2026-09");
    expect(september).toHaveAttribute("aria-current", "page");
    expect(september).toHaveAccessibleName("September: about a tenth left");
  });
});

describe("Appetite", () => {
  it("promises to tell after three months", () => {
    render(<Appetite sentences={[]} />);

    expect(screen.getByText(/After three months/)).toHaveClass("text-muted-foreground");
  });

  it("tells overflow streaks in the tight tone", () => {
    render(
      <Appetite
        sentences={[
          { sentence: "Wants has overflowed three months running.", streak: "overflowing" },
          { sentence: "You usually eat about half of Needs." },
        ]}
      />,
    );

    expect(screen.getByText(/overflowed/)).toHaveClass("text-tight");
    expect(screen.getByText(/usually eat/)).toHaveClass("text-foreground");
  });
});

describe("BiteList", () => {
  it("lists bites in rough words", () => {
    render(<BiteList bites={pieView.bites} />);

    const items = screen.getAllByRole("listitem");

    expect(items[0]).toHaveTextContent("Shoes3/4 (Wants)");
    expect(within(items[1] ?? document.body).getByText("Something")).toBeInTheDocument();
  });

  it("says when nothing was eaten", () => {
    render(<BiteList bites={[]} />);

    expect(screen.getByText("Not a crumb yet.")).toBeInTheDocument();
  });

  it("names a past month", () => {
    render(<BiteList bites={[]} heading="Eaten in September" empty="Not a crumb that month." />);

    expect(screen.getByRole("heading", { name: "Eaten in September" })).toBeInTheDocument();
    expect(screen.getByText("Not a crumb that month.")).toBeInTheDocument();
  });
});

describe("Answer", () => {
  it.each([
    ["fits", "text-foreground"],
    ["tight", "text-tight"],
    ["overflows", "text-destructive"],
    ["error", "text-destructive"],
  ] as const)("colours a %s answer", (tone, colour) => {
    render(<Answer tone={tone}>Said</Answer>);

    expect(screen.getByRole("status")).toHaveClass(colour);
  });
});

describe("page chrome", () => {
  it("shows the wordmark and month, and sign-out only when signed in", () => {
    const { rerender } = render(<Masthead month="October" />);

    expect(screen.getByText("pienance")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();

    rerender(<Masthead month="October" signOut={async () => undefined} />);

    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("frames a page with its footer and a level-one headline", () => {
    render(
      <PageFrame>
        <Headline id="h">Hello</Headline>
      </PageFrame>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Hello" })).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toHaveTextContent("proportions, not numbers");
  });
});
