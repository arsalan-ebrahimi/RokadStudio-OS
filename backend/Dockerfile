FROM node:22-slim

WORKDIR /app

# Install openssl and certificates required by Prisma on Debian
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm install

COPY . .

# Generate Prisma Client
RUN npx prisma generate

ENV NODE_ENV=production
ENV PORT=7860

EXPOSE 7860

CMD ["node", "--experimental-strip-types", "server.js"]
