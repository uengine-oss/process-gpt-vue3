#!/usr/bin/env python3
"""온톨로지 E2E 가이드(spec 017) 데모 정리 — 녹화를 처음 상태에서 다시 하기 위해 쓴다.

    python3 scripts/demo/ontology-e2e/cleanup.py          # 지운다
    python3 scripts/demo/ontology-e2e/cleanup.py --dry    # 무엇을 지울지 보여만 준다

tym 테넌트에서 이름이 '구매 KPI 주간 점검'인 프로세스 정의(화면 업로드로 만든 것, id 는 kpi-<타임스탬프>)와
그 버전·체계도(proc_map) 항목·실행 인스턴스·워크아이템·실행 기록, 그리고 전략 보드에서 추가한
KPI 'KPI 주간 점검 완료 건수'를 지운다. 끝나면 온톨로지를 전체 재동기화해 그래프에서도 사라지게 한다.
로컬 supabase(docker supabase_db_process-gpt-vue3)·strategy-service(127.0.0.1:8014) 전용.
"""
import json
import subprocess
import sys
import urllib.request

TENANT = "tym"
PROC_NAME = "구매 KPI 주간 점검"
KPI_NAME = "KPI 주간 점검 완료 건수"
STRATEGY = "http://127.0.0.1:8014"
DRY = "--dry" in sys.argv


def psql(sql: str) -> str:
    out = subprocess.run(
        ["docker", "exec", "-i", "supabase_db_process-gpt-vue3", "psql", "-U", "postgres", "-d", "postgres",
         "-At", "-v", "ON_ERROR_STOP=1"],
        input=sql, capture_output=True, text=True, check=True)
    return out.stdout.strip()


def q(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def api(method: str, path: str):
    req = urllib.request.Request(STRATEGY + path, method=method)
    with urllib.request.urlopen(req, timeout=120) as r:
        body = r.read().decode() or "null"
    return json.loads(body)


def prune(node, ids: set[str]) -> int:
    """proc_map JSON 에서 id 가 ids 인 항목을 부모 목록에서 뺀다."""
    removed = 0
    if isinstance(node, dict):
        for v in node.values():
            removed += prune(v, ids)
    elif isinstance(node, list):
        keep = [x for x in node if not (isinstance(x, dict) and str(x.get("id")) in ids)]
        removed += len(node) - len(keep)
        node[:] = keep
        for x in node:
            removed += prune(x, ids)
    return removed


def main() -> None:
    ids = [r for r in psql(
        f"select id from public.proc_def where tenant_id = {q(TENANT)} and name = {q(PROC_NAME)}").splitlines() if r]
    insts = [r for r in psql(
        f"select proc_inst_id from public.bpm_proc_inst where tenant_id = {q(TENANT)} and proc_def_id in "
        f"({','.join(q(i) for i in ids) or 'null'})").splitlines() if r] if ids else []
    kpis = []
    for o in api("GET", f"/api/map?tenant_id={TENANT}").get("objectives", []):
        kpis += [k["id"] for k in o.get("kpis", []) if k.get("name") == KPI_NAME]
    print(f"프로세스 {ids or '-'} · 인스턴스 {len(insts)} · KPI {kpis or '-'}")
    if DRY:
        return

    if ids:
        id_list = ",".join(q(i) for i in ids)
        inst_like = " or ".join(f"id like {q(i + '%')}" for i in insts) or "false"
        psql(f"""
begin;
delete from public.todolist where tenant_id = {q(TENANT)} and proc_def_id in ({id_list});
delete from public.bpm_proc_inst where tenant_id = {q(TENANT)} and proc_def_id in ({id_list});
delete from public.chats where {inst_like};
delete from public.chat_rooms where {inst_like};
delete from public.task_execution_properties where proc_def_id in ({id_list});
delete from public.app_usage_events where proc_def_id in ({id_list});
delete from public.form_def where tenant_id = {q(TENANT)} and proc_def_id in ({id_list});
delete from public.proc_def_version where proc_def_id in ({id_list});
delete from public.proc_def where tenant_id = {q(TENANT)} and id in ({id_list});
commit;
""")
        raw = psql(f"select value::text from public.configuration where tenant_id = {q(TENANT)} and key = 'proc_map'")
        if raw:
            pm = json.loads(raw)
            n = prune(pm, set(ids))
            if n:
                body = json.dumps(pm, ensure_ascii=False)
                psql(f"update public.configuration set value = $pm${body}$pm$::jsonb "
                     f"where tenant_id = {q(TENANT)} and key = 'proc_map';")
            print(f"proc_map 항목 {n}개 제거")
    for kid in kpis:
        api("DELETE", f"/api/kpis/{kid}?tenant_id={TENANT}")
    res = api("POST", f"/api/ontology/sync?tenant_id={TENANT}&full=true")
    print("온톨로지 재동기화:", {k: res.get(k) for k in ("processes", "execution")})


if __name__ == "__main__":
    main()
