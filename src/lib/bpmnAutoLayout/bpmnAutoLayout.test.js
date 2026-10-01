// node:test 포팅 — 원본은 playground-pi-system-web/src/lib/bpmnAutoLayout/bpmnAutoLayout.spec.ts (vitest).
// 실행: npm run test:unit  (js/esm 빌드를 검사하므로 소스 수정 후 ./build.sh 먼저)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function expect(actual) {
    const build = (negate) => ({
        toBe: (e) => (negate ? assert.notStrictEqual(actual, e) : assert.strictEqual(actual, e)),
        toEqual: (e) => (negate ? assert.notDeepStrictEqual(actual, e) : assert.deepStrictEqual(actual, e)),
        toContain: (e) => {
            const has = typeof actual === 'string' ? actual.includes(e) : Array.from(actual).includes(e);
            assert.ok(negate ? !has : has, `expected ${JSON.stringify(actual)} ${negate ? 'not ' : ''}to contain ${JSON.stringify(e)}`);
        },
        toHaveLength: (n) => assert.strictEqual(actual.length, n),
        toBeGreaterThan: (n) => assert.ok(actual > n, `${actual} > ${n}`),
        toBeGreaterThanOrEqual: (n) => assert.ok(actual >= n, `${actual} >= ${n}`),
        toBeLessThan: (n) => assert.ok(actual < n, `${actual} < ${n}`),
        toBeLessThanOrEqual: (n) => assert.ok(actual <= n, `${actual} <= ${n}`),
        toBeTruthy: () => assert.ok(negate ? !actual : actual),
        toBeDefined: () => assert.ok(negate ? actual === undefined : actual !== undefined)
    });
    return { ...build(false), not: build(true) };
}
import { autoLayoutBpmnXml, computeBpmnLayout, isOrthogonalPath } from './js/esm/bpmnAutoLayout.mjs';
const HEADER = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Defs_1" targetNamespace="http://bpmn.io/schema/bpmn">`;
/** 4레인 · 분기/합류 · 재작업 루프 · 경계 이벤트 — LLM 이 좌표를 엉망으로 준 상황 */
const MESSY_XML = `${HEADER}
  <bpmn:collaboration id="Collab_1">
    <bpmn:participant id="Participant_1" name="점용료 납부" processRef="Process_1" />
  </bpmn:collaboration>
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:laneSet id="LaneSet_1">
      <bpmn:lane id="Lane_A" name="담당자">
        <bpmn:flowNodeRef>Start_1</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_A1</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>GW_Split</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_A2</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>GW_Join</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>End_1</bpmn:flowNodeRef>
      </bpmn:lane>
      <bpmn:lane id="Lane_B" name="검토자">
        <bpmn:flowNodeRef>Task_B1</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>GW_Review</bpmn:flowNodeRef>
      </bpmn:lane>
      <bpmn:lane id="Lane_C" name="승인자">
        <bpmn:flowNodeRef>Task_C1</bpmn:flowNodeRef>
      </bpmn:lane>
      <bpmn:lane id="Lane_D" name="시스템">
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="Start_1" name="시작" />
    <bpmn:userTask id="Task_A1" name="신청서 작성" />
    <bpmn:exclusiveGateway id="GW_Split" name="자동 산정 가능?" />
    <bpmn:serviceTask id="Task_D1" name="자동 산정" />
    <bpmn:userTask id="Task_A2" name="수동 산정" />
    <bpmn:exclusiveGateway id="GW_Join" />
    <bpmn:userTask id="Task_B1" name="검토">
      <bpmn:standardLoopCharacteristics />
    </bpmn:userTask>
    <bpmn:boundaryEvent id="Boundary_1" attachedToRef="Task_B1">
      <bpmn:timerEventDefinition />
    </bpmn:boundaryEvent>
    <bpmn:exclusiveGateway id="GW_Review" name="보완 필요?" />
    <bpmn:userTask id="Task_C1" name="승인" />
    <bpmn:endEvent id="End_1" name="종료" />
    <bpmn:sequenceFlow id="F1" sourceRef="Start_1" targetRef="Task_A1" />
    <bpmn:sequenceFlow id="F2" sourceRef="Task_A1" targetRef="GW_Split" />
    <bpmn:sequenceFlow id="F3" sourceRef="GW_Split" targetRef="Task_D1" name="예" />
    <bpmn:sequenceFlow id="F4" sourceRef="GW_Split" targetRef="Task_A2" name="아니오" />
    <bpmn:sequenceFlow id="F5" sourceRef="Task_D1" targetRef="GW_Join" />
    <bpmn:sequenceFlow id="F6" sourceRef="Task_A2" targetRef="GW_Join" />
    <bpmn:sequenceFlow id="F7" sourceRef="GW_Join" targetRef="Task_B1" />
    <bpmn:sequenceFlow id="F8" sourceRef="Task_B1" targetRef="GW_Review" />
    <bpmn:sequenceFlow id="F9" sourceRef="GW_Review" targetRef="Task_A1" name="보완" />
    <bpmn:sequenceFlow id="F10" sourceRef="GW_Review" targetRef="Task_C1" name="승인 요청" />
    <bpmn:sequenceFlow id="F11" sourceRef="Task_C1" targetRef="End_1" />
    <bpmn:sequenceFlow id="F12" sourceRef="Boundary_1" targetRef="Task_C1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collab_1">
      <bpmndi:BPMNShape id="Participant_1_di" bpmnElement="Participant_1" isHorizontal="true">
        <dc:Bounds x="100" y="100" width="900" height="500" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_A1_di" bpmnElement="Task_A1"><dc:Bounds x="200" y="120" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_A2_di" bpmnElement="Task_A2"><dc:Bounds x="200" y="120" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="F1_di" bpmnElement="F1"><di:waypoint x="0" y="0" /><di:waypoint x="900" y="500" /></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
const TINY_XML = `${HEADER}
  <bpmn:process id="Process_1">
    <bpmn:startEvent id="S" />
    <bpmn:task id="T" />
    <bpmn:endEvent id="E" />
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="T" />
    <bpmn:sequenceFlow id="F2" sourceRef="T" targetRef="E" />
  </bpmn:process>
