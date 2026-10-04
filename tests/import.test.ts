import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import {
  guessMapping,
  mappedRows,
  parseCsv,
  parseFile,
  validateImport,
} from "../src/lib/import";
const row = {
  student_number: "00123",
  first_name: "Mali",
  last_name: "Example",
  class_name: "M.1/1",
};
describe("import parsing and validation", () => {
  it.each([
    ["Student ID", "First Name", "Last Name", "Class"],
    ["รหัสนักเรียน", "ชื่อ", "นามสกุล", "ห้อง"],
  ])("maps %s headers", (...headers) =>
    expect(guessMapping(headers)).toEqual({
      roll_number: -1,
      student_number: 0,
      first_name: 1,
      last_name: 2,
      class_name: 3,
    }),
  );
  it("trims whitespace and drops empty rows, preserving leading zeroes", () =>
    expect(
      mappedRows(
        [
          [" 00123 ", " Mali ", " Example ", "M.1/1"],
          ["", "", "", ""],
        ],
        guessMapping(["Student ID", "First Name", "Last Name", "Class"]),
      ),
    ).toEqual([row]));
  it("flags both duplicates and database matches", () => {
    const c = validateImport([row, row], new Set(["00123"]));
    expect(c[0].errors).toEqual(["duplicateInFile", "existsInDatabase"]);
    expect(c[1].errors).toEqual(c[0].errors);
  });
  it("flags missing ID, names and unknown classes", () => {
    const c = validateImport(
      [{ ...row, student_number: "", first_name: "" }],
      new Set(),
      new Set(["M.2/1"]),
    );
    expect(c[0].errors).toEqual(["invalid", "unknownClass"]);
  });
  it("supports quoted CSV commas and escaped quotes", () =>
    expect(parseCsv('ID,Name\r\n00123,"Mali, ""A"""')).toEqual([
      ["ID", "Name"],
      ["00123", 'Mali, "A"'],
    ]));
  it("rejects unterminated CSV quotes", () =>
    expect(() => parseCsv('00123,"oops')).toThrow());
  it("handles a thousand rows", () =>
    expect(
      validateImport(
        Array.from({ length: 1000 }, (_, i) => ({
          ...row,
          student_number: String(i).padStart(5, "0"),
        })),
      ).every((r) => r.errors.length === 0),
    ).toBe(true));
  it("reads real XLSX text IDs and numeric custom formats", async () => {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet("Students");
    sheet.addRow(["Student ID", "First Name", "Last Name", "Class"]);
    sheet.addRow(["00123", "Mali", "Example", "M.1/1"]);
    sheet.addRow([124, "Anan", "Example", "M.1/1"]);
    sheet.getCell("A3").numFmt = "00000";
    const bytes = await book.xlsx.writeBuffer();
    const parsed = await parseFile(
      new File([new Uint8Array(bytes)], "students.xlsx"),
    );
    expect(parsed.rows[0][0]).toBe("00123");
    expect(parsed.rows[1][0]).toBe("00124");
  });
  it("rejects formula cells", async () => {
    const book = new ExcelJS.Workbook();
    const s = book.addWorksheet("Students");
    s.addRow(["Student ID"]);
    s.addRow([{ formula: "1+1", result: 2 }]);
    const bytes = await book.xlsx.writeBuffer();
    await expect(
      parseFile(new File([new Uint8Array(bytes)], "students.xlsx")),
    ).rejects.toThrow("formulaCells");
  });
});
