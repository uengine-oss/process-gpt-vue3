#!/usr/bin/env python3
"""온톨로지 근거 에이전트 판단(spec 018) 회귀 점검 — 화면 없이 실행 엔진 API 로 시나리오를 돌려 판단이 기대와 맞는지 본다.

    python3 scripts/demo/ontology-decision/check.py            # 시나리오별 1회
    python3 scripts/demo/ontology-decision/check.py --runs 3   # 3회씩
    python3 scripts/demo/ontology-decision/check.py --email sanghoon01@uengine.org   # 그 계정이 시작·담당(이력이 그 계정에 보임)

| 케이스 | 프로세스 | 기대 결정 모드 | 기대 공급사 |
|---|---|---|---|
| 1        | 소모품 정기 구매(상충 없음)            | aligned            | A(저가, 납기 충족) |
| 2.1      | 생산 자재 긴급 구매(납기 1순위)        | priority           | B(빠른 납기) |
| 2.2-품질 | 설비 부품 구매(미정 → 사용자: 품질)    | user_choice        | B(품질 합격률 높음) |
| 2.2-단가 | 설비 부품 구매(미정 → 사용자: 단가)    | user_choice        | A(단가 낮음) |
| 통합     | 생산라인 증설 자재 조달 — 판단 단계 3개 | aligned → priority → user_choice | A → B → B(사용자: 품질) |

2.2·통합은 판단 뒤 발주 승인·발주서 발행까지 제출하고 검수 Gateway 가 고른 업무를 본다 — 품질을 택했으면
입고·검수(Task_Inspect), 단가를 택했으면 강화 검수(Task_Inspect_Strict).

엔진(:8000 /complete)으로 첫 업무를 제출하고, 폴링 서비스가 에이전트 단계를 처리하길 기다린다. 2.2 는 화면 대신
events 에 human_response 를 써서 답한다(화면의 질문 카드가 쓰는 것과 같은 행). 만든 인스턴스는 남는다(seed.py --cleanup).
"""
import argparse
import json
import os
import re
import shlex
import subprocess
import sys
import time
import urllib.request

ENGINE = "http://127.0.0.1:8000/complete"
PSQL = shlex.split("docker exec -i supabase_db_process-gpt-vue3 psql -U postgres -d postgres -At")
EMAIL = "manual-shots@uengine.org"
USER_ID = None  # --email 로 정하면 사람 레인 담당을 그 계정으로 바꿔 시작한다

# 시나리오 문구 — 녹화 스크립트(record.mjs)와 같은 파일을 쓴다
TEXTS = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "scenarios.json"), encoding="utf-8"))
CASES = [
    ("1", "ont-dec-regular", None, "aligned", "A", None),
    ("2.1", "ont-dec-urgent", None, "priority", "B", None),
    ("2.2-품질", "ont-dec-parts", "품질", "user_choice", "B", "Task_Inspect"),
    ("2.2-단가", "ont-dec-parts", "단가", "user_choice", "A", "Task_Inspect_Strict"),
]
INSPECT = ("Task_Inspect", "Task_Inspect_Strict")


def sql(s: str) -> str:
    return subprocess.run(PSQL, input=s.encode(), capture_output=True, check=True).stdout.decode().strip()


def q(v: str) -> str:
    return "'" + v.replace("'", "''") + "'"


def role_mappings(proc: str) -> list:
    """사람 레인 담당을 실행 계정으로 바꾼다 — 에이전트 레인은 그대로. --email 이 없으면 정의의 담당 그대로."""
    if not USER_ID:
        return []
    roles = json.loads(sql(f"select definition->'roles' from proc_def where id={q(proc)} and tenant_id='tym'"))
    agents = set(sql("select id::text from public.users where tenant_id='tym' and is_agent").split())
    swap = lambda v: v if v in agents else USER_ID
    return [{"name": r["name"], "endpoint": swap(r["endpoint"]), "default": swap(r["default"])} for r in roles]


def post(input_: dict) -> dict:
    body = {"input": {"email": EMAIL, "tenant_id": "tym", "answer": "", "role_mappings": [], **input_}}
    req = urllib.request.Request(ENGINE, data=json.dumps(body).encode(), method="POST",
                                 headers={"content-type": "application/json", "X-Forwarded-Host": "tym.x"})
    return json.load(urllib.request.urlopen(req, timeout=60))


def form_id(proc: str, activity: str) -> str:
    """단계 전용 폼 id — seed.py form_id_of 와 같다."""
    return f"{proc}-{activity}".replace("-", "_").lower() + "_form"


