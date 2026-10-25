"use client";

import {
  Proportion,
  roughly,
  shareStep,
  sliceNameLimit,
  type ResliceSliceView,
  type ResliceView,
  type SliceView,
} from "@pienance/core";
import { Button } from "@pienance/ui/components/button";
import { Field, FieldLabel, FieldLegend, FieldSet } from "@pienance/ui/components/field";
import { Input } from "@pienance/ui/components/input";
import { cn } from "@pienance/ui/lib/utils";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import type { PieActions } from "@/server/pie-actions";
import { Answer, type Tone } from "./answer";
import { weighDelay } from "./bite-composer";
import { crustBackground } from "./crust";
import { currencySymbol } from "./currency-symbol";
import { PieDiagram } from "./pie-diagram";

export type ResliceActions = Pick<PieActions, "reslicePie" | "previewReslice">;

/** A slice as it is being edited: a known one keeps its id, a new one has none yet. */
interface Row extends Omit<ResliceSliceView, "id"> {
  readonly key: string;
  readonly id?: string;
  readonly retiring: boolean;
}

interface Preview {
  /** The draft it answers, so a stale answer reads as "Weighing…". */
  readonly draft: string;
  readonly tone: Tone;
  readonly sentence: string;
}

const whole = 100;

/** How far each key moves a share stepper. */
const stepKeys = new Map([
  ["ArrowUp", shareStep],
  ["ArrowRight", shareStep],
  ["ArrowDown", -shareStep],
  ["ArrowLeft", -shareStep],
  ["PageUp", shareStep * 2],
  ["PageDown", -shareStep * 2],
]);

/** "Shares add up to 95%. Place 5% more." or null once they make the whole pie. */
function describeTotal(total: number): string | null {
  if (total < whole) return `Shares add up to ${total}%. Place ${whole - total}% more.`;

  if (total > whole) return `Shares add up to ${total}%. Take ${total - whole}% away.`;

  return null;
}

/** The small pie, drawn from the shares as they are picked. */
function sketch(rows: readonly Row[]): SliceView[] {
  let from = 0;

  return rows.map((row) => {
    const to = Math.min(from + row.percent / whole, 1);

    const view: SliceView = {
      id: row.key,
      name: row.name,
      retired: false,
      from,
      to,
      left: 1,
      leftWords: "all",
      stapled: 0,
    };

    from = to;

    return view;
  });
}

/**
 * Changes the pie's income and slices in place: names, shares in steps of 5%, new
 * slices and retired ones. A live line weighs this month's bites against the new
 * sizes before anything is saved.
 */
export function ResliceForm({ view, actions }: { view: ResliceView; actions: ResliceActions }) {
  const [income, setIncome] = useState(view.income);

  const [rows, setRows] = useState<Row[]>(() =>
    view.slices.map(({ id, ...slice }) => ({ ...slice, id, key: id, retiring: false })),
  );

  const [refused, setRefused] = useState<{ key: string; sentence: string } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const added = useRef(0);
  const [selecting, setSelecting] = useState<string | null>(null);

  const live = useMemo(() => rows.filter((row) => !row.retiring), [rows]);
  const total = live.reduce((sum, row) => sum + row.percent, 0);
  const totalWords = describeTotal(total);

  const input = useMemo(
    () => ({
      monthlyIncome: income,
      slices: live.map((row) => ({ id: row.id, name: row.name, percent: row.percent })),
    }),
    [income, live],
  );

  const draft = JSON.stringify(input);
  const ready = totalWords === null && live.every((row) => row.name.trim() !== "");

  // Weighs the draft once typing pauses; a later answer always replaces an earlier one.
  useEffect(() => {
    if (!ready) return;

    let current = true;

    const timer = setTimeout(async () => {
      const outcome = await actions.previewReslice(input);

      if (!current) return;

      setPreview(
        outcome.ok
          ? { draft, tone: outcome.value.verdict, sentence: outcome.value.sentence }
          : { draft, tone: "error", sentence: outcome.error },
      );
    }, weighDelay);

    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [ready, input, draft, actions]);

  function change(key: string, patch: Partial<Row>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    setError(null);
  }

  function retire(row: Row) {
    if (row.stocked) {
      return setRefused({ key: row.key, sentence: `Stop ${row.name}'s staples first.` });
    }

    if (live.length === 1) {
      return setRefused({ key: row.key, sentence: "A pie keeps at least one slice." });
    }

    setRefused(null);

    // A new slice has nothing to keep: it just goes.
    if (row.id === undefined) return setRows((current) => current.filter((r) => r !== row));

    change(row.key, { retiring: true });
  }

  function add() {
    const key = `new-${++added.current}`;

    setRows((current) => [
      ...current,
      { key, name: "New slice", percent: 0, eaten: false, stocked: false, retiring: false },
    ]);
    setSelecting(key);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!ready) return;

    startTransition(async () => {
      // Saved, the action takes the page back to the pie.
      const outcome = await actions.reslicePie(input);

      if (!outcome.ok) setError(outcome.error);
    });
  }

  const previewing = ready && preview?.draft !== draft;

  return (
    <form
      onSubmit={submit}
      aria-busy={pending}
      aria-label="Re-slice the pie"
      className="grid gap-8 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:items-start lg:gap-16"
    >
      <div className="grid justify-items-center lg:sticky lg:top-6">
        <PieDiagram slices={sketch(live)} className="max-w-40 lg:max-w-72" />
      </div>

      <div className="grid gap-8">
        <Field className="max-w-sm">
          <FieldLabel htmlFor="income">
            What comes in each month? ({currencySymbol(view.currency)})
          </FieldLabel>
          <Input
            id="income"
            name="income"
            inputMode="decimal"
            autoComplete="off"
            required
            className="h-11 tabular-nums"
            value={income}
            onChange={(event) => {
              setIncome(event.target.value);
              setError(null);
            }}
          />
        </Field>

        <FieldSet className="gap-3">
          <FieldLegend variant="label">Slices</FieldLegend>
          <ul className="grid">
            {rows.map((row, index) =>
              row.retiring ? (
                row.eaten && (
                  <li
                    key={row.key}
                    className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-1 border-b py-3 text-muted-foreground"
                  >
                    <span className="font-medium">{row.name}</span>
                    <span className="me-auto text-sm">Retired · still has bites this month</span>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11"
                      onClick={() => change(row.key, { retiring: false })}
                      data-track="keep-slice"
                    >
                      Keep
                    </Button>
                  </li>
                )
              ) : (
                <SliceRow
                  key={row.key}
                  row={row}
                  tone={crustBackground(live.indexOf(row))}
                  index={index}
                  select={selecting === row.key}
                  onSelected={() => setSelecting(null)}
                  refused={refused?.key === row.key ? refused.sentence : null}
                  onName={(name) => change(row.key, { name })}
                  onPercent={(percent) => change(row.key, { percent })}
                  onRetire={() => retire(row)}
                />
              ),
            )}
          </ul>
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-fit"
            onClick={add}
            data-track="add-slice"
          >
            + Add a slice
          </Button>
        </FieldSet>

        <div className="sticky bottom-0 -mx-4 grid gap-3 border-t bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:static lg:mx-0 lg:border-0 lg:p-0">
          <p className={cn("min-h-6", totalWords ? "text-tight" : "text-muted-foreground")}>
            {totalWords ?? "Shares add up to the whole pie."}
          </p>
          <Answer tone={error ? "error" : previewing ? undefined : preview?.tone}>
            {error ?? (ready && (previewing ? "Weighing…" : preview?.sentence))}
          </Answer>
          <div className="flex flex-wrap items-center gap-4">
            <Button size="lg" disabled={!ready || pending} data-track="reslice">
              {pending ? "Saving…" : "Save the pie"}
            </Button>
            <Link href="/" className="underline underline-offset-4">
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </form>
  );
}

