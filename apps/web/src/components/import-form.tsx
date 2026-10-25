"use client";

import {
  columnRoles,
  dateOrders,
  type ColumnRole,
  type DateOrder,
  type DraftBite,
  type SliceView,
  type StatementLayout,
} from "@pienance/core";
import { Button } from "@pienance/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@pienance/ui/components/field";
import { Input } from "@pienance/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@pienance/ui/components/native-select";
import { useState, useTransition } from "react";
import { largestUpload } from "@/import/lines";
import { isSpreadsheet, spreadsheetTypes } from "@/import/spreadsheet-types";
import type { PieActions, StatementReading } from "@/server/pie-actions";
import { Answer } from "./answer";
import { currencySymbol } from "./currency-symbol";

const roleNames: Record<ColumnRole, string> = {
  date: "Day",
  amount: "Amount",
  debit: "Money out",
  credit: "Money in",
  description: "What it was",
  ignore: "Skip",
};

const dateOrderNames: Record<DateOrder, string> = {
  ymd: "2026-10-31",
  dmy: "31/10/2026",
  mdy: "10/31/2026",
};

function roleOf(value: string): ColumnRole {
  return columnRoles.find((role) => role === value) ?? "ignore";
}

function dateOrderOf(value: string): DateOrder {
  return dateOrders.find((order) => order === value) ?? "dmy";
}

/** A draft bite with a stable key: bites repeat (two coffees), so their content cannot be one. */
interface Row {
  readonly key: number;
  readonly bite: DraftBite;
}

function rowsOf(bites: readonly DraftBite[]): Row[] {
  return bites.map((bite, key) => ({ key, bite }));
}

function columnsOf(preview: StatementReading) {
  return preview.header.map((name, index) => ({ name, index }));
}

type Actions = Pick<PieActions, "readStatement" | "takeBites">;

