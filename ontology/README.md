# Process GPT 온톨로지 (Apache AGE)

Process GPT의 데이터(전략·정의·실행·조직·지식·거버넌스)를 Apache AGE 지식그래프로 투영하기 위한 스키마 패키지.

| 문서/파일 | 내용 |
|---|---|
| [SCHEMA.md](./SCHEMA.md) | **스키마 계약 정본** — 노드 29종·엣지 47종의 속성/키/카디널리티/원천 매핑 (+Governance 3/10종 **보류** 스펙) |
| [INTEGRATION.md](./INTEGRATION.md) | **외부 프로젝트 통합 가이드** — 접속/권한, 질의 4규칙(검증된 함정 포함), Python·Node 예제, 쿡북, 확장·이식 가이드 |
| [ontology-spec.yaml](./ontology-spec.yaml) | **기계가독 스펙** — SCHEMA.md의 미러(버전 동기). 코드생성·검증·LLM 에이전트 컨텍스트 주입용. 라이브 DB 라벨과 일치 검증됨 |
| [docs/specs/graph-ontology-apache-age.md](../docs/specs/graph-ontology-apache-age.md) | 설계 문서 — AS-IS 분석, 온톨로지 설계 근거, 동기화 아키텍처, 질의 시나리오, 로드맵 |
| `schema/00-init.sql` | AGE 확장·그래프(`process_gpt`)·헬퍼 함수·동기화 인프라 테이블(outbox, dangling) |
| `schema/01-labels.sql` | 노드/엣지 라벨 생성 (멱등) |
| `schema/02-indexes.sql` | 업무키 UNIQUE + 탐색/스캔/GIN 인덱스 |
| `schema/03-seed.sql` | GraphMeta + BSC Perspective 시드(테넌트별 함수) |

> **검증됨**: 스키마 전체(00→03)는 `process-gpt/supabase-postgres-age:15.8.1.060-pg15`(PG15 + AGE **1.6.0**, 실제 타깃)와 `apache/age:latest`(PG18)에서 오류 없이 적용·재적용(멱등)·유니크 키 강제·Cypher 탐색까지 확인했다 (2026-07-10).

## 설치

**1. AGE가 포함된 Postgres 이미지 준비** — 이미 빌드된 `process-gpt/supabase-postgres-age:15.8.1.060-pg15` 이미지를 사용한다. 새로 빌드하려면(설계 문서 §4.1):

```dockerfile
FROM supabase/postgres:15.8.1.060
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential postgresql-server-dev-15 git flex bison \
 && git clone --depth 1 --branch release/PG15/1.5.0 https://github.com/apache/age.git /tmp/age \
 && cd /tmp/age && make && make install \
 && rm -rf /tmp/age && apt-get purge -y build-essential git && apt-get autoremove -y
```

**2. 스키마 적용** (순서 중요). ⚠ supabase 이미지에서 `postgres` 유저는 **superuser가 아니다** — `CREATE EXTENSION age`가 가능한 `supabase_admin`으로 실행할 것:

```bash
# DATABASE_URL 은 supabase_admin 계정 기준 (예: postgres://supabase_admin:***@host:5432/postgres)
for f in ontology/schema/00-init.sql ontology/schema/01-labels.sql \
         ontology/schema/02-indexes.sql ontology/schema/03-seed.sql; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done
```

**3. 확인**:

```sql
LOAD 'age';
SET search_path = ag_catalog, "$user", public;

-- 스키마 버전
SELECT public.agtext(v) FROM cypher('process_gpt', $$
  MATCH (m:GraphMeta {id:'meta'}) RETURN m.schema_version
$$) AS (v agtype);

-- 라벨 수 (노드 29 / 엣지 47 기대 — Governance 보류분 제외)
SELECT kind, count(*) FROM ag_catalog.ag_label l
JOIN ag_catalog.ag_graph g ON l.graph = g.graphid
WHERE g.name = 'process_gpt' AND l.name NOT LIKE '\_%'
GROUP BY kind;
```

## 주의

- 세션마다 `LOAD 'age'; SET search_path = ag_catalog, "$user", public;` 이 필요하다. 상시 사용 커넥션은 `ALTER DATABASE … SET session_preload_libraries = 'age'` 권장.
- `process_gpt` 스키마(그래프 내부 테이블)에는 **RLS가 없다**. PostgREST 노출 스키마에 포함하지 말 것 — 그래프 접근은 백엔드 service role 경유만 허용.
- 그래프는 원천 테이블의 **파생 projection**이다. 그래프에 직접 쓰지 말고 동기화 경로(설계 문서 §5)를 통해서만 적재한다.
- 신규 테넌트 생성 시 `SELECT public.graph_seed_perspectives('<tenant_id>');` 를 호출한다(03-seed는 현존 테넌트만 일괄 시드).

## 다음 단계 (로드맵 Phase 1 잔여)

1. 백필 ETL: 조직/정의/전략 순서(설계 문서 §5.3)로 원천 → 그래프 적재 스크립트
2. `graph_project_proc_def()` 등 재구축 함수 + `proc_def`/`configuration` 트리거
3. strategy-service pull 워커(§5.4)