</bpmn:definitions>`;
function overlaps(a, b) {
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
describe('autoLayoutBpmnXml', () => {
    const laid = computeBpmnLayout(MESSY_XML);
    const shape = (id) => laid.shapes.find((s) => s.id === id);
    const edge = (id) => laid.edges.find((e) => e.id === id);
    it('모든 flow node 가 선행보다 오른쪽 열에 놓인다 (역방향 루프 제외)', () => {
        const forward = [
            ['Start_1', 'Task_A1'],
            ['Task_A1', 'GW_Split'],
            ['GW_Split', 'Task_D1'],
            ['GW_Split', 'Task_A2'],
            ['Task_D1', 'GW_Join'],
            ['Task_A2', 'GW_Join'],
            ['GW_Join', 'Task_B1'],
            ['Task_B1', 'GW_Review'],
            ['GW_Review', 'Task_C1'],
            ['Task_C1', 'End_1']
        ];
        for (const [s, t] of forward) {
            expect(shape(t).x, `${s} -> ${t}`).toBeGreaterThan(shape(s).x + shape(s).w);
        }
    });
    it('같은 레인 안에서 도형이 겹치지 않고, 노드는 자기 레인 안에 있다', () => {
        const nodes = laid.shapes.filter((s) => !['participant', 'lane'].includes(s.type) && s.type !== 'boundaryEvent');
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                expect(overlaps(nodes[i], nodes[j]), `${nodes[i].id} vs ${nodes[j].id}`).toBe(false);
            }
        }
        const laneOf = {
            Start_1: 'Lane_A',
            Task_A1: 'Lane_A',
            GW_Split: 'Lane_A',
            Task_A2: 'Lane_A',
            GW_Join: 'Lane_A',
            End_1: 'Lane_A',
            Task_B1: 'Lane_B',
            GW_Review: 'Lane_B',
            Task_C1: 'Lane_C'
        };
        for (const [id, laneId] of Object.entries(laneOf)) {
            const n = shape(id);
            const lane = shape(laneId);
            expect(n.y, `${id} top in ${laneId}`).toBeGreaterThanOrEqual(lane.y);
            expect(n.y + n.h, `${id} bottom in ${laneId}`).toBeLessThanOrEqual(lane.y + lane.h);
        }
    });
    it('레인은 참여자 안에서 세로로 빈틈없이 쌓인다', () => {
        const p = shape('Participant_1');
        const lanes = ['Lane_A', 'Lane_B', 'Lane_C', 'Lane_D'].map(shape);
        expect(lanes[0].y).toBe(p.y);
        for (let i = 1; i < lanes.length; i++) expect(lanes[i].y).toBe(lanes[i - 1].y + lanes[i - 1].h);
        expect(lanes[3].y + lanes[3].h).toBe(p.y + p.h);
        for (const l of lanes) expect(l.x + l.w).toBe(p.x + p.w);
    });
    it('모든 sequenceFlow 는 수평/수직 구간만으로 이루어진다', () => {
        for (const e of laid.edges) expect(isOrthogonalPath(e.points), e.id).toBe(true);
        expect(laid.edges.map((e) => e.id).sort()).toEqual(
            ['F1', 'F10', 'F11', 'F12', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9'].sort()
        );
    });
    it('분기 게이트웨이: 주 행은 직선, 다른 행은 위/아래 꼭짓점에서 수직 출발', () => {
        const gw = shape('GW_Split');
        const main = edge('F3').points.length === 2 ? edge('F3') : edge('F4');
        const side = main.id === 'F3' ? edge('F4') : edge('F3');
        expect(main.points).toHaveLength(2);
        expect(main.points[0].x).toBe(gw.x + gw.w);
        expect(side.points[0].x).toBe(gw.x + gw.w / 2);
        expect([gw.y, gw.y + gw.h]).toContain(side.points[0].y);
        expect(side.points[0].x).toBe(side.points[1].x);
    });
    it('합류 게이트웨이: 다른 행에서 오는 선은 수평 후 수직 진입', () => {
        const gw = shape('GW_Join');
        const straight = edge('F5').points.length === 2 ? edge('F5') : edge('F6');
        const fromD = straight.id === 'F5' ? edge('F6') : edge('F5');
        expect(straight.points).toHaveLength(2);
        const last = fromD.points[fromD.points.length - 1];
        expect(last.x).toBe(gw.x + gw.w / 2);
        expect([gw.y, gw.y + gw.h]).toContain(last.y);
    });
    it('역방향 루프는 도형 아래 여백으로 돌아간다', () => {
        const back = edge('F9');
        const src = shape('GW_Review');
        const dst = shape('Task_A1');
        expect(back.points[0].y).toBe(src.y + src.h);
        expect(back.points[back.points.length - 1].y).toBe(dst.y + dst.h);
        expect(Math.max(...back.points.map((p) => p.y))).toBeGreaterThan(Math.max(src.y + src.h, dst.y + dst.h));
    });
    it('경계 이벤트는 호스트 아래 변에 붙는다', () => {
        const host = shape('Task_B1');
        const b = shape('Boundary_1');
        expect(b.y + b.h / 2).toBe(host.y + host.h);
        expect(b.x).toBeGreaterThanOrEqual(host.x);
        expect(b.x + b.w).toBeLessThanOrEqual(host.x + host.w);
        const out = edge('F12');
        expect(out.points[0].y).toBe(b.y + b.h);
    });
    it('레인 미배정 노드는 선행 레인에 배치되고 flowNodeRef 를 보강한다', () => {
        expect(laid.addedLaneRefs).toEqual([
            { laneId: 'Lane_A', nodeId: 'Task_D1' },
            { laneId: 'Lane_B', nodeId: 'Boundary_1' }
        ]);
        const result = autoLayoutBpmnXml(MESSY_XML);
        expect(result.changed).toBe(true);
        const laneA = /<bpmn:lane id="Lane_A"[\s\S]*?<\/bpmn:lane>/.exec(result.xml)[0];
        expect(laneA).toContain('<bpmn:flowNodeRef>Task_D1</bpmn:flowNodeRef>');
        const laneB = /<bpmn:lane id="Lane_B"[\s\S]*?<\/bpmn:lane>/.exec(result.xml)[0];
        expect(laneB).toContain('<bpmn:flowNodeRef>Boundary_1</bpmn:flowNodeRef>');
    });
    it('기존 bpmndi 는 통째로 교체되고 모든 요소에 DI 가 생긴다', () => {
        const result = autoLayoutBpmnXml(MESSY_XML);
        expect((result.xml.match(/<bpmndi:BPMNDiagram/g) || []).length).toBe(1);
        expect(result.xml).not.toContain('x="0" y="0"');
        expect(result.xml).toContain('bpmnElement="Collab_1"');
        for (const id of ['Participant_1', 'Lane_A', 'Lane_D', 'Start_1', 'Task_D1', 'Boundary_1', 'End_1']) {
            expect(result.xml, id).toContain(`bpmnElement="${id}"`);
        }
        for (let i = 1; i <= 12; i++) expect(result.xml).toContain(`<bpmndi:BPMNEdge id="F${i}_di" bpmnElement="F${i}">`);
        // 프로세스 본문은 그대로
        expect(result.xml).toContain('<bpmn:userTask id="Task_A1" name="신청서 작성" />');
        expect(result.xml.trim().endsWith('</bpmn:definitions>')).toBe(true);
    });
    it('레인·참여자 없는 최소 프로세스도 배치된다 (plane = process)', () => {
        const result = autoLayoutBpmnXml(TINY_XML);
        expect(result.changed).toBe(true);
        expect(result.xml).toContain('bpmnElement="Process_1"');
        expect(result.xml).toContain('bpmnElement="S"');
        expect(result.xml).toContain('bpmnElement="F2"');
        const l = computeBpmnLayout(TINY_XML);
        const s = l.shapes.find((x) => x.id === 'S');
        const t = l.shapes.find((x) => x.id === 'T');
        expect(t.x).toBeGreaterThan(s.x + s.w);
        expect(s.y + s.h / 2).toBe(t.y + t.h / 2);
    });
    it('빈 입력·definitions 없음은 원문을 그대로 돌려준다', () => {
        expect(autoLayoutBpmnXml('').changed).toBe(false);
        const junk = '<foo><bar/></foo>';
        const r = autoLayoutBpmnXml(junk);
        expect(r.changed).toBe(false);
        expect(r.xml).toBe(junk);
    });
});
