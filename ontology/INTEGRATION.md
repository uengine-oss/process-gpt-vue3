# Process GPT 온톨로지 — 외부 프로젝트 통합 가이드

> 대상 독자: Process GPT 그래프(`process_gpt`)를 **읽어서 활용**하려는 다른 프로젝트/서비스(분석 대시보드, 에이전트 백엔드, PI 시스템 등)와, 이 온톨로지 구조를 **자기 도메인에 이식**하려는 팀.
> 스키마 버전 `0.2.0` 기준. 계약 정본: [SCHEMA.md](./SCHEMA.md) · 기계가독 스펙: [ontology-spec.yaml](./ontology-spec.yaml) · 설계 배경: [설계 문서](../docs/specs/graph-ontology-apache-age.md)
> 이 문서의 코드 스니펫 중 (검증됨) 표기는 라이브 supabase-db(PG15 + AGE 1.6.0)에서 실행 확인한 것이다.

---

## 1. 무엇이 제공되는가

Apache AGE 그래프 `process_gpt` 하나에 6레이어 온톨로지가 들어 있다:

```
Strategy      전략목표(BSC)·KPI·실행과제 — "왜(Why)"          ← strategy-service에서 동기화
Definition    프로세스 정의·요소·역할·폼 — "무엇(What)"        ← proc_def(JSONB)·form_def·proc_map
Organization  사용자·AI에이전트·팀·그룹 — "누가(Who)"          ← users·조직도 JSON
Execution     인스턴스·워크아이템·위임 — "실제로 어떻게(How)"   ← bpm_proc_inst·todolist
Knowledge     스킬·지식문서                                    ← tenant_skills·knowledge_files
(Governance)  승인·PR — 보류 중(스펙만 존재, 라벨 미생성)
```

- 노드 라벨 **29종**, 엣지 라벨 **47종**. 전체 카탈로그는 SCHEMA.md §4·§5, 파싱 가능한 형태는 `ontology-spec.yaml`.
- 그래프는 원천(관계형 테이블·외부 µsvc)의 **파생 projection**이다. 원천이 항상 정본이고, 그래프는 "관계 인덱스"다.
- 멀티테넌트: 단일 그래프에 전 테넌트 공존. **모든 노드에 `tenant_id` 속성** — 질의 시 필터 필수(§4 R3).

## 2. 접속

### 2.1 네트워크·계정

| 항목 | 값 |
|---|---|
| 컨테이너 / 네트워크 | `supabase-db` / `docker-compose_default` (호스트 포트 **미공개** — 의도적) |
| 같은 네트워크의 서비스에서 | `postgresql://postgres:<POSTGRES_PASSWORD>@db:5432/postgres` (compose 서비스명 `db`) |
| 호스트/외부에서 | `docker exec -i supabase-db psql -U postgres -d postgres` 또는 포트 publish 후 접속 |
| **읽기/질의 계정** | `postgres` (검증됨 — 그래프 SELECT 가능) |
| DDL·스키마 변경 계정 | `supabase_admin` (superuser; `postgres`는 supabase 이미지에서 superuser 아님) |
| REST(PostgREST) | **불가** — `process_gpt` 스키마는 `PGRST_DB_SCHEMAS`에 미노출(보안 정책). 그래프 접근은 반드시 DB 커넥션 경유 |

⚠ `process_gpt` 스키마에는 **RLS가 없다**. 접속한 서비스가 테넌트 격리를 책임진다 — 모든 질의에 `tenant_id` 필터를 넣을 것.

### 2.2 세션 준비 (모든 커넥션 공통)

```sql
LOAD 'age';
SET search_path = ag_catalog, "$user", public;
```

커넥션 풀 사용 시 커넥션 초기화 훅에 위 2줄을 넣거나, 함수를 항상 `ag_catalog.cypher(...)`로 스키마 한정해 호출한다. (`LOAD`는 세션당 1회 필요 — `postgres` 계정으로 가능함을 확인했다.)

## 3. 질의 기본형