def submit(inst: str, proc: str, activity: str, values: dict) -> None:
    """사람 단계 제출 — 화면의 '제출 완료'와 같은 엔진 호출."""
    wait(inst, {"IN_PROGRESS"}, timeout=90, activity=activity)
    task_id = sql(f"select id from todolist where proc_inst_id={q(inst)} and activity_id={q(activity)}")
    post({"task_id": task_id, "process_instance_id": inst, "process_definition_id": proc, "activity_id": activity,
          "form_values": {form_id(proc, activity): values}})
    wait(inst, {"DONE", "SUBMITTED"}, timeout=90, activity=activity)


def start(proc: str) -> str:
    """구매 요청으로 시작 → 접수·사양 확인 → 견적 접수까지 사람 단계를 제출한다(다음은 에이전트 판단)."""
    t = TEXTS[proc]
    inst = post({"process_definition_id": proc, "process_instance_id": "new", "role_mappings": role_mappings(proc),
                 "form_values": {form_id(proc, "Task_Request"): t["request"]}})["proc_inst_id"]
    submit(inst, proc, "Task_Receive", t["receive"])
    submit(inst, proc, "Task_Quote", t["quote"])
    return inst


def decide_status(inst: str, activity: str = "Task_Decide") -> str:
    return sql(f"select status from todolist where proc_inst_id={q(inst)} and activity_id={q(activity)}")


def wait(inst: str, want: set[str], timeout: int = 240, activity: str = "Task_Decide") -> str:
    t0 = time.time()
    while time.time() - t0 < timeout:
        st = decide_status(inst, activity)
        if st in want:
            return st
        time.sleep(3)
    raise TimeoutError(f"{inst}/{activity}: {want} 대기 시간 초과(현재 {decide_status(inst, activity)})")


def answer(inst: str, keyword: str) -> str:
    row = sql(f"select data::text from events where proc_inst_id={q(inst)} and event_type='human_asked' order by timestamp desc limit 1")
    options = json.loads(row)["options"]
    pick = next(o for o in options if keyword in o)
    sql(f"""insert into events (id, job_id, todo_id, proc_inst_id, event_type, status, crew_type, data)
            select gen_random_uuid()::text, job_id, todo_id, proc_inst_id, 'human_response', 'APPROVED', crew_type,
                   jsonb_build_object('answer', {q(pick)})
            from events where proc_inst_id={q(inst)} and event_type='human_asked' order by timestamp desc limit 1""")
    return pick


def todo_id_of(inst: str, activity: str) -> str:
    return sql(f"select id from todolist where proc_inst_id={q(inst)} and activity_id={q(activity)}")


def wait_question(inst: str, activity: str, timeout: int = 360) -> None:
    """에이전트가 담당자에게 질문할 때까지 — 서비스 태스크 경로는 업무가 PENDING, 오케스트레이션 워커 경로는
    업무가 IN_PROGRESS 인 채 events 에 human_asked 가 생긴다."""
    t0 = time.time()
    while time.time() - t0 < timeout:
        todo = todo_id_of(inst, activity)
        asked = todo and sql(f"select count(*) from events where todo_id={q(todo)} and event_type='human_asked'") not in ("", "0")
        if asked or decide_status(inst, activity) == "PENDING":
            return
        time.sleep(3)
    raise TimeoutError(f"{inst}/{activity}: 질문 대기 시간 초과")


def form_of(out: dict) -> dict:
    """산출물의 폼 값 — 판단 업무는 전용 폼(…_form), 서비스 태스크 경로·이전 시드는 defaultform."""
    return next((v for k, v in out.items() if k.endswith("form") and isinstance(v, dict)), {})


def decision_mode(inst: str, activity: str, out: dict) -> str | None:
    """판단 모드 — 산출물의 decision, 없으면 판단 근거 도구 결과(events)와 사용자 답에서."""
    if isinstance(out.get("decision"), dict):
        return out["decision"].get("mode")
    todo = todo_id_of(inst, activity)
    rows = sql(f"select data::text from events where todo_id={q(todo)} and event_type='tool_usage_finished' order by timestamp")
    modes = re.findall(r'\\?"mode\\?": \\?"(\w+)', rows)
    mode = modes[-1] if modes else None
    answered = sql(f"select count(*) from events where todo_id={q(todo)} and event_type='human_response'") not in ("", "0")
    return "user_choice" if mode == "ask_user" and answered else mode


def report_of(out: dict) -> str:
    return form_of(out).get("free_input") or ""


def inspect_branch(inst: str, proc: str) -> str:
    """승인·발주서 발행을 제출하고 검수 Gateway 가 연 업무(활동 id)를 돌려준다. 엔진은 분기 양쪽 업무를 TODO 로
    미리 만들어 두므로 진행 중(IN_PROGRESS)이 된 쪽을 본다."""
    submit(inst, proc, "Task_Approve", TEXTS[proc]["approve"])
    submit(inst, proc, "Task_PO", TEXTS[proc]["po"])
    t0 = time.time()
    while time.time() - t0 < 120:
        rows = sql(f"select activity_id || '=' || status from todolist where proc_inst_id={q(inst)} "
                   f"and activity_id in ({', '.join(q(a) for a in INSPECT)})")
        status = dict(r.split("=") for r in rows.splitlines())
        opened = [a for a, st in status.items() if st == "IN_PROGRESS"]
        # 고르지 않은 쪽은 엔진이 CANCELLED 로 내린다(예정업무에 남지 않게)
        if opened and all(st == "CANCELLED" for a, st in status.items() if a not in opened):
            return ",".join(opened)
        time.sleep(3)
    return f"(없음: {rows.replace(chr(10), ' ')})"


