#!/usr/bin/env python3
"""온톨로지 E2E 가이드(spec 017)용 업로드 BPMN 생성기.

    python3 scripts/demo/ontology-e2e/make-bpmn.py > docs/manuals/assets/ontology-e2e/구매-KPI-주간-점검.bpmn

'구매 KPI 주간 점검' — 구매팀장이 점검할 KPI 를 적으면(사람) → 온톨로지 조회 에이전트가 전략–실행 온톨로지(MCP)로
원인을 역추적해 보고하고(에이전트, serviceTask) → 구매팀장이 결과를 검토한다(사람).
새 프로세스 대화상자의 '업로드'로 올리는 파일이다. 레인의 담당자(roleResolutionContext)와 서비스 태스크의
배정 에이전트(agent/agentMode)는 Process GPT 정의 형식(uengine:properties)으로 들어 있어, 화면이 정의(JSON)를
만들 때 그대로 실행 담당자가 된다.
"""
import json
import sys
from html import escape
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from demo_bpmn import build_bpmn  # noqa: E402

LEAD = "a08e7c0d-9050-4eb8-ad68-c35d4aceadf0"   # manual-shots@uengine.org (tym, 시연 계정 = 구매팀장 역)
AGENT = "116478c6-b16e-5ea0-9118-d3d23971134c"  # 온톨로지 조회 에이전트 (tools: strategy-ontology,ontology-studio)
PROC_ID = "purchase-kpi-weekly-review"

LANES = ["구매팀장", "온톨로지 조회 에이전트"]
ACTS = [
    {"id": "Task_Request", "name": "점검 요청", "lane": "구매팀장", "kind": "userTask",
     "desc": "이번 주 점검할 KPI 이름과 궁금한 점(왜 목표에 못 미치는지, 어느 단계·누가 병목인지)을 적어 분석을 요청한다."},
    {"id": "Task_Analyze", "name": "온톨로지 원인 분석", "lane": "온톨로지 조회 에이전트", "kind": "serviceTask",
     "desc": ("요청서에 적힌 KPI 를 전략–실행 온톨로지에서 찾고(ontology_resolve_entity, class_name=KPI) "
              "원인을 실행까지 역추적한다(ontology_kpi_root_cause). 현재값·목표·달성률, 병목 태스크와 평균 소요시간, "
              "담당자, 개선 제안 1~2개를 한국어로 보고한다. 숫자는 도구 결과에 있는 값만 쓴다.")},
    {"id": "Task_Review", "name": "점검 결과 검토", "lane": "구매팀장", "kind": "userTask",
     "desc": "에이전트 보고를 검토하고 후속 조치(담당자 면담·프로세스 개선 요청)를 적는다."},
]


def main() -> None:
    xml = build_bpmn(PROC_ID, "구매 KPI 주간 점검", LANES, ACTS)
    # 서비스 태스크: 배정 에이전트·자율 완료 모드·지시문
    a = ACTS[1]
    agent_props = {"description": a["desc"], "instruction": a["desc"], "procedure": [a["desc"]],
                   "agent": AGENT, "agentMode": "COMPLETE", "usePresetAgent": True,
                   "manualLinks": [], "systems": [], "input": [], "output": []}
    start = xml.index('<bpmn:serviceTask id="Task_Analyze"')
    p0 = xml.index('json="', start) + len('json="')
    p1 = xml.index('"', p0)
    xml = xml[:p0] + escape(json.dumps(agent_props, ensure_ascii=False), quote=True) + xml[p1:]
    # 레인 담당자: 실행 시 역할 기본 담당(DirectRoleResolutionContext)
    for i, uid in enumerate([LEAD, AGENT]):
        ctx = {"roleResolutionContext": {"_type": "org.uengine.kernel.DirectRoleResolutionContext", "endpoint": uid}}
        ext = (f'<bpmn:extensionElements><uengine:properties json="{escape(json.dumps(ctx), quote=True)}" />'
               "</bpmn:extensionElements>")
        tag = f'<bpmn:lane id="Lane_{i}" name="{escape(LANES[i])}">'
        xml = xml.replace(tag, tag + ext)
    sys.stdout.write(xml + "\n")


if __name__ == "__main__":
    main()
