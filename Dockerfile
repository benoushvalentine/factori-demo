FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY scripts ./scripts
RUN npm ci --include=dev
COPY src ./src
COPY public ./public
COPY server ./server
COPY index.html tsconfig.json vite.config.ts ./
RUN npm run build
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001 DATABASE_URL=file:/app/data/factori.db
EXPOSE 3001
CMD ["npm", "run", "start:deploy"]
