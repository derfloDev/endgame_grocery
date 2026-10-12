FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
RUN npm ci

COPY . .
ARG VITE_ICON_SIMILARITY_THRESHOLD=0.5
ENV VITE_ICON_SIMILARITY_THRESHOLD=$VITE_ICON_SIMILARITY_THRESHOLD
RUN npm run build --workspace frontend

FROM node:22-alpine AS runtime

# Production image: test routes stay off and dependencies behave in production mode.
ENV NODE_ENV=production

RUN apk add --no-cache nginx supervisor

WORKDIR /app

# Runtime configuration:
# REGISTRATION_ENABLED - set to "false" to disable self-registration (default: "true")

COPY package*.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
RUN npm ci --omit=dev

COPY backend/src ./backend/src
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/security-headers.conf /etc/nginx/security-headers.conf
# Validate Alpine's complete installed configuration, including both application files.
RUN nginx -t
COPY docker/supervisord.conf /etc/supervisord.conf
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
