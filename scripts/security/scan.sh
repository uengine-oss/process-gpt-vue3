#!/usr/bin/env bash
# 취약점 점검 — 로컬과 GitHub Actions(.github/workflows/security-scan.yml)가 같은 스크립트를 쓴다.
#
#   scripts/security/scan.sh [npm|maven|secrets|sast|iac|all]   (기본: all)
#
# 게이트: Critical/High 가 하나라도 있으면 종료 코드 1.
# 필요 도구: bash, docker, node/npm, (maven 단계) mvn + JDK 17.
# 결과 파일: reports/security/ (.gitignore 의 reports/ 아래)
#
# 환경변수
#   SECRETS_LOG_OPTS  gitleaks 가 이력에서 검사할 커밋 범위(git log 옵션). 비우면 작업 트리만 검사.
#                     예) SECRETS_LOG_OPTS="origin/main..HEAD"
#   SKIP_MAVEN_BUILD  1 이면 gateway jar 를 다시 빌드하지 않고 target/ 의 jar 를 검사.
# `sh scan.sh` 처럼 bash 가 아닌 셸로 실행되면 bash 로 다시 실행한다 (배열 등 bash 문법 사용).
# 이 줄까지는 POSIX sh 문법만 쓴다.
if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/reports/security"
mkdir -p "$OUT"

# 스캐너 이미지는 버전을 고정한다 (태그 변조·예고 없는 동작 변경 방지).
TRIVY_IMAGE="aquasec/trivy:0.74.0"
GITLEAKS_IMAGE="zricethezav/gitleaks:v8.30.1"
SEMGREP_IMAGE="semgrep/semgrep:1.177.0"
TRIVY_CACHE="${TRIVY_CACHE:-$ROOT/.cache/trivy}"
mkdir -p "$TRIVY_CACHE"

log() { printf '\n\033[1;36m[security] %s\033[0m\n' "$*"; }

run_npm() {
    log "SCA: npm 의존성 (npm audit, high 이상)"
    # package-lock.json 은 git 미추적이다. CI 와 같은 조건(새로 해석)을 만들기 위해
    # 임시 디렉터리에서 잠금파일만 생성해 audit 한다 — 작업 트리의 node_modules 를 건드리지 않는다.
    local tmp
    tmp="$(mktemp -d)"
    cp "$ROOT/package.json" "$tmp/"
    [ -f "$ROOT/.npmrc" ] && cp "$ROOT/.npmrc" "$tmp/"
    (cd "$tmp" && npm install --package-lock-only --ignore-scripts --no-audit --no-fund --loglevel=error >/dev/null)
    local rc=0
    (cd "$tmp" && npm audit --json > "$OUT/npm-audit.json") || true
    (cd "$tmp" && npm audit --audit-level=high) || rc=$?
    rm -rf "$tmp"
    node -e '
        const m = require(process.argv[1]).metadata.vulnerabilities;
        console.log(`npm audit: critical=${m.critical} high=${m.high} moderate=${m.moderate} low=${m.low}`);
    ' "$OUT/npm-audit.json"
    return $rc
}

