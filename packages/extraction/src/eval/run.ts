/**
 * Extraction eval harness.
 *
 * This is the gate on the whole project (PLAN.md Phase 0). If extraction cannot hit
 * the targets below, the product thesis changes — better to learn that now than in
 * month three.
 *
 * Usage:
 *   pnpm eval                          # default model
 *   pnpm eval -- --model gpt-5.6-terra
 *   pnpm eval -- --limit 20            # smoke test before spending real money
 *
 * Corpus layout:
 *   eval/corpus/<id>.jpg               the photo
 *   eval/corpus/<id>.json              hand-labelled ground truth
 *
 * See eval/README.md for how to build the corpus.
 */

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "../env.js";
import { getProvider } from "../index.js";
import { validateExtraction } from "../validate.js";
import { computeOverallConfidence } from "../confidence.js";
import { SEED_CATEGORIES, parseMoneyToMinor } from "@rr/shared";

loadEnv();

const HERE = dirname(fileURLToPath(import.meta.url));
const CORPUS = join(HERE, "..", "..", "eval", "corpus");
const RESULTS = join(HERE, "..", "..", "eval", "results");

/** Launch targets. OCR_PLAN.md §8. */
const TARGETS: Record<string, number> = {
  total: 0.95,
  currency: 0.98,
  receipt_date: 0.93,
  vendor: 0.9,
  tax: 0.85,
  category: 0.8,
};

interface GroundTruth {
  vendor: string | null;
  receipt_date: string | null;
  currency: string | null;
  subtotal: string | null;
  tax: string | null;
  total: string | null;
  category: string;
  line_item_count: number;
  /** Optional notes about why this receipt is hard. Useful when reading failures. */
  difficulty?: string;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

/** Vendor match is fuzzy: "STARBUCKS #4521" should count as "Starbucks". */
function vendorMatches(a: string | null, b: string | null): boolean {
  if (!a || !b) return a === b;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const x = norm(a);
  const y = norm(b);
  return x === y || x.includes(y) || y.includes(x);
}

function moneyMatches(a: string | null, b: string | null, currency: string): boolean {
  const x = parseMoneyToMinor(a, currency);
  const y = parseMoneyToMinor(b, currency);
  if (x === null || y === null) return x === y;
  return Math.abs(x - y) <= 1;
}

async function main() {
  const model = arg("model");
  const limit = Number(arg("limit") ?? "0");

  let files: string[] = [];
  try {
    files = (await readdir(CORPUS)).filter((f: string) => /\.(jpe?g|png|webp)$/i.test(f));
  } catch {
    console.error(`No corpus found at ${CORPUS}`);
    console.error("Create it and add receipt photos + .json ground truth. See eval/README.md.");
    process.exit(1);
  }

  if (files.length === 0) {
    console.error("Corpus directory is empty. Add receipt photos and ground truth first.");
    process.exit(1);
  }

  if (limit > 0) files = files.slice(0, limit);

  const provider = getProvider();
  const fields = ["vendor", "receipt_date", "currency", "total", "tax", "category"] as const;
  type Field = (typeof fields)[number];
  const correct: Record<string, number> = Object.fromEntries(
    fields.map((f: Field) => [f, 0]),
  );

  let scored = 0;
  let costMinor = 0;
  let durationMs = 0;
  let autoProcessed = 0;
  let autoProcessedCorrect = 0;
  const failures: object[] = [];

  for (const file of files) {
    const id = basename(file, extname(file));
    const image = await readFile(join(CORPUS, file));

    let truth: GroundTruth;
    try {
      truth = JSON.parse(await readFile(join(CORPUS, `${id}.json`), "utf8"));
    } catch {
      console.warn(`  skip ${id} — no ground truth file`);
      continue;
    }

    const mimeType = file.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";

    try {
      const res = await provider.extract({
        image,
        mimeType,
        categories: SEED_CATEGORIES,
        ...(model ? { model } : {}),
      });

      const currency = truth.currency ?? "USD";
      const hits: Record<string, boolean> = {
        vendor: vendorMatches(res.data.vendor, truth.vendor),
        receipt_date: res.data.receipt_date === truth.receipt_date,
        currency: res.data.currency === truth.currency,
        total: moneyMatches(res.data.total, truth.total, currency),
        tax: moneyMatches(res.data.tax, truth.tax, currency),
        category: res.data.category === truth.category,
      };

      for (const f of fields) if (hits[f]) correct[f]!++;
      scored++;
      costMinor += res.usage.costMinor;
      durationMs += res.durationMs;

      // Calibration: of the receipts we would have auto-accepted, how many were
      // fully correct? This is the number that decides whether users can trust it.
      const validation = validateExtraction(res.data, { homeCurrency: currency });
      const confidence = computeOverallConfidence({
        fieldConfidence: res.fieldConfidence,
        validationsPassed: validation.passed,
        legibility: res.data.legibility,
      });
      const wouldAutoAccept = confidence >= 0.85 && validation.passed;
      const fullyCorrect = hits.total && hits.receipt_date && hits.currency;

      if (wouldAutoAccept) {
        autoProcessed++;
        if (fullyCorrect) autoProcessedCorrect++;
      }

      const missed = fields.filter((f) => !hits[f]);
      if (missed.length > 0) {
        failures.push({
          id,
          missed,
          difficulty: truth.difficulty,
          expected: truth,
          got: res.data,
          confidence,
        });
      }

      process.stdout.write(missed.length === 0 ? "." : "x");
    } catch (err) {
      process.stdout.write("!");
      failures.push({ id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  console.log("\n");
  console.log(`Model:      ${model ?? process.env.EXTRACTION_MODEL ?? "gpt-5.6-luna"}`);
  console.log(`Scored:     ${scored} receipts`);
  console.log(`Cost:       $${(costMinor / 100).toFixed(4)}  ($${(costMinor / 100 / Math.max(scored, 1)).toFixed(5)}/receipt)`);
  console.log(`Latency:    ${Math.round(durationMs / Math.max(scored, 1))}ms avg`);
  console.log("");

  let allPassed = true;
  for (const f of fields) {
    const acc = scored ? correct[f]! / scored : 0;
    const target = TARGETS[f];
    const ok = target === undefined || acc >= target;
    if (!ok) allPassed = false;
    const targetLabel = target ? `target ${(target * 100).toFixed(0)}%` : "no target";
    console.log(
      `  ${ok ? "PASS" : "FAIL"}  ${f.padEnd(14)} ${(acc * 100).toFixed(1).padStart(5)}%  (${targetLabel})`,
    );
  }

  const calibration = autoProcessed ? autoProcessedCorrect / autoProcessed : 0;
  const calOk = calibration >= 0.98;
  if (!calOk) allPassed = false;
  console.log("");
  console.log(
    `  ${calOk ? "PASS" : "FAIL"}  calibration    ${(calibration * 100).toFixed(1).padStart(5)}%  (target 98% — of ${autoProcessed} auto-accepted)`,
  );

  await mkdir(RESULTS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = join(RESULTS, `${stamp}.json`);
  await writeFile(
    path,
    JSON.stringify(
      { model, scored, costMinor, accuracy: correct, calibration, failures },
      null,
      2,
    ),
  );
  console.log(`\nFailures written to ${path}`);

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
