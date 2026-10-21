# ontology-studio 상류 보고 초안 (미제출)

대상: https://github.com/uengine-oss/ontology-studio @ `20afcde`. 2026-10-14 로컬 실행·Process GPT tym 테넌트 MCP 연결 중 확인했다.
로컬 회피 패치는 `~/ontology-studio` 작업 트리에 있다(`git diff`). **제출 전 담당자 확인 필요** — 공개 저장소에 올라간다.

| # | 제목 | 증상 · 재현 | 로컬 회피 | 제안 |
|---|---|---|---|---|
| 1 | backend 가 `cliagents.shutdown_all` import 에서 기동 실패 | 서브모듈 `cliagents`(4e50a76, 상류 main 포함)에 함수가 없음 → `docker compose up` 시 backend `ImportError` | `backend/src/host/app.py` try/except 로 대체 함수 | 서브모듈 포인터 갱신 또는 import 가드 |
| 2 | MCP `ontology_query` 가 `No such file or directory: 'docker'` | compose 가 backend 에만 `SANDBOX_BACKEND: local` 을 주고, mcp 서비스는 `.env` 의 `SANDBOX_BACKEND=docker` 를 받음. mcp 이미지에는 docker CLI 가 없다 | mcp `environment` 에 `SANDBOX_BACKEND: local`·`LOCAL_SANDBOX_ROOT`·`SANDBOX_WORKDIR` 추가 | backend 와 같은 값을 mcp 에도 |
| 3 | 세션 DB(sqlite)가 컨테이너 레이어에 있음 — 재생성 시 스키마·구축 이력 소실, MCP 는 스키마를 못 봄 | `/app/backend/data/sessions.db` 가 볼륨이 아님. mcp 컨테이너는 자기 빈 DB 를 써서 `ontology_list_schemas` 가 `[]`, `ontology_query` 는 `no such table: sessions` | 명명 볼륨 `session-data:/app/backend/data` 를 backend·mcp 에 함께 마운트(기존 DB 백업 후 복원) | compose 에 볼륨 추가, MCP 진입점에서 `session_store.init_db()` 호출 |
| 4 | 발행(publish)이 같은 이름의 품질 이슈 노드에서 실패 | 구축 에이전트가 `MasterDataIssue.name` 을 `DUPLICATE_PRODUCT_NAME / <상품명>` 으로 지어 행이 다른 이슈 6건이 이름 3개를 공유 → `POST /api/schema/{id}/publish` 가 `ConstraintCreationFailed` | 중복 이름에 ` · 행 <source_row>` 를 붙임 | 이슈 클래스 키를 `_source_id` 로 두거나, 구축 단계에서 키 유일성 검사 |
| 5 | 업로드 세션 경로와 에이전트 작업 경로 불일치 | UI 업로드 파일이 세션 디렉터리에 저장되고 에이전트는 `/workspace/uploads` 를 읽어 "파일 없음" | 파일을 `/workspace/uploads` 로 복사 | 업로드 저장 경로를 에이전트 작업 경로와 일치 |
| 6 | 컨테이너에 restart 정책이 없음 | 호스트 재부팅 후 스택이 올라오지 않음 | `docker update --restart unless-stopped`(재생성하면 다시 필요) | compose 서비스에 `restart: unless-stopped` |
| 7 | `ontology_query` 응답에 성공 표지가 없음 | 결과가 `{answer, sources, meta}` 뿐이라 `status`/`result` 를 보는 MCP 클라이언트(Process GPT 폴링 서비스)가 산출물로 남기지 않는다 | — | `result: ok` 같은 표지 필드 추가(선택) |

## 제출 방법 (승인 후)

```bash
gh issue create -R uengine-oss/ontology-studio --title "<제목>" --body-file <본문>
```