interface Said {
  readonly tone: "fits" | "error";
  readonly sentence: string;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function summaryOf(preview: StatementReading): string {
  const skipped = [
    preview.incoming > 0 && `${plural(preview.incoming, "row", "rows")} of money coming in`,
    preview.unreadable > 0 && `${plural(preview.unreadable, "row", "rows")} it could not read`,
  ].filter(Boolean);

  const lines = preview.trimmed
    ? `Read the first ${preview.trimmed.kept.toLocaleString("en")} of its ${preview.trimmed.total.toLocaleString("en")} lines. `
    : "";

  return `${lines}Found ${plural(preview.bites.length, "bite", "bites")}${
    skipped.length > 0 ? `, and skipped ${skipped.join(" and ")}` : ""
  }. Check each slice, then take them.`;
}

/** A statement's text: a CSV as it is, a spreadsheet's first sheet as CSV. */
async function textOf(file: File): Promise<string | null> {
  if (!isSpreadsheet(file.name)) return file.text();

  // SheetJS is large: only load it for spreadsheets.
  const { csvOf } = await import("@/import/spreadsheet");

  return csvOf(await file.arrayBuffer());
}

/**
 * Imports a bank's CSV or Excel export: reads it, lets the person fix how it was read
 * and which slice each bite eats from, then takes the bites.
 */
export function ImportForm({
  slices,
  currency,
  actions,
}: {
  slices: readonly SliceView[];
  currency: string;
  actions: Actions;
}) {
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<StatementReading | null>(null);
  const [rows, setRows] = useState<readonly Row[]>([]);
  const [said, setSaid] = useState<Said | null>(null);
  const [pending, startTransition] = useTransition();
  const symbol = currencySymbol(currency);

  function read(text: string, layout?: StatementLayout) {
    startTransition(async () => {
      const outcome = await actions.readStatement({ csv: text, layout });

      if (!outcome.ok) {
        setSaid({ tone: "error", sentence: outcome.error });

        return;
      }

      setPreview(outcome.value);
      setRows(rowsOf(outcome.value.bites));
      setSaid({ tone: "fits", sentence: summaryOf(outcome.value) });
    });
  }

  async function choose(file: File | undefined) {
    if (!file) return;

    setPreview(null);
    setRows([]);

    if (file.size > largestUpload) {
      setSaid({ tone: "error", sentence: "This file is over 3.5 MB: export fewer months." });

      return;
    }

    const text = await textOf(file);

    if (text === null) {
      setSaid({ tone: "error", sentence: "This workbook has no sheet to read." });

      return;
    }

    if (text.length > largestUpload) {
      setSaid({
        tone: "error",
        sentence: "This sheet is over 3.5 MB as text: export fewer months.",
      });

      return;
    }

    setCsv(text);
    read(text);
  }

  function take() {
    startTransition(async () => {
      const outcome = await actions.takeBites({ bites: rows.map((row) => row.bite) });

      if (!outcome.ok) {
        setSaid({ tone: "error", sentence: outcome.error });

        return;
      }

      const { taken, duplicates } = outcome.value;

      setPreview(null);
      setRows([]);
      setSaid({
        tone: "fits",
        sentence: `Took ${plural(taken, "bite", "bites")}.${
          duplicates > 0 ? ` ${plural(duplicates, "was", "were")} already in the pie.` : ""
        }`,
      });
    });
  }

  function recolumn(index: number, role: ColumnRole) {
    if (!preview) return;

    const columns = preview.layout.columns.map((current, at) => (at === index ? role : current));

    read(csv, { ...preview.layout, columns });
  }

  function reslice(key: number, sliceId: string) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { key, bite: { ...row.bite, sliceId } } : row)),
    );
  }

  return (
    <section className="grid content-start gap-6" aria-labelledby="import-heading">
      <div className="grid gap-2">
        <h1 id="import-heading" className="text-3xl">
          Bring in a statement.
        </h1>
        <p className="max-w-[60ch] text-muted-foreground">
          Export a CSV or Excel file from your bank, in any layout. pienance finds the money that
          left, suggests a slice for each bite, and lets you check everything before it is taken. To
          do so, an AI model sees what each bite was and, for unfamiliar layouts, the first few
          rows.
        </p>
      </div>

      <Field className="max-w-md">
        <FieldLabel htmlFor="statement">Statement (CSV or Excel)</FieldLabel>
        <Input
          id="statement"
          type="file"
          accept={[".csv", "text/csv", "text/plain", ...spreadsheetTypes].join(",")}
          disabled={pending}
          onChange={(event) => void choose(event.currentTarget.files?.[0])}
          className="h-12 py-2.5"
        />
      </Field>

      <Answer tone={pending ? undefined : said?.tone}>
        {pending ? "Reading…" : said?.sentence}
      </Answer>

      {preview && (
        <>
          <FieldGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Columns">
            {columnsOf(preview).map(({ name, index }) => (
              <Field key={index}>
                <FieldLabel htmlFor={`column-${index}`} className="min-w-0 truncate">
                  {name}
                </FieldLabel>
                <NativeSelect
                  id={`column-${index}`}
                  value={preview.layout.columns[index] ?? "ignore"}
                  disabled={pending}
                  onChange={(event) => recolumn(index, roleOf(event.currentTarget.value))}
                  className="h-11"
                >
                  {columnRoles.map((role) => (
                    <NativeSelectOption key={role} value={role}>
                      {roleNames[role]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            ))}
            <Field>
              <FieldLabel htmlFor="date-order">Days are written</FieldLabel>
              <NativeSelect
                id="date-order"
                value={preview.layout.dates}
                disabled={pending}
                onChange={(event) =>
                  read(csv, { ...preview.layout, dates: dateOrderOf(event.currentTarget.value) })
                }
                className="h-11"
              >
                {dateOrders.map((order) => (
                  <NativeSelectOption key={order} value={order}>
                    {dateOrderNames[order]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </FieldGroup>

          <ul className="grid" aria-label="Bites to take">
            {rows.map(({ key, bite }) => (
              <li
                key={key}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b py-3 sm:grid-cols-[minmax(0,1fr)_auto_7rem_10rem]"
              >
                <span className="min-w-0 truncate">{bite.note || "Something"}</span>
                <span className="text-end tabular-nums">
                  {symbol}
                  {bite.amount}
                </span>
                <span className="text-sm text-muted-foreground">{bite.eatenOn}</span>
                <NativeSelect
                  aria-label={`Slice for ${bite.note || "something"} on ${bite.eatenOn}`}
                  value={bite.sliceId}
                  disabled={pending}
                  onChange={(event) => reslice(key, event.currentTarget.value)}
                  className="h-11 w-full"
                >
                  {slices.map((slice) => (
                    <NativeSelectOption key={slice.id} value={slice.id}>
                      {slice.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="lg" onClick={take} disabled={pending} data-track="take-bites">
              Take {plural(rows.length, "bite", "bites")}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
