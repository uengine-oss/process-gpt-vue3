#!/usr/bin/env python3
"""쏠리드(SOLiD) AX 설명회 시연 데이터 (specs/015-solid-ax-demo).

**모든 수치·인물·이력은 가상 예시다.** 쏠리드 공개자료(제안 전략 플랜 PDF)의 KPI 트리 가설 — 인당 공헌이익 → 동인 →
핵심 프로세스 5개 — 를 Process GPT 전략맵·프로세스·실행 이력으로 옮겨, 설명회 라이브 데모(세션 4)가 빈 화면 없이
돌아가게 한다. 타사(기존 고객) 프로세스·데이터는 쓰지 않는다.

  - 테넌트 `solid` (+ 캡처 계정 manual-shots@uengine.org 를 관리자 구성원으로)
  - 조직도 6팀 · 담당자 12명 · AI 에이전트 5개(스킬 연결)
  - 핵심 프로세스 5개(BPMN — 정의 편집기에서 열고 고칠 수 있다, 사람–에이전트 혼합, 승인 게이트)
      P1 신제품 개발(NPD) 단계 게이트 · P2 수주·RFP 대응 · P3 품질 이슈 → 개선(8D) · P4 공급망 납기 리스크 대응 ·
      P5 기술지원·인증 문서
  - 최근 16주 실행 약 80건과 워크아이템(완료/진행/지연, 프로세스마다 사람 판단 단계가 병목)
  - BSC 전략맵 7목표 · KPI 15 · 이니셔티브 5 + 수동 KPI 주간 측정 이력 16주(영향 가설 시연용, 대조군 포함)

  python3 scripts/demo/seed-solid-ax-demo.py            # (기존 데모 삭제 후) 생성
  python3 scripts/demo/seed-solid-ax-demo.py --cleanup  # 삭제

환경: TENANT(solid) STRATEGY_URL(http://127.0.0.1:8014)
      PSQL("docker exec -i supabase_db_process-gpt-vue3 psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q")
화면으로 보려면 테넌트를 solid 로 둔 프런트를 띄운다: VITE_TENANT_OVERRIDE=solid npx vite --port 5174
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
from html import escape

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from demo_bpmn import build_bpmn  # noqa: E402

TENANT = os.environ.get("TENANT", "solid")
API = os.environ.get("STRATEGY_URL", "http://127.0.0.1:8014").rstrip("/") + "/api"
PSQL = shlex.split(
    os.environ.get(
        "PSQL", "docker exec -i supabase_db_process-gpt-vue3 psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q"
    )
)
TAG = "demo-solid-"
# 시연·캡처 계정 — JWT 의 tenant_id(app_metadata)가 solid 여야 이 테넌트를 본다. 계정 생성(로컬 supabase, 1회):
#   SK=$(supabase status -o json | jq -r .SERVICE_ROLE_KEY); curl -X POST http://127.0.0.1:54321/auth/v1/admin/users \
#     -H "apikey: $SK" -H "Authorization: Bearer $SK" -H "Content-Type: application/json" \
#     -d '{"email":"solid-demo@uengine.org","password":"solid-demo-pw","email_confirm":true,"app_metadata":{"tenant_id":"solid"}}'
DEMO_EMAIL = "solid-demo@uengine.org"
# 자정 기준 — 같은 날 다시 시드해도 주 경계가 같아 영향 가설 결과가 바뀌지 않는다
NOW = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
rng = random.Random(2026)
NOTE = "[가상 예시 — 설명회 데모 데이터]"


def uid(key: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"{TAG}{TENANT}:{key}"))


# ------------------------------------------------------------------ 조직·사람·에이전트 (전부 가상 인물)
TEAMS = {
    "rnd": "연구개발본부",
    "sales": "해외영업본부",
    "quality": "품질경영팀",
    "scm": "SCM팀",
    "support": "기술지원팀",
    "exec": "경영진",
}
PEOPLE = {
    "cto": ("최승우", "exec", "CTO"),
    "sales_head": ("정우진", "sales", "영업본부장"),
    "sales_rep": ("한지민", "sales", "해외영업 매니저"),
    "pm": ("강민호", "rnd", "제품 PM"),
    "rf_eng": ("윤서아", "rnd", "RF 엔지니어"),
    "sys_eng": ("임도현", "rnd", "시스템 엔지니어"),
    "fw_eng": ("서지후", "rnd", "펌웨어 엔지니어"),
    "q_eng": ("송하은", "quality", "품질 엔지니어"),
    "q_lead": ("배준영", "quality", "품질팀장"),
    "scm_rep": ("조은비", "scm", "SCM 담당"),
    "scm_lead": ("류태호", "scm", "SCM팀장"),
    "cert_eng": ("신재원", "support", "인증 엔지니어"),
    "support_rep": ("문가영", "support", "기술지원 담당"),
}
AGENTS = {
    "rfp_agent": ("RFP 분석 에이전트", "sales", "고객 RFP 를 요구사항으로 분해하고 과거 수주·설계 이력과 매칭",
                  ["RFP 요구사항 분해", "과거 수주 이력 검색", "제안서 초안 작성"]),
    "spec_agent": ("규격 검토 에이전트", "rnd", "3GPP·O-RAN 규격과 시장 동향을 스캔해 요약",
                   ["3GPP·O-RAN 규격 검색", "경쟁사 동향 요약"]),
    "rca_agent": ("품질 원인분석 에이전트", "quality", "제품·로트·외주사·클레임 이력을 연결해 원인 후보와 8D 초안을 작성",
                  ["클레임 이력 연결", "원인 후보 도출", "8D 보고서 작성"]),
    "eta_agent": ("납기 감시 에이전트", "scm", "부품·외주 납기 지표를 상시 감시하고 대체 조달안을 작성",
                  ["납기 지표 감시", "대체 조달안 작성"]),
    "cert_agent": ("인증문서 작성 에이전트", "support", "국가별 규격·과거 인증 문서를 근거로 조항을 인용한 초안 작성",
                   ["국가별 인증 규격 검색", "인증 문서 초안 작성"]),
    # 장면 ⑥ — 실제로 도는 에이전트. 전략–실행 온톨로지 MCP(strategy-service /mcp)를 도구로 쓴다(seed_mcp).
    "kpi_agent": ("KPI 분석 에이전트", "exec", "전략–실행 온톨로지(MCP)로 미달 KPI 의 원인 경로·병목·담당자를 찾아 보고",
                  ["KPI 원인 분석"]),
}
MCP_URL = os.environ.get("STRATEGY_MCP_URL", "http://127.0.0.1:8014/mcp")

# ------------------------------------------------------------------ 핵심 프로세스 5개
# 활동: (id, 이름, 담당 후보, 기준 처리시간 h, 설명). 'gate' 는 (게이트 이름, 반려 시 되돌아갈 활동 id, 게이트 앞 활동 id).
PROCESSES = [
    {"id": f"{TAG}npd", "name": "신제품 개발 단계 게이트", "domain": "R&D", "label": "NPD", "count": 10,
     "lanes": {"제품기획": ["pm", "spec_agent"], "연구개발": ["rf_eng", "sys_eng"], "경영진": ["cto"]},
     "acts": [
         ("npd_scan", "시장·규격 스캔", ["spec_agent"], 3, "3GPP·O-RAN 규격과 고객 요구를 스캔해 기회 요약"),
         ("npd_options", "복수 기획안 작성", ["pm"], 20, "다중가설 퍼널 — 기획안 2~3개를 동시에 만든다"),
         ("npd_feasibility", "기술 타당성 검토", ["rf_eng", "sys_eng"], 30, "RF·시스템 관점 실현 가능성·원가 검토"),
         ("npd_gate", "게이트 심의", ["cto"], 44, "경영진이 기획안을 좁히고 착수 여부 결정"),
         ("npd_kickoff", "개발 착수 등록", ["pm"], 2, "착수 과제를 등록하고 일정 확정")],
     "gate": ("게이트 통과?", "npd_options", "npd_gate")},
    {"id": f"{TAG}rfp", "name": "수주·RFP 대응", "domain": "영업", "label": "RFP", "count": 22,
     "lanes": {"영업": ["sales_rep", "sales_head", "rfp_agent"], "기술": ["sys_eng"]},
     "acts": [
         ("rfp_receive", "RFP 접수", ["sales_rep"], 1, "고객 RFP·요구 문서 접수"),
         ("rfp_decompose", "요구사항 분해", ["rfp_agent"], 4, "에이전트가 RFP 를 요구사항 목록으로 분해"),
         ("rfp_match", "과거 수주·설계 매칭", ["rfp_agent"], 3, "유사 수주·설계 이력과 매칭해 재사용 후보 제시"),
         ("rfp_spec", "기술 사양 검토", ["sys_eng"], 30, "엔지니어가 요구사항별 대응 가능 여부·커스터마이징 판단"),
         ("rfp_draft", "제안서·견적 작성", ["rfp_agent", "sales_rep"], 6, "에이전트 초안을 영업이 다듬는다"),
         ("rfp_approve", "제안 승인", ["sales_head"], 10, "가격·조건 최종 승인"),
         ("rfp_submit", "제안 제출", ["sales_rep"], 1, "고객 포털 제출")],
     "gate": ("승인?", "rfp_draft", "rfp_approve")},
    {"id": f"{TAG}quality", "name": "품질 이슈 개선(8D)", "domain": "품질", "label": "품질이슈", "count": 14,
     "lanes": {"품질": ["q_eng", "q_lead", "rca_agent"]},
     "acts": [
         ("q_intake", "클레임 접수", ["q_eng"], 1, "고객 클레임·외주 불량 접수"),
         ("q_link", "이력 연결·원인 후보", ["rca_agent"], 2, "제품·로트·외주사·과거 클레임을 연결해 원인 후보 도출"),
         ("q_rootcause", "원인 규명", ["q_eng"], 40, "외주사와 함께 재현·분석해 근본 원인 확정"),
         ("q_capa", "CAPA 수립", ["q_eng"], 8, "시정·예방 조치 수립"),
         ("q_8d", "8D 보고서 작성", ["rca_agent"], 2, "에이전트가 8D 초안 작성"),
         ("q_verify", "효과 검증 승인", ["q_lead"], 12, "조치 효과 확인 후 종결")],
     "gate": ("효과 확인?", "q_capa", "q_verify")},
    {"id": f"{TAG}scm", "name": "공급망 납기 리스크 대응", "domain": "SCM", "label": "납기리스크", "count": 16,
     "lanes": {"SCM": ["scm_rep", "scm_lead", "eta_agent"]},
     "acts": [
         ("scm_watch", "납기 지표 감시", ["eta_agent"], 1, "부품·외주 납기 지연 신호 감지(임계값 초과 시 기동)"),
         ("scm_assess", "리스크 평가", ["scm_rep"], 6, "영향 받는 수주·생산 일정 평가"),
         ("scm_alt", "대체 조달안 작성", ["eta_agent"], 2, "대체 공급사·일정 시나리오 작성"),
         ("scm_decide", "구매 결정 승인", ["scm_lead"], 22, "돈이 나가는 결정은 사람이 승인"),
         ("scm_notify", "발주 변경·고객 통보", ["scm_rep"], 3, "발주 변경과 영향 고객 안내")]},
    {"id": f"{TAG}cert", "name": "기술지원·인증 문서", "domain": "기술지원", "label": "인증문서", "count": 18,
     "lanes": {"기술지원": ["support_rep", "cert_eng", "cert_agent"]},
     "acts": [
         ("cert_intake", "문서 요청 접수", ["support_rep"], 1, "국가·고객별 인증·규격 문서 요청 접수"),
         ("cert_search", "규격·과거 인증 검색", ["cert_agent"], 1, "해당 국가 규격과 과거 인증 문서 검색"),
         ("cert_draft", "인증 문서 초안 작성", ["cert_agent"], 3, "조항을 인용한 초안 작성"),
         ("cert_review", "엔지니어 검토", ["cert_eng"], 24, "숙련 엔지니어가 기술 내용을 검토·수정"),
         ("cert_submit", "제출·이력 등록", ["support_rep"], 2, "제출하고 이력에 남긴다")]},
    # 라이브 실행용 — 실행 이력은 만들지 않는다(count 0). 시연에서 새로 시작하면 에이전트가 MCP 로 온톨로지를 조회한다.
    {"id": f"{TAG}kpi", "name": "KPI 미달 원인 보고", "domain": "경영", "label": "KPI보고", "count": 0,
     "lanes": {"경영진": ["cto", "kpi_agent"]},
     "acts": [
         ("kpi_request", "분석 요청", ["cto"], 1, "미달 KPI 이름과 궁금한 점을 적어 분석을 요청한다"),
         ("kpi_rca", "원인 분석", ["kpi_agent"], 1,
          "요청한 KPI 를 온톨로지에서 찾고(ontology_resolve_entity, class_name=KPI) 원인을 역추적해(ontology_kpi_root_cause) "
          "병목 프로세스·태스크·담당자를 기여도 순으로 정리한다"),
         ("kpi_review", "결과 검토", ["cto"], 4, "에이전트 보고를 검토하고 후속 조치를 지시한다")]},
]


# ------------------------------------------------------------------ 시스템·데이터·문서·아키텍처 (spec 016)
# 프로세스 사이를 잇는 공유 자산. "제품 사양서"는 신제품 개발이 만들고 수주·품질·인증이 읽는다 — 신제품 개발을 바꾸면
# 세 프로세스가 영향을 받는다(프로세스 변경 영향도 시연). 모두 가상 예시.
SYSTEMS = {
    "PLM": ("설계", "제품 수명주기·설계 데이터"),
    "ERP": ("경영", "수주·구매·재고·원가"),
    "QMS": ("품질", "품질 이슈·클레임·CAPA"),
    "CRM": ("영업", "고객·영업 기회"),
    "DMS": ("문서", "문서·인증 자료 관리"),
}
TASK_SYSTEMS = {
    "npd_feasibility": ["PLM"], "npd_kickoff": ["PLM", "ERP"],
    "rfp_receive": ["CRM"], "rfp_match": ["CRM", "PLM"], "rfp_spec": ["PLM"], "rfp_draft": ["ERP", "DMS"], "rfp_submit": ["CRM"],
    "q_intake": ["QMS"], "q_link": ["QMS", "PLM"], "q_rootcause": ["QMS"], "q_capa": ["QMS"], "q_8d": ["DMS"],
    "scm_watch": ["ERP"], "scm_assess": ["ERP"], "scm_alt": ["ERP"], "scm_decide": ["ERP"], "scm_notify": ["ERP", "CRM"],
    "cert_search": ["DMS", "PLM"], "cert_draft": ["DMS"], "cert_submit": ["DMS"],
}
# 활동 → (읽는 데이터, 쓰는 데이터). 이름이 같으면 프로세스가 달라도 같은 데이터다.
DATA_FLOW = {
    "npd_scan": (["규격·시장 동향"], ["시장·규격 요약"]),
    "npd_options": (["시장·규격 요약"], ["기획안"]),
    "npd_feasibility": (["기획안"], ["제품 사양서"]),
    "npd_gate": (["기획안", "제품 사양서"], []),
    "npd_kickoff": ([], ["개발 과제 계획"]),
    "rfp_receive": ([], ["고객 RFP"]),
    "rfp_decompose": (["고객 RFP"], ["요구사항 목록"]),
    "rfp_match": (["요구사항 목록", "과거 수주 이력"], ["재사용 후보"]),
    "rfp_spec": (["요구사항 목록", "제품 사양서"], ["사양 검토 결과"]),
    "rfp_draft": (["재사용 후보", "사양 검토 결과"], ["제안서·견적"]),
    "rfp_approve": (["제안서·견적"], []),
    "rfp_submit": (["제안서·견적"], ["과거 수주 이력", "수주 예정 일정"]),
    "q_intake": ([], ["클레임 이력"]),
    "q_link": (["클레임 이력", "제품 사양서"], ["원인 후보"]),
    "q_rootcause": (["원인 후보"], ["외주사 품질 이력"]),
    "q_capa": (["외주사 품질 이력"], ["CAPA 조치"]),
    "q_8d": (["CAPA 조치", "원인 후보"], ["8D 보고서"]),
    "q_verify": (["8D 보고서"], []),
    "scm_watch": (["부품 납기 현황", "외주사 품질 이력"], ["납기 위험 신호"]),
    "scm_assess": (["납기 위험 신호", "수주 예정 일정"], ["영향 평가"]),
    "scm_alt": (["영향 평가"], ["대체 조달안"]),
    "scm_decide": (["대체 조달안"], []),
    "scm_notify": ([], ["발주 변경 내역"]),
    "cert_intake": ([], ["인증 문서 요청"]),
    "cert_search": (["인증 문서 요청", "제품 사양서", "과거 인증 문서"], ["인용 조항"]),
    "cert_draft": (["인용 조항"], ["인증 문서 초안"]),
    "cert_review": (["인증 문서 초안"], []),
    "cert_submit": (["인증 문서 초안"], ["과거 인증 문서"]),
}
# 규정·지침 문서(링크) → 따르는 활동
DOCS = {
    "spec_guide": ("3GPP·O-RAN 규격 해설", "https://docs.example.com/solid/3gpp-oran", ["npd_scan", "cert_search"]),
    "ecn_rule": ("설계변경(ECN) 규정", "https://docs.example.com/solid/ecn", ["npd_gate", "rfp_spec"]),
    "purchase_rule": ("구매 승인 규정", "https://docs.example.com/solid/purchase", ["scm_decide"]),
    "price_policy": ("견적·가격 정책", "https://docs.example.com/solid/pricing", ["rfp_draft", "rfp_approve"]),
    "8d_guide": ("8D 작성 지침", "https://docs.example.com/solid/8d", ["q_8d", "q_verify"]),
    "cert_procedure": ("국가별 인증 절차서", "https://docs.example.com/solid/cert", ["cert_draft", "cert_review"]),
}
# 끝 이벤트가 다른 프로세스로 업무를 넘긴다
HANDOFFS = {f"{TAG}quality": f"{TAG}scm", f"{TAG}npd": f"{TAG}cert"}
# 프로세스 맵: 영역 → 그룹 → 프로세스
PROC_MAP = [
    ("제품·기술", [("제품 개발", ["npd"]), ("기술지원", ["cert"])]),
    ("영업·수주", [("수주 관리", ["rfp"])]),
    ("품질·공급망", [("품질 관리", ["quality"]), ("공급망 관리", ["scm"])]),
    ("경영관리", [("성과 관리", ["kpi"])]),
]


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


def who_name(key: str) -> str:
    return AGENTS[key][0] if key in AGENTS else PEOPLE[key][0]


# ------------------------------------------------------------------ BPMN 생성 (정의 편집기에서 열 수 있게)


def bpmn_and_definition(p: dict) -> tuple[str, dict]:
    pid = p["id"].replace("-", "_")  # 정의 JSON 의 process 참조(Proc_{pid})
    lanes = list(p["lanes"].items())
    lane_of = {}
    for lane, members in lanes:
        for m in members:
            lane_of.setdefault(m, lane)
    acts = p["acts"]
    gate = p.get("gate")
    first_lane = lane_of[acts[0][2][0]]
    last_lane = lane_of[acts[-1][2][0]]
    # 정의 JSON 의 시퀀스 — BPMN(build_bpmn)과 같은 순서: 시작 → 활동(게이트 앞 활동 뒤에 게이트) → 끝
    order = ["Start"]
    for aid, *_rest in acts:
        order.append(aid)
        if gate and aid == gate[2]:
            order.append("Gate")
    order.append("End")
    flows = []
    for a, b in zip(order, order[1:]):
        flows.append((f"Flow_{a}_{b}", a, b, "예" if a == "Gate" else ""))
    if gate:
        flows.append(("Flow_Gate_back", "Gate", gate[1], "보완"))

    xml = build_bpmn(
        p["id"], p["name"], [lane for lane, _m in lanes],
        [{"id": aid, "name": name, "lane": lane_of[cands[0]], "desc": desc,
          # 에이전트가 맡는 활동은 서비스 태스크 — 실행 엔진이 에이전트(도구 사용)로 처리하고, 대시보드 자동화율에도 잡힌다
          "kind": "serviceTask" if cands[0] in AGENTS else "userTask"}
         for aid, name, cands, _h, desc in acts],
        gate, TASK_SYSTEMS, DATA_FLOW, HANDOFFS.get(p["id"]),
    )

    roles = [{"name": lane, "default": uid(members[0]) if members else "", "endpoint": "", "resolutionRule": ""}
             for lane, members in lanes]
    activities = []
    for aid, name, cands, h, desc in acts:
        is_agent = cands[0] in AGENTS
        activities.append({
            "id": aid, "name": name, "role": lane_of[cands[0]], "type": "serviceTask" if is_agent else "userTask",
            "process": f"Proc_{pid}",
            "tool": "formHandler:defaultform", "duration": max(1, round(h / 8)), "description": desc,
            "instruction": desc, "agent": uid(cands[0]) if is_agent else "", "agentMode": "COMPLETE" if is_agent else "",
            "orchestration": "", "inputData": [], "outputData": [], "checkpoints": [], "attachments": [],
            "systems": [{"name": n} for n in TASK_SYSTEMS.get(aid, [])],
            "manualLinks": [], "manualLink": "", "attachedEvents": None,
        })
    definition = {
        "processDefinitionId": p["id"], "processDefinitionName": p["name"], "description": f"{p['name']} {NOTE}",
        "roles": roles, "activities": activities, "data": [],
        "events": [
            {"id": "Start", "name": "시작", "role": first_lane, "type": "startEvent", "process": f"Proc_{pid}", "properties": "{}"},
            {"id": "End", "name": "완료", "role": last_lane, "type": "endEvent", "process": f"Proc_{pid}", "properties": "{}"},
        ],
        "gateways": ([{"id": "Gate", "name": gate[0], "role": lane_of[[a for a in acts if a[0] == gate[2]][0][2][0]],
                       "type": "exclusiveGateway", "process": f"Proc_{pid}", "condition": "", "properties": "{}"}] if gate else []),
        "sequences": [{"id": f[0], "name": f[3], "source": f[1], "target": f[2], "condition": "", "properties": "{}"} for f in flows],
    }
    return xml, definition


# ------------------------------------------------------------------ 정리


def cleanup() -> None:
    keys = list(PEOPLE) + list(AGENTS)
    ids = ", ".join(q(uid(k)) for k in keys)
    psql(f"""
