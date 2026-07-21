"use client";

import { useState } from "react";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import { useAddCategoryName, useRemoveCategoryName } from "../lib/queries";

export function ManageCategoriesPanel({ categories }: { categories: string[] }) {
  const [input, setInput] = useState("");
  const addCategory = useAddCategoryName();
  const removeCategory = useRemoveCategoryName();

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
              addCategory.mutate(input);
              setInput("");
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
            addCategory.mutate(input);
            setInput("");
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
              onClick={() => removeCategory.mutate(c)}
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
