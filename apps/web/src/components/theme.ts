/** A viewer's choice of colours; "system" follows the device. */
export type Theme = "system" | "light" | "dark";

export const themes: readonly Theme[] = ["system", "light", "dark"];

/** Where the choice is kept: in this viewer's browser only. */
export const themeKey = "theme";

/**
 * Runs in the page head before anything paints, so a chosen theme never flashes the
 * other one. Plain ES5 on purpose: it is inlined as a string.
 */
export const themeScript = `try{var t=localStorage.getItem("${themeKey}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

/** The theme a stored value names, or "system" for anything else. */
export function themeOf(value: string | null): Theme {
  return themes.find((theme) => theme === value) ?? "system";
}
