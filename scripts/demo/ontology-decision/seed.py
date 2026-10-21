#!/usr/bin/env python3
"""온톨로지 근거 에이전트 판단 데모(spec 018) 시드 — 일반 BPM 모드(:8081)에서 실행하는 프로세스 3개.

    python3 scripts/demo/ontology-decision/seed.py            # 만들기(있으면 지우고 다시)
    python3 scripts/demo/ontology-decision/seed.py --cleanup  # 지우기
    python3 scripts/demo/ontology-decision/seed.py --priority 2.1=lead|cost   # 시나리오 2.1 우선순위 지정(1순위 쪽)

세 프로세스는 같은 모양이다 — 구매 담당이 요청서(품목·후보 공급사 견적)를 쓰면(사람) → 구매 판단 에이전트가
전략–실행 온톨로지의 판단 근거(ontology_decision_context)를 보고 공급사를 고르고(서비스 태스크) → 구매팀장이 승인한다(사람).
다른 것은 그 프로세스를 지배하는 KPI 와 상충·우선순위뿐이다:

| 시나리오 | 프로세스 | 지배 KPI | 결정 모드 |
|---|---|---|---|
| 1   | 소모품 정기 구매   | 단가 절감률 + 정기 구매 계획 준수율(상충 없음)          | aligned  |
| 2.1 | 생산 자재 긴급 구매 | 납기 준수율(1순위) ↔ 단가 절감률(2순위) 상충           | priority |
| 2.2 | 설비 부품 구매     | 품질 합격률 ↔ 단가 절감률 상충, 우선순위 미정           | ask_user |
| 통합 | 생산라인 증설 자재 조달 | 판단 단계 3개 — 단계마다 KPI 적용 범위(activity_ids)가 달라 aligned → priority → ask_user 가 차례로 | 세 가지 |

2.2·통합은 판단 결과로 흐름이 갈린다 — 판단 업무 폼의 '적용 기준'(decision_chosen, 워커가 판단 근거 결과로 채움)을
발주서 발행 뒤 배타 Gateway 가 읽어, 품질을 택했으면 표준 입고·검수, 단가를 택했으면(품질 합격률이 낮은 공급사)
품질 관리의 강화 검수로 보낸다.

KPI 는 기존 전략('구매 원가 절감' 등, 전략–실행 온톨로지 데모 시드)에 붙인다. 없으면 같은 이름으로 만든다.
"""
import argparse
import json
import os
import re
import shlex
import subprocess
import sys
import urllib.request
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from demo_bpmn import build_bpmn  # noqa: E402

TENANT = os.environ.get("TENANT", "tym")
API = os.environ.get("STRATEGY_URL", "http://127.0.0.1:8014").rstrip("/") + "/api"
PSQL = shlex.split(os.environ.get(
    "PSQL", "docker exec -i supabase_db_process-gpt-vue3 psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q"))
TAG = "ont-dec-"
MARK = "[판단 데모 018]"
LEAD = "a08e7c0d-9050-4eb8-ad68-c35d4aceadf0"  # manual-shots@uengine.org — 구매 담당·구매팀장 역(한 계정으로 시연)
AGENT = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{TAG}{TENANT}:agent"))
AGENT_NAME = "구매 판단 에이전트"
MEGA, MAJOR_ID, MAJOR_NAME = "구매 운영", "MAJ-ONT-DEC", "AI 판단 시나리오"

AGENT_DESC = (
    "앞 단계의 구매 요청(품목·필요일)·사양 확인과 견적 접수(후보 공급사별 단가·납기·품질)를 읽고 발주할 공급사 한 곳을 정한다. "
    "판단 전에 전략–실행 온톨로지의 판단 근거(ontology_decision_context)로 이 업무를 지배하는 전략·KPI·우선순위·상충을 "
    "확인하고 그 결정 모드를 따른다. 보고서에는 선택한 공급사, 근거 KPI(목표·현재값), 택한/포기한 기준과 이유를 쓴다."
)
# 시연용 표준 구매 흐름(7단계) — 요청(현업) → 접수·사양 확인 → 견적 접수 → [에이전트 판단] → 발주 승인 → 발주서 발행 → 입고·검수
REQUESTER = "요청 부서"


QUALITY = "품질 관리"


