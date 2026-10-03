FROM node:18 AS builder

WORKDIR /app

COPY package.json ./
COPY package-lock.json ./

RUN npm install

COPY . .

RUN npm run build

FROM nginx:latest

COPY --from=builder /app/build /usr/share/nginx/html

EXPOSE 80