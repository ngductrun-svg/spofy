FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN npm install -g pnpm@11.25.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY src ./src
COPY public ./public
COPY scripts ./scripts
COPY index.html vite.config.js ./
ARG VITE_ARCHIVE_ASSET_BASE=https://spofy-archive.ngductrun.chatgpt.site/archive/
ARG VITE_ARCHIVE_CATALOG_URL=/archive-data.json
ENV VITE_ARCHIVE_ASSET_BASE=$VITE_ARCHIVE_ASSET_BASE
ENV VITE_ARCHIVE_CATALOG_URL=$VITE_ARCHIVE_CATALOG_URL
RUN pnpm build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATA_DIR=/data
COPY --from=build /app/dist ./dist
COPY server ./server
COPY package.json ./
COPY licenses ./licenses
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 3000
VOLUME ["/data"]
CMD ["node", "server/index.mjs"]
