# Usa Node 20 (recomendado hoy)
FROM node:20-alpine AS base
WORKDIR /app

# Dependencias de compilación para libs nativas
RUN apk add --no-cache python3 make g++

# Copia archivos de dependencias (lockfile incluido)
COPY package*.json ./
# Si usas paquetes privados, descomenta y copia .npmrc:
# COPY .npmrc ./

# Instala producción (sin dev) y limpia cache
# RUN npm ci --omit=dev && npm cache clean --force
RUN npm install --omit=dev && npm cache clean --force
# Copia el resto del código
COPY . .

# Asegura que 'public/' exista dentro de la imagen
RUN mkdir -p public

# Usuario no-root
RUN addgroup -g 1001 -S nodejs && adduser -S nodeuser -u 1001
RUN chown -R nodeuser:nodejs /app
USER nodeuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node healthcheck.js

CMD ["node", "server.js"]