```sql
-- (검증됨) 기본형: cypher(그래프명, $$ 쿼리 $$) AS (컬럼 agtype, ...)
SELECT public.agtext(name) AS name
FROM ag_catalog.cypher('process_gpt', $$
    MATCH (d:ProcessDefinition {tenant_id: 'skt'})
    RETURN d.name
$$) AS (name ag_catalog.agtype);
```

- 반환 컬럼은 모두 `agtype`. 스칼라는 `public.agtext(col)`(따옴표 제거 text 캐스팅 헬퍼, 00-init.sql 제공)로, 숫자는 `agtext(col)::numeric`으로 받는다.
- **하이브리드 조인**이 AGE의 최대 강점 — 그래프 결과를 관계형 원천·pgvector와 한 SQL에서 조인:

```sql
WITH impacted AS (
    SELECT public.agtext(def_id) AS def_id
    FROM ag_catalog.cypher('process_gpt', $$
        MATCH (ff:FormField {tenant_id:'skt', form_id:'loanForm', key:'amount'})
              <-[:DECIDES_BY]-(:Gateway)<-[:DEFINES]-(d:ProcessDefinition)
        RETURN d.id
    $$) AS (def_id ag_catalog.agtype)
)
SELECT t.id, t.activity_name, t.status
FROM public.todolist t
JOIN impacted i ON t.proc_def_id = i.def_id
WHERE t.status IN ('TODO','IN_PROGRESS');
```

## 4. 반드시 지킬 4가지 규칙

**R1. vertex/edge를 직접 반환하지 말 것 — `properties(n)` 또는 스칼라만.** (검증됨)
vertex를 `::text` 캐스팅하면 이 버전에서 `agtype_value_to_text: unsupported argument` 에러가 난다. 맵이 필요하면:

```sql
-- (검증됨) properties(n)은 유효한 JSON 문자열로 나온다 → 클라이언트에서 JSON.parse
SELECT props::text FROM ag_catalog.cypher('process_gpt', $$
    MATCH (p:Perspective {tenant_id:'skt', id:'financial'}) RETURN properties(p)
$$) AS (props ag_catalog.agtype);
-- {"id": "financial", "name": "Financial", "tenant_id": "skt", "sort_order": 1}
```

**R2. 사용자 입력은 서버측 바인드 파라미터로.** (검증됨)
`cypher()`의 3번째 인자는 **반드시 진짜 바인드 파라미터**여야 한다(리터럴·캐스팅 식은 `third argument of cypher function must be a parameter` 에러). SQL에서는 PREPARE로:

```sql
PREPARE q(ag_catalog.agtype) AS
SELECT public.agtext(c) FROM ag_catalog.cypher('process_gpt', $$
    MATCH (p:Perspective {tenant_id: $t}) RETURN count(p)
$$, $1) AS (c ag_catalog.agtype);

EXECUTE q('{"t": "skt"}');   -- cypher 쿼리 안에서 $t 로 참조
```

드라이버의 extended-protocol 바인딩($1 자리표시자)은 PREPARE와 같은 경로다 — psycopg**3**, node-postgres는 가능; **psycopg2는 클라이언트 측 문자열 치환이라 3번째 인자에 못 쓴다**(직접 이스케이프하거나 psycopg3 사용).

**R3. 모든 질의에 `tenant_id` 필터.** RLS가 없으므로 생략하면 전 테넌트 데이터가 섞여 나온다.

**R4. 쓰기 금지(읽기 전용).** 그래프 쓰기는 Process GPT의 동기화 파이프라인(outbox 워커·재구축 함수·strategy pull 워커)만 수행한다. 외부 프로젝트가 임의 MERGE하면 다음 재구축 때 소실되거나 dangling 정책과 충돌한다. 자체 데이터를 붙이고 싶으면 §7의 확장 절차를 따를 것.

## 5. 클라이언트 예제

### Python (psycopg 3)

