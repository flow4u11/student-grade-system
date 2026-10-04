import "server-only";
import ExcelJS from "exceljs";
export async function workbookResponse(
  name: string,
  rows: unknown[][],
  numberFormats: Record<number, string> = {},
) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Records");
  rows.forEach((row, i) => {
    const r = sheet.addRow(
      row.map((v) => (typeof v === "number" ? v : String(v ?? ""))),
    );
    if (i === 0) {
      r.font = { bold: true, color: { argb: "FFFFFFFF" } };
      r.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF126C61" },
      };
    }
  });
  sheet.getColumn(1).numFmt = "@";
  for (const [column, format] of Object.entries(numberFormats))
    sheet.getColumn(Number(column)).numFmt = format;
  sheet.columns.forEach((c) => (c.width = 24));
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  const buffer = await book.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name.replace(/[^a-zA-Z0-9_-]/g, "-")}-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
