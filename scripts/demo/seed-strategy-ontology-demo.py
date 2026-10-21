#!/usr/bin/env python3
"""전략–실행 온톨로지 익스플로러 데모 데이터 (specs/013-ontology-explorer).

매뉴얼 캡처·시연용으로 "운영 중인 회사"처럼 보일 만큼 데이터를 채운다.
  - 구매·조달 도메인 프로세스 5개(기존 '구매 프로세스' + 데모 정의 4개, 활동 포함)
  - 담당자 6명 + AI 에이전트 3개(스킬 연결)
  - BSC 전략맵 10개 목표 · KPI 12개 · 이니셔티브 4개 (strategy-service API)
  - 최근 120일 실행 인스턴스 약 60건과 워크아이템(완료/진행/지연, 프로세스별 병목 단계)
  - 수동 KPI 4개의 주간 측정 이력 17주(영향 가설 데모, spec 014 US4 — 합성 데이터):
    구매 요청 만족도 ← 구매 프로세스 소요시간(같은 주, 반대), 납기 준수율 ← 발주 소요시간(1주 뒤, 반대),
    구매 단가 절감률 ← 협력사 평가 완료(2주 뒤, 같은 방향), 재고 회전 일수 = 무관한 잡음(대조군)
그 뒤 KPI 측정과 온톨로지 전체 동기화를 실행한다.

데모 행 식별: proc_def.id / proc_inst_id 에 'demo-onto-', 사용자 email 'demo-onto-*@example.com'.

  python3 scripts/demo/seed-strategy-ontology-demo.py            # (기존 데모 삭제 후) 생성
  python3 scripts/demo/seed-strategy-ontology-demo.py --cleanup  # 데모 데이터·전략맵 삭제
  python3 scripts/demo/seed-strategy-ontology-demo.py --structure  # 전략맵은 두고 시스템·데이터·문서·프로세스 맵만 적용(spec 016)

환경: TENANT(tym) STRATEGY_URL(http://127.0.0.1:8014)
      PSQL("docker exec -i supabase_db_process-gpt-vue3 psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q")
표준 라이브러리만 사용한다.
"""

import json
import os
import random
import shlex
import subprocess
import sys
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from demo_bpmn import build_bpmn  # noqa: E402

TENANT = os.environ.get("TENANT", "tym")
API = os.environ.get("STRATEGY_URL", "http://127.0.0.1:8014").rstrip("/") + "/api"
PSQL = shlex.split(
    os.environ.get(
        "PSQL", "docker exec -i supabase_db_process-gpt-vue3 psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q"
    )
)
TAG = "demo-onto-"
NOW = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
rng = random.Random(13)

# ------------------------------------------------------------------ 사람·에이전트


def uid(key: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"{TAG}{TENANT}:{key}"))


PEOPLE = {
    "jihoon": ("김지훈", "구매팀"),
    "seoyeon": ("이서연", "구매팀"),
    "junho": ("박준호", "구매팀"),
    "minji": ("최민지", "재무팀"),
    "haneul": ("정하늘", "재무팀"),
    "doyun": ("한도윤", "물류팀"),
}
AGENTS = {
    "quote_agent": ("견적비교 에이전트", "협력사 견적을 수집·비교해 추천안을 작성", ["견적 비교 분석", "협력사 단가 조회", "구매 문서 작성"]),
    "settle_agent": ("정산 대사 에이전트", "세금계산서와 발주·입고를 대사", ["세금계산서 대사", "3-way 매칭", "구매 문서 작성"]),
    "stock_agent": ("재고 분석 에이전트", "재고 차이와 수요를 분석", ["재고 차이 분석", "수요 예측"]),
    # 실행 이력 없이 도구만 가진 에이전트 — tenants.mcp 의 두 서버(전략–실행 온톨로지, ontology-studio)를 쓴다(AGENT_TOOLS)
    "onto_agent": ("온톨로지 조회 에이전트", "전략–실행 온톨로지와 Ontology Studio 지식 그래프를 MCP 로 조회해 근거를 정리",
                   ["온톨로지 질의"]),
}
# 기존 tym 사용자(요청 부서·결재자 역할)
EXISTING = {"hong": "68dcbf56-6f5c-48e0-95c2-120e4fba3ea9", "kim": "41a10913-f5b1-43af-a5b6-b964314d09d3",
            "ceo": "261481bb-4d17-4507-955c-5fbe53f273b7"}


# users.tools = tenants.mcp 의 서버 이름(쉼표 구분). 서버 등록은 테넌트 MCP 설정 화면에서 한다.
AGENT_TOOLS = {"onto_agent": "strategy-ontology,ontology-studio"}


