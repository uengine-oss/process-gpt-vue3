# Supabase 로컬 DB 이미지(supabase CLI 가 쓰는 public.ecr.aws/supabase/postgres)에 Apache AGE 를 얹는다.
# 이 이미지의 Postgres 는 nix 로 빌드되어 있어 apt 의 postgresql-server-dev-15 로는 맞지 않는다.
# 같은 nix 빌드의 pg_config/헤더로 컴파일하고, 서버가 실제로 쓰는 postgresql-and-plugins 경로에 넣는다.
# 빌드·적용: supabase/age/install.sh
ARG BASE_IMAGE=public.ecr.aws/supabase/postgres:15.8.1.085
ARG AGE_REF=PG15/v1.6.0-rc0

FROM ${BASE_IMAGE} AS build
ARG AGE_REF
RUN apt-get update \
 && apt-get install -y --no-install-recommends git flex bison perl make gcc libc6-dev ca-certificates \
 && git clone --depth 1 --branch "${AGE_REF}" https://github.com/apache/age.git /tmp/age
WORKDIR /tmp/age
# /usr/bin/pg_config 는 심볼릭 링크라 자기 위치 기준으로 /usr/include/server 같은 틀린 경로를 낸다.
# 실제 nix 경로의 pg_config 를 쓴다. pgxs 가 기록한 CC 는 nix 의 gcc 경로라 컨테이너에 없어 시스템 gcc/flex/bison/perl 로 덮는다.
RUN make CC=gcc FLEX=flex BISON=bison PERL=perl PG_CONFIG="$(readlink -f /usr/bin/pg_config)" \
 && mkdir -p /out/lib /out/extension \
 && cp age.so /out/lib/ \
 && cp age.control age--*.sql /out/extension/

FROM ${BASE_IMAGE}
COPY --from=build /out /tmp/age-out
# 라이브러리는 서버 바이너리의 $libdir(PKGLIBDIR), control/sql 은 SHAREDIR(/usr/share/postgresql)/extension 이
# 가리키는 nix 프로필 경로로 간다. 둘이 서로 다른 store 경로라 각각 링크를 따라가 찾는다.
RUN set -eux; \
    libdir="$(dirname "$(dirname "$(readlink -f /usr/bin/postgres)")")/lib"; \
    extdir="$(readlink -f /usr/share/postgresql/extension)"; \
    chmod u+w "$libdir" "$extdir"; \
    cp /tmp/age-out/lib/age.so "$libdir/"; \
    cp /tmp/age-out/extension/* "$extdir/"; \
    chmod u-w "$libdir" "$extdir"; \
    rm -rf /tmp/age-out
