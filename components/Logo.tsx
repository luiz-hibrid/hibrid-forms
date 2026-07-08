export function Logo({
  className = "",
  height = 26,
}: {
  className?: string;
  height?: number;
}) {
  // Wordmark "hibrid" — recriado em texto com a fonte da marca.
  return (
    <span
      className={`inline-block font-black lowercase tracking-tight ${className}`}
      style={{ fontSize: height, lineHeight: 1, letterSpacing: "-0.04em" }}
    >
      hibrid
    </span>
  );
}
