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
/*
 * As três estruturas visuais que hoje se escondem sob o mesmo nome
 * `.module-heading`. Foram medidas no navegador, a 1366px:
 *
 *   executive  flex ·  padding 32px    · altura 132px · ícone 64px
 *   financial  flex ·  padding 30px 32 · altura 164px · ícone 64px
 *   standard   grid ·  padding 30px 34 · altura 166px · ícone 78px
 *
 * Não é ajuste fino: a clara usa grid onde as outras usam flex. Declarar a
 * estrutura aqui, vinda do React, é o que permite ao CSS parar de deduzi-la
 * por `:has()` ou pela barra lateral.
 */
export type ModuleHeaderVariant = "executive" | "financial" | "standard";

/** Acento semântico: muda cor de ícone e detalhes, nunca a estrutura. */
export type ModuleHeaderAccent =
  | "none"
  | "payroll"
  | "compliance"
  | "admin"
  | "tax";

export type ModuleHeaderProps = {
  /** Estrutura visual da tela. Declarada pelo React, nunca deduzida por CSS. */
  variant: ModuleHeaderVariant;
  accent?: ModuleHeaderAccent;
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
  variant,
  accent = "none",
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
      /*
       * A classe global continua sendo emitida nesta etapa, de propósito:
       * as 152 regras legadas ainda dependem dela. Os atributos abaixo são
       * preparação — dão ao componente uma identidade estável para testes e
       * para o CSS Module das etapas seguintes, sem mudar nada agora.
       */
      className={variantClass ? `module-heading ${variantClass}` : "module-heading"}
      data-ui="module-header"
      data-variant={variant}
      data-accent={accent}
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