delete from public.todolist where tenant_id = {q(TENANT)} and proc_def_id like '{TAG}%';
delete from public.bpm_proc_inst where tenant_id = {q(TENANT)} and proc_def_id like '{TAG}%';
delete from public.proc_def where tenant_id = {q(TENANT)} and id like '{TAG}%';
delete from public.agent_skills where tenant_id = {q(TENANT)} and user_id::text in ({ids});
delete from public.tenant_skills where tenant_id = {q(TENANT)} and owner_id::text in ({ids});
delete from public.signup_requests where tenant_id = {q(TENANT)} and user_id::text in ({ids});
delete from public.users where tenant_id = {q(TENANT)} and id::text in ({ids});
delete from public.strategy_kpi_measurements where tenant_id = {q(TENANT)};
delete from public.strategy_causal_hypotheses where tenant_id = {q(TENANT)};
delete from public.configuration where tenant_id = {q(TENANT)} and key in ('organization', 'metrics', 'dashboard_thresholds');
update public.tenants set mcp = mcp #- '{{mcpServers,strategy-ontology}}' where id = {q(TENANT)} and mcp is not null;
delete from public.configuration where tenant_id = {q(TENANT)} and key = 'proc_map';
delete from public.systems where tenant_id = {q(TENANT)} and id::text in ({", ".join(q(uid("system:" + k)) for k in SYSTEMS)});
delete from public.policy_document_usage where tenant_id = {q(TENANT)} and policy_id::text in ({", ".join(q(uid("doc:" + k)) for k in DOCS)});
delete from public.audit_policy where tenant_id = {q(TENANT)} and id::text in ({", ".join(q(uid("doc:" + k)) for k in DOCS)});
""")
    try:
        api("DELETE", "map")
    except Exception:  # noqa: BLE001 — 첫 실행
        pass


# ------------------------------------------------------------------ 생성


def seed_tenant() -> None:
    demo = psql_value(f"select id from auth.users where email = {q(DEMO_EMAIL)} limit 1")
    psql(f"insert into public.tenants (id, owner) values ({q(TENANT)}, {q(demo or None)}) on conflict (id) do nothing;")
    if not demo:
        print(f"[안내] 시연 계정 {DEMO_EMAIL} 이 없습니다 — 파일 머리말의 명령으로 만든 뒤 다시 실행하세요.")
        return
    # 가입 트리거가 기본 테넌트에 대기 행을 만든다 — 시연 테넌트의 승인된 관리자로 옮긴다
    psql(f"""