def form_id_of(proc_id: str, act_id: str) -> str:
    """판단 업무 전용 폼 id — 단계마다 따로 둬야 뒤 단계의 기본 폼 결과에 덮이지 않고 Gateway 가 읽을 수 있다."""
    return f"{proc_id}-{act_id}".replace("-", "_").lower() + "_form"


def inspect_branch(proc_id: str, decide_id: str, strict_desc: str) -> dict:
    """발주서 발행 뒤 검수 분기 — 판단에서 품질을 택했으면 표준 검수, 아니면(단가를 택함) 강화 검수."""
    form = form_id_of(proc_id, decide_id)
    return {
        "id": "Gate_Inspect", "name": "검수 방식(적용 기준)", "after": "Task_PO",
        "paths": [
            {"flow": "Flow_Gate_Inspect_std", "label": "품질 우선", "condition": f"{form}: '품질' in decision_chosen",
             "act": {"id": "Task_Inspect", "name": "입고·검수", "lane": REQUESTER, "kind": "userTask",
                     "desc": "입고된 품목의 수량·품질을 검수하고 결과를 적는다."}},
            {"flow": "Flow_Gate_Inspect_strict", "label": "단가 우선", "condition": f"{form}: '품질' not in decision_chosen",
             "act": {"id": "Task_Inspect_Strict", "name": "강화 검수", "lane": QUALITY, "kind": "userTask",
                     "desc": strict_desc}},
        ],
    }


def std_acts(decide: list[dict] | None = None, approve_name: str = "발주 승인", inspect: bool = True) -> list[dict]:
    decide = decide or [{"id": "Task_Decide", "name": "공급사 선정 판단", "lane": AGENT_NAME, "kind": "serviceTask",
                         "desc": "{AGENT}"}]
    return [
        {"id": "Task_Request", "name": "구매 요청", "lane": REQUESTER, "kind": "userTask",
         "desc": "필요한 품목·수량·필요일과 요청 사유를 적어 구매를 요청한다."},
        {"id": "Task_Receive", "name": "요청 접수·사양 확인", "lane": "구매 담당", "kind": "userTask",
         "desc": "요청 품목의 사양·수량·필요일을 확인하고 견적을 받을 후보 공급사를 정한다."},
        {"id": "Task_Quote", "name": "견적 접수", "lane": "구매 담당", "kind": "userTask",
         "desc": "후보 공급사 두 곳의 견적(공급사별 단가·납기·품질 합격률)을 받아 적는다."},
        *decide,
        {"id": "Task_Approve", "name": approve_name, "lane": "구매팀장", "kind": "userTask",
         "desc": "에이전트의 선정 결과와 근거(전략·KPI·우선순위·담당자 답)를 검토하고 발주를 승인하거나 의견을 남긴다."},
        {"id": "Task_PO", "name": "발주서 발행", "lane": "구매 담당", "kind": "userTask",
         "desc": "승인된 공급사로 발주서를 발행하고 발주 번호·약속 납기를 적는다."},
        *([{"id": "Task_Inspect", "name": "입고·검수", "lane": REQUESTER, "kind": "userTask",
            "desc": "입고된 품목의 수량·품질을 검수하고 결과를 적는다."}] if inspect else []),
    ]


