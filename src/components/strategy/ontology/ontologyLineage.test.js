import test from 'node:test';
import assert from 'node:assert/strict';
import {
    STAGES,
    applyColumns,
    buildIndex,
    computeMetrics,
    coursePath,
    kpiAchievement,
    layoutWaterfall,
    lineageOf,
    stageCounts,
    stageIndex,
    stageOf,
    strategyConnected
} from './ontologyLineage.js';

// 전략 2단 → KPI → 프로세스 → 태스크 2 → 인스턴스 → 워크아이템 2 → 사용자 → 팀, + 무관한 프로세스·사용자 업무
const n = (id, label, properties = {}) => ({ id, label, name: id, properties });
const e = (rel_type, source, target) => ({ rel_type, source, target });
const graph = {
    nodes: [
        n('S1', 'Strategy'),
        n('S2', 'Strategy'),
        n('K1', 'KPI', { current_value: 6, target_value: 10, baseline_value: 0 }),
        n('P1', 'Process'),
        n('T1', 'Task'),
        n('T2', 'Task'),
        n('I1', 'ProcessInstance', { status: 'COMPLETED', duration_hours: 10, is_overdue: true }),
        n('W1', 'WorkItem', { duration_hours: 2 }),
        n('W2', 'WorkItem', { duration_hours: 8 }),
        n('U1', 'User'),
        n('TEAM', 'Team'),
        n('P2', 'Process'),
        n('T9', 'Task'),
        n('I9', 'ProcessInstance', { status: 'RUNNING' }),
        n('W9', 'WorkItem'),
        n('C1', 'Canvas')
    ],
    edges: [
        e('HAS_SUB_STRATEGY', 'S1', 'S2'),
        e('HAS_KPI', 'S2', 'K1'),
        e('IMPACTS_KPI', 'P1', 'K1'),
        e('CONTAINS_TASK', 'P1', 'T1'),
        e('CONTAINS_TASK', 'P1', 'T2'),
        e('HAS_INSTANCE', 'P1', 'I1'),
        e('HAS_WORK_ITEM', 'I1', 'W1'),
        e('HAS_WORK_ITEM', 'I1', 'W2'),
        e('EXECUTES_TASK', 'W1', 'T1'),
        e('EXECUTES_TASK', 'W2', 'T2'),
        e('ASSIGNED_TO', 'W1', 'U1'),
        e('MEMBER_OF', 'U1', 'TEAM'),
        // U1 이 무관한 프로세스 P2 의 업무도 했다 — 체인에 섞이면 안 된다
        e('CONTAINS_TASK', 'P2', 'T9'),
        e('HAS_INSTANCE', 'P2', 'I9'),
        e('HAS_WORK_ITEM', 'I9', 'W9'),
        e('EXECUTES_TASK', 'W9', 'T9'),
        e('ASSIGNED_TO', 'W9', 'U1'),
        e('HAS_BLOCK', 'C1', 'S1')
    ]
};

test('단계 밖 라벨과 그 엣지는 색인에서 빠진다', () => {
    const idx = buildIndex(graph);
    assert.equal(idx.nodes.has('C1'), false);
    assert.equal(
        idx.edges.some((x) => x.rel_type === 'HAS_BLOCK'),
        false
    );
});

test('KPI 체인: 상위 전략 2단 + 하류 실행·담당자·팀, 무관한 프로세스는 제외', () => {
    const idx = buildIndex(graph);
    const { nodes } = lineageOf(idx, 'K1');
    for (const id of ['S1', 'S2', 'K1', 'P1', 'T1', 'T2', 'I1', 'W1', 'W2', 'U1', 'TEAM']) assert.ok(nodes.has(id), id);
    for (const id of ['P2', 'T9', 'I9', 'W9']) assert.equal(nodes.has(id), false, id);
});

