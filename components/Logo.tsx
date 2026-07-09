/* eslint-disable @next/next/no-img-element */
export function Logo({
  className = "",
  height = 26,
}: {
  className?: string;
  height?: number;
}) {
  // Logo oficial da Hibrid (arquivo em /public/logo-hibrid.png)
  return (
    <img
      src="/logo-hibrid.png"
      alt="hibrid"
      style={{ height, width: "auto", display: "block" }}
      className={className}
    />
  );
}