def person_id(key: str) -> str:
    return EXISTING.get(key) or uid(key)


# ------------------------------------------------------------------ 프로세스
# 활동: (activity_id, 이름, 담당 후보, 기준 처리시간(h))  — 처리시간이 가장 긴 단계가 병목
PURCHASE = "-1789706878546"  # 기존 '구매 프로세스'(활동 6개)
PROCESSES = [
    {"id": PURCHASE, "name": "구매 프로세스", "existing": True, "count": 16, "label": "구매요청", "acts": [
        ("Task_Request", "구매 요청서 작성", ["hong", "kim"], 2),
        ("Task_Quote", "견적 접수·비교", ["quote_agent", "quote_agent", "seoyeon"], 6),
        ("Task_Review", "견적 검토", ["junho", "jihoon"], 30),
        ("Task_Approve", "구매 승인", ["ceo", "minji"], 6),
        ("Task_Order", "발주서 발행", ["seoyeon"], 3),
        ("Task_Settle", "검수·정산", ["haneul"], 5)]},
    {"id": f"{TAG}po", "name": "구매발주 처리", "count": 14, "label": "발주", "acts": [
        ("po_receive", "발주 요청 접수", ["jihoon"], 1),
        ("po_vendor", "협력사 선정", ["junho", "quote_agent"], 10),
        ("po_draft", "발주서 작성", ["seoyeon", "quote_agent"], 3),
        ("po_approve", "발주 승인", ["ceo"], 18),
        ("po_track", "납기 확인", ["doyun"], 6)]},
    {"id": f"{TAG}eval", "name": "협력사 정기 평가", "count": 7, "label": "협력사평가", "acts": [
        ("ev_plan", "평가 계획 수립", ["junho"], 4),
        ("ev_collect", "실적 데이터 수집", ["quote_agent"], 2),
        ("ev_score", "평가 점수 산정", ["jihoon", "junho"], 12),
        ("ev_review", "평가위원회 검토", ["ceo"], 40),
        ("ev_notify", "결과 통보", ["seoyeon"], 2)]},
    {"id": f"{TAG}count", "name": "재고 실사·조정", "count": 8, "label": "재고실사", "acts": [
        ("ct_plan", "실사 계획 수립", ["doyun"], 3),
        ("ct_count", "현물 실사", ["doyun"], 20),
        ("ct_diff", "재고 차이 분석", ["stock_agent"], 1),
        ("ct_adjust", "재고 조정 승인", ["minji"], 8)]},
    {"id": f"{TAG}settle", "name": "대금 정산 처리", "count": 14, "label": "정산", "acts": [
        ("st_invoice", "세금계산서 수신", ["haneul"], 1),
        ("st_match", "3-way 매칭", ["settle_agent", "settle_agent", "haneul"], 1),
        ("st_check", "정산 검토", ["minji"], 26),
        ("st_approve", "지급 승인", ["ceo"], 6),
        ("st_pay", "지급 실행", ["haneul"], 2)]},
]
PROC = {p["id"]: p for p in PROCESSES}
INSTANCES: list[tuple] = []  # seed_executions 가 채운다 — KPI 이력이 실행 지표를 따라가게 하려고

# ------------------------------------------------------------------ 유틸


def q(v) -> str:
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, datetime):
        return "'" + v.strftime("%Y-%m-%d %H:%M:%S") + "'"
    return "'" + str(v).replace("'", "''") + "'"


def psql(sql: str) -> None:
    # 한 배치는 한 트랜잭션 — 중간 실패 시 반쯤 들어간 데모 행이 남지 않게
    subprocess.run(PSQL, input=f"begin;\n{sql}\ncommit;\n".encode(), check=True)


def psql_value(sql: str) -> str:
    out = subprocess.run(PSQL + ["-At", "-c", sql], capture_output=True, check=True)
    return out.stdout.decode().strip()


def api(method: str, path: str, body=None):
    url = f"{API}/{path}{'&' if '?' in path else '?'}tenant_id={TENANT}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={"content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=600) as res:
        raw = res.read()
    return json.loads(raw) if raw else None


# ------------------------------------------------------------------ 정리