delete from public.signup_requests where user_id::text = {q(demo)};
delete from public.users where id::text = {q(demo)} and tenant_id <> {q(TENANT)};
insert into public.users (id, username, email, tenant_id, role, is_admin, membership_status)
values ({q(demo)}, '쏠리드 데모', {q(DEMO_EMAIL)}, {q(TENANT)}, 'admin', true, 'approved')
on conflict (id, tenant_id) do nothing;
-- 가입 트리거가 새 행을 viewer/pending 으로 덮으므로 따로 승인한다
update public.users set role = 'admin', is_admin = true, membership_status = 'approved'
 where id::text = {q(demo)} and tenant_id = {q(TENANT)};
delete from public.signup_requests where user_id::text = {q(demo)};
""")


def seed_people() -> None:
    rows = []
    for key, (name, team, title) in PEOPLE.items():
        rows.append(f"({q(uid(key))}, {q(name)}, {q(f'{TAG}{key}@example.com')}, {q(TENANT)}, false, null, {q(title)}, {q(TEAMS[team])})")
    for key, (name, team, desc, _skills) in AGENTS.items():
        rows.append(f"({q(uid(key))}, {q(name)}, null, {q(TENANT)}, true, 'agent', {q(desc)}, {q(TEAMS[team])})")
    ids = ", ".join(q(uid(k)) for k in PEOPLE)
    skills, owners = [], {}
    for key, (_n, _t, _d, names) in AGENTS.items():
        skills += [f"({q(uid(key))}, {q(TENANT)}, {q(s)})" for s in names]
        for s in names:
            owners.setdefault(s, uid(key))
    catalog = ", ".join(f"({q(TENANT)}, {q(s)}, {q(o)})" for s, o in owners.items())
    psql(f"""
