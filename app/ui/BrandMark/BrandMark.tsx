/*
 * A marca da Beta Construtora.
 *
 * Desenhada em SVG, e não carregada como imagem, por três razões práticas:
 * escala sem borrar em qualquer tela, herda a cor de onde estiver (branca na
 * barra lateral escura, azul sobre fundo claro) e não custa uma requisição —
 * o Worker entrega a marca junto com a página, sem espera e sem o piscar de
 * quadro vazio enquanto o arquivo chega.
 *
 * O desenho segue o logotipo: um B sólido com a ponte estaiada vazada por
 * dentro — mastro, estais em leque e o tabuleiro cortando a letra na
 * diagonal.
 *
 * O vazado é feito por MÁSCARA, e não por linhas pintadas da cor do fundo.
 * Linha pintada de azul só funciona sobre azul: bastaria a marca aparecer num
 * cabeçalho claro, num PDF ou numa planilha para o desenho virar um borrão.
 * Vazada de verdade, a ponte deixa passar o que estiver atrás.
 *
 * O que o logotipo tem e aqui não: a textura de concreto. Em 40 pixels ela
 * viraria sujeira, e é justamente onde a marca mais aparece — na barra
 * lateral, o dia inteiro. Havendo o arquivo oficial em alta resolução, ele
 * tem precedência: basta preencher "Logotipo" em Configurações.
 */

export default function BrandMark({
  className,
  title = "Beta Construtora",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      fill="currentColor"
    >
      <mask id="beta-brand-bridge" maskUnits="userSpaceOnUse">
        {/* Branco é o que fica; preto é o que vaza. */}
        <rect width="64" height="64" fill="#000" />

        {/* O B sólido. */}
        <path
          d="M9 5h27a13.5 13.5 0 0 1 8.7 23.8A14.5 14.5 0 0 1 38 59H9z
             M22 17v8h13a4 4 0 0 0 0-8z
             M22 38v9h14a4.5 4.5 0 0 0 0-9z"
          fill="#fff"
          fillRule="evenodd"
        />

        {/* Tabuleiro: a diagonal longa que corta a letra inteira. */}
        <path d="M4 46 52 20" stroke="#000" strokeWidth="3.4" />

        {/* Mastro. */}
        <path d="M27 12v44" stroke="#000" strokeWidth="3.4" />

        {/* Estais, em leque a partir do topo do mastro. */}
        <g stroke="#000" strokeWidth="2.6">
          <path d="M27 14 15 42" />
          <path d="M27 20 19 42" />
          <path d="M27 14 38 40" />
          <path d="M27 21 34 40" />
        </g>
      </mask>

      <rect width="64" height="64" mask="url(#beta-brand-bridge)" />
    </svg>
  );
}