PROCESSES = [
    {"id": f"{TAG}regular", "name": "소모품 정기 구매", "scenario": "1",
     "desc": "정기 소모품을 계획대로 구매한다. 에이전트가 단가·계획 준수 KPI 에 맞춰 공급사를 고른다(상충 없음)."},
    {"id": f"{TAG}urgent", "name": "생산 자재 긴급 구매", "scenario": "2.1",
     "desc": "생산 차질 우려가 있는 자재를 급히 구매한다. 납기와 단가 KPI 가 상충하며, 우선순위대로 에이전트가 고른다."},
    {"id": f"{TAG}parts", "name": "설비 부품 구매", "scenario": "2.2",
     "desc": "설비 교체 부품을 구매한다. 품질과 단가 KPI 가 상충하고 우선순위가 없어 에이전트가 담당자에게 묻는다. "
             "담당자가 택한 기준으로 검수 흐름이 갈린다(품질 → 표준 입고·검수, 단가 → 품질 관리 강화 검수).",
     "acts": std_acts(inspect=False),
     "branch": inspect_branch(f"{TAG}parts", "Task_Decide",
                              "단가를 택해 품질 합격률이 낮은 공급사로 발주한 건이다. 전수 시운전·시험 성적서·보증 조건을 확인하고 결과를 적는다.")},
    {"id": f"{TAG}expansion", "name": "생산라인 증설 자재 조달", "scenario": "통합",
     "desc": "증설에 필요한 세 가지 자재를 한 번에 조달한다. 에이전트가 품목마다 다른 KPI 로 판단한다 — "
             "포장 부자재(상충 없음) → 핵심 자재(우선순위로 선택) → 설비 부품(담당자에게 질문) → 통합 승인. "
             "설비 부품에서 택한 기준으로 검수 흐름이 갈린다.",
     "branch": inspect_branch(f"{TAG}expansion", "Task_Parts",
                              "설비 부품을 단가 기준으로 발주한 건이다. 3품목 입고 검수와 함께 설비 부품은 전수 시운전·시험 성적서·보증 조건을 확인하고 결과를 적는다."),
     "acts": std_acts([
         {"id": "Task_Packaging", "name": "포장 부자재 공급사 선정", "lane": "구매 판단 에이전트", "kind": "serviceTask",
          "desc": "견적의 ① 포장 부자재 항목만 판단한다. " + "{AGENT}"},
         {"id": "Task_Core", "name": "핵심 자재 조달 판단", "lane": "구매 판단 에이전트", "kind": "serviceTask",
          "desc": "견적의 ② 핵심 자재 항목만 판단한다(다른 항목은 앞·뒤 단계가 맡는다). " + "{AGENT}"},
         {"id": "Task_Parts", "name": "설비 부품 공급사 선정", "lane": "구매 판단 에이전트", "kind": "serviceTask",
          "desc": "견적의 ③ 설비 부품 항목만 판단한다(다른 항목은 앞 단계가 맡았다). " + "{AGENT}"},
     ], approve_name="통합 발주 승인", inspect=False)},
]
# (프로세스, 키, 전략 이름, 전략 관점, KPI 이름, 단위, 방향, 기준, 목표, 현재, 우선순위[, 판단 적용 활동])
KPIS = [
    (f"{TAG}regular", "reg_cost", "구매 원가 절감", "financial", "소모품 구매 단가 절감률", "%", "increase", 0, 6, 4.1, None),
    (f"{TAG}regular", "reg_plan", "구매 프로세스 표준화·자동화", "internal_process", "정기 구매 계획 준수율", "%", "increase", 70, 95, 88, None),
    (f"{TAG}urgent", "urg_lead", "협력사 납기 신뢰도 향상", "customer", "긴급 자재 납기 준수율", "%", "increase", 70, 95, 86, 1),
    (f"{TAG}urgent", "urg_cost", "구매 원가 절감", "financial", "긴급 자재 구매 단가 절감률", "%", "increase", 0, 5, 3.2, 2),
    (f"{TAG}parts", "par_quality", "협력사 관리 체계 고도화", "internal_process", "설비 부품 품질 합격률", "%", "increase", 95, 99.5, 98.1, None),
    (f"{TAG}parts", "par_cost", "구매 원가 절감", "financial", "설비 부품 구매 단가 절감률", "%", "increase", 0, 7, 5.0, None),
    # 통합 — 같은 프로세스지만 판단 단계마다 근거 KPI 가 다르다(activity_ids)
    (f"{TAG}expansion", "exp_pack_cost", "구매 원가 절감", "financial", "증설 포장재 단가 절감률", "%", "increase", 0, 6, 3.8, None, ["Task_Packaging"]),
    (f"{TAG}expansion", "exp_pack_plan", "구매 프로세스 표준화·자동화", "internal_process", "증설 포장재 납기 계획 준수율", "%", "increase", 70, 95, 90, None, ["Task_Packaging"]),
    (f"{TAG}expansion", "exp_core_lead", "협력사 납기 신뢰도 향상", "customer", "증설 핵심자재 납기 준수율", "%", "increase", 70, 95, 84, 1, ["Task_Core"]),
    (f"{TAG}expansion", "exp_core_cost", "구매 원가 절감", "financial", "증설 핵심자재 단가 절감률", "%", "increase", 0, 5, 2.9, 2, ["Task_Core"]),
    (f"{TAG}expansion", "exp_parts_quality", "협력사 관리 체계 고도화", "internal_process", "증설 설비부품 품질 합격률", "%", "increase", 95, 99.5, 97.9, None, ["Task_Parts"]),
    (f"{TAG}expansion", "exp_parts_cost", "구매 원가 절감", "financial", "증설 설비부품 단가 절감률", "%", "increase", 0, 7, 4.6, None, ["Task_Parts"]),
]
CONFLICTS = [("urg_lead", "urg_cost"), ("par_quality", "par_cost"), ("exp_core_lead", "exp_core_cost"), ("exp_parts_quality", "exp_parts_cost")]
# 판단 단계 → 결정 모드 확인용
DECIDE_STEPS = {f"{TAG}expansion": ["Task_Packaging", "Task_Core", "Task_Parts"]}
KPI_FIELDS = ("objective_id", "name", "description", "unit", "measure_type", "form_field", "proc_def_id", "direction",
              "baseline_value", "target_value", "period_start", "period_end", "survey_questions", "source_url",
              "source_field", "kpi_role", "importance", "priority", "activity_ids")
