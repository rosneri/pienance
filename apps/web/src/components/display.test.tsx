import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Answer } from "./answer";
import { BiteList } from "./bite-list";
import { pieView } from "@/testing/fixtures";
import { Headline } from "./headline";
import { Legend } from "./legend";
import { Masthead } from "./masthead";
import { PageFrame } from "./page-frame";
import { PieDiagram } from "./pie-diagram";

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

describe("Legend", () => {
  it("lists each slice with what is left", () => {
    render(<Legend slices={pieView.slices} />);

    expect(screen.getByText("Wants").nextSibling).toHaveTextContent("about a quarter left");
    expect(screen.getAllByRole("term")).toHaveLength(3);
  });
});

describe("BiteList", () => {
  it("lists bites in rough words", () => {
    render(<BiteList bites={pieView.bites} />);

    const items = screen.getAllByRole("listitem");

    expect(items[0]).toHaveTextContent("Shoesabout three quarters of Wants");
    expect(within(items[1] ?? document.body).getByText("Something")).toBeInTheDocument();
  });

  it("says when nothing was eaten", () => {
    render(<BiteList bites={[]} />);

    expect(screen.getByText("Not a crumb yet.")).toBeInTheDocument();
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
