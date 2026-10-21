# Supabase 로컬 DB 이미지(supabase CLI 가 쓰는 public.ecr.aws/supabase/postgres)에 ontological-db 를 얹는다.
# supabase/age/Dockerfile 과 같은 방식: 이미지 안의 nix 빌드 pg_config/헤더로 컴파일하고,
# 서버가 실제로 쓰는 postgresql-and-plugins 경로에 넣는다.
# 빌드·적용: supabase/ontological/install.sh
#
# BASE_IMAGE 는 AGE 를 이미 얹은 이미지(현재 CLI 태그)를 기본으로 한다 — 전환 기간 동안 두 확장이 함께 있다.
ARG BASE_IMAGE=public.ecr.aws/supabase/postgres:15.8.1.085
ARG OG_REF=3179cc7

FROM ${BASE_IMAGE} AS build
ARG OG_REF
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates curl git pkg-config gcc g++ make libc6-dev libssl-dev clang libclang-dev \
 && rm -rf /var/lib/apt/lists/*
ENV RUSTUP_HOME=/opt/rustup CARGO_HOME=/opt/cargo PATH=/opt/cargo/bin:$PATH
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable --profile minimal
RUN cargo install cargo-pgrx --version 0.19.2 --locked
RUN git clone https://github.com/uengine-oss/ontological-db.git /src \
 && git -C /src checkout "${OG_REF}"
# 상류에 아직 반영되지 않은 수정 — 각 파일 머리말에 증상과 원인을 적는다. 상류 반영 후 삭제.
COPY patches/ /patches/
RUN for p in /patches/*.patch; do [ -e "$p" ] || continue; git -C /src apply "$p"; done
WORKDIR /src/engine
# /usr/bin/pg_config 는 심볼릭 링크라 틀린 경로를 낸다 — 실제 nix 경로의 pg_config 를 쓴다.
RUN PGC="$(readlink -f /usr/bin/pg_config)" \
 && cargo pgrx init --pg15 "$PGC" \
 && cargo pgrx package --features pg15 --no-default-features --pg-config "$PGC" --out-dir /pkg \
 && mkdir -p /out/lib /out/extension \
 && find /pkg -name 'ontological*.so' -exec cp {} /out/lib/ \; \
 && find /pkg -path '*extension*' \( -name 'ontological*.sql' -o -name 'ontological*.control' \) -exec cp {} /out/extension/ \; \
 && ls -l /out/lib /out/extension

FROM ${BASE_IMAGE}
COPY --from=build /out /tmp/og-out
RUN set -eux; \
    libdir="$(dirname "$(dirname "$(readlink -f /usr/bin/postgres)")")/lib"; \
    extdir="$(readlink -f /usr/share/postgresql/extension)"; \
    chmod u+w "$libdir" "$extdir"; \
    cp /tmp/og-out/lib/*.so "$libdir/"; \
    cp /tmp/og-out/extension/* "$extdir/"; \
    chmod u-w "$libdir" "$extdir"; \
    rm -rf /tmp/og-out
