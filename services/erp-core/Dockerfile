FROM node:22-alpine AS build

WORKDIR /workspace
COPY services/erp-core/package.json services/erp-core/package-lock.json ./services/erp-core/
RUN npm ci --prefix services/erp-core

COPY services/erp-core ./services/erp-core
COPY packages/payroll-core ./packages/payroll-core
RUN npm run build --prefix services/erp-core

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app
COPY services/erp-core/package.json services/erp-core/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /workspace/services/erp-core/dist ./dist
COPY services/erp-core/migrations ./migrations

USER node
EXPOSE 8080
CMD ["node", "dist/services/erp-core/src/main.js"]
