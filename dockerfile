
FROM node:18


ENV PORT=3307


WORKDIR /app


COPY package*.json ./


RUN npm install

COPY . .

EXPOSE $PORT


CMD ["node", "tryconnection.js"]
