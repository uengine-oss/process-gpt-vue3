# docker-compose-gs 로컬 HTTPS 적용 가이드

`docker-compose-gs` 환경을 로컬에서 HTTPS로 띄우는 절차입니다.

## 1) `mkcert` 설치

Windows에서 `mkcert`는 관리자 권한이 필요합니다.

1. PowerShell을 **관리자 권한**으로 실행
2. 아래 명령 실행

```powershell
choco install mkcert -y
```

설치 확인:

```powershell
mkcert -version
```

## 2) 로컬 루트 CA 등록 (최초 1회)

```powershell
mkcert -install
```

- 이 작업을 해야 브라우저가 로컬 인증서를 신뢰합니다.
- 테스트 PC가 여러 대면, 각 PC마다 신뢰 등록이 필요합니다.

## 3) 인증서 생성 (`localhost` + 로컬 IP)

`docker-compose-gs/nginx` 폴더에서 실행:

```powershell
cd docker-compose-gs/nginx
mkcert 192.168.0.10 localhost 127.0.0.1
```


docker compose down -v --remove-orphans


Remove-Item -Recurse -Force ".\volumes\db\data" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force ".\docker-compose\volumes\db\data" -ErrorAction SilentlyContinue



- `192.168.0.10`은 실제 테스트용 PC IP로 바꿔서 사용하세요.(env, SITE_URL, API_EXTERNAL_URL,  ADDITIONAL_REDIRECT_URLS, SUPABASE_PUBLIC_URL 4개 수정)
- 생성 파일 예시:
  - `localhost+2.pem` (인증서)
  - `localhost+2-key.pem` (개인키)

중요:
- 파일명은 실행 환경마다 `localhost+1.pem`, `localhost+2.pem`처럼 달라질 수 있습니다.
- 아래 nginx/compose 설정의 파일명과 **정확히 일치**해야 합니다.

## 4) `nginx/nginx.conf` 설정

`listen`에 `ssl`을 반드시 넣어야 합니다.

```nginx
server {
    listen 8088 ssl;
    ssl_certificate     /etc/nginx/certs/localhost+2.pem;
    ssl_certificate_key /etc/nginx/certs/localhost+2-key.pem;

    location / {
        set $frontend_upstream frontend:8080;
        proxy_pass http://$frontend_upstream;
    }
    # ... 생략 ...
}
```

핵심:
- `listen 8088;` 만 있으면 HTTPS가 아니라 HTTP로 동작합니다.
- 이 상태에서 `https://...` 접속하면 `ERR_SSL_PROTOCOL_ERROR`가 납니다.

## 5) `docker-compose.yaml` 볼륨 마운트

`nginx` 서비스에 인증서 2개 모두 마운트:

```yaml
nginx:
  image: nginx:latest
  ports:
    - "8088:8088"
  volumes:
    - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    - ./nginx/localhost+2.pem:/etc/nginx/certs/localhost+2.pem:ro
    - ./nginx/localhost+2-key.pem:/etc/nginx/certs/localhost+2-key.pem:ro
    - ./volumes/email-templates:/usr/share/nginx/auth-templates:ro
```

핵심:
- `*.pem` (인증서) + `*-key.pem` (개인키) 둘 다 필요합니다.
- 하나라도 빠지면 nginx가 기동 실패합니다.

## 6) 재기동

`docker-compose-gs` 폴더에서 실행:

```powershell
docker compose down
docker compose up -d --force-recreate
```

## 7) 접속 확인

- HTTPS: `https://localhost:8088`
- IP 테스트: `https://192.168.0.10:8088`

## 8) 자주 나는 오류와 원인

### `ERR_CONNECTION_REFUSED`

- nginx 컨테이너가 죽어 있음
- 보통 인증서 파일 경로/파일명 불일치로 기동 실패

### `cannot load certificate ... No such file or directory`

- `docker-compose.yaml`에 인증서 파일 마운트 누락
- 또는 파일명 불일치 (`localhost+1.pem` vs `localhost+2.pem`)

### `ERR_SSL_PROTOCOL_ERROR`

- nginx가 HTTP로 떠 있음 (`listen 8088;`)
- `listen 8088 ssl;`로 수정 필요

## 9) 도메인 없이 IP 인증서 가능한지

- 로컬/사내 테스트 목적의 `mkcert`는 **도메인 없이 IP로 발급 가능**
- 공인 인증서(예: Let's Encrypt)는 일반적으로 사설 IP 대상 발급 불가
