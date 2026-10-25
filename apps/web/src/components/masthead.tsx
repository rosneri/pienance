import { Button } from "@pienance/ui/components/button";
import Link from "next/link";

/**
 * Wordmark on the left edge; the month, re-slicing once there is a pie, and sign-out
 * when signed in, on the right.
 */
export function Masthead({
  month,
  signOut,
  reslice = false,
}: {
  month: string;
  signOut?: () => Promise<void>;
  reslice?: boolean;
}) {
  return (
    <header className="flex items-center justify-between gap-4">
      <span className="font-display text-xl font-[650] tracking-tight [font-variation-settings:'SOFT'_100] after:ml-1 after:inline-block after:size-[0.35em] after:rounded-full after:bg-berry after:content-['']">
        pienance
      </span>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>{month}</span>
        {reslice && (
          <Link
            href="/reslice"
            className="inline-flex h-11 items-center underline-offset-4 hover:text-foreground hover:underline"
            data-track="open-reslice"
          >
            Re-slice
          </Link>
        )}
        {signOut && (
          <form action={signOut}>
            <Button variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        )}
      </div>
    </header>
  );
}