STATE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".state.json")


def q(v) -> str:
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def psql(sql: str) -> None:
    subprocess.run(PSQL, input=f"begin;\n{sql}\ncommit;\n".encode(), check=True)


def psql_value(sql: str) -> str:
    return subprocess.run(PSQL + ["-At", "-c", sql], capture_output=True, check=True).stdout.decode().strip()


def api(method: str, path: str, body=None):
    url = f"{API}/{path}{'&' if '?' in path else '?'}tenant_id={TENANT}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={"content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as res:
        raw = res.read()
    return json.loads(raw) if raw else None


# 에이전트 판단 단계의 BPMN 유형 — 원래 흐름은 사용자 태스크에 에이전트를 배정한다(에이전트 탭: 에이전트·자율 완료·
# 오케스트레이션). 실행은 오케스트레이션 워커(langchain-react)가 한다. --service-task 면 실행 엔진 폴링 서비스가
# 직접 실행하는 서비스 태스크로 만든다(워커가 없을 때).
AGENT_TASK = "userTask"
AGENT_ORCH = "langchain-react"


def decision_form(form_id: str) -> tuple[str, list[dict]]:
    """판단 업무 폼 — 보고서(에이전트가 씀) + 판단 방식·적용 기준(워커가 판단 근거 결과로 채움, Gateway 조건이 읽음)."""
    fields = [{"key": "free_input", "text": "판단 보고서", "type": "textarea", "disabled": "false", "readonly": "false"},
              {"key": "decision_mode", "text": "판단 방식", "type": "text", "disabled": "false", "readonly": "true"},
              {"key": "decision_chosen", "text": "적용 기준", "type": "text", "disabled": "false", "readonly": "true"}]

    def col(f, width):
        if f["type"] == "textarea":
            tag = (f'<textarea-field name="{f["key"]}" alias="{f["text"]}" rows="12" disabled="false" readonly="false" '
                   f'v-model="slotProps.modelValue[\'{f["key"]}\']"></textarea-field>')
        else:
            tag = (f'<text-field name="{f["key"]}" alias="{f["text"]}" type="text" disabled="false" readonly="true" '
                   f'v-model="slotProps.modelValue[\'{f["key"]}\']"></text-field>')
        return f'<div class="col-sm-{width}">{tag}</div>'

    html = (f'<section><row-layout name="{form_id}_section" alias="공급사 선정 판단" is_multidata_mode="false" '
            'v-model="formValues" v-slot="slotProps"><div class="row">'
            + col(fields[1], 4) + col(fields[2], 8) + '</div><div class="row">' + col(fields[0], 12)
            + '</div></row-layout></section>')
    return html, fields


