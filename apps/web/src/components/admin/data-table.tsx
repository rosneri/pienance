import { cn } from "@pienance/ui/lib/utils";
import type { ReactNode } from "react";

export interface Column {
  readonly label: string;
  /** Numbers align right and use tabular figures. */
  readonly numeric?: boolean;
}

export interface Row {
  readonly key: string;
  readonly cells: readonly ReactNode[];
}

/** A plain, hairline-ruled table; scrolls inside itself on narrow screens, never the page. */
export function DataTable({
  label,
  columns,
  rows,
}: {
  label: string;
  columns: readonly Column[];
  rows: readonly Row[];
}) {
  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="w-full border-collapse text-sm tabular-nums">
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr className="border-b text-muted-foreground">
            {columns.map((column) => (
              <th
                key={column.label}
                scope="col"
                className={cn(
                  "py-2 font-normal whitespace-nowrap",
                  column.numeric ? "pl-4 text-end" : "pr-4 text-start",
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b">
              {row.cells.map((cell, index) => (
                <td
                  key={columns[index]?.label ?? index}
                  className={cn(
                    "py-2.5",
                    columns[index]?.numeric
                      ? "pl-4 text-end whitespace-nowrap"
                      : "pr-4 break-words",
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