insert into public.users (id, username, email, tenant_id, is_agent, agent_type, description, department_name)
values {', '.join(rows)};
update public.users set membership_status = 'approved', role = 'editor' where tenant_id = {q(TENANT)} and id::text in ({ids});
delete from public.signup_requests where tenant_id = {q(TENANT)} and user_id::text in ({ids});
insert into public.tenant_skills (tenant_id, skill_name, owner_id) values {catalog} on conflict do nothing;
insert into public.agent_skills (user_id, tenant_id, skill_name) values {', '.join(skills)};
""")


def seed_mcp() -> None:
    """테넌트 MCP 에 전략–실행 온톨로지 서버를 등록하고 KPI 분석 에이전트에 배정한다.
    users.tools 는 tenants.mcp 의 서버 이름 목록 — 폴링 서비스가 서비스 태스크를 이 도구로 실행한다."""
    server = {"url": MCP_URL, "transport": "streamable_http", "enabled": True, "headers": {"X-Tenant-Id": TENANT},
              "description": "전략–실행 온톨로지 (읽기 전용) — 이름→키 해소, 체인, KPI 원인"}
    psql(f"""
update public.tenants
   set mcp = jsonb_set(coalesce(mcp, '{{}}'::jsonb), '{{mcpServers}}',
                       coalesce(mcp -> 'mcpServers', '{{}}'::jsonb) || jsonb_build_object('strategy-ontology', {q(json.dumps(server, ensure_ascii=False))}::jsonb))
 where id = {q(TENANT)};
