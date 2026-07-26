"use client";

import { useRef, useState } from "react";
import { currencySymbol, formatMoney, formatShortDate, minorToDecimalString, parseMoneyToMinor } from "@rr/shared";
import { color, fontSize, fontWeight, layout, radius, reimbursementChip } from "@rr/ui-tokens";
import {
  blankDraftReceipt,
  extractReceiptFromFile,
  RetakePhotoError,
  TODAY,
  type DraftReceipt,
} from "../lib/data";
import { useAddReceipt, useCategories, useHomeCurrency, useUploadReceiptPhoto } from "../lib/queries";
import { useDataStore } from "../lib/store";

type Step = "pick" | "loading" | "retake" | "error" | "confirm";

/**
 * Web's equivalent of mobile's capture flow (apps/mobile/app/capture/
 * {processing,confirm}.tsx), condensed into one drawer's internal steps
 * instead of two screens — web doesn't need screen-to-screen navigation for
 * this. Same global-overlay pattern as ReceiptDrawer/RejectionModal.
 */
export function AddReceiptDrawer() {
  const { addReceiptOpen, closeAddReceipt } = useDataStore();
  const { data: currency } = useHomeCurrency();
  const { data: categories } = useCategories();
  const addReceipt = useAddReceipt();
  const uploadPhoto = useUploadReceiptPhoto();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("pick");
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<DraftReceipt | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const [vendor, setVendor] = useState("");
  const [date, setDate] = useState("");
  const [totalText, setTotalText] = useState("");
  const [taxText, setTaxText] = useState("");
  const [payment, setPayment] = useState("");
  const [category, setCategory] = useState("Other");
  const [comment, setComment] = useState("");

  if (!addReceiptOpen) return null;

  const reset = () => {
    setStep("pick");
    setFile(null);
    setDraft(null);
    setErrorMessage("");
    setVendor("");
    setDate("");
    setTotalText("");
    setTaxText("");
    setPayment("");
    setCategory("Other");
    setComment("");
  };

  const close = () => {
    reset();
    closeAddReceipt();
  };

  const loadDraft = (d: DraftReceipt) => {
    setDraft(d);
    setVendor(d.vendor);
    setDate(d.date);
    setTotalText(minorToDecimalString(d.totalMinor, currency!));
    setTaxText(minorToDecimalString(d.taxMinor, currency!));
    setPayment(d.paymentBrand || d.paymentLast4 ? `${d.paymentBrand ?? ""} •${d.paymentLast4 ?? ""}`.trim() : "");
    setCategory(d.category);
    setComment(d.comment);
    setStep("confirm");
  };

  const onPickFile = async (f: File) => {
    if (!currency) return;
    setFile(f);
    setStep("loading");
    try {
      const d = await extractReceiptFromFile(f, currency, TODAY);
      loadDraft(d);
    } catch (err) {
      if (err instanceof RetakePhotoError) {
        setErrorMessage(err.message);
        setStep("retake");
      } else {
        setErrorMessage(err instanceof Error ? err.message : String(err));
        setStep("error");
      }
    }
  };

  const onEnterManually = () => {
    loadDraft(blankDraftReceipt(TODAY));
  };

  if (!currency || !categories) return null;

  const totalMinor = parseMoneyToMinor(totalText, currency);
  const saving = addReceipt.isPending || uploadPhoto.isPending;
  const canSave = vendor.trim().length > 0 && totalMinor !== null && totalMinor > 0 && !saving;

  const onSave = async () => {
    if (!canSave || totalMinor === null) return;
    const [paymentBrand, paymentLast4] = payment.includes("•")
      ? payment.split("•").map((s) => s.trim())
      : [payment.trim() || null, null];

    // Same reasoning as mobile: the photo is secondary to the data itself —
    // a failed upload shouldn't lose everything just typed in.
    let imagePath: string | null = null;
    if (file) {
      try {
        imagePath = await uploadPhoto.mutateAsync(file);
      } catch {
        imagePath = null;
      }
    }

    addReceipt.mutate(
      {
        vendor: vendor.trim(),
        receiptDate: date.trim() || null,
        totalMinor,
        taxMinor: parseMoneyToMinor(taxText, currency) ?? 0,
        categoryName: category,
        comment: comment.trim(),
        paymentBrand: paymentBrand || null,
        paymentLast4: paymentLast4 || null,
        imagePath,
        originalCurrency: draft?.originalCurrency ?? null,
        originalTotalMinor: draft?.originalTotalMinor ?? null,
        fxRate: draft?.fxRate ?? null,
        fxRateDate: draft?.fxRateDate ?? null,
        country: draft?.country ?? null,
      },
      { onSuccess: close },
    );
  };

  return (
    <div
      onClick={close}
      style={{ position: "fixed", inset: 0, background: `color-mix(in oklch, ${color.text} 45%, transparent)`, zIndex: 20, display: "flex", justifyContent: "flex-end" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: layout.drawerWidth, maxWidth: "92vw", height: "100%", background: color.surface, overflowY: "auto", padding: 26 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div style={{ fontSize: fontSize.xl + 1, fontWeight: fontWeight.heavy }}>Upload receipt</div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            style={{
              width: 30, height: 30, borderRadius: radius.sm + 1, background: color.surfaceMuted,
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              fontSize: fontSize.lg + 1, color: color.textMuted, border: "none",
            }}
          >
            ×
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPickFile(f);
            e.target.value = "";
          }}
        />

        {step === "pick" ? (
          <div>
            <div style={{ fontSize: fontSize.body, color: color.textMuted, marginBottom: 16, lineHeight: 1.5 }}>
              Choose a photo or scan of a receipt — vendor, date, total, tax, and category get read off it automatically.
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: "100%", padding: "40px 20px", borderRadius: radius.xl, border: `2px dashed ${color.borderStrong}`,
                background: color.surfaceMuted, color: color.textMuted, fontWeight: fontWeight.bold, fontSize: fontSize.body,
                cursor: "pointer",
              }}
            >
              Choose a receipt image…
            </button>
          </div>
        ) : null}

        {step === "loading" ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: fontSize.body, fontWeight: fontWeight.bold, marginBottom: 6 }}>Reading your receipt…</div>
            <div style={{ fontSize: fontSize.small + 0.5, color: color.textMuted }}>
              Extracting vendor, date, total, tax, and line items.
            </div>
          </div>
        ) : null}

        {step === "retake" || step === "error" ? (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: fontSize.body, fontWeight: fontWeight.bold, marginBottom: 6 }}>
              {step === "retake" ? "This photo is too unclear to read" : "Couldn't read this receipt"}
            </div>
            <div style={{ fontSize: fontSize.small + 0.5, color: color.textMuted, marginBottom: 18 }}>{errorMessage}</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{ padding: "9px 16px", borderRadius: radius.md, background: color.brand, color: color.surface, fontWeight: fontWeight.bold, fontSize: fontSize.body, border: "none", cursor: "pointer" }}
              >
                {step === "retake" ? "Choose another file" : "Retry"}
              </button>
              {step === "error" ? (
                <button
                  type="button"
                  onClick={onEnterManually}
                  style={{ padding: "9px 16px", borderRadius: radius.md, background: color.surfaceMuted, color: color.text, fontWeight: fontWeight.bold, fontSize: fontSize.body, border: "none", cursor: "pointer" }}
                >
                  Enter manually
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {step === "confirm" ? (
          <div>
            {draft?.originalCurrency && draft.originalTotalMinor !== null ? (
              <div style={{ background: reimbursementChip.approved.bg, borderRadius: radius.lg, padding: "12px 14px", marginBottom: 14 }}>
                <div style={{ fontSize: fontSize.tiny, fontWeight: fontWeight.bold, color: reimbursementChip.approved.text, marginBottom: 4 }}>
                  Currency conversion
                </div>
                <div style={{ fontSize: fontSize.small + 0.5, color: reimbursementChip.approved.text, lineHeight: 1.5 }}>
                  Originally {formatMoney(draft.originalTotalMinor, draft.originalCurrency)}
                  {draft.fxRate !== null ? ` · converted at ${draft.fxRate}` : ""}
                  {draft.fxRateDate ? ` on ${formatShortDate(draft.fxRateDate)}` : ""}
                </div>
              </div>
            ) : null}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Field label="Vendor">
                <input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Vendor name" style={inputStyle} />
              </Field>

              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <Field label="Date">
                    <input value={date} onChange={(e) => setDate(e.target.value)} placeholder="YYYY-MM-DD" style={inputStyle} />
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label={`Total (${currencySymbol(currency)})`}>
                    <input value={totalText} onChange={(e) => setTotalText(e.target.value)} style={inputStyle} />
                  </Field>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <Field label={`Tax (${currencySymbol(currency)})`}>
                    <input value={taxText} onChange={(e) => setTaxText(e.target.value)} style={inputStyle} />
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Payment">
                    <input value={payment} onChange={(e) => setPayment(e.target.value)} placeholder="Visa •1234" style={inputStyle} />
                  </Field>
                </div>
              </div>

              <Field label="Category">
                <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Comment">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="e.g. reason for exception, attendees, purpose…"
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical" as const }}
                />
              </Field>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button
                type="button"
                onClick={close}
                disabled={saving}
                style={{ flex: 1, padding: "12px 0", borderRadius: radius.md, background: color.surfaceMuted, color: color.textMuted, fontWeight: fontWeight.bold, fontSize: fontSize.body, border: "none", cursor: "pointer", opacity: saving ? 0.5 : 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={!canSave}
                style={{ flex: 1, padding: "12px 0", borderRadius: radius.md, background: color.brand, color: color.surface, fontWeight: fontWeight.bold, fontSize: fontSize.body, border: "none", cursor: "pointer", opacity: canSave ? 1 : 0.5 }}
              >
                {saving ? "Saving…" : "Save receipt"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: fontSize.tiny, fontWeight: fontWeight.bold, color: color.textMuted, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 4 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  fontSize: fontSize.body,
  fontWeight: fontWeight.semibold,
  padding: "9px 12px",
  borderRadius: radius.md,
  border: `1px solid ${color.borderStrong}`,
  color: color.text,
  background: color.surface,
  boxSizing: "border-box",
};
