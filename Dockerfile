# ============================================================
# Multi-stage build for al-base (Next.js + Custom Server + WebSocket)
# ============================================================

# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# 安全：非 root 用户运行
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 复制完整 node_modules（tsx/typescript 是运行时需要的）
COPY --from=builder /app/node_modules ./node_modules

# 复制构建产物和源码
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/tsconfig.server.json ./tsconfig.server.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

USER nextjs

EXPOSE 3000

CMD ["npx", "tsx", "server.ts"]
