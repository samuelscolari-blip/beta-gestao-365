import type { CSSProperties, ReactNode } from "react";

/*
 * ModuleHeader — o cabeçalho que abre cada tela do sistema.
 *
 * Esta etapa é uma extração puramente MECÂNICA: o componente emite
 * exatamente o mesmo HTML que os sete pontos de `BetaApp.tsx` emitiam
 * separadamente, com as mesmas classes, na mesma ordem, sem envoltório
 * novo. Nenhum CSS foi tocado, e o resultado visual precisa ser idêntico.
 *
 * O objetivo aqui é apenas dar um dono único a este pedaço de interface.
 * Enquanto o HTML estava repetido em sete lugares, treze arquivos CSS
 * disputavam a classe global `.module-heading` e ninguém conseguia prever
 * qual regra venceria — foi assim que nasceram os defeitos de cabeçalho
 * com fundo claro e texto branco.
 *
 * A etapa seguinte troca `.module-heading` por um CSS Module próprio e
 * remove as regras legadas. Separar as duas coisas é proposital: mover
 * código e mudar aparência são riscos de naturezas diferentes, e juntá-los
 * torna impossível saber qual dos dois causou uma regressão.
 */
export type ModuleHeaderProps = {
  /** Classe semântica da tela: `compliance-heading`, `admin-heading`, etc. */
  variantClass?: string;
  /** Classe extra do ícone: `payroll-icon`, `microsoft-icon`, etc. */
  iconClass?: string;
  /** Cores do ícone vindas da definição do módulo, quando existem. */
  iconStyle?: CSSProperties;
  icon: ReactNode;
  eyebrow: ReactNode;
  title: ReactNode;
  description: ReactNode;
  /** Botões, selos ou avisos à direita. Nem toda tela tem. */
  actions?: ReactNode;
};

export default function ModuleHeader({
  variantClass,
  iconClass,
  iconStyle,
  icon,
  eyebrow,
  title,
  description,
  actions,
}: ModuleHeaderProps) {
  return (
    <section
      className={variantClass ? `module-heading ${variantClass}` : "module-heading"}
    >
      <div className="module-title-wrap">
        <span
          className={iconClass ? `module-big-icon ${iconClass}` : "module-big-icon"}
          style={iconStyle}
        >
          {icon}
        </span>
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </div>
      {actions}
    </section>
  );
}
