/** The pie's slice colours, as literal Tailwind classes so they are generated. */
const fills = ["fill-crust-1", "fill-crust-2", "fill-crust-3"] as const;

const backgrounds = ["bg-crust-1", "bg-crust-2", "bg-crust-3"] as const;

export function crustFill(index: number): string {
  return fills[index % fills.length] ?? fills[0];
}

export function crustBackground(index: number): string {
  return backgrounds[index % backgrounds.length] ?? backgrounds[0];
}
