# @pienance/ui

The shared design system: [shadcn/ui](https://ui.shadcn.com) components on Tailwind v4, themed with
pienance's Hallmark tokens (`src/styles/globals.css`). Every web app imports
`@pienance/ui/globals.css` and the components from `@pienance/ui/components/*`.

Add a component from an app folder with the shadcn CLI; `components.json` routes it here:

```sh
cd apps/web && pnpm dlx shadcn@latest add dialog
```

## Local changes to shadcn sources

shadcn components are owned code. Changes made so they meet the Hallmark rules:

- `button`: pill radius (`rounded-full`); `lg` is 48 px high for touch; `transition-all` replaced
  with explicit properties.
- `input`, `native-select`, `radio-group`: the focus ring no longer transitions (it must appear
  instantly).
- Formatting and lint follow the repo (oxfmt, anti-slop).

Source: shadcn-ui/ui `apps/v4/registry/new-york-v4` at 2d3f1cd436b18ea12f24130de4df781355925b08.
