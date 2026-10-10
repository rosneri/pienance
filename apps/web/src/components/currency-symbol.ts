/** "€" for EUR, "¥" for JPY…, from the platform's own currency data. */
export function currencySymbol(code: string): string {
  const parts = new Intl.NumberFormat("en", { style: "currency", currency: code }).formatToParts(0);

  return parts.find((part) => part.type === "currency")?.value ?? code;
}