update public.users set tools = 'strategy-ontology' where tenant_id = {q(TENANT)} and id::text = {q(uid('kpi_agent'))};
""")


def seed_structure() -> None:
    """시스템 마스터·규정 문서·문서 사용처·프로세스 맵(spec 016). 정의(seed_proc_defs) 다음에 — 문서 사용처가 정의를 참조한다."""
    proc_of = {a[0]: p["id"] for p in PROCESSES for a in p["acts"]}
    systems = ", ".join(f"({q(uid('system:' + k))}, {q(TENANT)}, {q(k)}, {q(cat)}, {q(desc + ' ' + NOTE)}, 'active')"
                        for k, (cat, desc) in SYSTEMS.items())
    docs = ", ".join(f"({q(uid('doc:' + k))}, {q(TENANT)}, {q(name)}, 'link', {q(url)}, '쏠리드 데모', ARRAY[]::text[])"
                     for k, (name, url, _acts) in DOCS.items())
    usage = ", ".join(f"({q(TENANT)}, {q(uid('doc:' + k))}, {q(proc_of[a])}, {q(a)})"
                      for k, (_n, _u, acts) in DOCS.items() for a in acts)
    domain_of = {p["id"][len(TAG):]: p["domain"] for p in PROCESSES}
    proc_map = {"mega_proc_list": [
        {"id": f"{TAG}area-{i}", "name": area, "domain_id": domain_of[groups[0][1][0]], "major_proc_list": [
            # 트리는 영역 → 도메인(그룹의 domain_id, metrics.domains 의 id) → 그룹 → 프로세스. 없으면 'unknown' 으로 묶인다
            {"id": f"{TAG}group-{i}-{j}", "name": group, "domain_id": domain_of[keys[0]], "sub_proc_list": [
                {"id": f"{TAG}{k}", "name": next(p["name"] for p in PROCESSES if p["id"] == f"{TAG}{k}"), "proc_def_id": f"{TAG}{k}"}
                for k in keys]}
            for j, (group, keys) in enumerate(groups)]}
        for i, (area, groups) in enumerate(PROC_MAP)]}
    psql(f"""
