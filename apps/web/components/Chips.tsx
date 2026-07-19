import { categoryChipColor } from "@rr/shared";
import type { ReimbursementStatus, ReceiptStatus } from "@rr/shared";
import { reimbursementChip, receiptStatusChip, fontSize, fontWeight, radius } from "@rr/ui-tokens";

const pillStyle: React.CSSProperties = {
  fontSize: fontSize.tiny + 0.5,
  fontWeight: fontWeight.bold,
  padding: "3px 9px",
  borderRadius: radius.pill,
  display: "inline-block",
  whiteSpace: "nowrap",
};

export function CategoryChip({ category }: { category: string }) {
  return (
    <span
      style={{
        ...pillStyle,
        background: categoryChipColor(category, true),
        color: categoryChipColor(category, false),
      }}
    >
      {category}
    </span>
  );
}

export function ReimbursementChip({ status }: { status: ReimbursementStatus }) {
  const meta = reimbursementChip[status];
  return (
    <span style={{ ...pillStyle, background: meta.bg, color: meta.text }}>{meta.label}</span>
  );
}

export function ReceiptStatusChip({ status }: { status: ReceiptStatus }) {
  const meta = receiptStatusChip[status];
  return (
    <span style={{ ...pillStyle, background: meta.bg, color: meta.text }}>{meta.label}</span>
  );
}
