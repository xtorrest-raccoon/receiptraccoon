"use client";

import { useState, type CSSProperties } from "react";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";

export const multiSelectControlStyle: CSSProperties = {
  width: "100%",
  border: `1px solid ${color.borderStrong}`,
  borderRadius: radius.sm,
  padding: "6px 8px",
  fontSize: fontSize.small,
  background: color.surface,
  color: color.text,
  cursor: "pointer",
};

/**
 * Closed by default, opens a checkbox list — same shape as a native
 * <select multiple> but readable at a glance and doesn't need Ctrl/Cmd-click
 * to pick more than one. Commits each toggle immediately, so there's no
 * separate Save step, matching how a plain dropdown feels. Shared by
 * ReimbursementAuthorityTable's "Authority on" and every status filter
 * (Receipts, Team's Receipts/Mileage sections).
 */
export function MultiSelectDropdown({
  options,
  selected,
  onChange,
  emptyLabel,
  buttonStyle,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  emptyLabel: string;
  buttonStyle?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const summary = selected.length === 0 ? emptyLabel : options.filter((o) => selected.includes(o.value)).map((o) => o.label).join(", ");

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ ...multiSelectControlStyle, ...buttonStyle, textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{summary}</span>
        <span style={{ color: color.textFaint, flexShrink: 0 }}>▾</span>
      </button>
      {open ? (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 10,
            minWidth: 200,
            maxHeight: 220,
            overflowY: "auto",
            background: color.surface,
            border: `1px solid ${color.borderStrong}`,
            borderRadius: radius.sm,
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            padding: 6,
          }}
        >
          {options.length === 0 ? (
            <div style={{ fontSize: fontSize.small, color: color.textFaint, padding: "6px 8px" }}>Nothing to choose from.</div>
          ) : (
            options.map((o) => (
              <label key={o.value} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", fontSize: fontSize.small, color: color.text, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={selected.includes(o.value)}
                  onChange={(e) => onChange(e.target.checked ? [...selected, o.value] : selected.filter((v) => v !== o.value))}
                />
                {o.label}
              </label>
            ))
          )}
          <div style={{ borderTop: `1px solid ${color.borderSubtle}`, marginTop: 4, paddingTop: 4, textAlign: "right" }}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ fontSize: fontSize.tiny + 0.5, fontWeight: fontWeight.bold, color: color.brand, background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
