# syntax=docker/dockerfile:1

# ---- build stage: full deps + react-router build -> dist/ ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime stage: prod deps + built app + Node/Express server ----
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Built app (dist) + the custom Node server. server/index.ts is run by tsx and
# resolves ~/lib/* at runtime, so the app/ source + tsconfig.json (path alias)
# must be present in the runtime image.
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/app ./app
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/env.d.ts ./env.d.ts

EXPOSE 3000
CMD ["node", "--import", "tsx", "server/index.ts"]
