# Dockerfile per frontend React

FROM node:18-alpine

# Imposta directory di lavoro
WORKDIR /app

# Copia package.json
COPY package*.json ./

# Installa dipendenze
RUN npm ci && npm cache clean --force

# Copia tutto il codice
COPY . .

# Espone porta 3000
EXPOSE 3000

# Comando di default per dev
CMD ["npm", "start"]