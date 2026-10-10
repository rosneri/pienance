import { parseBeacon } from "@pienance/telemetry/contract";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Telemetry } from "./telemetry";

describe("Telemetry", () => {
  it("sends a pageview and tracked clicks when the page is hidden", () => {
    const bodies: string[] = [];

    const { unmount } = render(
      <>
        <Telemetry
          send={(body) => {
            bodies.push(body);

            return true;
          }}
        />
        <button type="button" data-track="weigh">
          Weigh
        </button>
      </>,
    );

    document.querySelector("button")?.click();
    unmount();

    const names = bodies.flatMap((body) => parseBeacon(body)?.items.map((item) => item.name) ?? []);

    expect(names).toEqual(["$pageview", "$click"]);
  });
});