def cleanup() -> None:
    user_ids = [uid(k) for k in list(PEOPLE) + list(AGENTS)]
    ids = ", ".join(q(i) for i in user_ids)
    skill_names = ", ".join(q(n) for _n, _d, names in AGENTS.values() for n in names)
    psql(f"""
delete from public.todolist where tenant_id = {q(TENANT)} and (proc_inst_id like '%{TAG}%' or proc_def_id like '{TAG}%');
delete from public.bpm_proc_inst where tenant_id = {q(TENANT)} and (proc_inst_id like '%{TAG}%' or proc_def_id like '{TAG}%');
delete from public.proc_def where tenant_id = {q(TENANT)} and id like '{TAG}%';
delete from public.agent_skills where tenant_id = {q(TENANT)} and user_id::text in ({ids});
delete from public.tenant_skills where tenant_id = {q(TENANT)} and owner_id::text in ({ids}) and skill_name in ({skill_names});
delete from public.signup_requests where tenant_id = {q(TENANT)} and user_id::text in ({ids});
delete from public.users where tenant_id = {q(TENANT)} and id::text in ({ids});
delete from public.strategy_kpi_measurements where tenant_id = {q(TENANT)} and source = '{TAG}history';
delete from public.strategy_causal_hypotheses where tenant_id = {q(TENANT)}
   and (process_id like '{TAG}%' or process_id = {q(PURCHASE)});
""")
    cleanup_structure()
    api("DELETE", "map")


def cleanup_structure() -> None:
    """시스템·문서·사용처와 프로세스 맵의 데모 항목만 지운다(사용자 항목은 그대로)."""
    sys_ids = ", ".join(q(uid("system:" + k)) for k in SYSTEMS)
    doc_ids = ", ".join(q(uid("doc:" + k)) for k in DOCS)
    psql(f"""
delete from public.policy_document_usage where tenant_id = {q(TENANT)} and policy_id::text in ({doc_ids});
delete from public.audit_policy where tenant_id = {q(TENANT)} and id::text in ({doc_ids});
delete from public.systems where tenant_id = {q(TENANT)} and id::text in ({sys_ids});
""")
    raw = psql_value(f"select value::text from public.configuration where tenant_id = {q(TENANT)} and key = 'proc_map'")
    if not raw:
        return
    pm = json.loads(raw)
    for mega in pm.get("mega_proc_list") or []:
        for major in mega.get("major_proc_list") or []:
            major["sub_proc_list"] = [s for s in major.get("sub_proc_list") or [] if not str(s.get("id", "")).startswith(TAG)]
    psql(f"update public.configuration set value = {q(json.dumps(pm, ensure_ascii=False))}::jsonb "
         f"where tenant_id = {q(TENANT)} and key = 'proc_map';")


def seed_structure() -> None:
    """시스템 마스터(시스템 관리 화면 선택지)·규정 문서·문서 사용처·프로세스 맵 배치."""
    proc_of = {a[0]: p["id"] for p in PROCESSES for a in p["acts"]}
    systems = ", ".join(f"({q(uid('system:' + k))}, {q(TENANT)}, {q(k)}, {q(cat)}, {q(desc)}, 'active')"
                        for k, (cat, desc) in SYSTEMS.items())
    docs = ", ".join(f"({q(uid('doc:' + k))}, {q(TENANT)}, {q(name)}, 'link', {q(url)}, '구매 데모', ARRAY[]::text[])"
                     for k, (name, url, _acts) in DOCS.items())
    usage = ", ".join(f"({q(TENANT)}, {q(uid('doc:' + k))}, {q(proc_of[a])}, {q(a)})"
                      for k, (_n, _u, acts) in DOCS.items() for a in acts)
    psql(f"""
insert into public.systems (id, tenant_id, name, category, description, registration_status) values {systems};
insert into public.audit_policy (id, tenant_id, name, kind, link_url, author_name, domains) values {docs};
insert into public.policy_document_usage (tenant_id, policy_id, process_id, element_id) values {usage};
""")
    raw = psql_value(f"select value::text from public.configuration where tenant_id = {q(TENANT)} and key = 'proc_map'")
    if not raw:
        print("[안내] tym 프로세스 맵이 없어 데모 프로세스를 배치하지 않았습니다.")
        return
    pm = json.loads(raw)
    names = {p["id"]: p["name"] for p in PROCESSES}
    placed = []
    for mega in pm.get("mega_proc_list") or []:
        for major in mega.get("major_proc_list") or []:
            for pid, (mega_name, major_name) in MAP_PLACE.items():
                if mega.get("name") == mega_name and major.get("name") == major_name:
                    subs = major.setdefault("sub_proc_list", [])
                    if not any(s.get("id") == pid for s in subs):
                        subs.append({"id": pid, "name": names[pid], "proc_def_id": pid})
                    placed.append(pid)
    psql(f"update public.configuration set value = {q(json.dumps(pm, ensure_ascii=False))}::jsonb "
         f"where tenant_id = {q(TENANT)} and key = 'proc_map';")
    missing = set(MAP_PLACE) - set(placed)
    if missing:
        print(f"[안내] 프로세스 맵에서 그룹을 찾지 못해 배치하지 않음: {sorted(missing)}")


