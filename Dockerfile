FROM node:20.19-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

FROM node:20.19-alpine AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/config ./config
COPY --from=build /app/lang ./lang
COPY --from=build /app/process.json ./process.json

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Set proper ownership
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('fs').accessSync('/app/dist/start-bot.js'); console.log('Health check passed')"

# Apply committed migrations before accepting Discord events. Prisma uses
# PostgreSQL advisory locking to serialize concurrent migration attempts.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && exec node --enable-source-maps dist/start-bot.js"]