insert into public.systems (id, tenant_id, name, category, description, registration_status) values {systems};
insert into public.audit_policy (id, tenant_id, name, kind, link_url, author_name, domains) values {docs};
insert into public.policy_document_usage (tenant_id, policy_id, process_id, element_id) values {usage};
insert into public.configuration (key, value, tenant_id) values ('proc_map', {q(json.dumps(proc_map, ensure_ascii=False))}::jsonb, {q(TENANT)});
""")


def seed_org() -> None:
    def member(key):
        name = who_name(key)
        return {"id": uid(key), "name": name, "data": {"id": uid(key), "name": name, "isTeam": False, "pid": None}, "children": []}

    teams = []
    for tkey, tname in TEAMS.items():
        tid = uid(f"team-{tkey}")
        kids = [member(k) for k, v in PEOPLE.items() if v[1] == tkey] + [member(k) for k, v in AGENTS.items() if v[1] == tkey]
        for k in kids:
            k["data"]["pid"] = tid
        teams.append({"id": tid, "name": tname, "data": {"id": tid, "name": tname, "isTeam": True, "pid": "root"}, "children": kids})
    chart = {"chart": {"id": "root", "name": "쏠리드(가상)", "data": {"id": "root", "name": "쏠리드(가상)", "isTeam": True}, "children": teams}}
    # 상태 기준(분석 대시보드 KPI RAG 와 공유) — 경보는 진짜 위험에만: 양호 60% 이상, 주의 35% 이상
    thresholds = {"kpi_rag_green_pct": 60, "kpi_rag_amber_pct": 35, "fte_high": 3, "fte_medium": 1, "fte_critical": 5,
                  "fte_working_days": 22, "churn_high": 3, "churn_medium": 2, "dq_good_pct": 80, "dq_warning_pct": 60,
                  "review_delay_days": 7, "zombie_danger_days": 180, "zombie_warning_days": 90, "velocity_weekly_target": 0}
    metrics = {"domains": [{"id": d, "name": d, "order": i + 1} for i, d in enumerate(sorted({p["domain"] for p in PROCESSES}))],
               "mega_processes": [], "processes": []}
    psql(f"""
