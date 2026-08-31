ARG SUPABASE_POSTGRES_IMAGE=supabase/postgres:15.8.1.060

FROM ${SUPABASE_POSTGRES_IMAGE} AS age-builder

ARG PG_MAJOR=15
ENV DEBIAN_FRONTEND=noninteractive

USER root

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        gnupg \
    && install -d /usr/share/keyrings \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
        | gpg --dearmor -o /usr/share/keyrings/postgresql.gpg \
    && . /etc/os-release \
    && pgdg_dist="${VERSION_CODENAME}-pgdg" \
    && echo "deb [signed-by=/usr/share/keyrings/postgresql.gpg] https://apt.postgresql.org/pub/repos/apt ${pgdg_dist} main" \
        > /etc/apt/sources.list.d/pgdg.list \
    && (apt-get update \
        || (echo "deb [signed-by=/usr/share/keyrings/postgresql.gpg] https://apt-archive.postgresql.org/pub/repos/apt ${pgdg_dist} main" \
            > /etc/apt/sources.list.d/pgdg.list \
            && apt-get update)) \
    && apt-get install -y --no-install-recommends \
        bison \
        build-essential \
        flex \
        git \
        libreadline-dev \
        postgresql-server-dev-${PG_MAJOR} \
        zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

ARG APACHE_AGE_REF=PG15/v1.6.0-rc0

RUN git clone --depth 1 --branch "${APACHE_AGE_REF}" https://github.com/apache/age.git /tmp/apache-age \
    && make -C /tmp/apache-age PG_CONFIG=/usr/lib/postgresql/${PG_MAJOR}/bin/pg_config install \
    && mkdir -p /tmp/age-artifacts/lib /tmp/age-artifacts/extension \
    && cp /usr/lib/postgresql/${PG_MAJOR}/lib/age.so /tmp/age-artifacts/lib/ \
    && cp /usr/share/postgresql/${PG_MAJOR}/extension/age* /tmp/age-artifacts/extension/

FROM ${SUPABASE_POSTGRES_IMAGE}

ARG PG_MAJOR=15

USER root

COPY --from=age-builder /tmp/age-artifacts/ /tmp/age-artifacts/

RUN set -eux; \
    primary_pkglibdir="$(pg_config --pkglibdir)"; \
    for libdir in \
        "${primary_pkglibdir}" \
        /nix/store/*postgresql*${PG_MAJOR}*/lib; \
    do \
        [ -d "${libdir}" ] || continue; \
        install -m 755 /tmp/age-artifacts/lib/age.so "${libdir}/age.so"; \
        mkdir -p "${libdir}/plugins"; \
        ln -sf "${libdir}/age.so" "${libdir}/plugins/age.so"; \
    done; \
    for sharedir in \
        "$(pg_config --sharedir)" \
        "$("$(readlink -f "$(command -v pg_config)")" --sharedir)" \
        /nix/store/*postgresql*${PG_MAJOR}*/share/postgresql; \
    do \
        [ -d "${sharedir}" ] || continue; \
        mkdir -p "${sharedir}/extension"; \
        cp /tmp/age-artifacts/extension/age* "${sharedir}/extension/"; \
    done; \
    rm -rf /tmp/age-artifacts