```python
import json, psycopg

DSN = "postgresql://postgres:PASSWORD@db:5432/postgres"

with psycopg.connect(DSN) as conn:
    conn.execute("LOAD 'age'")
    conn.execute('SET search_path = ag_catalog, "$user", public')

    # 파라미터 바인딩: 3번째 인자에 JSON 문자열을 $1로 바인드 (서버측 바인딩 — R2)
    rows = conn.execute(
        """
        SELECT props::text FROM ag_catalog.cypher('process_gpt', $$
            MATCH (o:Objective {tenant_id: $t})<-[:MEASURES]-(k:KPI)
            RETURN properties(k)
        $$, %s::ag_catalog.agtype) AS (props ag_catalog.agtype)
        """,
        (json.dumps({"t": "skt"}),),
    ).fetchall()

    kpis = [json.loads(r[0]) for r in rows]   # R1: properties() → JSON 파싱
```

> psycopg3는 기본이 서버측 바인딩이라 `%s::ag_catalog.agtype`가 PREPARE와 동일하게 동작한다. psycopg2라면 이 형태가 실패하므로 값 검증 후 문자열 포매팅으로 우회해야 한다.

### Node.js (pg)

```ts
import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgresql://postgres:PASSWORD@db:5432/postgres' });
pool.on('connect', async (c) => {
    await c.query(`LOAD 'age'`);
    await c.query(`SET search_path = ag_catalog, "$user", public`);
});

const { rows } = await pool.query(
    `SELECT props::text AS p FROM ag_catalog.cypher('process_gpt', $q$
         MATCH (d:ProcessDefinition {tenant_id: $t})
         RETURN properties(d)
     $q$, $1::ag_catalog.agtype) AS (props ag_catalog.agtype)`,
    [JSON.stringify({ t: 'skt' })]
);
const defs = rows.map(r => JSON.parse(r.p));
```

> 주의: node-postgres에서 cypher 본문을 `$$`로 감싸면 `$1` 자리표시자와 헷갈리기 쉬우니 `$q$ ... $q$` 태그드 쿼팅을 권장.

### psql (탐색·디버깅)

```bash
docker exec -it supabase-db psql -U postgres -d postgres
```

## 6. 질의 쿡북

아래는 `'<TENANT>'`만 바꿔 바로 쓰는 대표 시나리오다. (스키마 계약 기준 작성 — 데이터가 백필된 레이어에서 동작)