test('사용자 체인은 상류로 수행한 업무 → 프로세스 → KPI → 전략까지 거슬러 오른다', () => {
    const idx = buildIndex(graph);
    const { nodes } = lineageOf(idx, 'U1');
    for (const id of ['W1', 'W9', 'I1', 'I9', 'T1', 'T9', 'P1', 'P2', 'K1', 'S2', 'S1', 'TEAM']) assert.ok(nodes.has(id), id);
    // 같은 인스턴스의 다른 사람 업무(W2)는 사용자 체인이 아니다
    assert.equal(nodes.has('W2'), false);
});

test('인스턴스 체인은 프로세스·KPI·전략으로 오르고 자기 워크아이템으로만 내려간다', () => {
    const idx = buildIndex(graph);
    const { nodes } = lineageOf(idx, 'I1');
    for (const id of ['P1', 'K1', 'S2', 'S1', 'W1', 'W2', 'U1']) assert.ok(nodes.has(id), id);
    assert.equal(nodes.has('I9'), false);
    assert.equal(nodes.has('T1'), false); // 상류 확장은 단계가 작아지는 쪽만 — 인스턴스와 태스크는 직접 연결이 아니다
});

test('기본 보기는 전략과 연결된 노드만', () => {
    const idx = buildIndex(graph);
    const { nodes } = strategyConnected(idx);
    assert.ok(nodes.has('W1') && nodes.has('TEAM'));
    assert.equal(nodes.has('P2'), false);
});

test('KPI 달성률은 기준선·방향을 반영한다', () => {
    assert.equal(kpiAchievement({ current_value: 6, target_value: 10, baseline_value: 0 }), 60);
    assert.equal(kpiAchievement({ current_value: 64.4, target_value: 48, baseline_value: 96, direction: 'decrease' }), 65.8);
    assert.equal(kpiAchievement({ current_value: 62, target_value: 90, baseline_value: 40 }), 44);
    assert.equal(kpiAchievement({ target_value: 10 }), null);
});

test('지표: 프로세스 실행 집계, 병목 태스크, 전략 달성률', () => {
    const idx = buildIndex(graph);
    const m = computeMetrics(idx);
    assert.deepEqual(
        { ...m.get('P1'), avgHours: m.get('P1').avgHours },
        { instances: 1, completed: 1, running: 0, overdue: 1, avgHours: 10, bottleneckTaskId: 'T2' }
    );
    assert.equal(m.get('T2').bottleneck, true);
    assert.equal(m.get('K1').level, 'warn'); // 60% — 기본 기준(달성 100 · 주의 50)
    assert.equal(m.get('K1').linked, true);
    assert.equal(m.get('S2').achievement, 60);
    assert.equal(m.get('S2').level, 'warn');
    assert.equal(computeMetrics(idx, { green: 100, amber: 70 }).get('K1').level, 'risk');
});

test('배치: 단계별 열, 하위 전략 들여쓰기, 상류 순서 정렬', () => {
    const idx = buildIndex(graph);
    const ids = new Set(idx.nodes.keys());
    // 열 순서는 스키마가 정한다 — 번호 대신 열 키로
    const stages = ['strategy', 'kpi', 'process', 'task', 'instance', 'workitem', 'resource'].map(stageIndex);
    const { positions, columns } = layoutWaterfall(idx, ids, stages, { colWidth: 200, colGap: 40 });
    assert.equal(columns.length, 7);
    assert.equal(positions.get('S1').depth, 0);
    assert.equal(positions.get('S2').depth, 1);
    assert.ok(positions.get('S2').y > positions.get('S1').y);
    assert.equal(positions.get('K1').x, 240);
    // P1(KPI 에 연결)이 P2 보다 위
    assert.ok(positions.get('P1').y < positions.get('P2').y);
    const counts = stageCounts(idx, ['S1', 'S2', 'W1']);
    assert.equal(counts.length, STAGES.length);
    assert.equal(counts[stageIndex('strategy')], 2);
    assert.equal(counts[stageIndex('workitem')], 1);
    assert.equal(counts.reduce((a, b) => a + b, 0), 3);
});

