"""데모 시드가 함께 쓰는 BPMN 생성기 (spec 015·016).

레인·활동·게이트와 함께 시스템(활동 확장 속성 `systems`), 데이터 객체·연결선(dataInput/OutputAssociation),
끝 이벤트의 프로세스 인계(`definitionIds`)를 그린다 — PAL 정의 화면이 직접 입력할 때와 같은 형식이라 화면에서 보이고
고칠 수 있으며, strategy-service 구조 인제스천(app/process_structure.py)이 그대로 읽는다.

    build_bpmn(proc_id, name, lanes, acts, gate=None, task_systems={}, data_flow={}, handoff_to=None) -> str

- lanes: 레인 이름 목록(위→아래)
- acts: [{"id", "name", "lane", "kind"(userTask|serviceTask), "desc"}] — 순서대로 한 줄
- gate: (게이트 이름, 반려 시 돌아갈 활동 id, 게이트 앞 활동 id) 또는 None
- task_systems: 활동 id → 시스템 이름 목록
- data_flow: 활동 id → (읽는 데이터 이름 목록, 쓰는 데이터 이름 목록)
- handoff_to: 끝 이벤트가 업무를 넘기는 proc_def id
- branch: 배타 분기 {"id", "name", "after"(분기 앞 활동 id), "paths": [{"flow", "label", "condition", "act"}]} 또는 None —
  분기한 활동들은 같은 열에(각자 레인에) 놓이고 끝 이벤트로 모인다. condition 은 연결선 조건식(conditionFunction)
"""

import json
from html import escape

LANE_H, X0, STEP = 170, 260, 175


