FROM node:22-alpine

WORKDIR /app

# Install openssl required by Prisma Query Engine on Alpine Linux
RUN apk add --no-cache openssl

COPY package*.json ./

RUN npm install

COPY . .

# Generate Prisma Client
RUN npx prisma generate

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

CMD ["node", "--experimental-strip-types", "server.js"]
