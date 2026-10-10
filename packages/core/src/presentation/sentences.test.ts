import { describe, expect, it } from "vitest";
import { describeLeftover, describeWeighing } from "./sentences";

const weighing = {
  sliceName: "Wants",
  ofSlice: "about a fifth",
  ofLeftover: "about a quarter",
  ofPie: "about a tenth",
  leftAfter: "about half",
} as const;

describe("sentences", () => {
  it.each([
    ["about half", "About half of your pie is left."],
    ["all", "Your whole pie is left."],
    ["nothing", "Your pie is all eaten."],
  ])("describes %s left", (words, sentence) => {
    expect(describeLeftover(words)).toBe(sentence);
  });

  it("describes each verdict", () => {
    expect(describeWeighing({ ...weighing, verdict: "fits" })).toBe(
      "Fits. It is about a fifth of your Wants slice and leaves about half of it.",
    );
    expect(describeWeighing({ ...weighing, verdict: "tight" })).toBe(
      "Tight. It fits, but takes about a quarter of what is left of Wants.",
    );
    expect(describeWeighing({ ...weighing, verdict: "overflows" })).toBe(
      "Too big. It is more than what is left of Wants.",
    );
  });
});
