/** Shared by every CSV export (receipts, mileage) -- same download mechanics either way. */
export function downloadCsv(rows: unknown[][], filename: string) {
  // Excel doesn't assume UTF-8 for a bare CSV — without the BOM it reads "€"
  // (multi-byte UTF-8) as the system codepage and mangles it into "â‚¬".
  const csv = "﻿" + rows.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