test('배치: 접힌 단계는 카드 없이 좁은 열만 차지한다', () => {
    const idx = buildIndex(graph);
    const ids = new Set(idx.nodes.keys());
    const [WI, RES] = [stageIndex('workitem'), stageIndex('resource')];
    const stages = ['strategy', 'kpi', 'instance', 'workitem', 'resource'].map(stageIndex);
    const { positions, columns } = layoutWaterfall(idx, ids, stages, { colWidth: 200, colGap: 40, collapsed: new Set([WI]) });
    const wi = columns.find((c) => c.stage === WI);
    assert.equal(wi.collapsed, true);
    assert.equal(wi.count, 3);
    assert.equal(positions.has('W1'), false);
    assert.equal(columns.find((c) => c.stage === RES).x, wi.x + wi.width + 40);
});

test('전략 달성률은 KPI 중요도 가중 평균', () => {
    const g = {
        nodes: [
            n('S', 'Strategy'),
            n('A', 'KPI', { current_value: 100, target_value: 100, importance: 1 }),
            n('B', 'KPI', { current_value: 40, target_value: 100, importance: 3 })
        ],
        edges: [e('HAS_KPI', 'S', 'A'), e('HAS_KPI', 'S', 'B')]
    };
    const m = computeMetrics(buildIndex(g));
    assert.equal(m.get('S').achievement, 55); // (100*1 + 40*3) / 4
    assert.equal(m.get('A').linked, false);
});

test('코스: KPI 에서 상위 전략 → KPI → 프로세스 → 병목 태스크 → 그 인스턴스 → 워크아이템 → 담당자 → 팀', async () => {
    const { coursePath } = await import('./ontologyLineage.js');
    const idx = buildIndex(graph);
    const m = computeMetrics(idx);
    // T2(8h) 가 병목, W2 가 T2 를 수행, W1 만 담당자가 있다 → W2 경로는 담당자 없이 끝난다
    assert.deepEqual(coursePath(idx, m, 'K1'), ['S1', 'S2', 'K1', 'P1', 'T2', 'I1', 'W2']);
    // 전략을 고르면 체인의 가장 나쁜 KPI 를 축으로
    assert.deepEqual(coursePath(idx, m, 'S1').slice(0, 4), ['S1', 'S2', 'K1', 'P1']);
    // 사용자를 고르면 상류로 가장 나쁜 워크아이템 → 인스턴스 → 프로세스 → KPI → 전략
    assert.deepEqual(coursePath(idx, m, 'U1').slice(0, 5), ['S1', 'S2', 'K1', 'P1', 'I1']);
});

test('배치: pinFirst 노드는 열의 맨 위', () => {
    const idx = buildIndex(graph);
    const ids = new Set(idx.nodes.keys());
    const { positions } = layoutWaterfall(idx, ids, ['strategy', 'kpi', 'process', 'task'].map(stageIndex), { pinFirst: new Set(['P2', 'T9']) });
    assert.ok(positions.get('P2').y < positions.get('P1').y);
    assert.ok(positions.get('T9').y < positions.get('T1').y);
});

