import type { TakeBitesInput, TakenBites } from "@pienance/core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { utils, write } from "xlsx";
import type { Outcome } from "@/server/outcome";
import type { Asked, StatementReading, StatementUpload } from "@/server/pie-actions";
import { pieView } from "@/testing/fixtures";
import { ImportForm } from "./import-form";

const preview: StatementReading = {
  layout: {
    skipRows: 1,
    columns: ["date", "description", "amount"],
    dates: "dmy",
    decimal: ".",
    spending: "negative",
  },
  header: ["Date", "Description", "Amount"],
  bites: [
    { eatenOn: "2026-10-02", amount: "3.00", note: "Coffee", sliceId: "wants" },
    { eatenOn: "2026-10-02", amount: "3.00", note: "Coffee", sliceId: "wants" },
    { eatenOn: "2026-10-03", amount: "900.00", note: "Rent", sliceId: "needs" },
  ],
  incoming: 1,
  unreadable: 0,
  trimmed: null,
};

const file = new File(["Date,Description,Amount\n02/10/2026,Coffee,-3.00"], "statement.csv", {
  type: "text/csv",
});

/** Uploads the statement and waits until it is read, when the fields are enabled again. */
async function uploadStatement(user: ReturnType<typeof userEvent.setup>) {
  await user.upload(screen.getByLabelText("Statement (CSV or Excel)"), file);
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Found|look like/));
}

function setup(read: Outcome<StatementReading> = { ok: true, value: preview }) {
  const uploads: StatementUpload[] = [];
  const takes: Asked<TakeBitesInput>[] = [];

  const actions = {
    readStatement: async (upload: StatementUpload) => {
      uploads.push(upload);

      return read;
    },
    takeBites: async (input: Asked<TakeBitesInput>): Promise<Outcome<TakenBites>> => {
      takes.push(input);

      return { ok: true, value: { taken: 2, duplicates: 1 } };
    },
  };

  render(<ImportForm slices={pieView.slices} currency="EUR" actions={actions} />);

  return { uploads, takes, user: userEvent.setup() };
}

describe("ImportForm", () => {
  it("reads a chosen file and lists its bites with suggested slices", async () => {
    const { uploads, user } = setup();

    await user.upload(screen.getByLabelText("Statement (CSV or Excel)"), file);

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Found 3 bites, and skipped 1 row of money coming in. Check each slice, then take them.",
      ),
    );
    expect(uploads).toEqual([{ csv: "Date,Description,Amount\n02/10/2026,Coffee,-3.00" }]);
    expect(screen.getByLabelText("Slice for Rent on 2026-10-03")).toHaveValue("needs");
    expect(screen.getByLabelText("Description")).toHaveValue("description");
  });

  it("reads the first sheet of an Excel file as CSV", async () => {
    const { uploads, user } = setup();
    const book = utils.book_new();

    utils.book_append_sheet(
      book,
      utils.aoa_to_sheet([
        ["Date", "Description", "Amount"],
        [new Date(2026, 9, 2), "Coffee", -3],
      ]),
    );

    await user.upload(
      screen.getByLabelText("Statement (CSV or Excel)"),
      new File([write(book, { type: "array", bookType: "xlsx" })], "statement.xlsx"),
    );

    await waitFor(() => expect(uploads).toHaveLength(1));
    expect(uploads[0]).toEqual({ csv: "Date,Description,Amount\r\n2026-10-02,Coffee,-3" });
  });

  it("takes the bites with the slices the person chose", async () => {
    const { takes, user } = setup();

    // Choosing a slice while the statement is still being read would be undone by the read.
    await uploadStatement(user);
    await user.selectOptions(screen.getByLabelText("Slice for Rent on 2026-10-03"), "Savings");
    await user.click(screen.getByRole("button", { name: "Take 3 bites" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Took 2 bites. 1 was already in the pie.",
      ),
    );
    expect(takes[0]?.bites.map((bite) => bite.sliceId)).toEqual(["wants", "wants", "savings"]);
    expect(screen.queryByRole("list", { name: "Bites to take" })).not.toBeInTheDocument();
  });

  it("reads again when the person corrects a column", async () => {
    const { uploads, user } = setup();

    await uploadStatement(user);
    await user.selectOptions(screen.getByLabelText("Description"), "Skip");

    await waitFor(() => expect(uploads).toHaveLength(2));
    expect(uploads[1]?.layout?.columns).toEqual(["date", "ignore", "amount"]);
  });

  it("says when only the first lines of a statement were read", async () => {
    const { user } = setup({
      ok: true,
      value: { ...preview, trimmed: { kept: 2_000, total: 5_321 } },
    });

    await uploadStatement(user);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Read the first 2,000 of its 5,321 lines. Found 3 bites",
    );
  });

  it("refuses a file too big to upload, without sending it", async () => {
    const { uploads, user } = setup();
    const huge = new File(["x".repeat(3_500_001)], "huge.csv", { type: "text/csv" });

    await user.upload(screen.getByLabelText("Statement (CSV or Excel)"), huge);

    expect(await screen.findByRole("status")).toHaveTextContent(
      "This file is over 3.5 MB: export fewer months.",
    );
    expect(uploads).toEqual([]);
  });

  it("says why a file could not be read", async () => {
    const { user } = setup({
      ok: false,
      error: "This file does not look like a list of transactions",
    });

    await user.upload(screen.getByLabelText("Statement (CSV or Excel)"), file);

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "This file does not look like a list of transactions",
      ),
    );
  });
});
