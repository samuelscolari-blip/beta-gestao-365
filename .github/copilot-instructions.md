# Beta Gestão 365

Siga o `AGENTS.md` da raiz. O destino exclusivo é o Cloudflare Worker
`beta-gestao-365`, com D1 `beta-gestao-365-db` no binding `DB`. O domínio
`chatgpt.site` está aposentado. Não recrie `.openai/hosting.json`, não inclua
segredos no código e não aplique migrations destrutivas. Execute
`npm run lint` e `npm test` antes de publicar pela branch `main`.
