FROM node:18-alpine
WORKDIR /app

# Copia as dependências e instala
COPY package*.json ./
RUN npm install

# Copia o resto do código
COPY . .

# Diz pro Hugging Face pra usar a porta 7860
ENV PORT=7860
EXPOSE 7860

# Roda as migrações do banco e sobe o servidor
CMD ["sh", "-c", "npx drizzle-kit migrate && npm start"]