# ------------------------------------------------------------------ 생성


def seed_people() -> None:
    rows = []
    for key, (name, dept) in PEOPLE.items():
        rows.append(f"({q(uid(key))}, {q(name)}, {q(f'{TAG}{key}@example.com')}, {q(TENANT)}, false, null, null, {q(dept)})")
    for key, (name, desc, _skills) in AGENTS.items():
        rows.append(f"({q(uid(key))}, {q(name)}, null, {q(TENANT)}, true, 'agent', {q(desc)}, 'AI 에이전트')")
    ids = ", ".join(q(uid(k)) for k in PEOPLE)
    skills, owners = [], {}
    for key, (_n, _d, names) in AGENTS.items():
        skills += [f"({q(uid(key))}, {q(TENANT)}, {q(s)})" for s in names]
        for s in names:
            owners.setdefault(s, uid(key))
    catalog = ", ".join(f"({q(TENANT)}, {q(s)}, {q(o)})" for s, o in owners.items())
    psql(f"""
insert into public.users (id, username, email, tenant_id, is_agent, agent_type, description, department_name)
values {', '.join(rows)};
-- 사람 계정은 트리거가 pending 으로 만든다 → 데모 담당자는 승인 상태로, 가입 대기열에서도 뺀다
update public.users set membership_status = 'approved', role = 'editor'
 where tenant_id = {q(TENANT)} and id::text in ({ids});
delete from public.signup_requests where tenant_id = {q(TENANT)} and user_id::text in ({ids});
insert into public.tenant_skills (tenant_id, skill_name, owner_id) values {catalog}
    on conflict do nothing;
insert into public.agent_skills (user_id, tenant_id, skill_name) values {', '.join(skills)};
{chr(10).join(f"update public.users set tools = {q(t)} where tenant_id = {q(TENANT)} and id::text = {q(uid(k))};" for k, t in AGENT_TOOLS.items())}
""")


# ------------------------------------------------------------------ 시스템·데이터·문서·아키텍처 (spec 016)
# SOLiD 데모와 같은 구성. 발주서는 발주가 만들고 정산이 읽는다, 납기 실적은 발주가 만들고 협력사 평가가 읽는다,
# 협력사 평가 결과는 평가가 만들고 발주가 읽는다 — 발주를 바꾸면 정산·평가가 영향을 받는다.
# 시스템은 tym 의 다른(사용자) 프로세스에서도 고를 수 있게 생산·품질 계열까지 등록한다.
SYSTEMS = {
    "ERP": ("경영", "구매·재고·회계·원가"),
    "SRM 협력사 포털": ("구매", "견적·발주·납기 회신을 협력사와 주고받는 포털"),
    "WMS": ("물류", "입고·보관·출고·재고 실사"),
    "MES": ("생산", "작업지시·생산실적·설비"),
    "PLM": ("설계", "BOM·설계변경·도면"),
    "QMS": ("품질", "검사·부적합·클레임·CAPA"),
    "전자결재": ("공통", "결재·합의 문서"),
    "전자세금계산서": ("재무", "세금계산서 수발행·국세청 연계"),
}
DEPT_OF = {"quote_agent": "구매팀", "settle_agent": "재무팀", "stock_agent": "물류팀", "ceo": "경영진",
           "hong": "요청부서", "kim": "요청부서"}