def chosen_supplier(report: str) -> str | None:
    """보고서 첫 결론 문장에서 고른 공급사(A/B)."""
    # 보고 순서: 비교표 → 판단(결론) → 근거. 결론 단락에서 처음 나오는 공급사를 고른 것으로 본다.
    m = re.search(r"판단\s*\(?결론\)?(.*?)(?:#+\s*근거|$)", report, re.S)
    found = re.findall(r"([AB])\s*공급사", m.group(1) if m else report)
    return found[0] if found else None


def run_case(name, proc, keyword, want_mode, want_supplier, want_branch) -> bool:
    inst = start(proc)
    asked = None
    if keyword:
        wait_question(inst, "Task_Decide")
        asked = answer(inst, keyword)
    wait(inst, {"DONE"})
    out = json.loads(sql(f"select output::text from todolist where proc_inst_id={q(inst)} and activity_id='Task_Decide'"))
    mode = decision_mode(inst, "Task_Decide", out)
    report = report_of(out)
    supplier = chosen_supplier(report)
    chosen = form_of(out).get("decision_chosen")
    branch = inspect_branch(inst, proc) if want_branch else None
    ok = mode == want_mode and supplier == want_supplier and branch == want_branch
    print(f"{'OK ' if ok else 'BAD'} {name:<9} mode={str(mode):<12} 공급사={supplier} (기대 {want_mode}/{want_supplier})"
          f"{' 답=' + asked if asked else ''}{f'  적용 기준={chosen} → {branch} (기대 {want_branch})' if want_branch else ''}  {inst}")
    if not ok:
        print("    " + report[:400].replace("\n", "\n    "))
    return ok


# 통합(생산라인 증설) — 한 인스턴스에서 판단 단계 3개가 차례로: (활동, 기대 모드, 기대 공급사)
EXPANSION = [("Task_Packaging", "aligned", "A"), ("Task_Core", "priority", "B"), ("Task_Parts", "user_choice", None)]


def run_expansion(keyword: str = "품질") -> bool:
    inst = start("ont-dec-expansion")
    oks = []
    for activity, want_mode, want_supplier in EXPANSION:
        if want_mode == "user_choice":
            wait_question(inst, activity)
            asked = answer(inst, keyword)
            want_supplier = "B" if keyword == "품질" else "A"
        wait(inst, {"DONE"}, timeout=360, activity=activity)
        out = json.loads(sql(f"select output::text from todolist where proc_inst_id={q(inst)} and activity_id={q(activity)}"))
        mode = decision_mode(inst, activity, out)
        supplier = chosen_supplier(report_of(out))
        ok = mode == want_mode and supplier == want_supplier
        oks.append(ok)
        print(f"{'OK ' if ok else 'BAD'} 통합/{activity:<15} mode={str(mode):<12} 공급사={supplier} (기대 {want_mode}/{want_supplier})"
              f"{' 답=' + asked if want_mode == 'user_choice' else ''}")
    want_branch = "Task_Inspect" if keyword == "품질" else "Task_Inspect_Strict"
    branch = inspect_branch(inst, "ont-dec-expansion")
    oks.append(branch == want_branch)
    print(f"{'OK ' if branch == want_branch else 'BAD'} 통합/검수 분기       → {branch} (기대 {want_branch})  {inst}")
    return all(oks)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", type=int, default=1)
    ap.add_argument("--only", choices=["cases", "expansion"], help="한쪽만 점검")
    ap.add_argument("--email", help="시작·사람 단계를 맡을 계정(tym) — 기본은 시드 담당 manual-shots")
    args = ap.parse_args()
    if args.email:
        global EMAIL, USER_ID
        EMAIL = args.email
        USER_ID = sql(f"select id from public.users where email={q(args.email)} and tenant_id='tym'")
        if not USER_ID:
            sys.exit(f"tym 테넌트에 {args.email} 계정이 없습니다")
    results = []
    for _ in range(args.runs):
        if args.only != "expansion":
            results += [run_case(*c) for c in CASES]
        if args.only != "cases":
            results.append(run_expansion("단가"))
    print(f"\n{sum(results)}/{len(results)} 통과")
    sys.exit(0 if all(results) else 1)


if __name__ == "__main__":
    main()
