# Tasks: 011-vuln-scan

- [x] T001 기준선 점검 — npm audit / Trivy(gateway·IaC) / gitleaks / Semgrep
- [x] T002 npm: 미사용 패키지 제거, jspdf·jsondiffpatch·vite 상향, overrides+resolutions
- [x] T003 npm: 빌드(vue-tsc+vite 6)·모바일 빌드·단위 테스트·dev 서버 스모크
- [x] T004 gateway: Spring Boot 4.0.8 / Spring Cloud 2025.1.3 / jjwt 0.13 / jackson 패치
- [x] T005 gateway: JwtVerifier(HS+JWKS), 서명 미검증 폴백 제거, application.yml 이관
- [x] T006 gateway: 위조·만료·변조·none 토큰 401, 정상 ES256/HS256 통과, 테넌트·CORS 회귀
- [x] T007 시크릿 4건 제거(PAT·BlackDuck·Keycloak·AWS KeyID) + .gitleaks.toml 허용목록
- [x] T008 IaC: Dockerfile non-root, k8s securityContext, .trivyignore.yaml(경로 한정 1건)
- [x] T009 scripts/security/scan.sh + .github/workflows/security-scan.yml (actionlint 통과, 음성 테스트)
- [x] T010 이 서버 반영 — npm ci, frontend·gateway 서비스 재시작, 실로그인 검증
- [x] T011 보고서 docs/security/vuln-scan-report-2026-10.md
- [ ] T012 (소유자) 유출 시크릿 폐기·재발급 — GitHub PAT, BlackDuck, Keycloak client secret
- [ ] T013 (후속) GitOps 저장소 매니페스트에 securityContext·SUPABASE_URL 반영

## 2차 — process-gpt-completion (2026-10-01)
- [x] T014 기준선 점검 — Trivy(uv.lock·requirements·polling·frontend·IaC) / gitleaks / Semgrep
- [x] T015 Python 의존성 상향 (langchain 1.x·langgraph 1.x·fastmcp 3·starlette 1.x·pyjwt) + import 경로 이전, 미사용 chromadb·transformers 제거
- [x] T016 polling_service 의존성 동기화, frontend 데모 vue-cli → vite
- [x] T017 mcp.json Odoo 자격 증명 제거, f-string SQL → psycopg2.sql, Dockerfile·k8s 하드닝, mem0ai 예외(만료 2027-01-31)
- [x] T018 scan.sh + security-scan.yml (completion)
- [x] T019 두 저장소 origin/main 최신화 (completion main.py·supabase_config.py 충돌 해소, 로컬 변경은 stash 백업) → process-gpt.target 재시작·실로그인 검증
- [ ] T020 (소유자) Odoo API 키 폐기·재발급