TASK_SYSTEMS = {
    "po_receive": ["ERP"], "po_vendor": ["SRM 협력사 포털", "ERP"], "po_draft": ["ERP", "SRM 협력사 포털"],
    "po_approve": ["전자결재"], "po_track": ["SRM 협력사 포털", "ERP"],
    "ev_plan": ["SRM 협력사 포털"], "ev_collect": ["ERP", "QMS"], "ev_score": ["SRM 협력사 포털"],
    "ev_review": ["전자결재"], "ev_notify": ["SRM 협력사 포털"],
    "ct_plan": ["WMS"], "ct_count": ["WMS"], "ct_diff": ["WMS", "ERP"], "ct_adjust": ["ERP", "전자결재"],
    "st_invoice": ["전자세금계산서"], "st_match": ["ERP", "전자세금계산서"], "st_check": ["ERP"],
    "st_approve": ["전자결재"], "st_pay": ["ERP"],
}
DATA_FLOW = {
    "po_receive": (["구매요청서"], ["발주 요청"]),
    "po_vendor": (["발주 요청", "협력사 평가 결과", "단가 계약"], ["선정 협력사"]),
    "po_draft": (["선정 협력사", "단가 계약"], ["발주서"]),
    "po_approve": (["발주서"], []),
    "po_track": (["발주서"], ["납기 실적"]),
    "ev_plan": ([], ["평가 계획"]),
    "ev_collect": (["평가 계획", "납기 실적", "입고 검사 결과"], ["협력사 실적"]),
    "ev_score": (["협력사 실적"], ["평가 점수"]),
    "ev_review": (["평가 점수"], ["협력사 평가 결과"]),
    "ev_notify": (["협력사 평가 결과"], []),
    "ct_plan": (["재고 현황"], ["실사 계획"]),
    "ct_count": (["실사 계획"], ["실사 결과"]),
    "ct_diff": (["실사 결과", "재고 현황"], ["재고 차이"]),
    "ct_adjust": (["재고 차이"], ["재고 현황"]),
    "st_invoice": ([], ["세금계산서"]),
    "st_match": (["세금계산서", "발주서", "재고 현황"], ["매칭 결과"]),
    "st_check": (["매칭 결과"], []),
    "st_approve": (["매칭 결과"], ["지급 승인"]),
    "st_pay": (["지급 승인"], ["지급 내역"]),
}
DOCS = {
    "purchase_rule": ("구매 규정", "https://docs.example.com/tym/purchase", ["po_vendor", "po_approve"]),
    "vendor_eval": ("협력사 평가 기준", "https://docs.example.com/tym/vendor-eval", ["ev_score", "ev_review"]),
    "stock_guide": ("재고 관리 지침", "https://docs.example.com/tym/stock", ["ct_diff", "ct_adjust"]),
    "payment_rule": ("대금 지급 규정", "https://docs.example.com/tym/payment", ["st_check", "st_approve"]),
}
HANDOFFS = {f"{TAG}po": f"{TAG}settle"}
# 기존 tym 프로세스 맵(구매관리 도메인)의 그룹에 데모 프로세스를 넣는다: 프로세스 → (메가 이름, 메이저 이름)
MAP_PLACE = {
    f"{TAG}po": ("구매 운영", "구매 실행"),
    f"{TAG}eval": ("협력사 관리", "협력사 평가"),
    f"{TAG}count": ("자재·재고 관리", "입고·재고 관리"),
    f"{TAG}settle": ("원가·정산 관리", "대금 정산"),
}


def dept_of(key: str) -> str:
    return DEPT_OF.get(key) or PEOPLE[key][1]


def bpmn_and_definition(p: dict) -> tuple[str, dict]:
    """정의 JSON + BPMN(레인=담당 부서, 에이전트 활동=서비스 태스크, 시스템·데이터·인계 포함)."""
    roles = sorted({c for _a, _n, cands, _h in p["acts"] for c in cands})
    lanes = list(dict.fromkeys(dept_of(cands[0]) for _a, _n, cands, _h in p["acts"]))
    acts = [{"id": a, "name": n, "lane": dept_of(cands[0]), "desc": f"{n} — {p['name']}",
             "kind": "serviceTask" if cands[0] in AGENTS else "userTask"} for a, n, cands, _h in p["acts"]]
    xml = build_bpmn(p["id"], p["name"], lanes, acts, None, TASK_SYSTEMS, DATA_FLOW, HANDOFFS.get(p["id"]))
    definition = {
        "processDefinitionId": p["id"],
        "processDefinitionName": p["name"],
        "roles": [{"name": r, "default": person_id(r)} for r in roles],
        "activities": [
            {"id": a, "name": n, "type": "serviceTask" if cands[0] in AGENTS else "userTask", "role": cands[0],
             "duration": max(1, round(h / 8)), "systems": [{"name": x} for x in TASK_SYSTEMS.get(a, [])]}
            for a, n, cands, h in p["acts"]
        ],
        "data": [],
    }
    return xml, definition


def seed_proc_defs() -> None:
    stmts = []
    for p in PROCESSES:
        if p.get("existing"):
            continue
        xml, definition = bpmn_and_definition(p)
        stmts.append(
            # 업무 도메인 — 분석 대시보드 도메인 필터·익스플로러 교차 필터가 같은 값을 쓴다(spec 014 US6)
            f"insert into public.proc_def (id, name, tenant_id, definition, bpmn, type, description, domain_id) values "
            f"({q(p['id'])}, {q(p['name'])}, {q(TENANT)}, {q(json.dumps(definition, ensure_ascii=False))}::jsonb, {q(xml)}, 'bpmn', "
            f"{q(p['name'] + ' 표준 절차')}, '구매관리') "
            "on conflict (tenant_id, id) do update set definition = excluded.definition, bpmn = excluded.bpmn;"
        )
    psql("\n".join(stmts))


