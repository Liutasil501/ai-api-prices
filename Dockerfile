FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY mcp/prices.js mcp/server.js ./mcp/

ENV NODE_ENV=production

USER node

CMD ["node", "mcp/server.js"]
