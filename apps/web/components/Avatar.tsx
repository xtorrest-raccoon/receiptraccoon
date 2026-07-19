import { initials } from "@rr/shared";
import { color, fontWeight } from "@rr/ui-tokens";

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size <= 28 ? 8 : 9,
        background: color.avatarBg,
        color: color.avatarText,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size <= 28 ? 11 : 12,
        fontWeight: fontWeight.heavy,
        flexShrink: 0,
      }}
    >
      {initials(name)}
    </div>
  );
}
