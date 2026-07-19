"use client";

import { useState } from "react";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import { addCategoryName, removeCategoryName } from "../lib/data";

export function ManageCategoriesPanel({ categories, onChanged }: { categories: string[]; onChanged: () => void }) {
  const [input, setInput] = useState("");

  return (
    <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"], padding: 20, marginTop: 16 }}>
      <div style={{ fontSize: fontSize.base, fontWeight: fontWeight.bold, marginBottom: 4 }}>Manage categories</div>
      <div style={{ fontSize: fontSize.small, color: color.textMuted, marginBottom: 14 }}>
        Add a custom category or remove one — receipts in a removed category move to &ldquo;Other&rdquo;.
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input
          placeholder="New category name…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              addCategoryName(input);
              setInput("");
              onChanged();
            }
          }}
          style={{
            flex: 1,
            maxWidth: 280,
            padding: "9px 14px",
            borderRadius: radius.md,
            border: `1px solid ${color.borderStrong}`,
            fontSize: fontSize.body,
          }}
        />
        <button
          type="button"
          onClick={() => {
            addCategoryName(input);
            setInput("");
            onChanged();
          }}
          style={{
            padding: "9px 16px",
            borderRadius: radius.md,
            background: color.brand,
            color: color.surface,
            fontWeight: fontWeight.bold,
            fontSize: fontSize.body,
            border: "none",
            cursor: "pointer",
          }}
        >
          Add
        </button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {categories.map((c) => (
          <div
            key={c}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 6px 6px 12px",
              borderRadius: radius.pill,
              background: color.surfaceMuted,
              fontSize: fontSize.small + 0.5,
              fontWeight: fontWeight.semibold,
            }}
          >
            {c}
            <button
              type="button"
              onClick={() => {
                removeCategoryName(c);
                onChanged();
              }}
              aria-label={`Remove ${c}`}
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: color.border,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontSize: fontSize.tiny,
                color: color.textStrong,
                border: "none",
                padding: 0,
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