def definition_of(p: dict) -> tuple[str, dict]:
    def norm(a):
        return dict(a, desc=a["desc"].replace("{AGENT}", AGENT_DESC), kind=AGENT_TASK if a["lane"] == AGENT_NAME else a["kind"])

    acts = [norm(a) for a in (p.get("acts") or std_acts())]
    branch = p.get("branch")
    branch_acts = [path["act"] for path in branch["paths"]] if branch else []
    all_acts = [*acts, *branch_acts]
    lanes = [REQUESTER, "구매 담당", AGENT_NAME, "구매팀장", *([QUALITY] if branch else [])]
    xml = build_bpmn(p["id"], p["name"], lanes, acts, branch=branch)
    # 시연은 한 계정이 사람 역할(요청 부서·구매 담당·구매팀장)을 모두 맡는다
    owner = {n: (AGENT if n == AGENT_NAME else LEAD) for n in lanes}
    pid = "Proc_" + p["id"].replace("-", "_")

    def tool_of(a):
        return f"formHandler:{form_id_of(p['id'], a['id'])}" if a["lane"] == AGENT_NAME else "formHandler:defaultform"

    def agent_props(a):
        orch = AGENT_ORCH if a["kind"] == "userTask" else ""
        return {"description": a["desc"], "instruction": a["desc"], "manualLinks": [], "systems": [], "input": [], "output": [],
                "agent": AGENT, "agentMode": "COMPLETE", "orchestration": orch, "usePresetAgent": True,
                "tool": tool_of(a)}

    def act(a):
        is_agent = a["lane"] == AGENT_NAME
        props = agent_props(a) if is_agent else {"description": a["desc"], "instruction": "", "manualLinks": [], "systems": [],
                                                  "input": [], "output": []}
        return {
            "id": a["id"], "name": a["name"], "role": a["lane"], "tool": tool_of(a), "type": a["kind"],
            "agent": AGENT if is_agent else "", "agentMode": "COMPLETE" if is_agent else "",
            "orchestration": props.get("orchestration", ""),
            "process": pid, "systems": [], "duration": 1 if is_agent else 2, "inputData": [], "outputData": [],
            "manualLink": "", "manualLinks": [], "attachments": [], "checkpoints": [], "attachedEvents": None,
            "description": a["desc"], "instruction": a["desc"] if is_agent else "",
            "properties": json.dumps(props, ensure_ascii=False),
        }

    # 정의 편집기의 에이전트 탭이 BPMN 속성(uengine:properties)에서 읽으므로 에이전트 설정을 BPMN 에도 넣는다
    from html import escape as _esc
    for a in acts:
        if a["lane"] != AGENT_NAME:
            continue
        start = xml.index(f'<bpmn:{a["kind"]} id="{a["id"]}"')
        j0 = xml.index('json="', start) + len('json="')
        j1 = xml.index('"', j0)
        xml = xml[:j0] + _esc(json.dumps(agent_props(a), ensure_ascii=False), quote=True) + xml[j1:]

    # 연결선은 BPMN 에서 그대로 읽는다(분기 연결선의 조건식 포함)
    conds = {path["flow"]: path["condition"] for path in branch["paths"]} if branch else {}
    sequences = [{"id": fid, "name": name, "source": src, "target": dst, "condition": "",
                  "properties": json.dumps({"conditionFunction": conds[fid]}, ensure_ascii=False) if fid in conds else "{}"}
                 for fid, name, src, dst in re.findall(
                     r'<bpmn:sequenceFlow id="([^"]+)" name="([^"]*)" sourceRef="([^"]+)" targetRef="([^"]+)"', xml)]
    gate_lane = next(a["lane"] for a in acts if branch and a["id"] == branch["after"]) if branch else None
    definition = {
        "processDefinitionId": p["id"],
        "processDefinitionName": p["name"],
        "description": p["desc"],
        "shortDescription": p["desc"],
        "roles": [{"name": n, "default": owner[n], "endpoint": owner[n], "resolutionRule": ""} for n in lanes],
        "activities": [act(a) for a in all_acts],
        "events": [
            {"id": "Start", "name": "시작", "role": acts[0]["lane"], "type": "startEvent", "process": pid, "properties": "{}", "description": ""},
            {"id": "End", "name": "완료", "role": all_acts[-1]["lane"], "type": "endEvent", "process": pid, "properties": "{}", "description": ""},
        ],
        "gateways": ([{"id": branch["id"], "name": branch["name"], "role": gate_lane, "type": "exclusiveGateway", "process": pid,
                       "condition": {}, "conditionData": [], "properties": "{}", "description": ""}] if branch else []),
        "sequences": sequences,
        "subProcesses": [],
        "data": [],
        "meta": {"process_mode": "asis"},
    }
    # 레인 담당자(DirectRoleResolutionContext) — 정의 편집기에서 열어도 같은 담당이 보이게
    from html import escape
    for i, lane in enumerate(lanes):
        ctx = {"roleResolutionContext": {"_type": "org.uengine.kernel.DirectRoleResolutionContext", "endpoint": owner[lane]}}
        tag = f'<bpmn:lane id="Lane_{i}" name="{escape(lane)}">'
        xml = xml.replace(tag, tag + f'<bpmn:extensionElements><uengine:properties json="{escape(json.dumps(ctx), quote=True)}" /></bpmn:extensionElements>')
    return xml, definition


