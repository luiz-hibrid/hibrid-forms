/* eslint-disable @next/next/no-img-element */
export function Logo({
  className = "",
  height = 32,
}: {
  className?: string;
  height?: number;
}) {
  // Logomarca oficial (ícone + "hibrid"). Duas versões: texto preto (fundo claro) e
  // texto branco (fundo escuro). O CSS escolhe pela classe do tema (.gl-admin[data-theme="dark"]);
  // fora do admin (ex.: login público) vale a versão de texto preto.
  const style = { height, width: "auto" } as const;
  return (
    <>
      <img src="/logo-hibrid.png" alt="hibrid" style={style} className={`logo-on-light ${className}`} />
      <img src="/logo-hibrid-branca.png" alt="" aria-hidden="true" style={style} className={`logo-on-dark ${className}`} />
    </>
  );
}
