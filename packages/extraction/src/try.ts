/**
 * `pnpm try` — read receipt photos and print what the AI found.
 *
 * The friendly on-ramp. No ground-truth labelling required: drop photos in
 * eval/inbox/, run this, and compare what it read against the actual receipt by eye.
 *
 * The rigorous measurement (`pnpm eval`) needs hand-labelled ground truth, but
 * there is no point labelling 200 receipts before knowing the first few come back
 * sensibly.
 */

import { readdir, readFile } from "node:fs/promises";
import { dirname, join, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./env.js";
import { getProvider } from "./index.js";
import { validateExtraction } from "./validate.js";
import { computeOverallConfidence } from "./confidence.js";
import { SEED_CATEGORIES, formatPaymentMethod } from "@rr/shared";

loadEnv();

const HERE = dirname(fileURLToPath(import.meta.url));
const INBOX = join(HERE, "..", "eval", "inbox");

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const OFF = "\x1b[0m";

function row(label: string, value: string | null | undefined): void {
  console.log(`   ${DIM}${label.padEnd(12)}${OFF}${value ?? `${DIM}—${OFF}`}`);
}

async function main() {
  let files: string[] = [];
  try {
    files = (await readdir(INBOX)).filter((f: string) => /\.(jpe?g|png|webp)$/i.test(f));
  } catch {
    console.log(`\n${YELLOW}No inbox folder yet.${OFF}`);
    console.log(`Create it and drop receipt photos in:\n   ${INBOX}\n`);
    process.exit(1);
  }

  if (files.length === 0) {
    console.log(`\n${YELLOW}No photos found.${OFF}`);
    console.log(`Drop some receipt photos (.jpg or .png) into:\n   ${INBOX}\n`);
    process.exit(1);
  }

  console.log(`\nReading ${files.length} receipt${files.length === 1 ? "" : "s"}…\n`);

  const provider = getProvider();
  let totalCostMinor = 0;
  let ok = 0;

  for (const file of files) {
    const image = await readFile(join(INBOX, file));
    const mimeType = file.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
    const name = basename(file, extname(file));

    console.log(`${BOLD}${name}${OFF}`);

    try {
      const res = await provider.extract({
        image,
        mimeType,
        categories: SEED_CATEGORIES,
      });
      const d = res.data;
      const currency = d.currency ?? "USD";

      const validation = validateExtraction(d, { homeCurrency: currency });
      const confidence = computeOverallConfidence({
        fieldConfidence: res.fieldConfidence,
        validationsPassed: validation.passed,
        legibility: d.legibility,
      });

      totalCostMinor += res.usage.costMinor;
      if (validation.passed) ok++;

      row("vendor", d.vendor);
      row("date", d.receipt_date);
      row("currency", d.currency);
      row("subtotal", d.subtotal);
      row("tax", d.tax);
      row("total", d.total ? `${BOLD}${d.total}${OFF}` : null);
      row("payment", formatPaymentMethod(d.payment_brand, d.payment_last4));
      row("category", d.category);
      row("legibility", d.legibility);
      row("items", `${d.line_items.length}`);

      for (const li of d.line_items.slice(0, 8)) {
        console.log(`   ${DIM}  · ${li.quantity} × ${li.description} @ ${li.unit_price}${OFF}`);
      }
      if (d.line_items.length > 8) {
        console.log(`   ${DIM}  … ${d.line_items.length - 8} more${OFF}`);
      }

      const verdict = validation.passed
        ? `${GREEN}would auto-accept${OFF}`
        : `${YELLOW}would go to review${OFF}`;
      console.log(
        `   ${DIM}────${OFF} ${verdict} ${DIM}· confidence ${(confidence * 100).toFixed(0)}% · ${res.durationMs}ms · $${(res.usage.costMinor / 100).toFixed(4)}${OFF}`,
      );

      for (const issue of validation.issues) {
        const color = issue.severity === "hard" ? RED : YELLOW;
        console.log(`   ${color}! ${issue.field}: ${issue.message}${OFF}`);
      }
      if (d.notes) console.log(`   ${DIM}note: ${d.notes}${OFF}`);
    } catch (err) {
      console.log(`   ${RED}failed: ${err instanceof Error ? err.message : String(err)}${OFF}`);
    }

    console.log("");
  }

  console.log(
    `${ok}/${files.length} would auto-accept · total cost $${(totalCostMinor / 100).toFixed(4)}\n`,
  );
  console.log(
    `${DIM}Compare each result against the real receipt. What matters most is whether`,
  );
  console.log(`the TOTAL and DATE are right — those are the fields that must never lie.${OFF}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
