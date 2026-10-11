import type { AppetiteSentence } from "@pienance/core";
import { cn } from "@pienance/ui/lib/utils";

/** "Usually": how each slice is eaten over the last three months, or a promise to tell. */
export function Appetite({ sentences }: { sentences: readonly AppetiteSentence[] }) {
  return (
    <section className="grid gap-2" aria-labelledby="appetite-heading">
      <h2 id="appetite-heading" className="text-2xl">
        Usually
      </h2>
      {sentences.length === 0 ? (
        <p className="max-w-[60ch] text-muted-foreground">
          After three months, pienance tells you how each slice is usually eaten.
        </p>
      ) : (
        sentences.map(({ sentence, streak }) => (
          <p
            key={sentence}
            className={cn(
              "max-w-[60ch]",
              streak === "overflowing" ? "text-tight" : "text-foreground",
            )}
          >
            {sentence}
          </p>
        ))
      )}
    </section>
  );
}
