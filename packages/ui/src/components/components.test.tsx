import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from "./field";
import { Input } from "./input";
import { NativeSelect, NativeSelectOption } from "./native-select";
import { RadioGroup, RadioGroupItem } from "./radio-group";
import { Separator } from "./separator";

describe("Button", () => {
  it("renders a pill button with its variant and size", () => {
    render(
      <Button variant="outline" size="lg">
        Bake
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Bake" });

    expect(button).toHaveAttribute("data-variant", "outline");
    expect(button).toHaveAttribute("data-size", "lg");
    expect(button).toHaveClass("rounded-full", "h-12");
  });

  it("does not animate its focus ring", () => {
    render(<Button>Go</Button>);

    expect(screen.getByRole("button").className).not.toMatch(/transition-all|box-shadow/);
  });

  it("can render as its child, such as a link", () => {
    render(
      <Button asChild>
        <a href="https://example.com/pie">Open</a>
      </Button>,
    );

    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute("data-slot", "button");
  });

  it("ignores clicks when disabled", async () => {
    let clicks = 0;

    render(
      <Button disabled onClick={() => clicks++}>
        Nope
      </Button>,
    );
    await userEvent.setup().click(screen.getByRole("button"));

    expect(clicks).toBe(0);
  });
});

describe("Input and Field", () => {
  it("labels an input and reports invalid values", () => {
    render(
      <Field>
        <FieldLabel htmlFor="price">Price</FieldLabel>
        <Input id="price" aria-invalid />
      </Field>,
    );

    expect(screen.getByLabelText("Price")).toHaveAttribute("aria-invalid", "true");
  });

  it("shows one error, or a list of distinct errors", () => {
    const { rerender } = render(<FieldError errors={[{ message: "Too big" }]} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Too big");

    rerender(
      <FieldError
        errors={[{ message: "Too big" }, { message: "Too big" }, { message: "Not money" }]}
      />,
    );

    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Too big",
      "Not money",
    ]);
  });

  it("shows nothing without errors", () => {
    const { container } = render(<FieldError errors={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe("NativeSelect", () => {
  it("is a real select, so it posts with forms and works on phones", async () => {
    render(
      <NativeSelect aria-label="Currency" defaultValue="EUR">
        <NativeSelectOption value="EUR">Euro</NativeSelectOption>
        <NativeSelectOption value="JPY">Yen</NativeSelectOption>
      </NativeSelect>,
    );
    await userEvent.setup().selectOptions(screen.getByLabelText("Currency"), "JPY");

    expect(screen.getByLabelText("Currency")).toHaveValue("JPY");
  });
});

describe("RadioGroup", () => {
  it("picks one option and posts it with the form", async () => {
    const user = userEvent.setup();

    render(
      <form aria-label="slices">
        <FieldSet>
          <FieldLegend>Slice</FieldLegend>
          <RadioGroup name="slice" defaultValue="needs">
            <FieldLabel htmlFor="needs">
              <RadioGroupItem id="needs" value="needs" />
              Needs
            </FieldLabel>
            <FieldLabel htmlFor="wants">
              <RadioGroupItem id="wants" value="wants" />
              Wants
            </FieldLabel>
          </RadioGroup>
        </FieldSet>
      </form>,
    );

    await user.click(screen.getByRole("radio", { name: "Wants" }));

    const form = screen.getByRole("form", { name: "slices" });

    expect(screen.getByRole("radio", { name: "Wants" })).toBeChecked();
    expect(form instanceof HTMLFormElement && new FormData(form).get("slice")).toBe("wants");
  });
});

describe("Checkbox", () => {
  it("ticks and posts its value with the form", async () => {
    render(
      <form aria-label="staple">
        <FieldLabel htmlFor="every-month">
          <Checkbox id="every-month" name="everyMonth" />
          Every month
        </FieldLabel>
      </form>,
    );

    const box = screen.getByRole("checkbox", { name: "Every month" });

    expect(box).not.toBeChecked();
    await userEvent.setup().click(box);
    expect(box).toBeChecked();

    const form = screen.getByRole("form", { name: "staple" });

    expect(form instanceof HTMLFormElement && new FormData(form).get("everyMonth")).toBe("on");
  });
});

describe("Separator", () => {
  it("is decorative by default", () => {
    const { container } = render(<Separator />);

    expect(container.firstElementChild).toHaveAttribute("data-orientation", "horizontal");
  });
});
