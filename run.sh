#!/bin/sh

# .env 파일의 내용을 환경 변수로 설정
if [ -f /opt/www/.env ]; then
  echo "Loading environment variables from .env file..."
  export $(grep -v '^#' /opt/www/.env | xargs)
else
  echo "Warning: .env file not found at /opt/www/.env"
fi

# HTTP 서버 실행
exec http-server /opt/www -p 8080 -d false --push-state
