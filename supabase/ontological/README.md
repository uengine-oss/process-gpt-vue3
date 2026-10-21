# ontological-db on Supabase (로컬 CLI · 셀프호스트)

strategy-service 의 온톨로지 그래프를 플랫폼과 **같은 Supabase Postgres** 에 두기 위해
[ontological-db](https://github.com/uengine-oss/ontological-db) 확장을 Supabase Postgres 이미지에 얹는다
(spec `specs/014-ontology-graph-platform`, US1).

| 파일 | 내용 |
|---|---|
| `Dockerfile` | supabase/postgres(PG15.8, nix 빌드) 안에서 pgrx 로 확장을 컴파일해 서버 경로에 넣는다. `BASE_IMAGE` 가 AGE 이미지면 두 확장이 함께 들어간다 |
| `install.sh` | 로컬 supabase CLI 의 DB 이미지 태그를 덮어쓰고 DB 컨테이너만 재생성(데이터 유지) → `CREATE EXTENSION` · 권한 부여 |
| `patches/` | 상류에 아직 없는 엔진 수정. 각 파일 머리말에 증상·재현 |

```bash
./supabase/ontological/install.sh          # 첫 빌드 약 5분(cargo-pgrx 설치 + 엔진 컴파일)
```

셀프호스트 compose(`docker-compose/`)용 이미지는 같은 Dockerfile 에 그 compose 의 DB 이미지를 베이스로 준다:

```bash
docker build --build-arg BASE_IMAGE=process-gpt/supabase-postgres-age:15.8.1.060-pg15 \
  -t process-gpt/supabase-postgres-ontological:15.8.1.060-pg15 supabase/ontological
```

**Supabase Cloud(관리형)에는 설치할 수 없다** — AGE 와 마찬가지로 확장 허용 목록에 없다. ontological-db 스펙
005 도 클라우드 등재를 외부 승인 과제로 두고, 성공 기준을 셀프호스트로 정의한다.

## 권한

supabase 의 `postgres` 롤은 superuser 가 아니다. 확장 생성은 `supabase_admin` 이 하고, 서비스 롤에는
`og_grant('<role>', 'admin')` + `GRANT CREATE ON SCHEMA og_data` 를 준다(새 라벨 = 새 저장 테이블).

## 상류(uengine-oss/ontological-db @3179cc7)에 보고할 것

실서비스(strategy-service `GraphStore` 계약 테스트 + 데모 테넌트 이관·동기화)를 붙이며 확인했다.

| # | 증상 | 재현 | 영향 / 우리 쪽 대응 |
|---|---|---|---|
| 1 | `n.id` 가 내부 int8 id 로 예약됨 — Neo4j 에서는 평범한 속성 | `CREATE (n:A {id:'x'})` 는 저장되지만 `MATCH (n:A {id:'x'})` 는 `'x'::int8` 캐스트 오류, `RETURN n.id` 는 내부 id | 업무 키를 `id` 로 쓰는 앱은 URI 만 바꿔 옮길 수 없다. 어댑터가 `uid` 로 저장·변환 |
| 2 | `og_grant(role,'admin')` 이 `og_data` 스키마 CREATE 를 주지 않음 | admin 롤로 새 라벨 `CREATE` → `permission denied for schema og_data` | 암시적 라벨 생성 불가. install.sh 가 따로 GRANT |
| 3 | `og_grant` 이후 모든 타입 생성 실패 — 권한 재부여가 이미 따옴표 친 뷰 이름을 다시 감싼다(`"og_data"."""Task"""`), "로그만 남기는" 실패가 SPI 오류로 트랜잭션을 중단 | `og_grant(...)` → `og_create_type(...)` → `relation "og_data."Task"" does not exist` | `patches/0001` 로 수정 |
| 4 | `SET n += $map` 와 같은 문장의 `RETURN n` 이 갱신 전 값 (`SET n.x = v` 는 반영됨) | `MATCH (n) SET n += {a:1} RETURN n.a` → 이전 값 | 어댑터가 쓴 맵을 결과에 얹음 |
| 5 | 라벨 없는 패턴의 속성 비교가 행마다 `og_node_json()` 으로 컴파일 — 선언된 속성 인덱스를 못 탐 | `og_cypher_sql('g', 'MATCH (a)-[r]->(b) WHERE a.tenant_id=$t …')` | 성능 10배 차이. 어댑터가 타입별 저장 테이블·`og_edge_view` 를 SQL 로 읽음 |
| 6 | 스키마 변경 시 엔진이 모든 타입 뷰를 지우고 다시 만드는데, 뷰 소유 롤이 섞여 있으면 실패 | 한 롤로 타입 생성 후 다른 롤이 `og_create_graph` → `must be owner of view v_N` | 스키마 변경은 서비스 롤 하나로만 한다 |
| 7 | 그 뷰 재생성이 동시 질의 둘에서 겹치면 한쪽이 `pg_type_typname_nsp_index` 고유 위반 | 새 속성 추가 직후 동시 조회 | 어댑터가 해당 오류에서 재실행 |
| 8 | `og_cypher` 가 매 호출 감사 로그(`og_audit`)에 INSERT — 읽기 전용 트랜잭션에서는 읽기도 실패 | `SET transaction_read_only = on` 후 `MATCH … RETURN` → `cannot execute INSERT in a read-only transaction` | 읽기 전용 강제가 불가해 자유 Cypher MCP 도구를 두지 않음 |
| 9 | `og_enable_rls` 정책이 조회에 적용되지 않음(원인 미확인 — 보안정의자 뷰 소유자 문제로 추정) | 테넌트 정책 설정 후 다른 테넌트 노드가 보임 | 테넌트 격리는 어댑터·도구 계층에서 |
| 10 | `og_audit` 를 끌 설정도, 보존 정책도 없음 — 모든 `og_cypher` 호출이 한 행씩 쌓인다 | 60초 주기 동기화(약 550 호출/분) → 6일 만에 24만 행·62MB, 실제 그래프(약 8MB)의 8배 | 동기화가 바뀐 원천만 쓰게 하고(약 29 호출/분), `public.purge_og_audit` + pg_cron 으로 14일 보관(migration `20261014000001`) |

## 운영 메모

- **데이터 이중화(중복 저장) 여부** — 엔진 내부는 중복 저장이 아니다. `og_node`·`og_edge` 는 (id, 타입[, src, dst])만 갖는
  얇은 색인이고 속성은 타입별 저장 테이블(`n_<id>`·`e_<id>`)에 한 번만 있다. `og_adj` 는 이웃 배열(탐색용 색인)이다.
  다만 그래프 자체는 플랫폼 테이블(`proc_def`·`users`·`todolist` 등)을 **복사한 투영**이다 — 원본은 플랫폼 테이블이고,
  그래프는 동기화(최대 60초 지연)로 따라온다. 2026-10-14 기준 그래프 약 8MB(노드 1,383·관계 2,799).

- **MERGE 는 원자적이지 않다.** 같은 업무 키를 두 MERGE 가 동시에 실행하면 노드가 둘 생긴다(동기화 루프와 수동 동기화가 겹친
  실측: 워크아이템 587개 중복). 어댑터가 라벨마다 `(p_uid, p_tenant_id)` 고유 색인을 만들고(`ensure_ready` 가 기존 중복을 먼저
  정리), 동기화는 `pg_advisory_lock` 으로 직렬화한다.

