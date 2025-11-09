# Dockerfile per backend Node.js

# Usa immagine Node.js 18 Alpine (leggera)
FROM node:18-alpine

# Installa dipendenze per compilazione moduli nativi
RUN apk add --no-cache python3 make g++

# Imposta directory di lavoro
WORKDIR /app

# Copia package.json e package-lock.json
COPY package*.json ./

# Installa dipendenze (usa npm install invece di npm ci)
RUN npm install && npm cache clean --force

# Copia il resto del codice
COPY . .

# Espone porta 5000
EXPOSE 5000

# Comando di default (sovrascrivibile da docker-compose)
CMD ["node", "server.js"]