insert into public.configuration (key, tenant_id, value) values
  ('organization', {q(TENANT)}, {q(json.dumps(chart, ensure_ascii=False))}::jsonb),
  ('metrics', {q(TENANT)}, {q(json.dumps(metrics, ensure_ascii=False))}::jsonb),
  ('dashboard_thresholds', {q(TENANT)}, {q(json.dumps(thresholds))}::jsonb);
""")


def seed_proc_defs() -> None:
    stmts = []
    for p in PROCESSES:
        xml, definition = bpmn_and_definition(p)
        stmts.append(
            "insert into public.proc_def (id, name, tenant_id, definition, bpmn, type, description, domain_id) values "
            f"({q(p['id'])}, {q(p['name'])}, {q(TENANT)}, {q(json.dumps(definition, ensure_ascii=False))}::jsonb, {q(xml)}, "
            f"'bpmn', {q(p['name'] + ' ' + NOTE)}, {q(p['domain'])});"
        )
    psql("\n".join(stmts))


INSTANCES: list[tuple] = []


def seed_executions() -> tuple[int, int]:
    inst_rows, item_rows = [], []
    serial = 3000
    for p in PROCESSES:
        n = p["count"]
        for i in range(n):
            serial += rng.randint(1, 3)
            inst_id = f"{p['id']}.{serial}"
            age_days = 110 * (n - i) / n + rng.uniform(-2, 2)
            start = NOW - timedelta(days=max(1.5, age_days))
            running_at = rng.randint(1, len(p["acts"]) - 1) if i >= n - 2 and rng.random() < 0.8 else None
            budget = sum(a[3] for a in p["acts"]) * 1.35
            due = start + timedelta(hours=max(48, budget))
            # 최근으로 올수록 에이전트 도입 효과로 사람 판단 단계가 조금씩 짧아진다(개선 추세)
            trend = 1.15 - 0.35 * (i / max(1, n - 1))
            t = start
            current = None
            for step, (aid, aname, cands, base, _d) in enumerate(p["acts"]):
                who = rng.choice(cands)
                is_agent = who in AGENTS
                hours = base * (rng.uniform(0.2, 0.4) if is_agent else rng.uniform(0.6, 1.6) * trend)
                t = t + timedelta(hours=rng.uniform(0.3, 4.0))
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
        dur = round((e - s).total_seconds() / 60) if e else None
        return (f"(gen_random_uuid(), {q(uid(who))}, {q(who_name(who))}, {q(inst_id)}, {q(inst_id)}, {q(pd)}, {q(aid)}, "
                f"{q(aname)}, {q(status)}::todo_status, {q(TENANT)}, {q(s)}, {q(e)}, {q(d)}, {q(dur)}, "
                f"{"'COMPLETE'::agent_mode" if is_agent else 'null'}, {q(e or s)})")

    def inst_sql(r):
        inst_id, name, pd, status, s, e, d, cur = r
        acts = "array[]::text[]" if cur is None else f"array[{q(cur)}]"
        return (f"({q(inst_id)}, {q(name)}, {q(pd)}, {q(inst_id)}, {q(status)}::process_status, {q(TENANT)}, "
                f"{q(s)}, {q(e)}, {q(d)}, {acts}, array[]::text[], false, {q(e or s)})")

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
        return api("POST", "objectives", {"name": name, "description": f"{desc} {NOTE}", "perspective": perspective,
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

    north = obj("인당 공헌이익 극대화", "인력을 크게 늘리지 않고 성장한다 — 성과 중심 경영 재설계의 최상위 목표", "financial", 5)
    win = obj("수주 경쟁력 강화", "북미·유럽 고객 RFP 에 더 빨리, 더 정확히 대응한다", "customer", 5, [north])
    npd = obj("신제품 출시 속도", "DAS·하이브리드 DAS·O-RAN 포트폴리오 의사결정을 빠르게", "internal_process", 4, [north])
    qual = obj("품질 비용 절감", "외주 제조 품질 이슈의 원인을 빨리 찾고 재발을 막는다", "internal_process", 4, [north])
    scm = obj("공급망 납기 신뢰도", "부품·외주 납기 리스크를 사후가 아니라 사전에 대응한다", "internal_process", 4, [north, win])
    docs = obj("기술 문서 대응 자동화", "국가별 인증·규격 문서 작성 부담을 줄인다", "internal_process", 3, [win])
    ai = obj("AI 에이전트 협업 역량", "반복 업무는 에이전트가, 판단은 사람이 — 사람–에이전트 혼합 프로세스", "learning_growth", 3, [npd, docs, qual])

    kpi(north, "인당 매출", "억원", "manual", 11.0, 8.4, importance=5, value=8.9)
    kpi(north, "인당 공헌이익", "억원", "manual", 2.6, 2.0, importance=5, value=2.15)
    kpi(win, "제안 리드타임", "시간", "avg_duration_hours", 30, 80, "decrease", proc=f"{TAG}rfp", role="leading", importance=5)
    kpi(win, "수주율", "%", "manual", 35, 25, importance=4, value=30)
    kpi(npd, "컨셉→개발 착수 리드타임", "시간", "avg_duration_hours", 72, 200, "decrease", proc=f"{TAG}npd", role="leading", importance=4)
    kpi(npd, "게이트 통과율", "%", "manual", 70, 50, importance=3, value=58)
    kpi(qual, "원인 규명 리드타임", "시간", "avg_duration_hours", 48, 120, "decrease", proc=f"{TAG}quality", role="leading", importance=4)
    kpi(qual, "클레임 비용", "억원", "manual", 3.0, 6.0, "decrease", importance=4, value=4.8)
    kpi(qual, "재발률", "%", "manual", 5, 12, "decrease", importance=3, value=9)
    kpi(scm, "납기 리스크 대응 리드타임", "시간", "avg_duration_hours", 24, 72, "decrease", proc=f"{TAG}scm", role="leading", importance=3)
    kpi(scm, "납기 준수율", "%", "manual", 97, 88, importance=4, value=93)
    kpi(docs, "인증 문서 작성 리드타임", "시간", "avg_duration_hours", 16, 48, "decrease", proc=f"{TAG}cert", role="leading", importance=3)
    kpi(docs, "엔지니어 반복업무 비중", "%", "manual", 25, 45, "decrease", importance=3, value=38)
    kpi(ai, "에이전트 처리 비중", "%", "manual", 50, 10, role="leading", importance=3, value=27)
    kpi(ai, "자동 해결률", "%", "manual", 40, 0, role="leading", importance=2, value=18)

    initiative(win, "RFP 요구사항 자동 분해", "RFP 분석 에이전트가 요구사항 분해·이력 매칭", "in_progress", 55, f"{TAG}rfp", "2026-07-01", "2026-12-31")
    initiative(npd, "다중가설 기획 퍼널", "기획안 2~3개를 동시에 만들어 게이트에서 좁힌다", "planned", 10, f"{TAG}npd", "2026-11-01", "2027-03-31")
    initiative(qual, "8D 보고서 자동화", "원인 후보·8D 초안을 에이전트가 작성", "in_progress", 40, f"{TAG}quality", "2026-08-01", "2027-01-31")
    initiative(scm, "납기 감시 에이전트", "임계값 초과 시 대체 조달 프로세스 자동 기동", "in_progress", 65, f"{TAG}scm", "2026-06-01", "2026-11-30")
    initiative(docs, "인증 문서 초안 자동화", "국가별 규격을 인용한 초안 자동 작성", "in_progress", 50, f"{TAG}cert", "2026-07-15", "2026-12-31")


def _weekly(proc_id: str) -> tuple[dict, dict]:
    count, hours = {}, {}
    for _iid, _name, pd, status, s, e, _d, _cur in INSTANCES:
        if pd != proc_id or status != "COMPLETED" or e is None:
            continue
        wk = (e - timedelta(days=e.weekday())).date()
        count[wk] = count.get(wk, 0) + 1
        hours.setdefault(wk, []).append((e - s).total_seconds() / 3600)
    return count, {w: sum(v) / len(v) for w, v in hours.items()}


def seed_kpi_history(weeks: int = 16) -> int:
    """수동 KPI 주간 이력(가상). 세 KPI 는 실행 지표를 시차를 두고 따라가고(영향 가설로 발견되게), 하나는 잡음(대조군)."""
    monday = (NOW - timedelta(days=NOW.weekday())).date()
    week_list = [monday - timedelta(weeks=i) for i in range(weeks - 1, -1, -1)]
    _rc, rfp_h = _weekly(f"{TAG}rfp")
    _qc, q_h = _weekly(f"{TAG}quality")
    _sc, scm_h = _weekly(f"{TAG}scm")
    h = random.Random(41)

    def carry(series, w):
        prev = [series[x] for x in sorted(series) if x <= w]
        return prev[-1] if prev else (sum(series.values()) / len(series) if series else 0)

    plans = {
        "수주율": (30, lambda w: 40 - 0.12 * carry(rfp_h, w - timedelta(weeks=2)) + h.gauss(0, 0.5)),
        "클레임 비용": (4.8, lambda w: 2.0 + 0.04 * carry(q_h, w - timedelta(weeks=1)) + h.gauss(0, 0.08)),
        "납기 준수율": (93, lambda w: 99 - 0.25 * carry(scm_h, w - timedelta(weeks=1)) + h.gauss(0, 0.4)),
        "재발률": (9, lambda w: 9 + h.gauss(0, 0.8)),
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
        print(f"SOLiD 데모 데이터 삭제 완료 (tenant={TENANT})")
        return
    cleanup()
    seed_tenant()
    seed_people()
    seed_mcp()
    seed_org()
    seed_proc_defs()
    seed_structure()
    insts, items = seed_executions()
    seed_strategy()
    history = seed_kpi_history()
    api("POST", "measure/run")
    summary = api("POST", "ontology/sync?full=true")
    hypotheses = api("POST", "causal/discover")
    print(json.dumps({"tenant": TENANT, "instances": insts, "work_items": items, "kpi_history_rows": history,
                      "execution": summary.get("execution"), "nodes_merged": summary.get("nodes_merged"),
                      "hypotheses": hypotheses}, ensure_ascii=False))
    print(f"SOLiD 데모 데이터 생성 완료. 화면: VITE_TENANT_OVERRIDE={TENANT} npx vite --port 5174 → {DEMO_EMAIL} 로그인"
          f" · 삭제: {sys.argv[0]} --cleanup")


if __name__ == "__main__":
    main()
