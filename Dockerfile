# login-service · imagen multi-stage para Cloud Run
FROM node:20-slim AS deps
WORKDIR /app
COPY package*.json ./
# Usa npm ci si hay lock-file, npm install en su defecto.
RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev; \
    else \
      npm install --omit=dev --no-audit --no-fund; \
    fi

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Crear usuario no-root
RUN groupadd -r nodejs && useradd -r -g nodejs -m -d /home/nodejs nodejs

COPY --from=deps /app/node_modules ./node_modules
COPY app.js ./
COPY config ./config
COPY src ./src

USER nodejs
EXPOSE 8080

CMD ["node", "app.js"]
