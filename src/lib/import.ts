import { importRow } from "./validation";
export type ImportRow = {
  student_number: string;
  first_name: string;
  last_name: string;
  class_name: string;
  roll_number?: number;
};
export type ImportCheck = { row: number; errors: string[] };
export const aliases: Record<keyof ImportRow, string[]> = {
  roll_number: [
    "เลขที่",
    "ลำดับ",
    "no",
    "no.",
    "number",
    "roll number",
    "roll_number",
  ],
  student_number: [
    "student id",
    "student number",
    "เลขประจำตัว",
    "เลขประจำตัวนักเรียน",
    "รหัสประจำตัวนักเรียน",
    "student code",
    "student_number",
    "student_id",
    "รหัสนักเรียน",
  ],
  first_name: ["first name", "ชื่อ", "ชื่อนักเรียน", "given name", "ชื่อจริง"],
  last_name: ["last name", "นามสกุล", "surname", "family name"],
  class_name: [
    "class",
    "ห้อง",
    "ชั้น",
    "ห้องเรียน",
    "ชั้นเรียน",
    "classroom",
    "class name",
  ],
};
const normalizeHeader = (v: string) =>
  v
    .trim()
    .toLowerCase()
    .replace(/[\s_./-]+/g, "");
export function guessMapping(headers: string[]) {
  return Object.fromEntries(
    Object.entries(aliases).map(([key, names]) => [
      key,
      headers.findIndex((h) =>
        names.some((n) => normalizeHeader(n) === normalizeHeader(h)),
      ),
    ]),
  ) as Record<keyof ImportRow, number>;
}
export function mappedRows(
  rows: string[][],
  mapping: Record<keyof ImportRow, number>,
  fallbackClass = "",
): ImportRow[] {
  return rows
    .filter((row) => row.some((c) => c.trim()))
    .map((row) => {
      const value = Object.fromEntries(
        Object.entries(mapping)
          .filter(([k]) => k !== "roll_number")
          .map(([k, index]) => [k, (row[index] ?? "").trim()]),
      ) as unknown as ImportRow;
      if (!value.class_name) value.class_name = fallbackClass;
      const roll =
        mapping.roll_number >= 0 ? (row[mapping.roll_number] || "").trim() : "";
      if (roll) value.roll_number = Number(roll);
      return value;
    });
}
export function validateImport(
  rows: ImportRow[],
  existing = new Set<string>(),
  classes?: Set<string>,
): ImportCheck[] {
  const counts = new Map<string, number>();
  rows.forEach((r) =>
    counts.set(r.student_number, (counts.get(r.student_number) || 0) + 1),
  );
  return rows.map((row, i) => {
    const errors: string[] = [];
    if (!importRow.safeParse(row).success) errors.push("invalid");
    if ((counts.get(row.student_number) || 0) > 1)
      errors.push("duplicateInFile");
    if (existing.has(row.student_number)) errors.push("existsInDatabase");
    if (classes && !classes.has(row.class_name)) errors.push("unknownClass");
    return { row: i + 2, errors };
  });
}
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (quoted || cell === "") {
        quoted = !quoted;
      } else throw new Error("invalid");
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("invalid");
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
// Title rows are common in school spreadsheets. Only recognized student columns
// participate in detection; National ID and household columns are never inferred.
export function detectHeader(rows: string[][]) {
  let best = 0,
    score = -1;
  rows.slice(0, 30).forEach((row, i) => {
    const m = guessMapping(row);
    const n = Object.values(m).filter((v) => v >= 0).length;
    if (n > score) {
      best = i;
      score = n;
    }
  });
  return best;
}
export async function parseFile(
  file: File,
): Promise<{ headers: string[]; rows: string[][]; numericIds: boolean }> {
  if (file.size > 5 * 1024 * 1024) throw new Error("tooLarge");
  if (/\.csv$/i.test(file.name)) {
    const rows = parseCsv((await file.text()).replace(/^\uFEFF/, ""));
    const start = detectHeader(rows);
    if (rows.length - start > 1001) throw new Error("rowLimit");
    return {
      headers: rows[start] ?? [],
      rows: rows.slice(start + 1),
      numericIds: false,
    };
  }
  if (!/\.xlsx$/i.test(file.name)) throw new Error("unsupportedFile");
  const ExcelJS = (await import("exceljs")).default;
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await file.arrayBuffer());
  const sheet = book.worksheets[0];
  if (!sheet || sheet.rowCount > 1030 || sheet.columnCount > 50)
    throw new Error("rowLimit");
  const numericColumns = new Set<number>();
  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: true }, (r) => {
    const values: string[] = [];
    for (let i = 1; i <= sheet.columnCount; i++) {
      const c = r.getCell(i);
      if (
        c.type === ExcelJS.ValueType.Formula ||
        c.type === ExcelJS.ValueType.Error
      )
        throw new Error("formulaCells");
      if (typeof c.value === "number") {
        const fmt = c.numFmt;
        if (/^0+$/.test(fmt) && fmt.length > 1)
          values.push(String(c.value).padStart(fmt.length, "0"));
        else {
          numericColumns.add(i - 1);
          values.push(String(c.value));
        }
      } else values.push(c.text);
    }
    rows.push(values);
  });
  const start = detectHeader(rows);
  if (rows.length - start > 1001) throw new Error("rowLimit");
  const headers = rows[start] ?? [];
  return {
    headers,
    rows: rows.slice(start + 1),
    numericIds: numericColumns.has(guessMapping(headers).student_number),
  };
}