def seed_executions() -> int:
    inst_rows, item_rows = [], []
    serial = 2000
    for p in PROCESSES:
        n = p["count"]
        for i in range(n):
            serial += rng.randint(1, 4)
            inst_id = f"{p['id']}.{TAG}{serial}"
            age_days = 118 * (n - i) / n + rng.uniform(-2, 2)  # 오래된 것부터 고르게
            start = NOW - timedelta(days=max(1.5, age_days))
            # 최근 2건 중 일부는 진행 중
            running_at = rng.randint(1, len(p["acts"]) - 1) if i >= n - 2 and rng.random() < 0.8 else None
            budget = sum(h for *_x, h in p["acts"]) * 1.4
            due = start + timedelta(hours=max(48, budget))
            t = start
            current = None
            for step, (aid, aname, cands, base) in enumerate(p["acts"]):
                who = rng.choice(cands)
                is_agent = who in AGENTS
                hours = base * (rng.uniform(0.15, 0.35) if is_agent else rng.uniform(0.6, 1.7))
                wait = rng.uniform(0.2, 3.0)
                t = t + timedelta(hours=wait)
                item_due = t + timedelta(hours=max(8, base * 1.3))
                if running_at is not None and step == running_at:
                    item_rows.append((who, inst_id, p["id"], aid, aname, "IN_PROGRESS", t, None, item_due, is_agent))
                    current = aid
                    break
                end = t + timedelta(hours=hours)
                item_rows.append((who, inst_id, p["id"], aid, aname, "DONE", t, end, item_due, is_agent))
                t = end
            done = current is None
            inst_rows.append((inst_id, f"{p['label']} #{serial}", p["id"], "COMPLETED" if done else "RUNNING",
                              start, t if done else None, due, current))

    def item_sql(r):
        who, inst_id, pd, aid, aname, status, s, e, d, is_agent = r
        user = person_id(who)
        name = AGENTS[who][0] if is_agent else (PEOPLE.get(who) or (None,))[0]
        dur = round((e - s).total_seconds() / 60) if e else None
        return (f"(gen_random_uuid(), {q(user)}, {q(name)}, {q(inst_id)}, {q(inst_id)}, {q(pd)}, {q(aid)}, {q(aname)}, "
                f"{q(status)}::todo_status, {q(TENANT)}, {q(s)}, {q(e)}, {q(d)}, {q(dur)}, "
                f"{"'COMPLETE'::agent_mode" if is_agent else 'null'}, {q(e or s)})")

    # 참여자 = 워크아이템 담당자. 진행·완료 인스턴스 목록은 participants 로 거르므로 비우면 아무에게도 안 보인다.
    members: dict[str, list[str]] = {}
    for who, inst_id, *_rest in item_rows:
        uid = person_id(who)
        if uid and uid not in members.setdefault(inst_id, []):
            members[inst_id].append(uid)

    def inst_sql(r):
        inst_id, name, pd, status, s, e, d, cur = r
        acts = "array[]::text[]" if cur is None else f"array[{q(cur)}]"
        parts = f"array[{', '.join(q(u) for u in members.get(inst_id, []))}]::text[]"
        return (f"({q(inst_id)}, {q(name)}, {q(pd)}, {q(inst_id)}, {q(status)}::process_status, {q(TENANT)}, "
                f"{q(s)}, {q(e)}, {q(d)}, {acts}, {parts}, false, {q(e or s)})")

    psql(f"""
insert into public.bpm_proc_inst (proc_inst_id, proc_inst_name, proc_def_id, root_proc_inst_id, status, tenant_id,
    start_date, end_date, due_date, current_activity_ids, participants, is_deleted, updated_at)
values {', '.join(inst_sql(r) for r in inst_rows)};
insert into public.todolist (id, user_id, username, proc_inst_id, root_proc_inst_id, proc_def_id, activity_id,
    activity_name, status, tenant_id, start_date, end_date, due_date, duration, agent_mode, updated_at)
values {', '.join(item_sql(r) for r in item_rows)};
""")
    INSTANCES.extend(inst_rows)
    return len(inst_rows), len(item_rows)


KPI_IDS: dict[str, str] = {}


