import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["app/ponto/page.tsx"],
    rules: {
      // O portal restaura IndexedDB, conectividade e parâmetros externos após
      // a hidratação. Esses estados são sincronizações reais com APIs do
      // navegador, não estado derivado durante a renderização.
      "react-hooks/set-state-in-effect": "off",
      // Os dois links são saídas deliberadas do shell isolado da PWA para a
      // aplicação administrativa; manter âncora força uma navegação completa
      // e evita carregar o estado administrativo dentro do shell do ponto.
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "**/dist/**",
    "**/node_modules/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