def cleanup() -> None:
    state = load_state()
    for kid in state.get("kpis", {}).values():
        try:
            api("DELETE", f"kpis/{kid}")
        except Exception:  # noqa: BLE001 — 이미 지워짐
            pass
    # 상태 파일이 없어도 표식으로 지운다
    try:
        for obj in api("GET", "map").get("objectives", []):
            for k in obj.get("kpis", []):
                if (k.get("description") or "").startswith(MARK):
                    api("DELETE", f"kpis/{k['id']}")
    except Exception as e:  # noqa: BLE001
        print(f"[안내] 전략 서비스 KPI 정리 건너뜀: {e}")
    psql(f"""
delete from public.events where proc_inst_id like '{TAG}%';
delete from public.todolist where tenant_id = {q(TENANT)} and proc_def_id like '{TAG}%';
delete from public.form_def where tenant_id = {q(TENANT)} and id like '{TAG.replace("-", "_")}%';
delete from public.bpm_proc_inst where tenant_id = {q(TENANT)} and proc_def_id like '{TAG}%';
delete from public.proc_def where tenant_id = {q(TENANT)} and id like '{TAG}%';
delete from public.users where tenant_id = {q(TENANT)} and id::text = {q(AGENT)};
""")
    raw = psql_value(f"select value::text from public.configuration where tenant_id = {q(TENANT)} and key = 'proc_map'")
    if raw:
        pm = json.loads(raw)
        for mega in pm.get("mega_proc_list") or []:
            mega["major_proc_list"] = [m for m in mega.get("major_proc_list") or [] if m.get("id") != MAJOR_ID]
        psql(f"update public.configuration set value = {q(json.dumps(pm, ensure_ascii=False))}::jsonb "
             f"where tenant_id = {q(TENANT)} and key = 'proc_map';")
    if os.path.exists(STATE_FILE):
        os.remove(STATE_FILE)