def seed_strategy() -> None:
    def obj(name, desc, perspective, importance, parents=()):
        return api("POST", "objectives", {"name": name, "description": desc, "perspective": perspective,
                                          "importance": importance, "parents": list(parents)})["id"]

    def kpi(objective, name, unit, measure, target, baseline, direction="increase", proc=None, role="lagging",
            importance=3, value=None):
        body = {"objective_id": objective, "name": name, "unit": unit, "measure_type": measure,
                "target_value": target, "baseline_value": baseline, "direction": direction, "kpi_role": role,
                "importance": importance, "period_start": "2026-01-01", "period_end": "2026-12-31"}
        if proc:
            body["proc_def_id"] = proc
        k = api("POST", "kpis", body)
        if value is not None:
            api("POST", f"kpis/{k['id']}/value", {"value": value})
        KPI_IDS[name] = k["id"]

    def initiative(objective, name, desc, status, progress, proc, start, due):
        api("POST", "initiatives", {"objective_id": objective, "name": name, "description": desc, "status": status,
                                    "progress": progress, "proc_def_id": proc, "start_date": start, "due_date": due})

    f1 = obj("구매 원가 절감", "전사 구매 단가와 처리 비용을 낮춘다", "financial", 5)
    f2 = obj("운전자본 효율화", "재고와 미지급 정산 주기를 줄여 현금 흐름을 개선한다", "financial", 4)
    c1 = obj("현업 구매 요청 만족도 향상", "요청 부서가 빠르고 예측 가능하게 자재를 받는다", "customer", 4, [f1])
    c2 = obj("협력사 납기 신뢰도 향상", "협력사와 약속한 납기를 지킨다", "customer", 4, [f1, f2])
    p1 = obj("구매 프로세스 표준화·자동화", "견적 비교·승인을 표준화하고 반복 업무를 에이전트로 옮긴다", "internal_process", 4, [c1])
    p2 = obj("협력사 관리 체계 고도화", "정기 평가로 우수 협력사를 선별한다", "internal_process", 3, [c2])
    p3 = obj("재고 정확도 개선", "장부와 실물 재고 차이를 줄인다", "internal_process", 3, [f2])
    p4 = obj("정산 업무 자동화", "세금계산서 대사·지급을 자동화한다", "internal_process", 3, [f2])
    l1 = obj("구매 담당자 역량 강화", "협상·원가분석 역량을 키운다", "learning_growth", 3, [p1, p2])
    l2 = obj("AI 에이전트 활용 확대", "반복 업무를 에이전트가 처리하도록 확대한다", "learning_growth", 3, [p1, p4])

    kpi(f1, "구매 완료 건수", "건", "instance_count", 20, 0, proc=PURCHASE, importance=5)
    kpi(f1, "구매 단가 절감률", "%", "manual", 5, 0, importance=4, value=3.2)
    kpi(f2, "정산 처리 리드타임", "시간", "avg_duration_hours", 36, 72, "decrease", proc=f"{TAG}settle", importance=4)
    kpi(f2, "재고 회전 일수", "일", "manual", 30, 45, "decrease", importance=3, value=38)
    kpi(c1, "구매 처리 리드타임", "시간", "avg_duration_hours", 48, 96, "decrease", proc=PURCHASE, role="leading", importance=4)
    kpi(c1, "구매 요청 만족도", "점", "manual", 4.5, 3.0, role="lagging", importance=3, value=3.9)
    kpi(c2, "발주 처리 건수", "건", "instance_count", 12, 0, proc=f"{TAG}po", importance=3)
    kpi(c2, "납기 준수율", "%", "manual", 95, 80, importance=4, value=88)
    kpi(p1, "표준 견적 비교 적용률", "%", "manual", 90, 40, role="leading", value=62)
    kpi(p2, "협력사 평가 완료 건수", "건", "instance_count", 6, 0, proc=f"{TAG}eval", role="leading")
    kpi(p3, "재고 실사 리드타임", "시간", "avg_duration_hours", 24, 48, "decrease", proc=f"{TAG}count", role="leading")
    kpi(p4, "세금계산서 자동 대사율", "%", "manual", 80, 20, role="leading", value=55)
    kpi(l1, "협상 교육 이수율", "%", "manual", 80, 20, role="leading", importance=2, value=85)
    kpi(l2, "에이전트 처리 비중", "%", "manual", 50, 10, role="leading", importance=3, value=34)

    initiative(p1, "견적 비교 자동화", "견적 접수·비교 단계를 에이전트가 초안 작성", "in_progress", 60, PURCHASE,
               "2026-07-01", "2026-12-31")
    initiative(p2, "협력사 스코어카드 도입", "정기 평가 지표를 표준화한다", "in_progress", 35, f"{TAG}eval",
               "2026-08-01", "2027-02-28")
    initiative(p3, "재고 실사 모바일화", "현물 실사를 모바일 스캔으로 바꾼다", "planned", 10, f"{TAG}count",
               "2026-11-01", "2027-03-31")
    initiative(p4, "정산 대사 RPA", "3-way 매칭을 에이전트로 자동화", "completed", 100, f"{TAG}settle",
               "2026-03-01", "2026-08-31")


