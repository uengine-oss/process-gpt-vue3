FROM node:22-bullseye AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --legacy-peer-deps

COPY . .
RUN NODE_OPTIONS=--max-old-space-size=4096 npm run build

FROM sanghoon01/spa-http-server:v1

ENV TZ=Asia/Seoul
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# 빌드 산출물은 읽기 전용 위치에 두고, run.sh 가 기동 시 /opt/www 로 복사한 뒤
# 환경변수를 주입한다 — 컨테이너를 root 가 아닌 사용자로, 루트 파일시스템을
# 읽기 전용으로 돌려도(/opt/www 만 쓰기 가능 볼륨) 동작하게 하기 위함.
COPY --from=build /app/dist /opt/www-dist
ADD run.sh /opt/run.sh
RUN sed -i 's/\r$//' /opt/run.sh \
    && mkdir -p /opt/www \
    && chown -R 1000:1000 /opt/www
USER 1000:1000
EXPOSE 8080
ENTRYPOINT ["sh","/opt/run.sh"]