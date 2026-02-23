FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc --outDir dist

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
RUN addgroup -S sisdrone && adduser -S sisdrone -G sisdrone \
    && mkdir -p uploads \
    && chown -R sisdrone:sisdrone /app
USER sisdrone
EXPOSE 3001
CMD ["node", "dist/index.js"]
