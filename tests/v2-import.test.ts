import { it, expect } from "vitest";
import ExcelJS from "exceljs";
import {
  detectHeader,
  guessMapping,
  mappedRows,
  parseFile,
} from "../src/lib/import";
it("finds headers below a school title and never infers a national ID as student ID", () => {
  const rows = [
    ["ทะเบียนนักเรียน"],
    [],
    ["เลขที่", "Student_ID", "First name", "Surname", "บัตรประชาชน"],
  ];
  expect(detectHeader(rows)).toBe(2);
  const m = guessMapping(rows[2]);
  expect(m.student_number).toBe(1);
  expect(guessMapping(["บัตรประชาชน", "National ID"]).student_number).toBe(-1);
  expect(
    mappedRows(
      [["1", "00123", "A", "B", "ignored-sensitive-column"]],
      m,
      "M.3/1",
    ),
  ).toEqual([
    {
      roll_number: 1,
      student_number: "00123",
      first_name: "A",
      last_name: "B",
      class_name: "M.3/1",
    },
  ]);
});
it("detects CSV headers after title rows without altering text IDs", async () => {
  const parsed = await parseFile(
    new File(
      [
        "School roster\n\nเลขที่,รหัสนักเรียน,ชื่อ,นามสกุล,ห้อง\n1,00123,A,B,M.3/1",
      ],
      "roster.csv",
    ),
  );
  expect(parsed.headers[0]).toBe("เลขที่");
  expect(
    mappedRows(parsed.rows, guessMapping(parsed.headers))[0].student_number,
  ).toBe("00123");
});
it("numeric roll numbers do not trigger an ID warning for text IDs", async () => {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Roster");
  sheet.addRow(["School title"]);
  sheet.addRow(["Student ID", "First name", "Surname", "Class", "No."]);
  sheet.addRow(["00123", "A", "B", "M.3/1", 1]);
  const bytes = await book.xlsx.writeBuffer();
  const parsed = await parseFile(
    new File([new Uint8Array(bytes)], "roster.xlsx"),
  );
  expect(parsed.numericIds).toBe(false);
  expect(
    mappedRows(parsed.rows, guessMapping(parsed.headers))[0].roll_number,
  ).toBe(1);
});
