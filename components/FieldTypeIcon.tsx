import type { FieldType } from "@/lib/types";

export const FIELD_META: Record<FieldType, { color: string; icon: string }> = {
  single: { color: "#4f7cff", icon: "◉" },
  multi: { color: "#4f7cff", icon: "☑" },
  name: { color: "#22b07d", icon: "A" },
  email: { color: "#22b07d", icon: "@" },
  tel: { color: "#22b07d", icon: "✆" },
  link: { color: "#22b07d", icon: "🔗" },
  text: { color: "#e0a52b", icon: "¶" },
  welcome: { color: "#9b6dff", icon: "👋" },
};

export function FieldTypeIcon({
  type,
  size = 18,
}: {
  type: FieldType;
  size?: number;
}) {
  const m = FIELD_META[type] ?? FIELD_META.text;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-[5px] text-white"
      style={{ background: m.color, width: size, height: size, fontSize: size * 0.55 }}
    >
      {m.icon}
    </span>
  );
}