def load_state() -> dict:
    try:
        with open(STATE_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def seed() -> None:
    psql(f"""
insert into public.users (id, username, email, tenant_id, is_agent, agent_type, description, department_name, tools)
values ({q(AGENT)}, {q(AGENT_NAME)}, null, {q(TENANT)}, true, 'agent',
        '전략–실행 온톨로지의 판단 근거(전략·KPI 우선순위·상충)로 공급사를 고르고, 정하지 못하면 담당자에게 묻는다',
        'AI 에이전트', 'strategy-ontology');
""")
    stmts = []
    for p in PROCESSES:
        xml, definition = definition_of(p)
        for a in definition["activities"]:
            if a["role"] != AGENT_NAME:
                continue
            fid = form_id_of(p["id"], a["id"])
            html, fields = decision_form(fid)
            stmts.append("insert into public.form_def (id, html, proc_def_id, activity_id, tenant_id, fields_json) values "
                         f"({q(fid)}, {q(html)}, {q(p['id'])}, {q(a['id'])}, {q(TENANT)}, {q(json.dumps(fields, ensure_ascii=False))}::jsonb);")
        stmts.append(
            "insert into public.proc_def (id, name, tenant_id, definition, bpmn, type, description, domain_id, owner) values "
            f"({q(p['id'])}, {q(p['name'])}, {q(TENANT)}, {q(json.dumps(definition, ensure_ascii=False))}::jsonb, {q(xml)}, "
            f"'bpmn', {q(p['desc'])}, '구매관리', {q(LEAD)});")
    psql("\n".join(stmts))

    raw = psql_value(f"select value::text from public.configuration where tenant_id = {q(TENANT)} and key = 'proc_map'")
    pm = json.loads(raw) if raw else {"mega_proc_list": []}
    mega = next((m for m in pm["mega_proc_list"] if m.get("name") == MEGA), None)
    if mega is None:
        mega = {"id": "MEGA-ONT-DEC", "name": MEGA, "major_proc_list": []}
        pm["mega_proc_list"].append(mega)
    mega.setdefault("major_proc_list", []).append({
        "id": MAJOR_ID, "name": MAJOR_NAME, "domain": "구매관리", "domain_id": "구매관리",
        "sub_proc_list": [{"id": p["id"], "pid": f"{MAJOR_ID}.1", "name": p["name"], "type": "asis",
                           "description": f"[시나리오 {p['scenario']}] {p['desc']}", "proc_def_id": p["id"]} for p in PROCESSES],
    })
    psql(f"update public.configuration set value = {q(json.dumps(pm, ensure_ascii=False))}::jsonb "
         f"where tenant_id = {q(TENANT)} and key = 'proc_map';")

    objectives = {o["name"]: o["id"] for o in api("GET", "map").get("objectives", [])}
    kpi_ids: dict[str, str] = {}
    for proc, key, sname, perspective, name, unit, direction, base, target, current, prio, *scope in KPIS:
        if sname not in objectives:
            objectives[sname] = api("POST", "objectives", {"name": sname, "perspective": perspective, "importance": 4})["id"]
        body = {"objective_id": objectives[sname], "name": name, "description": f"{MARK} {name}", "unit": unit,
                "measure_type": "manual", "proc_def_id": proc, "direction": direction, "baseline_value": base,
                "target_value": target, "importance": 4, "priority": prio, "kpi_role": "lagging",
                "activity_ids": scope[0] if scope else []}
        kid = api("POST", "kpis", body)["id"]
        api("POST", f"kpis/{kid}/value", {"value": current})
        kpi_ids[key] = kid
    for a, b in CONFLICTS:
        kpi = next(k for o in api("GET", "map")["objectives"] for k in o["kpis"] if k["id"] == kpi_ids[a])
        api("PUT", f"kpis/{kpi_ids[a]}", {**{k: kpi.get(k) for k in KPI_FIELDS}, "conflicts_with": [kpi_ids[b]]})
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump({"kpis": kpi_ids, "agent": AGENT}, f, ensure_ascii=False, indent=1)
    api("POST", "ontology/sync?full=true")
    for p in PROCESSES:
        modes = []
        for step in DECIDE_STEPS.get(p["id"], ["Task_Decide"]):
            d = api("GET", f"ontology/decision-context?proc_def_id={p['id']}&activity_id={step}")
            modes.append(d["decision"]["mode"])
        print(f"시나리오 {p['scenario']:<4} {p['name']:<12} → {' → '.join(modes)}")


def set_priority(spec: str) -> None:
    """--priority 2.1=lead : 시나리오 2.1 의 납기 KPI 를 1순위(단가 2순위)로, =cost 면 반대로, =none 이면 둘 다 미정."""
    scen, first = spec.split("=")
    pair = {"2.1": ("urg_lead", "urg_cost"), "2.2": ("par_quality", "par_cost")}[scen]
    ids = load_state()["kpis"]
    order = {"lead": (1, 2), "quality": (1, 2), "cost": (2, 1), "none": (None, None)}[first]
    for key, prio in zip(pair, order):
        kpi = next(k for o in api("GET", "map")["objectives"] for k in o["kpis"] if k["id"] == ids[key])
        body = {k: kpi.get(k) for k in KPI_FIELDS if k != "priority"}
        api("PUT", f"kpis/{ids[key]}", {**body, "priority": prio})
    d = api("GET", f"ontology/decision-context?proc_def_id={TAG}{'urgent' if scen == '2.1' else 'parts'}&activity_id=Task_Decide")
    print(scen, d["decision"]["mode"], d["decision"].get("guidance", "")[:120])


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--cleanup", action="store_true")
    ap.add_argument("--priority")
    ap.add_argument("--service-task", action="store_true", help="판단 단계를 서비스 태스크로(오케스트레이션 워커 없이 폴링 서비스가 실행)")
    args = ap.parse_args()
    if args.service_task:
        AGENT_TASK = "serviceTask"
    if args.priority:
        set_priority(args.priority)
    elif args.cleanup:
        cleanup()
    else:
        cleanup()
        seed()