```sql
-- C1. 프로세스 지도: Mega → Major → 정의
SELECT public.agtext(mega), public.agtext(major), public.agtext(def)
FROM ag_catalog.cypher('process_gpt', $$
    MATCH (mg:MegaProcess {tenant_id:'<TENANT>'})-[:CONTAINS]->(mj:MajorProcess)-[:CONTAINS]->(d:ProcessDefinition)
    RETURN mg.name, mj.name, d.name
$$) AS (mega ag_catalog.agtype, major ag_catalog.agtype, def ag_catalog.agtype);

-- C2. 정의 구조 덤프(시각화용): 요소·타입·역할 + 흐름
SELECT public.agtext(src), public.agtext(dst), public.agtext(cond)
FROM ag_catalog.cypher('process_gpt', $$
    MATCH (d:ProcessDefinition {tenant_id:'<TENANT>', id:'<DEF_ID>'})-[:DEFINES]->(a)-[f:FLOWS_TO]->(b)
    RETURN a.name, b.name, f.condition
$$) AS (src ag_catalog.agtype, dst ag_catalog.agtype, cond ag_catalog.agtype);

-- C3. 북극성 드릴다운: 전략목표 → KPI → 프로세스 → 진행중 인스턴스
SELECT public.agtext(obj), public.agtext(kpi), public.agtext(cur), public.agtext(def), public.agtext(run)
FROM ag_catalog.cypher('process_gpt', $$
    MATCH (o:Objective {tenant_id:'<TENANT>'})<-[:MEASURES]-(k:KPI)-[:SOURCED_FROM]->(d:ProcessDefinition)
    OPTIONAL MATCH (d)<-[:INSTANCE_OF]-(pi:ProcessInstance {status:'RUNNING'})
    RETURN o.name, k.name, k.current_value, d.name, count(pi)
$$) AS (obj ag_catalog.agtype, kpi ag_catalog.agtype, cur ag_catalog.agtype, def ag_catalog.agtype, run ag_catalog.agtype);

-- C4. 영향분석: 폼 필드를 바꾸면 깨지는 게이트웨이/참조 액티비티
SELECT public.agtext(kind), public.agtext(el), public.agtext(def)
FROM ag_catalog.cypher('process_gpt', $$
    MATCH (ff:FormField {tenant_id:'<TENANT>', form_id:'<FORM_ID>', key:'<FIELD_KEY>'})
    OPTIONAL MATCH (ff)<-[:DECIDES_BY]-(g:Gateway)<-[:DEFINES]-(d1:ProcessDefinition)
    OPTIONAL MATCH (ff)<-[:REFERENCES]-(a:Activity)<-[:DEFINES]-(d2:ProcessDefinition)
    RETURN 'gateway', g.name, d1.id UNION
    RETURN 'activity', a.name, d2.id
$$) AS (kind ag_catalog.agtype, el ag_catalog.agtype, def ag_catalog.agtype);

-- C5. 담당자 리스크: 이 사람이 빠지면 영향받는 역할·진행중 업무
SELECT public.agtext(roles), public.agtext(items)
FROM ag_catalog.cypher('process_gpt', $$
    MATCH (u:User {tenant_id:'<TENANT>', email:'<EMAIL>'})
    OPTIONAL MATCH (r:Role)-[:RESOLVES_TO]->(u)
    OPTIONAL MATCH (w:WorkItem)-[:ASSIGNED_TO]->(u) WHERE w.status IN ['TODO','IN_PROGRESS']
    RETURN collect(DISTINCT r.name), count(w)
$$) AS (roles ag_catalog.agtype, items ag_catalog.agtype);

-- C6. 실행 트레이스: 인스턴스의 워크아이템 타임라인 (+실행한 정의 요소)
SELECT public.agtext(act), public.agtext(st), public.agtext(who), public.agtext(s), public.agtext(e)
FROM ag_catalog.cypher('process_gpt', $$
    MATCH (w:WorkItem)-[:IN_INSTANCE]->(pi:ProcessInstance {id:'<PROC_INST_ID>'})
    OPTIONAL MATCH (w)-[:ASSIGNED_TO]->(u)
    RETURN w.activity_name, w.status, u.username, w.start_date, w.end_date
    ORDER BY w.start_date
$$) AS (act ag_catalog.agtype, st ag_catalog.agtype, who ag_catalog.agtype, s ag_catalog.agtype, e ag_catalog.agtype);

-- C7. GraphRAG 하이브리드(스켈레톤): pgvector top-k 문서 → 그래프 이웃으로 컨텍스트 확장
WITH hits AS (
    SELECT id, metadata->>'proc_def_id' AS def_id
    FROM public.match_documents('<QUERY_EMBEDDING>'::vector, '{}'::jsonb, 5)
)
SELECT h.def_id, public.agtext(g.ctx)
FROM hits h
JOIN LATERAL (
    SELECT ctx FROM ag_catalog.cypher('process_gpt', $$
        MATCH (d:ProcessDefinition {tenant_id:'<TENANT>'})-[:DEFINES]->(a:Activity)-[:IN_LANE]->(r:Role)
        WHERE d.id = $def_id
        RETURN collect(a.name + ' by ' + r.name)
    $$, jsonb_build_object('def_id', h.def_id)::text::ag_catalog.agtype) AS (ctx ag_catalog.agtype)
) g ON true;
```

## 7. 확장(쓰기)이 필요한 프로젝트를 위한 규칙

외부 프로젝트가 자기 도메인 노드를 이 그래프에 붙이고 싶다면(예: PI 시스템이 `PiIndicator`를 `ProcessDefinition`에 연결):

1. **자기 라벨에 프로젝트 접두어**를 붙인다 (`PiIndicator`, `PI_MEASURES` 처럼) — Process GPT 코어 라벨과 네임스페이스 충돌 방지. 엣지 라벨은 그래프 전역임을 기억할 것.
2. 코어 노드(29종)는 **수정 금지** — 속성 추가/변경 불가, 연결(자기 엣지로 코어 노드를 가리키는 것)은 허용.
3. 자기 라벨에도 **업무키 UNIQUE 표현식 인덱스**를 만든다 (02-indexes.sql §1 패턴 복사).
4. `SCHEMA.md`와 `ontology-spec.yaml`에 등록하고 `GraphMeta.schema_version`을 MINOR bump — 등록되지 않은 라벨은 계약 위반으로 간주.
5. 코어 노드가 삭제·재구축될 수 있음을 감안한다 — 정의류 서브그래프는 delete+rebuild 방식이므로, 코어 요소 노드(Activity 등)에 건 엣지는 재구축 후 자기 파이프라인에서 재연결해야 한다. 안정적인 앵커는 재구축 대상이 아닌 `ProcessDefinition`/`ProcessInstance`/`User` 같은 키 노드다.

