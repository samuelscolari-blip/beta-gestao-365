# Instructions for coding agents

Read `00_LEIA-ME_PRIMEIRO.md` and
`01_GUIA_PARA_OUTRA_IA_PUBLICAR.md` before taking any project action.

## Existing production target

- Project: `appgprj_6a67cdc58ee8819180fe477f9299edf7`
- Slug: `beta-gestao-365`
- URL: `https://beta-gestao-365.scolarisamuel.chatgpt.site`
- D1 binding: `DB`
- Baseline: version 51, commit
  `e304021c25cdf5be679daa441c085cad5aa4269d`

Never create a replacement Site. Preserve `.openai/hosting.json`, the project
identity, the production URL, the `DB` binding, all migrations and historical
data.

## Required workflow

1. Open/edit the existing Site using its persisted project identity.
2. Inspect only the files relevant to the request.
3. Preserve unrelated user changes.
4. Implement server-side permission checks for every mutation.
5. Keep secrets outside files and source control.
6. Run `npm run lint` and `npm test`.
7. Perform visual and interaction QA on affected screens.
8. Save an immutable version and deploy it to the same Site only from an
   authenticated owner/editor session.
9. Verify the deployment reaches a terminal success state before reporting it.

## Product rules

- Internal record codes remain hidden by default.
- Operational Terceiros remains hidden without deleting history.
- Passo a passo da obra remains present.
- The holistic work index remains distinct from physical progress.
- Purchase statuses are only `Aguardando análise`, `Aprovado`, `Reprovado`.
- Fictional decision examples never enter real queues, totals or actions.
- Visitors are read-only; privileged writes are server-authorized.
- IBS/CBS is not a payroll deduction.
- Termination calculations are previews and do not transmit official eSocial
  events.

Do not weaken these rules unless Samuel Scolari explicitly changes the
requirement.

