FROM node:24.14.0-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:24.14.0-slim AS production
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY views ./views
COPY public ./public
COPY migrations ./migrations
RUN chown -R node:node /app
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