def _weekly(proc_id: str) -> tuple[dict, dict]:
    """프로세스의 주별(월요일 기준) 완료 건수·평균 소요시간(h)."""
    count, hours = {}, {}
    for inst_id, _name, pd, status, s, e, _d, _cur in INSTANCES:
        if pd != proc_id or status != "COMPLETED" or e is None:
            continue
        wk = (e - timedelta(days=e.weekday())).date()
        count[wk] = count.get(wk, 0) + 1
        hours.setdefault(wk, []).append((e - s).total_seconds() / 3600)
    return count, {w: sum(v) / len(v) for w, v in hours.items()}


def seed_kpi_history(weeks: int = 17) -> int:
    """수동 KPI 의 주간 측정 이력(합성). 세 KPI 는 실행 지표를 시차를 두고 따라가고, 하나는 무관한 잡음이다.
    마지막 주 값은 KPI 의 현재 값에 맞춘다(전략맵 숫자와 이력이 어긋나지 않게)."""
    monday = (NOW - timedelta(days=NOW.weekday())).date()
    week_list = [monday - timedelta(weeks=i) for i in range(weeks - 1, -1, -1)]
    buy_cnt, buy_h = _weekly(PURCHASE)
    _po_cnt, po_h = _weekly(f"{TAG}po")
    ev_cnt, _ev_h = _weekly(f"{TAG}eval")
    hrng = random.Random(29)

    def carry(series: dict, w):
        # 완료가 없던 주는 직전 값(측정 잡도 직전 집계를 유지한다)
        prev = [series[x] for x in sorted(series) if x <= w]
        return prev[-1] if prev else (sum(series.values()) / len(series) if series else 0)

    plans = {
        "구매 요청 만족도": (3.9, lambda w: 4.6 - 0.012 * carry(buy_h, w) + hrng.gauss(0, 0.04)),
        "납기 준수율": (88, lambda w: 97 - 0.16 * carry(po_h, w - timedelta(weeks=1)) + hrng.gauss(0, 0.6)),
        "구매 단가 절감률": (3.2, lambda w: 1.8 + 1.1 * ev_cnt.get(w - timedelta(weeks=2), 0) + hrng.gauss(0, 0.15)),
        "재고 회전 일수": (38, lambda w: 38 + hrng.gauss(0, 2.0)),
    }
    rows = []
    for name, (current, fn) in plans.items():
        kid = KPI_IDS.get(name)
        if not kid:
            continue
        values = [fn(w) for w in week_list]
        shift = current - values[-1]
        for w, v in zip(week_list, values):
            at = datetime.combine(w, datetime.min.time(), tzinfo=timezone.utc) + timedelta(hours=9)
            rows.append(f"({q(kid)}, {q(TENANT)}, {round(v + shift, 3)}, '{TAG}history', {q(at)})")
    psql("insert into public.strategy_kpi_measurements (kpi_id, tenant_id, value, source, measured_at) values "
         + ", ".join(rows) + ";")
    return len(rows)


def main() -> None:
    if "--cleanup" in sys.argv:
        cleanup()
        api("POST", "ontology/sync?full=true")
        print(f"데모 데이터 삭제 완료 (tenant={TENANT})")
        return
    if "--structure" in sys.argv:
        # 전략맵·실행 이력은 그대로 두고 정의(BPMN)·시스템·문서·프로세스 맵만 다시 적용
        cleanup_structure()
        seed_proc_defs()
        seed_structure()
        summary = api("POST", "ontology/sync")
        print(json.dumps({"structure": summary.get("structure")}, ensure_ascii=False))
        return
    cleanup()  # 재실행해도 같은 결과
    seed_people()
    seed_proc_defs()
    seed_structure()
    insts, items = seed_executions()
    seed_strategy()
    history = seed_kpi_history()
    api("POST", "measure/run")
    summary = api("POST", "ontology/sync?full=true")
    hypotheses = api("POST", "causal/discover")
    print(json.dumps({"instances": insts, "work_items": items, "kpi_history_rows": history,
                      "execution": summary.get("execution"), "nodes_merged": summary.get("nodes_merged"),
                      "hypotheses": hypotheses}, ensure_ascii=False))
    print(f"데모 데이터 생성 완료 (tenant={TENANT}). 삭제: {sys.argv[0]} --cleanup")


if __name__ == "__main__":
    main()
