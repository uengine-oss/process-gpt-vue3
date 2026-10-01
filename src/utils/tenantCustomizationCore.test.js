import test from 'node:test';
import assert from 'node:assert/strict';

import {
    DEFAULT_CLASSIFICATION_COLUMNS,
    DEFAULT_OPERATION_POLICY,
    diffTerminologyFromDefault,
    hexToRgbTriplet,
    inferStageColumnFromCode,
    isDefaultClassification,
    matchStageColumn,
    migrateProcMapStageValues,
    normalizeClassification,
    normalizeCustomMenuItems,
    normalizeOperationPolicy,
    normalizeRoleLabels,
    normalizeTerminology,
    recycleBinRemainingDays,
    annualFrequencyFactor
} from './tenantCustomizationCore.js';

test('용어: 누락·잘못된 색은 기본값으로 채우고, diff 는 바뀐 항목만 남긴다', () => {
    const full = normalizeTerminology({ hierarchy: { domain: '사업부' }, stages: { draft: { label: '기획', color: 'red' } } });
    assert.equal(full.hierarchy.domain, '사업부');
    assert.equal(full.hierarchy.mega, '메가프로세스');
    assert.equal(full.stages.draft.label, '기획');
    assert.equal(full.stages.draft.color, '#94a3b8', '잘못된 색은 기본값');
    assert.equal(full.stages.published.label, '4단계');

    const diff = diffTerminologyFromDefault(full);
    assert.deepEqual(diff, { hierarchy: { domain: '사업부' }, stages: { draft: { label: '기획' } } });
    assert.equal(hexToRgbTriplet('#3B82F6'), '59, 130, 246');
    assert.equal(hexToRgbTriplet('#fff'), '255, 255, 255');
});

test('분류축: 열이 없으면 기본 5열, key 중복/형식 위반은 라벨에서 재생성, 폴백은 목록 안으로', () => {
    assert.ok(isDefaultClassification(null));
    assert.equal(normalizeClassification(null).columns.length, DEFAULT_CLASSIFICATION_COLUMNS.length);

    const cfg = normalizeClassification({
        columns: [
            { key: 'sales', label: '영업', keywords: '영업, sales ,영업' },
            { key: 'sales', label: '고객 관리', color: '#123456', icon: 'mdi-account' },
            { key: 'BAD KEY', label: '품질' },
            { label: '' }
        ],
        fallback_key: 'nope',
        infer_stage_from_code: false
    });
    // 한글 라벨은 ASCII 가 없어 'col', 'col-2' 로 생성된다(관리자가 key 를 직접 지정하면 그대로 쓴다)
    assert.deepEqual(cfg.columns.map((c) => c.key), ['sales', 'col', 'col-2']);
    assert.deepEqual(cfg.columns[0].keywords, ['영업', 'sales']);
    assert.equal(cfg.columns[1].color, '#123456');
    assert.equal(cfg.fallback_key, 'col-2', '폴백이 목록에 없으면 마지막 열');
    assert.equal(cfg.infer_stage_from_code, false);
    assert.equal(cfg.infer_domain, true);
    assert.ok(!isDefaultClassification(cfg));
});

test('분류 판정: key/라벨/키워드 정확 일치 → 부분 일치, ID 코드 순번은 열 순서를 따른다', () => {
    const cols = normalizeClassification({
        columns: [
            { key: 'sales', label: '영업', keywords: ['영업', 'sales'] },
            { key: 'quality', label: '품질', keywords: ['품질', 'qa'] }
        ]
    }).columns;
    assert.equal(matchStageColumn('영업', cols, true), 'sales', '라벨 정확 일치');
    assert.equal(matchStageColumn('quality', cols, true), 'quality', 'key 정확 일치');
    assert.equal(matchStageColumn('고객품질관리', cols, true), null, 'exactOnly 는 부분 일치 안 함');
    assert.equal(matchStageColumn('고객품질관리', cols), 'quality', '부분 일치');
    assert.equal(matchStageColumn('설계', cols), null, '기본 열 키워드는 사용자 열에 없으면 매칭되지 않는다');
    assert.equal(inferStageColumnFromCode('설비 A.2.1', cols), 'quality');
    assert.equal(inferStageColumnFromCode('설비 A.3', cols), null, '열 수를 넘는 순번은 null');
});

