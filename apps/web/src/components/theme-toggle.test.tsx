import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { themeOf, themeScript } from "./theme";
import { ThemeToggle } from "./theme-toggle";

afterEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe("ThemeToggle", () => {
  it("follows the system until a theme is chosen, and keeps the choice", async () => {
    const user = userEvent.setup();

    render(<ThemeToggle />);

    expect(screen.getByRole("button", { name: "System" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Dark" }));

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem("theme")).toBe("dark");
    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "System" }));

    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(window.localStorage.getItem("theme")).toBeNull();
  });

  it("applies a kept theme before paint, ignoring anything else", () => {
    window.localStorage.setItem("theme", "light");
    new Function(themeScript)();

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(themeOf("purple")).toBe("system");
  });
});
