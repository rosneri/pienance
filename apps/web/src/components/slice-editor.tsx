"use client";

import type { SliceView } from "@pienance/core";
import { Button } from "@pienance/ui/components/button";
import { Input } from "@pienance/ui/components/input";
import { useState, useTransition } from "react";
import type { PieActions } from "@/server/pie-actions";
import { Answer } from "./answer";

/** A slice as it is being edited: a kept one has its id, a new one only a key. */
interface Row {
  readonly key: string;
  readonly id?: string;
  readonly name: string;
  readonly percent: string;
}

function rowsOf(slices: readonly SliceView[]): Row[] {
  return slices.map((slice) => ({
    key: slice.id,
    id: slice.id,
    name: slice.name,
    percent: String(Math.round((slice.to - slice.from) * 100)),
  }));
}

function totalOf(rows: readonly Row[]): number {
  return rows.reduce((sum, row) => sum + (Number(row.percent) || 0), 0);
}

/**
 * The person's own slices: rename, resize, add or remove them. Imports and the
 * add-a-bite row then use these slices.
 */
export function SliceEditor({
  slices,
  actions,
}: {
  slices: readonly SliceView[];
  actions: Pick<PieActions, "recutPie">;
}) {
  const [rows, setRows] = useState<readonly Row[] | null>(null);
  const [added, setAdded] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!rows) {
    return (
      <section className="grid content-start gap-3" aria-labelledby="slices-heading">
        <h2 id="slices-heading" className="text-2xl">
          Slices
        </h2>
        <p className="max-w-[60ch] text-muted-foreground">
          {slices.map((slice) => slice.name).join(", ")}. Make them your own: statements are sliced
          the same way.
        </p>
        <div>
          <Button
            variant="outline"
            className="h-11"
            onClick={() => setRows(rowsOf(slices))}
            data-track="change-slices"
          >
            Change slices
          </Button>
        </div>
      </section>
    );
  }

  const total = totalOf(rows);
  const kept = new Set(rows.flatMap((row) => (row.id ? [row.id] : [])));
  const removed = slices.filter((slice) => !kept.has(slice.id));

  function edit(key: string, change: Partial<Pick<Row, "name" | "percent">>) {
    setRows(
      (current) => current?.map((row) => (row.key === key ? { ...row, ...change } : row)) ?? null,
    );
  }

  function add() {
    setRows((current) => [
      ...(current ?? []),
      { key: `new-${added}`, name: "", percent: String(Math.max(100 - totalOf(current ?? []), 0)) },
    ]);
    setAdded(added + 1);
  }

  function save(edited: readonly Row[]) {
    startTransition(async () => {
      const outcome = await actions.recutPie({
        slices: edited.map(({ id, name, percent }) => ({ id, name, percent })),
      });

      setError(outcome.ok ? null : outcome.error);

      if (outcome.ok) setRows(null);
    });
  }

  return (
    <section className="grid content-start gap-4" aria-labelledby="slices-heading">
      <h2 id="slices-heading" className="text-2xl">
        Slices
      </h2>
      <ul className="grid gap-2" aria-label="Your slices">
        {rows.map((row, index) => (
          <li
            key={row.key}
            className="grid grid-cols-[minmax(0,1fr)_5.5rem_auto] items-center gap-2"
          >
            <Input
              aria-label={`Name of slice ${index + 1}`}
              value={row.name}
              maxLength={40}
              disabled={pending}
              onChange={(event) => edit(row.key, { name: event.currentTarget.value })}
              className="h-11"
            />
            <div className="flex items-center gap-1">
              <Input
                aria-label={`Percent of slice ${index + 1}`}
                value={row.percent}
                inputMode="numeric"
                disabled={pending}
                onChange={(event) => edit(row.key, { percent: event.currentTarget.value })}
                className="h-11 text-end tabular-nums"
              />
              <span className="text-muted-foreground">%</span>
            </div>
            <Button
              variant="ghost"
              className="size-11 text-lg"
              aria-label={`Remove ${row.name || `slice ${index + 1}`}`}
              disabled={pending || rows.length === 1}
              onClick={() => setRows(rows.filter((other) => other.key !== row.key))}
            >
              ×
            </Button>
          </li>
        ))}
      </ul>

      <p className={total === 100 ? "text-muted-foreground" : "text-tight"}>
        {total === 100
          ? "Adds up to the whole pie."
          : total < 100
            ? `${100 - total}% of the pie is not in a slice yet.`
            : `That is ${total - 100}% more than the whole pie.`}
      </p>

      {removed.length > 0 && (
        <p className="text-destructive">
          Removing {removed.map((slice) => slice.name).join(" and ")} also removes everything eaten
          from {removed.length === 1 ? "it" : "them"}, in every month.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          className="h-11"
          disabled={pending}
          onClick={add}
          data-track="add-slice"
        >
          Add a slice
        </Button>
        <Button
          variant="ghost"
          className="h-11"
          disabled={pending}
          onClick={() => {
            setRows(null);
            setError(null);
          }}
        >
          Cancel
        </Button>
        <Button
          className="ms-auto h-11"
          disabled={pending || total !== 100}
          onClick={() => save(rows)}
          data-track="recut-pie"
        >
          {pending ? "Saving…" : "Save slices"}
        </Button>
      </div>

      {error && <Answer tone="error">{error}</Answer>}
    </section>
  );
}