def build_bpmn(proc_id: str, name: str, lanes: list[str], acts: list[dict], gate=None,
               task_systems: dict | None = None, data_flow: dict | None = None, handoff_to: str | None = None,
               branch: dict | None = None) -> str:
    task_systems = task_systems or {}
    data_flow = data_flow or {}
    pid = proc_id.replace("-", "_")
    lane_y = {lane: 80 + i * LANE_H for i, lane in enumerate(lanes)}

    nodes = []  # (id, kind, name, lane, x)
    slots = []  # 열 단위 노드 id — 분기한 활동은 한 열에 여럿
    x = X0
    nodes.append(("Start", "startEvent", "시작", acts[0]["lane"], 190))
    slots.append(["Start"])
    branch_acts = [p["act"] for p in branch["paths"]] if branch else []
    for a in acts:
        nodes.append((a["id"], a["kind"], a["name"], a["lane"], x))
        slots.append([a["id"]])
        x += STEP
        if gate and a["id"] == gate[2]:
            nodes.append(("Gate", "exclusiveGateway", gate[0], a["lane"], x - 20))
            slots.append(["Gate"])
            x += 110
        if branch and a["id"] == branch["after"]:
            nodes.append((branch["id"], "exclusiveGateway", branch["name"], a["lane"], x - 20))
            slots.append([branch["id"]])
            x += 110
            for b in branch_acts:
                nodes.append((b["id"], b["kind"], b["name"], b["lane"], x))
            slots.append([b["id"] for b in branch_acts])
            x += STEP
    nodes.append(("End", "endEvent", "완료", (branch_acts or acts)[-1]["lane"], x))
    slots.append(["End"])
    width = x + 120

    path_of = {p["act"]["id"]: p for p in branch["paths"]} if branch else {}
    flows = []
    flow_cond: dict[str, str] = {}
    for s1, s2 in zip(slots, slots[1:]):
        for a in s1:
            for b in s2:
                if branch and a == branch["id"]:
                    p = path_of[b]
                    flows.append((p["flow"], a, b, p["label"]))
                    flow_cond[p["flow"]] = p["condition"]
                else:
                    flows.append((f"Flow_{a}_{b}", a, b, "예" if a == "Gate" else ""))
    if gate:
        flows.append(("Flow_Gate_back", "Gate", gate[1], "보완"))

    def props_json(aid: str, desc: str, procedure: list[str]) -> str:
        body = {"description": desc, "procedure": procedure, "manualLinks": [],
                "systems": [{"name": n} for n in task_systems.get(aid, [])], "input": [], "output": []}
        return escape(json.dumps(body, ensure_ascii=False), quote=True)

    # 이 프로세스가 쓰는 데이터 객체 — 처음 나온 활동 아래에 그린다
    data_names: list[str] = []
    for a in acts:
        reads, writes = data_flow.get(a["id"], ([], []))
        for dname in reads + writes:
            if dname not in data_names:
                data_names.append(dname)
    data_ref = {dname: f"DOR_{i}" for i, dname in enumerate(data_names)}

    desc_of = {a["id"]: a.get("desc") or "" for a in [*acts, *branch_acts]}
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" '
        'xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" '
        'xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:uengine="http://uengine" '
        f'id="Defs_{pid}" targetNamespace="http://uengine.org/bpmn">',
        f'  <bpmn:collaboration id="Collab_{pid}"><bpmn:participant id="Pool_{pid}" name="{escape(name)}" processRef="Proc_{pid}" /></bpmn:collaboration>',
        f'  <bpmn:process id="Proc_{pid}" name="{escape(name)}" isExecutable="true">',
        '    <bpmn:laneSet id="LaneSet_1">',
    ]
    for i, lane in enumerate(lanes):
        refs = "".join(f"<bpmn:flowNodeRef>{n[0]}</bpmn:flowNodeRef>" for n in nodes if n[3] == lane)
        lines.append(f'      <bpmn:lane id="Lane_{i}" name="{escape(lane)}">{refs}</bpmn:lane>')
    lines.append("    </bpmn:laneSet>")
    for nid, kind, node_name, _lane, _x in nodes:
        inc = "".join(f"<bpmn:incoming>{f[0]}</bpmn:incoming>" for f in flows if f[2] == nid)
        out = "".join(f"<bpmn:outgoing>{f[0]}</bpmn:outgoing>" for f in flows if f[1] == nid)
        ext = assoc = ""
        if kind in ("userTask", "serviceTask"):
            ext = (f'<bpmn:extensionElements><uengine:properties json="{props_json(nid, desc_of[nid], [desc_of[nid]])}" />'
                   "</bpmn:extensionElements>")
            reads, writes = data_flow.get(nid, ([], []))
            for dname in reads:
                assoc += (f'<bpmn:dataInputAssociation id="DIA_{nid}_{data_ref[dname]}"><bpmn:sourceRef>{data_ref[dname]}</bpmn:sourceRef>'
                          f'<bpmn:targetRef>Prop_{nid}</bpmn:targetRef></bpmn:dataInputAssociation>')
            for dname in writes:
                assoc += (f'<bpmn:dataOutputAssociation id="DOA_{nid}_{data_ref[dname]}"><bpmn:targetRef>{data_ref[dname]}</bpmn:targetRef>'
                          '</bpmn:dataOutputAssociation>')
        elif kind == "endEvent" and handoff_to:
            ref = escape(json.dumps({"definitionIds": [f"{handoff_to}.bpmn"]}), quote=True)
            ext = f'<bpmn:extensionElements><uengine:properties json="{ref}" /></bpmn:extensionElements>'
        lines.append(f'    <bpmn:{kind} id="{nid}" name="{escape(node_name)}">{ext}{inc}{out}{assoc}</bpmn:{kind}>')
    for dname, ref in data_ref.items():
        lines.append(f'    <bpmn:dataObjectReference id="{ref}" name="{escape(dname)}" dataObjectRef="DO_{ref}" />'
                     f'<bpmn:dataObject id="DO_{ref}" />')
    for fid, a, b, label in flows:
        if fid in flow_cond:
            cond = escape(json.dumps({"conditionFunction": flow_cond[fid]}, ensure_ascii=False), quote=True)
            lines.append(f'    <bpmn:sequenceFlow id="{fid}" name="{escape(label)}" sourceRef="{a}" targetRef="{b}">'
                         f'<bpmn:extensionElements><uengine:properties json="{cond}" /></bpmn:extensionElements></bpmn:sequenceFlow>')
            continue
        lines.append(f'    <bpmn:sequenceFlow id="{fid}" name="{label}" sourceRef="{a}" targetRef="{b}" />')
    lines.append("  </bpmn:process>")
    lines.append('  <bpmndi:BPMNDiagram id="Diagram_1">')
    lines.append(f'    <bpmndi:BPMNPlane id="Plane_1" bpmnElement="Collab_{pid}">')
    total_h = LANE_H * len(lanes)
    lines.append(f'      <bpmndi:BPMNShape id="Pool_{pid}_di" bpmnElement="Pool_{pid}" isHorizontal="true">'
                 f'<dc:Bounds x="120" y="80" width="{width - 120}" height="{total_h}" /></bpmndi:BPMNShape>')
    for i, lane in enumerate(lanes):
        lines.append(f'      <bpmndi:BPMNShape id="Lane_{i}_di" bpmnElement="Lane_{i}" isHorizontal="true">'
                     f'<dc:Bounds x="150" y="{lane_y[lane]}" width="{width - 150}" height="{LANE_H}" /></bpmndi:BPMNShape>')
    geo = {}
    for nid, kind, _name, lane, nx in nodes:
        cy = lane_y[lane] + LANE_H // 2
        if kind in ("userTask", "serviceTask"):
            b = (nx, cy - 40, 130, 80)
        elif kind == "exclusiveGateway":
            b = (nx, cy - 25, 50, 50)
        else:
            b = (nx, cy - 18, 36, 36)
        geo[nid] = b
        marker = ' isMarkerVisible="true"' if kind == "exclusiveGateway" else ""
        lines.append(f'      <bpmndi:BPMNShape id="{nid}_di" bpmnElement="{nid}"{marker}>'
                     f'<dc:Bounds x="{b[0]}" y="{b[1]}" width="{b[2]}" height="{b[3]}" /><bpmndi:BPMNLabel /></bpmndi:BPMNShape>')
    first_use = {}
    for a in acts:
        reads, writes = data_flow.get(a["id"], ([], []))
        for dname in reads + writes:
            first_use.setdefault(dname, a["id"])
    used_x: dict[int, int] = {}
    data_y = 80 + total_h + 40
    for dname, ref in data_ref.items():
        tx = geo[first_use[dname]][0]
        slot = used_x.get(tx, 0)
        used_x[tx] = slot + 1
        dx, dy = tx + slot * 60, data_y + (slot % 2) * 70
        geo[ref] = (dx, dy, 36, 50)
        lines.append(f'      <bpmndi:BPMNShape id="{ref}_di" bpmnElement="{ref}"><dc:Bounds x="{dx}" y="{dy}" width="36" height="50" />'
                     '<bpmndi:BPMNLabel /></bpmndi:BPMNShape>')
    for a in acts:
        aid = a["id"]
        reads, writes = data_flow.get(aid, ([], []))
        tx, ty, tw, th = geo[aid]
        for dname, eid in [(n, f"DIA_{aid}_{data_ref[n]}") for n in reads] + [(n, f"DOA_{aid}_{data_ref[n]}") for n in writes]:
            dx, dy, dw, _dh = geo[data_ref[dname]]
            lines.append(f'      <bpmndi:BPMNEdge id="{eid}_di" bpmnElement="{eid}"><di:waypoint x="{dx + dw // 2}" y="{dy}" />'
                         f'<di:waypoint x="{tx + tw // 2}" y="{ty + th}" /></bpmndi:BPMNEdge>')
    for fid, a, b, _label in flows:
        ax, ay, aw, ah = geo[a]
        bx, by, bw, bh = geo[b]
        if fid == "Flow_Gate_back":
            top = min(ay, by) - 30
            pts = [(ax + aw // 2, ay), (ax + aw // 2, top), (bx + bw // 2, top), (bx + bw // 2, by)]
        else:
            pts = [(ax + aw, ay + ah // 2), (bx, by + bh // 2)]
            if pts[0][1] != pts[1][1]:
                mx = (pts[0][0] + pts[1][0]) // 2
                pts = [pts[0], (mx, pts[0][1]), (mx, pts[1][1]), pts[1]]
        wps = "".join(f'<di:waypoint x="{px}" y="{py}" />' for px, py in pts)
        lines.append(f'      <bpmndi:BPMNEdge id="{fid}_di" bpmnElement="{fid}">{wps}</bpmndi:BPMNEdge>')
    lines += ["    </bpmndi:BPMNPlane>", "  </bpmndi:BPMNDiagram>", "</bpmn:definitions>"]
    return "\n".join(lines)