run_maven() {
    log "SCA: gateway Maven 의존성 (Trivy, 빌드된 jar 기준)"
    # pom.xml 을 바로 스캔하면 Trivy 가 Maven Central 에서 부모 POM 을 받다가 429(차단)에 걸린다.
    # 빌드된 fat jar 안의 실제 라이브러리를 오프라인으로 검사하는 편이 정확하고 안정적이다.
    if [ "${SKIP_MAVEN_BUILD:-0}" != "1" ]; then
        (cd "$ROOT/gateway" && mvn -B -q -DskipTests package)
    fi
    local jar_dir
    jar_dir="$(mktemp -d)"
    cp "$ROOT"/gateway/target/*SNAPSHOT.jar "$jar_dir/"
    local rc=0
    docker run --rm -v "$jar_dir:/scan:ro" -v "$TRIVY_CACHE:/root/.cache" -v "$OUT:/out" "$TRIVY_IMAGE" \
        rootfs --scanners vuln --offline-scan -q \
        --format sarif --output /out/trivy-gateway.sarif /scan || true
    docker run --rm -v "$jar_dir:/scan:ro" -v "$TRIVY_CACHE:/root/.cache" "$TRIVY_IMAGE" \
        rootfs --scanners vuln --offline-scan -q \
        --severity CRITICAL,HIGH --exit-code 1 /scan || rc=$?
    rm -rf "$jar_dir"
    return $rc
}

run_secrets() {
    log "Secrets: gitleaks (작업 트리${SECRETS_LOG_OPTS:+ + 커밋 범위 $SECRETS_LOG_OPTS})"
    local rc=0
    # 작업 트리 — git 이 추적하는(또는 추적 대상인) 파일만 복사해 검사한다. .env 등 무시 파일 제외.
    local tree
    tree="$(mktemp -d)"
    (cd "$ROOT" && git ls-files -z --cached --others --exclude-standard | xargs -0 tar -cf - 2>/dev/null) | tar -xf - -C "$tree" 2>/dev/null || true
    docker run --rm -v "$tree:/repo:ro" -v "$ROOT/.gitleaks.toml:/config.toml:ro" -v "$OUT:/out" "$GITLEAKS_IMAGE" \
        dir /repo --config /config.toml --no-banner --redact --max-target-megabytes 5 \
        --report-format sarif --report-path /out/gitleaks-tree.sarif --exit-code 1 || rc=$?
    rm -rf "$tree"
    # 이력 — 이번에 추가된 커밋만. (과거 이력의 유출은 폐기·재발급으로 처리하고 문서에 남긴다.)
    if [ -n "${SECRETS_LOG_OPTS:-}" ]; then
        docker run --rm -v "$ROOT:/repo:ro" -v "$ROOT/.gitleaks.toml:/config.toml:ro" -v "$OUT:/out" "$GITLEAKS_IMAGE" \
            git /repo --config /config.toml --no-banner --redact --log-opts="$SECRETS_LOG_OPTS" \
            --report-format sarif --report-path /out/gitleaks-commits.sarif --exit-code 1 || rc=$?
    fi
    return $rc
}

run_sast() {
    log "SAST: Semgrep (저장소 룰 + 공개 룰셋, ERROR 등급 차단)"
    # Semgrep 은 .vue 를 직접 파싱하지 못한다 — <script> 블록을 .tmp/semgrep-vue-src 로 추출해 함께 검사한다.
    (cd "$ROOT" && node scripts/sast-vue-semgrep.mjs --extract-only)
    local targets=(src .tmp/semgrep-vue-src server.js gateway/src mobile/src scripts)
    local common=(--metrics off --config semgrep-rules --config p/javascript --config p/typescript --config p/java
        --no-git-ignore --exclude node_modules --exclude dist --exclude public --exclude '*.test.js'
        --timeout 30 --quiet)
    docker run --rm -v "$ROOT:/src" -w /src "$SEMGREP_IMAGE" \
        semgrep scan "${common[@]}" --sarif --output reports/security/semgrep.sarif "${targets[@]}" >/dev/null || true
    local rc=0
    docker run --rm -v "$ROOT:/src" -w /src "$SEMGREP_IMAGE" \
        semgrep scan "${common[@]}" --severity ERROR --error "${targets[@]}" || rc=$?
    return $rc
}

run_iac() {
    log "IaC: Dockerfile / Kubernetes (Trivy config)"
    local rc=0
    docker run --rm -v "$ROOT:/src:ro" -v "$TRIVY_CACHE:/root/.cache" -v "$OUT:/out" "$TRIVY_IMAGE" \
        config --skip-dirs node_modules --skip-dirs dist --ignorefile /src/.trivyignore.yaml -q \
        --format sarif --output /out/trivy-iac.sarif /src || true
    docker run --rm -v "$ROOT:/src:ro" -v "$TRIVY_CACHE:/root/.cache" "$TRIVY_IMAGE" \
        config --skip-dirs node_modules --skip-dirs dist --ignorefile /src/.trivyignore.yaml -q \
        --severity CRITICAL,HIGH --exit-code 1 /src || rc=$?
    return $rc
}

target="${1:-all}"
case "$target" in
    npm|maven|secrets|sast|iac) "run_$target" ;;
    all)
        failed=()
        for t in npm maven secrets sast iac; do
            "run_$t" || failed+=("$t")
        done
        if [ ${#failed[@]} -gt 0 ]; then
            log "FAIL — Critical/High 발견: ${failed[*]}"
            exit 1
        fi
        log "PASS — 모든 영역 Critical/High 0건"
        ;;
    *) echo "usage: $0 [npm|maven|secrets|sast|iac|all]" >&2; exit 2 ;;
esac
