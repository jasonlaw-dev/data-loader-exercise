FROM node:12-alpine
WORKDIR /app

COPY package*.json tsconfig.json wait-for ./
RUN npm install

COPY src/ ./src/
RUN npm run build

COPY test ./test/

RUN chmod u+x ./wait-for

CMD sh -c './wait-for db:5432 -- node lib/index.js'
