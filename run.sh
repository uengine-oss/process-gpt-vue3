#!/bin/sh

# .env 파일의 내용을 환경 변수로 설정
if [ -f /opt/www/.env ]; then
  echo "Loading environment variables from .env file..."
  export $(grep -v '^#' /opt/www/.env | xargs)

  echo "Environment variables:"
  echo "VITE_SUPABASE_URL: $VITE_SUPABASE_URL"
  echo "VITE_SUPABASE_KEY: $VITE_SUPABASE_KEY"
  echo "VITE_UPSTAGE_API_KEY: $VITE_UPSTAGE_API_KEY" # 보안을 위해 일부만 표시
else
  echo "Warning: .env file not found at /opt/www/.env"
fi

# HTML 파일에 환경 변수를 설정하는 스크립트 추가
if [ -f /opt/www/index.html ]; then
  echo "Injecting environment variables into index.html..."
  sed -i '/<head>/a \
  <script>\
  window._env_ = {\
    VITE_SUPABASE_URL: "'$VITE_SUPABASE_URL'",\
    VITE_SUPABASE_KEY: "'$VITE_SUPABASE_KEY'",\
    VITE_KEYCLOAK_URL: "'$VITE_KEYCLOAK_URL'",\
    VITE_KEYCLOAK_REALM: "'$VITE_KEYCLOAK_REALM'",\
    VITE_KEYCLOAK_CLIENT_ID: "'$VITE_KEYCLOAK_CLIENT_ID'",\
    VITE_UPSTAGE_API_KEY: "'$VITE_UPSTAGE_API_KEY'",\
    VITE_GS_MODE: "'$VITE_GS_MODE'",\
    VITE_MODE: "'$VITE_MODE'",\
    VITE_PAL_MODE: "'$VITE_PAL_MODE'",\
    VITE_FF_EXECUTION: "'$VITE_FF_EXECUTION'",\
    VITE_FF_AI: "'$VITE_FF_AI'",\
    VITE_FF_AI_COPILOT: "'$VITE_FF_AI_COPILOT'",\
    VITE_FF_AI_DESIGNER: "'$VITE_FF_AI_DESIGNER'",\
    VITE_FF_AI_FORM: "'$VITE_FF_AI_FORM'",\
    VITE_FF_DEV_ROUTES: "'$VITE_FF_DEV_ROUTES'",\
  };\
  window.$mode = window._env_.VITE_MODE || window.$mode;\
  </script>' /opt/www/index.html
else
  echo "Warning: index.html file not found at /opt/www/index.html"
fi

# HTTP 서버 실행
#
# -c-1 을 반드시 붙인다. http-server 는 -c 를 안 주면 모든 응답에 max-age=3600 을
# 붙인다. 그러면 index.html 이 한 시간 캐시되어, 배포를 해도 사용자는 최대
# 한 시간 동안 예전 번들 해시를 물고 있게 된다.
#
# 에셋까지 캐시가 풀리는 것은 감수한다. 파일명에 내용 해시가 박혀 있어 재검증이
# 돌아도 304 로 끝나고, 그 비용보다 배포가 즉시 반영되는 쪽이 크다.
# (http-server 에는 경로별 캐시 설정이 없어 전체로밖에 못 준다.)
exec http-server /opt/www -p 8080 -c-1 -d false --push-state
