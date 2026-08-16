/**
 * Shared CSV cell escaping — used by every export route.
 *
 * Values here often come from user-controlled OAuth profiles (names, wallet
 * strings), so a leading =/+/-/@ is neutralized to prevent formula injection
 * when the file is opened in Excel/Sheets.
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Join header + rows into a CSV string with CRLF line endings (max spreadsheet compatibility). */
export function buildCsv(header: (string | number)[], rows: (string | number | null | undefined)[][]): string {
  const lines = [header.map(csvCell).join(",")];
  for (const row of rows) lines.push(row.map(csvCell).join(","));
  return lines.join("\r\n") + "\r\n";
}
