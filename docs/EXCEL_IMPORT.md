# Importing and exporting students

1. Create a term and the class names used in the file.
2. Select **Import students**, then download the Excel template.
3. Keep Student ID as text. A value like `00123` must stay exactly `00123`.
4. Upload XLSX or UTF-8 CSV (up to 5 MiB, 1,000 students, 50 XLSX columns).
5. Map Student ID, First Name, Last Name, and Class. English and common Thai headers are recognized; custom headers are supported through mapping.
6. Validate and review every flagged row. No database records are created at file selection or preview.
7. Confirm import. The database transaction either creates all rows/enrollments or none.
8. Set individual student PINs through **Students → Edit / PIN** and share privately. Imports do not generate a common password.

Recognized Thai headers include เลขประจำตัว, รหัสนักเรียน, ชื่อ, นามสกุล, ห้อง, ชั้น. Leading/trailing whitespace is removed; blank rows are skipped. IDs are limited to letters, digits, hyphen and underscore, with a maximum of 40 characters. Duplicate IDs within the file and existing IDs are errors, not overwrite requests. Unknown or inactive classes must be corrected first.

Use XLSX or CSV. Legacy binary XLS is not supported; save it as XLSX in Excel or LibreOffice first. Numeric XLSX IDs with simple zero padding (e.g. `00000`) preserve the visible padded value. Unformatted numeric cells trigger a warning: zeroes already discarded by Excel cannot be reconstructed. Formula and spreadsheet error cells are rejected; use Paste Values.

Student-list and gradebook XLSX exports explicitly encode ID cells as text. CSV can represent `00123`, but Excel's automatic CSV type detection can still remove zeroes when opening it; use the XLSX template/export for reliable round trips. Export filenames include date and course/term context where applicable.