function SliceRow({
  row,
  tone,
  index,
  select,
  onSelected,
  refused,
  onName,
  onPercent,
  onRetire,
}: {
  row: Row;
  /** The crust colour of its wedge. */
  tone: string;
  index: number;
  /** Just added: its name is selected for typing over. */
  select: boolean;
  onSelected: () => void;
  refused: string | null;
  onName: (name: string) => void;
  onPercent: (percent: number) => void;
  onRetire: () => void;
}) {
  const nameInput = useRef<HTMLInputElement>(null);
  const label = row.name.trim() || "this slice";
  const step = (by: number) => onPercent(Math.min(Math.max(row.percent + by, 0), whole));

  useEffect(() => {
    if (!select) return;

    nameInput.current?.focus();
    nameInput.current?.select();
    onSelected();
  }, [select, onSelected]);

  function keys(event: KeyboardEvent<HTMLSpanElement>) {
    const by = stepKeys.get(event.key);

    if (by === undefined) return;

    event.preventDefault();
    step(by);
  }

  return (
    <li className="grid gap-2 border-b py-3">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <span className={cn("size-3 rounded-full", tone)} aria-hidden />
        <FieldLabel htmlFor={`slice-name-${index}`} className="sr-only">
          Name of slice {index + 1}
        </FieldLabel>
        <Input
          ref={nameInput}
          id={`slice-name-${index}`}
          autoComplete="off"
          required
          maxLength={sliceNameLimit}
          className="h-11"
          value={row.name}
          onChange={(event) => onName(event.target.value)}
        />
        <Button
          type="button"
          variant="ghost"
          className="size-11 text-lg"
          aria-label={`Retire ${label}`}
          onClick={onRetire}
          data-track="retire-slice"
        >
          ×
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 ps-6">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            className="size-11 text-lg"
            aria-label={`Less for ${label}`}
            disabled={row.percent === 0}
            onClick={() => step(-shareStep)}
          >
            −
          </Button>
          <span
            role="spinbutton"
            tabIndex={0}
            aria-label={`Share of ${label}`}
            aria-valuenow={row.percent}
            aria-valuemin={0}
            aria-valuemax={whole}
            aria-valuetext={`${row.percent}%`}
            onKeyDown={keys}
            className="grid h-11 min-w-16 place-items-center rounded-md text-center tabular-nums outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {row.percent}%
          </span>
          <Button
            type="button"
            variant="outline"
            className="size-11 text-lg"
            aria-label={`More for ${label}`}
            disabled={row.percent === whole}
            onClick={() => step(shareStep)}
          >
            +
          </Button>
        </div>
        <span className="text-sm text-muted-foreground">
          {roughly(Proportion.of(row.percent / whole))}
        </span>
      </div>
      {refused && <p className="ps-6 text-sm text-destructive">{refused}</p>}
    </li>
  );
}