test('맥락 열(시스템·데이터·문서) — 체인에는 들고 코스는 건너뛴다', () => {
    const idx = buildIndex({
        nodes: [
            { id: 'K', label: 'KPI', name: 'K' },
            { id: 'P', label: 'Process', name: 'P' },
            { id: 'T', label: 'Task', name: 'T' },
            { id: 'I', label: 'ProcessInstance', name: 'I' },
            { id: 'W', label: 'WorkItem', name: 'W' },
            { id: 'D', label: 'Document', name: 'D' },
            { id: 'O', label: 'DataObject', name: 'O' }
        ],
        edges: [
            { rel_type: 'IMPACTS_KPI', source: 'P', target: 'K' },
            { rel_type: 'CONTAINS_TASK', source: 'P', target: 'T' },
            { rel_type: 'HAS_INSTANCE', source: 'P', target: 'I' },
            { rel_type: 'HAS_WORK_ITEM', source: 'I', target: 'W' },
            { rel_type: 'EXECUTES_TASK', source: 'W', target: 'T' },
            { rel_type: 'GOVERNED_BY', source: 'T', target: 'D' },
            { rel_type: 'GOVERNED_BY', source: 'O', target: 'D' }
        ]
    });
    assert.equal(stageOf('Document'), stageIndex('asset'));
    assert.equal(STAGES[stageIndex('asset')].course, false);
    // 문서에서 위로: 그 문서를 따르는 태스크 → 프로세스 → KPI, 같은 단계의 데이터(데이터 → 문서)도
    const up = lineageOf(idx, 'D').nodes;
    for (const id of ['T', 'P', 'K', 'O']) assert.ok(up.has(id), id);
    // 태스크 코스는 문서가 아니라 워크아이템·인스턴스로 내려간다
    const metrics = computeMetrics(idx);
    assert.ok(!coursePath(idx, metrics, 'T').includes('D'));
});


test('스키마 열을 적용하면 단계가 바뀐다 · 영역은 그룹·프로세스의 상류', () => {
    const saved = STAGES.map((st) => ({ ...st }));
    try {
        // 형식이 틀린 열은 무시
        assert.equal(applyColumns([{ name: 'x' }]), false);
        assert.equal(applyColumns(saved), true);
        const idx = buildIndex({
            nodes: [
                { id: 'K', label: 'KPI', name: 'K' },
                { id: 'A', label: 'ProcessArea', name: 'A' },
                { id: 'G', label: 'ProcessGroup', name: 'G' },
                { id: 'P', label: 'Process', name: 'P' },
                { id: 'T', label: 'Task', name: 'T' }
            ],
            edges: [
                { rel_type: 'PART_OF', source: 'G', target: 'A' },
                { rel_type: 'PART_OF', source: 'P', target: 'G' },
                { rel_type: 'IMPACTS_KPI', source: 'P', target: 'K' },
                { rel_type: 'CONTAINS_TASK', source: 'P', target: 'T' }
            ]
        });
        // 영역을 고르면 그 아래 그룹 → 프로세스 → 태스크
        const down = lineageOf(idx, 'A').nodes;
        for (const id of ['G', 'P', 'T']) assert.ok(down.has(id), id);
        // 프로세스 코스는 그룹(맥락 열)이 아니라 KPI 로 올라간다
        const course = coursePath(idx, computeMetrics(idx), 'P');
        assert.ok(course.includes('K') && !course.includes('G'));
    } finally {
        applyColumns(saved);
    }
});


test('전략과 이어진 프로세스의 그룹·영역도 지도 기본 범위에 든다', () => {
    const idx = buildIndex({
        nodes: [
            { id: 'S', label: 'Strategy', name: 'S' },
            { id: 'K', label: 'KPI', name: 'K' },
            { id: 'P', label: 'Process', name: 'P' },
            { id: 'G', label: 'ProcessGroup', name: 'G' },
            { id: 'A', label: 'ProcessArea', name: 'A' },
            { id: 'G2', label: 'ProcessGroup', name: '전략과 무관한 그룹' }
        ],
        edges: [
            { rel_type: 'HAS_KPI', source: 'S', target: 'K' },
            { rel_type: 'IMPACTS_KPI', source: 'P', target: 'K' },
            { rel_type: 'PART_OF', source: 'P', target: 'G' },
            { rel_type: 'PART_OF', source: 'G', target: 'A' },
            { rel_type: 'PART_OF', source: 'G2', target: 'A' }
        ]
    });
    const { nodes } = strategyConnected(idx);
    for (const id of ['S', 'K', 'P', 'G', 'A']) assert.ok(nodes.has(id), id);
    // 영역을 거쳐 다른 그룹까지 번지지는 않는다 — 같은 영역이어도 G2 는 전략과 무관
    assert.ok(!nodes.has('G2'));
});
