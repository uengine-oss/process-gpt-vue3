FROM node:22-bullseye AS build

WORKDIR /app

# lockfile 기반 설치(npm ci) — 빌드 재현성 확보. npm install 은 lockfile 무시하고 매번
# 최신 semver 로 재해석해 transitive dep(예: @bpmn-io/cm-theme) 드리프트로 빌드가 깨졌음.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --legacy-peer-deps

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