## 8. 이 구조를 다른 도메인에 이식하기 (템플릿 가이드)

이 온톨로지에서 **도메인 무관하게 재사용 가능한 것**:

| 패턴 | 내용 | 어디서 복사 |
|---|---|---|
| 4파일 멱등 DDL 구조 | 00-init(그래프+헬퍼+동기화 인프라) → 01-labels → 02-indexes → 03-seed | `schema/*.sql` 그대로 — 라벨 목록만 교체 |
| 라벨 생성 헬퍼 | `graph_ensure_vlabel/elabel` (cstring 캐스팅 처리 포함) | 00-init.sql §2 |
| **업무키 = UNIQUE 표현식 인덱스** | AGE에 제약이 없으므로 라벨 테이블에 `agtype_access_operator` 표현식 UNIQUE로 키 강제 | 02-indexes.sql §1 (데이터 주도 루프) |
| 엣지 탐색 인덱스 자동화 | 전 엣지 라벨 start_id/end_id 루프 생성 | 02-indexes.sql §3 |
| projection 원칙 | 그래프는 원천의 파생 — 원천 무변경, outbox/재구축/pull 3경로 동기화 | 설계 문서 §5 |
| dangling 정책 | placeholder 금지 + `graph_sync_dangling` 리포트 | 00-init.sql §4-2, SCHEMA.md §7 |
| 하드닝 | supabase default privileges 차단(RLS+REVOKE), 함수 RPC 노출 차단 | 00-init.sql §5 |
| 계약 문서 체계 | SCHEMA.md(사람) + ontology-spec.yaml(기계) + GraphMeta 버전 노드 | 이 디렉터리 구조 |
| 스키마 계약 3겹 강제 | 라벨=DDL, 키=UNIQUE 인덱스, 속성·endpoint=문서+검증 질의 | SCHEMA.md §1 |

**Process GPT 특화라 이식 시 교체할 것**: 라벨 의미론(§4·§5 카탈로그), BSC Perspective 시드, 원천 매핑(어떤 테이블/JSON을 어느 노드로), 동기화 워커 구현.

최소 채택 체크리스트: ① 레이어 구분 정의 → ② 노드/엣지 카탈로그 작성(업무키 필수) → ③ 4파일 DDL 생성 → ④ 컨테이너에서 적용·멱등·유니크 검증(우리가 한 방식) → ⑤ 동기화 경로 결정(트리거 재구축 vs outbox vs pull) → ⑥ SCHEMA.md/spec.yaml 작성.

## 9. 버전·호환성 확인

```sql
-- (검증됨) 내가 아는 스키마와 배포본이 맞는지 기동 시 확인
SELECT public.agtext(v) FROM ag_catalog.cypher('process_gpt', $$
    MATCH (m:GraphMeta {id:'meta'}) RETURN m.schema_version
$$) AS (v ag_catalog.agtype);   -- '0.2.0'
```

- 버전 규칙(SemVer): MAJOR=재적재 필요한 파괴적 변경, MINOR=라벨/엣지/키 추가, PATCH=속성 추가·문서 정정. 소비자는 **MAJOR 불일치 시 중단**, MINOR/PATCH는 전방 호환으로 취급하면 된다.
- 현재 보류 레이어: Governance(Review·ResourcePR·Terminology + 엣지 10종) — 활성화되면 MINOR bump로 공지된다.
- 백필 진행 상태에 따라 레이어별 데이터 유무가 다를 수 있다. 노드 존재 여부로 기능을 판단하지 말고 `GraphMeta`와 각 레이어 count로 헬스체크할 것.
