import type { CSSProperties, ReactNode } from "react";

import styles from "./ModuleHeader.module.css";

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
  /**
   * Identificador do módulo, quando a tela representa um.
   *
   * Existe para que outras camadas possam localizar um cabeçalho específico
   * sem comparar o texto do título — era assim que a tela de Férias era
   * encontrada, e renomear o título quebraria a estilização em silêncio.
   */
  moduleId?: string;
  /** Classe semântica da tela: `compliance-heading`, `admin-heading`, etc. */
  variantClass?: string;
  /** Classe extra do ícone: `payroll-icon`, `microsoft-icon`, etc. */
  iconClass?: string;
  /**
   * Natureza do ícone. Quase todos são desenhos; o da Rescisão é a letra
   * "R", e letra pede tamanho e peso próprios para não ficar franzina
   * dentro do quadrado. No legado isso vinha embutido na classe
   * `termination-icon`; declarar aqui torna a exceção visível.
   */
  iconKind?: "glyph" | "letter";
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
  moduleId,
  variantClass,
  iconClass,
  iconKind = "glyph",
  iconStyle,
  icon,
  eyebrow,
  title,
  description,
  actions,
}: ModuleHeaderProps) {
  /*
   * Migração em andamento, uma variante por vez.
   *
   * A `executive` já tem CSS próprio e por isso NÃO emite mais a classe
   * global — é o que a desliga das 152 regras legadas. As outras duas
   * continuam no caminho antigo até serem migradas.
   *
   * A regra que não pode ser quebrada: um elemento nunca carrega as duas
   * classes ao mesmo tempo. Uma ou outra por variante é seguro; as duas
   * juntas recriariam a disputa que esta reforma existe para acabar.
   */
  const migrada = variant === "executive";

  /*
   * UM único ponto de decisão para as duas famílias de classe.
   *
   * A primeira versão espalhava a escolha por três ternários dentro do
   * JSX. Funcionava, mas deixava o erro perigoso a uma distração de
   * distância: bastava um deles emitir os dois nomes juntos para as regras
   * legadas voltarem a valer por cima do CSS Module — que é exatamente a
   * disputa que esta reforma existe para acabar.
   *
   * Com as duas famílias declaradas em objetos separados, elas não têm
   * como se misturar, e `tests/module-header-component.test.mjs` consegue
   * conferir isso lendo o arquivo, sem navegador.
   */
  const proprias = {
    /*
     * A variante migrada NÃO emite a classe semântica legada
     * (payroll-heading, tax-heading...). Elas são estilizadas por folhas
     * que não exigem a classe global, então continuariam valendo e
     * repintariam o cabeçalho de claro — foi o que a linha de base
     * acusou em Cálculo de Salário e Rescisão.
     *
     * Nada se perde: a medição mostrou que, na variante executiva, o
     * acento não tinha efeito visual algum, porque o V105 já sobrepunha
     * tudo. O acento segue declarado em `data-accent`, para a variante
     * clara usar.
     */
    root: `${styles.root} ${styles.executive}`,
    titleWrap: styles.titleWrap,
    /* Mesma razão: `payroll-icon` e `microsoft-icon` também vencem sem a
       classe global, e na variante executiva nunca tiveram efeito. */
    icon: `${styles.icon}${iconKind === "letter" ? ` ${styles.letterIcon}` : ""}`,
    eyebrow: styles.eyebrow,
    title: styles.title,
    description: styles.description,
  };

  const legadas = {
    root: variantClass ? `module-heading ${variantClass}` : "module-heading",
    titleWrap: "module-title-wrap",
    icon: `module-big-icon${iconClass ? ` ${iconClass}` : ""}`,
    eyebrow: "eyebrow",
    title: undefined,
    description: undefined,
  };

  const cls = migrada ? proprias : legadas;

  return (
    <section
      className={cls.root}
      data-ui="module-header"
      data-variant={variant}
      data-accent={accent}
      data-module={moduleId}
    >
      <div className={cls.titleWrap} data-ui="module-header-title-wrap">
        <span
          className={cls.icon}
          /*
           * Na variante migrada o CSS Module é o dono das cores do ícone.
           * O estilo inline vinha da definição do módulo e venceria
           * qualquer classe — antes ele era sobreposto pelo V105. Sem essa
           * sobreposição, a única forma correta de o componente mandar na
           * própria aparência é não receber o inline.
           */
          style={migrada ? undefined : iconStyle}
          data-ui="module-header-icon"
        >
          {icon}
        </span>
        <div>
          <span className={cls.eyebrow} data-ui="module-header-eyebrow">
            {eyebrow}
          </span>
          <h1 className={cls.title}>{title}</h1>
          <p className={cls.description}>{description}</p>
        </div>
      </div>
      {actions}
    </section>
  );
}
