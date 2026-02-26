FROM node:22-bullseye AS build

WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund --legacy-peer-deps

COPY . .
RUN NODE_OPTIONS=--max-old-space-size=4096 npm run build

FROM sanghoon01/spa-http-server:v1

ENV TZ=Asia/Seoul
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

COPY --from=build /app/dist /opt/www
ADD run.sh /opt/run.sh
RUN sed -i 's/\r$//' /opt/run.sh
EXPOSE 8080
ENTRYPOINT ["sh","/opt/run.sh"]