test('proc_map 마이그레이션: 라벨로 저장된 분류 값을 key 로 바꾸고 key/미매칭 값은 그대로 둔다', () => {
    const cols = normalizeClassification(null).columns;
    const map = {
        mega_proc_list: [
            {
                id: 'M1',
                category: '설계',
                major_proc_list: [
                    { id: 'J1', category: '설계', stage: '구축' },
                    { id: 'J2', category: 'monitor' },
                    { id: 'J3', category: '알 수 없음' },
                    { id: 'J4' }
                ]
            }
        ]
    };
    const changed = migrateProcMapStageValues(map, cols);
    assert.equal(changed, 3);
    assert.equal(map.mega_proc_list[0].category, 'design');
    assert.equal(map.mega_proc_list[0].major_proc_list[0].category, 'design');
    assert.equal(map.mega_proc_list[0].major_proc_list[0].stage, 'build');
    assert.equal(map.mega_proc_list[0].major_proc_list[1].category, 'monitor');
    assert.equal(map.mega_proc_list[0].major_proc_list[2].category, '알 수 없음');
    assert.equal(migrateProcMapStageValues(map, cols), 0, '두 번째 실행은 변경 없음');
});

test('운영 정책: 문자열·범위 밖 값은 clamp, 통화는 대문자 3~8자', () => {
    assert.deepEqual(normalizeOperationPolicy(null), DEFAULT_OPERATION_POLICY);
    const p = normalizeOperationPolicy({
        public_feedback_days: '14',
        feedback_alert_days: -3,
        stalled_days: 9999,
        recycle_bin_retention_days: 0,
        annual_working_hours: 1800,
        cycle_factors: { Monthly: 10, Daily: 'x' },
        annual_cost_per_fte: '95000000',
        currency: 'usd'
    });
    assert.equal(p.public_feedback_days, 14);
    assert.equal(p.feedback_alert_days, 0);
    assert.equal(p.stalled_days, 365);
    assert.equal(p.recycle_bin_retention_days, 1);
    assert.equal(p.annual_working_hours, 1800);
    assert.deepEqual(p.cycle_factors, { Monthly: 10, Weekly: 52, Daily: 260 });
    assert.equal(p.annual_cost_per_fte, 95000000);
    assert.equal(p.currency, 'USD');
    assert.equal(normalizeOperationPolicy({ currency: 'x' }).currency, 'KRW');
    assert.equal(annualFrequencyFactor('Weekly', p), 52);
    assert.equal(annualFrequencyFactor('Yearly', p), 1);
});

test('휴지통 남은 일수: 보존 일수 - 경과 일수, 0 미만은 0, 삭제일 없으면 보존 일수', () => {
    const now = Date.parse('2026-09-28T00:00:00Z');
    const tenDaysAgo = new Date(now - 10 * 86400000).toISOString();
    assert.equal(recycleBinRemainingDays(tenDaysAgo, 30, now), 20);
    assert.equal(recycleBinRemainingDays(tenDaysAgo, 7, now), 0);
    assert.equal(recycleBinRemainingDays(null, 45, now), 45);
    assert.equal(recycleBinRemainingDays('not-a-date', 999, now), 365, '범위 밖 보존 일수는 clamp');
});

test('역할 라벨: 빈 값은 기본값 사용으로 보고 버린다', () => {
    const r = normalizeRoleLabels({ admin: { label: ' 운영자 ', description: '' }, editor: { label: '' }, unknown: { label: 'x' } });
    assert.deepEqual(r, { admin: { label: '운영자' } });
});

test('사용자 정의 메뉴: 내부 경로는 / 로 시작, 외부 URL 은 external, 잘못된 항목은 제외', () => {
    const items = normalizeCustomMenuItems(
        [
            { id: 'a', label: '병합 요청함', target: 'merge-requests', section: 'process', requiredRole: 'EDITOR' },
            { id: 'a', label: '위키', target: 'https://wiki.example.com', section: 'bogus', order: 1 },
            { label: '', target: '/x' },
            { label: '나쁜 경로', target: '//evil' }
        ],
        () => 'gen'
    );
    assert.equal(items.length, 2);
    assert.deepEqual(items[0], { id: 'a', label: '병합 요청함', target: '/merge-requests', external: false, section: 'process', requiredRole: 'editor' });
    assert.equal(items[1].id, 'gen', '중복 id 는 재생성');
    assert.equal(items[1].external, true);
    assert.equal(items[1].section, 'process', '알 수 없는 섹션은 process');
    assert.equal(items[1].order, 1);
});
