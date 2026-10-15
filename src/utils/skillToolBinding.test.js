// 스킬 전용 도구와 스킬 연결(SKILL.md metadata.include_tools) 편집·판정 — openspec bind-skill-tools.
// 숨길 도구는 관리자가 스킬 전용으로 지정하고, include_tools 는 그 도구를 열어 줄 스킬만 정한다.
// 머리말의 include_tools 한 줄만 고치고 나머지(다른 필드·본문·줄바꿈)는 그대로여야 한다.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    adminRows,
    filterAdminRows,
    readIncludeTools,
    writeIncludeTools,
    readDescription,
    bindingImpact,
    descriptionHints,
    includeToolsChangeFromPatch,
    COPY,
    toolStatus,
    actionItems,
    addToolPlan,
    removeToolPlan,
    designationTiming,
    oneLine,
    searchTools,
    skillBadges,
    groupBySkills,
    addManyPlan,
    pickerNotice,
    connectableSkills,
    shortList,
    toolSource,
    groupBySource
} from './skillToolBinding.js';

const BASE = '---\nname: skill-nda-review\ndescription: NDA 를 검토합니다.\n---\n\n## 본문\n- 한 줄\n';
const WITH_META = '---\nname: s\ndescription: d\nmetadata:\n  owner: legal\n  include_tools: send_email_tool\n---\n본문\n';

const CATALOG = [
    { name: 'send_email_tool', source: 'mcp', server: 'gmail-mcp', description: 'Send an email via Gmail SMTP.', schema_tokens: 120, category: 'bindable', skill_only: true },
    { name: 'lookup_order', source: 'mcp', server: 'orders', description: 'Look up an order status.', schema_tokens: 80, category: 'bindable', skill_only: false },
    { name: 'read_file', source: 'service', server: null, description: '에이전트 기본 도구', schema_tokens: 0, category: 'unbindable' }
];

test('include_tools 가 없으면 metadata 블록을 만들고 본문은 그대로다', () => {
    const out = writeIncludeTools(BASE, ['send_email_tool']);
    assert.equal(out, '---\nname: skill-nda-review\ndescription: NDA 를 검토합니다.\nmetadata:\n  include_tools: send_email_tool\n---\n\n## 본문\n- 한 줄\n');
    assert.deepEqual(readIncludeTools(out), ['send_email_tool']);
});

test('기존 include_tools 줄만 바꾸고 metadata 의 다른 필드는 보존한다', () => {
    const out = writeIncludeTools(WITH_META, ['send_email_tool', 'lookup_order']);
    assert.equal(out, WITH_META.replace('include_tools: send_email_tool', 'include_tools: send_email_tool lookup_order'));
});

test('metadata 는 있지만 include_tools 가 없으면 같은 들여쓰기로 한 줄 추가한다', () => {
    const src = '---\nname: s\nmetadata:\n    owner: legal\n---\n본문\n';
    assert.equal(writeIncludeTools(src, ['lookup_order']), '---\nname: s\nmetadata:\n    include_tools: lookup_order\n    owner: legal\n---\n본문\n');
});

test('모두 해제하면 include_tools 줄을 지우고, 비게 된 metadata 도 지운다', () => {
    const only = '---\nname: s\nmetadata:\n  include_tools: lookup_order\n---\n본문\n';
    assert.equal(writeIncludeTools(only, []), '---\nname: s\n---\n본문\n');
    assert.equal(writeIncludeTools(WITH_META, []), '---\nname: s\ndescription: d\nmetadata:\n  owner: legal\n---\n본문\n');
});

test('쓰고 다시 읽으면 왕복이 같고, CRLF 줄바꿈도 유지한다', () => {
    const crlf = BASE.replace(/\n/g, '\r\n');
    const out = writeIncludeTools(crlf, ['lookup_order']);
    assert.ok(!/[^\r]\n/.test(out), 'LF 가 섞였다');
    assert.deepEqual(readIncludeTools(out), ['lookup_order']);
    assert.equal(writeIncludeTools(out, []), crlf);
});

test('같은 이름은 한 번만 쓰고, 머리말이 없으면 원문 그대로다', () => {
    assert.deepEqual(readIncludeTools(writeIncludeTools(BASE, ['a', 'a', ' b '])), ['a', 'b']);
    assert.equal(writeIncludeTools('# 머리말 없음\n', ['a']), '# 머리말 없음\n');
});

test('원문에서 직접 고친 include_tools 를 읽고, 따옴표·주석도 처리한다', () => {
    assert.deepEqual(readIncludeTools('---\nmetadata:\n  include_tools: "a b"  # 메모\n---\n'), ['a', 'b']);
    assert.deepEqual(readIncludeTools('---\nname: s\n---\n'), []);
});

test('description 은 한 줄과 > 블록 모두 읽는다', () => {
    assert.equal(readDescription(BASE), 'NDA 를 검토합니다.');
    assert.equal(readDescription('---\ndescription: >\n  첫 줄\n  둘째 줄\nname: x\n---\n'), '첫 줄 둘째 줄');
});

test('영향: 다른 스킬·직접 지정·토큰 합, 카탈로그에 없는 이름', () => {
    const bindings = {
        send_email_tool: { skills: ['skill-nda-review', 'contract-mailer'], direct_assignments: [{ kind: 'agent', agent_name: '법무' }] }
    };
    const impact = bindingImpact(['send_email_tool', 'lookup_order', 'ghost'], CATALOG, bindings, 'skill-nda-review');
    assert.equal(impact.totalTokens, 200);
    assert.deepEqual(impact.tools[0].otherSkills, ['contract-mailer']);
    assert.equal(impact.tools[0].directAssignments.length, 1);
    assert.equal(impact.tools[2].known, false);
});

test('설명 보완 안내: 설명에 도구로 할 일이 없을 때만', () => {
    assert.deepEqual(descriptionHints('NDA 를 검토합니다.', ['send_email_tool'], CATALOG), ['send_email_tool']);
    assert.deepEqual(descriptionHints('NDA 를 검토하고 결과를 이메일로 발송합니다.', ['send_email_tool'], CATALOG), []);
    assert.deepEqual(descriptionHints('주문 상태를 조회합니다', ['lookup_order'], CATALOG), []);
});

test('설명 보완 안내: 같은 MCP 서버 도구는 서버 단위로 본다', () => {
    const supa = [
        { name: 'list_tables', server: 'supabase', description: 'Lists all tables.', category: 'bindable' },
        { name: 'apply_migration', server: 'supabase', description: 'Applies a migration.', category: 'bindable' }
    ];
    assert.deepEqual(descriptionHints('Supabase 프로젝트의 테이블을 관리합니다', ['list_tables', 'apply_migration'], supa), []);
    assert.deepEqual(descriptionHints('프로젝트를 관리합니다', ['list_tables', 'apply_migration'], supa), ['list_tables', 'apply_migration']);
});

test('병합 요청 패치에서 include_tools 추가·제거를 뽑는다', () => {
    const added = '@@ -1,6 +1,8 @@\n ---\n name: skill-nda-review\n+metadata:\n+  include_tools: send_email_tool\n ---';
    assert.deepEqual(includeToolsChangeFromPatch(added), { added: ['send_email_tool'], removed: [] });
    const changed = '-  include_tools: a b\n+  include_tools: b c';
    assert.deepEqual(includeToolsChangeFromPatch(changed), { added: ['c'], removed: ['a'] });
    assert.equal(includeToolsChangeFromPatch(' -  본문만 바뀜\n+ 본문'), null);
    assert.equal(includeToolsChangeFromPatch('   include_tools: a\n+본문'), null);
});

// ── 상태와 판정(openspec skill-tool-binding-ui) ──────────────────────────────

const BINDINGS = {
    send_email_tool: { skills: ['skill-nda-review'] },
    lookup_order: { skills: ['order-lookup', 'order-audit'] },
    list_tables: { skills: ['supabase-project-admin'] },
    execute_sql: { skills: ['supabase-project-admin'] }
};
const CAT2 = [
    ...CATALOG,
    { name: 'list_tables', source: 'mcp', server: 'supabase', description: 'Lists all tables.', category: 'bindable' },
    { name: 'execute_sql', source: 'mcp', server: 'supabase', description: 'Runs SQL.', category: 'bindable' },
    { name: 'orphan_tool', source: 'service', server: null, description: '연결 없는 도구', category: 'bindable' }
];

test('상태 라벨은 세 가지다: 모든 대화에서 사용 / 스킬을 읽은 뒤 사용 · 스킬 / 사용 불가', () => {
    assert.deepEqual(toolStatus('send_email_tool', ['send_email_tool'], BINDINGS), {
        kind: 'after-skill', label: '스킬을 읽은 뒤 사용 · skill-nda-review', skills: ['skill-nda-review']
    });
    assert.equal(toolStatus('list_tables', [], BINDINGS).label, '모든 대화에서 사용', '연결됐어도 지정 안 되면 처음부터 보인다');
    assert.equal(toolStatus('orphan_tool', new Set(['orphan_tool']), BINDINGS).label, '사용 불가 · 연결된 스킬 없음');
});

test('확인 필요: 연결 없는 스킬 전용 도구, 연결됐지만 지정 안 된 도구(스킬 단위로 많은 순)', () => {
    const items = actionItems(CAT2, { ...BINDINGS, read_file: { skills: ['x'] } }, ['send_email_tool', 'orphan_tool', 'read_file']);
    assert.deepEqual(items.unusable, ['orphan_tool'], '기본 도구는 지정 대상이 아니므로 빠진다');
    assert.deepEqual(items.undesignated, [
        { skill: 'supabase-project-admin', tools: ['execute_sql', 'list_tables'] },
        { skill: 'order-audit', tools: ['lookup_order'] },
        { skill: 'order-lookup', tools: ['lookup_order'] }
    ]);
    assert.deepEqual(actionItems(CAT2, {}, []), { unusable: [], undesignated: [] }, '처리할 일이 없으면 비어 있다');
});

test('도구 추가: 지정된 도구는 연결만, 아니면 관리자는 지정과 연결, 작성자는 불가', () => {
    const [mail, order, builtin] = CATALOG;
    assert.equal(addToolPlan(order, { isAdmin: false, skillOnly: ['lookup_order'] }), 'connect');
    assert.equal(addToolPlan(mail, { isAdmin: true, skillOnly: [] }), 'designate-and-connect');
    assert.equal(addToolPlan(mail, { isAdmin: false, skillOnly: [] }), 'not-allowed');
    assert.equal(addToolPlan(builtin, { isAdmin: true, skillOnly: [] }), 'unbindable');
    assert.equal(addToolPlan(undefined, { isAdmin: true, skillOnly: [] }), 'unknown');
});

test('도구 빼기: 다른 연결이 있거나 지정 안 됐으면 그냥 빼고, 마지막 연결이면 확인', () => {
    const ctx = (isAdmin) => ({ bindings: BINDINGS, skillOnly: ['send_email_tool', 'lookup_order'], isAdmin });
    assert.equal(removeToolPlan('lookup_order', 'order-lookup', ctx(true)), 'disconnect', '다른 스킬도 연결했다');
    assert.equal(removeToolPlan('list_tables', 'supabase-project-admin', ctx(true)), 'disconnect', '지정 안 된 도구');
    assert.equal(removeToolPlan('send_email_tool', 'skill-nda-review', ctx(true)), 'last-connection');
    assert.equal(removeToolPlan('send_email_tool', 'skill-nda-review', ctx(false)), 'last-connection-warn');
});

test('저장 순서: 로컬 스킬은 저장 직후 지정, 저장소 스킬은 병합 뒤로 미룬다', () => {
    assert.equal(designationTiming({ gitBacked: false }), 'after-save');
    assert.equal(designationTiming({ gitBacked: true }), 'defer');
});

test('설명 한 줄 요약과 기본 도구를 뺀 검색', () => {
    assert.equal(oneLine('Send an email via Gmail SMTP. Parameters: - recipient'), 'Send an email via Gmail SMTP.');
    assert.equal(oneLine('x'.repeat(200), 20).length, 20);
    assert.equal(oneLine(''), '');
    const found = searchTools(CATALOG, 'email').flatMap((g) => g.tools.map((t) => t.name));
    assert.deepEqual(found, ['send_email_tool']);
    const all = searchTools(CATALOG, '').flatMap((g) => g.tools.map((t) => t.name));
    assert.equal(all.includes('read_file'), false, '에이전트 기본 도구는 결과에 없다');
});

test('스킬 목록 배지: 읽은 뒤 쓰는 도구 수와 지정 필요 수', () => {
    const badges = skillBadges(BINDINGS, ['send_email_tool']);
    assert.deepEqual(badges.get('skill-nda-review'), { after: 1, undesignated: 0 });
    assert.deepEqual(badges.get('supabase-project-admin'), { after: 0, undesignated: 2 });
});

test('화면 문구에 내부 용어가 없다', () => {
    const texts = Object.entries(COPY).map(([key, v]) => {
        if (typeof v !== 'function') return v;
        const tool = key.endsWith('Group') ? ['도구'] : '도구';
        return v(tool, ['스킬']) + v(tool, []);
    });
    for (const t of texts) {
        assert.doesNotMatch(t, /include_tools|바인딩|여는 스킬|binding/i, t);
    }
});

test('확인 창은 연결 스킬이 같은 도구를 한 문장으로 묶는다', () => {
    const groups = groupBySkills(['list_tables', 'execute_sql', 'send_email_tool', 'orphan_tool'], BINDINGS);
    assert.deepEqual(groups, [
        { tools: ['list_tables', 'execute_sql'], skills: ['supabase-project-admin'] },
        { tools: ['send_email_tool'], skills: ['skill-nda-review'] },
        { tools: ['orphan_tool'], skills: [] }
    ]);
});

test('관리자 표: 기본 도구는 빼고 상태별로 행을 만들며, 목록에 없는 지정도 행으로 남긴다', () => {
    const rows = adminRows(CAT2, BINDINGS, ['send_email_tool', 'orphan_tool', 'gone_tool']);
    const kind = Object.fromEntries(rows.map((r) => [r.name, r.kind]));
    assert.deepEqual(kind, {
        execute_sql: 'undesignated',
        gone_tool: 'missing',
        list_tables: 'undesignated',
        lookup_order: 'undesignated',
        orphan_tool: 'unusable',
        send_email_tool: 'after-skill'
    });
    assert.equal(rows.find((r) => r.name === 'read_file'), undefined);
});

test('관리자 표 보기: 지정 안 됨 · 지정됨 · 사용 불가 · 스킬 · 검색어', () => {
    const rows = adminRows(CAT2, BINDINGS, ['send_email_tool', 'orphan_tool', 'gone_tool']);
    const names = (opts) => filterAdminRows(rows, opts).map((r) => r.name);
    assert.deepEqual(names({ filter: 'undesignated' }), ['execute_sql', 'list_tables', 'lookup_order']);
    assert.deepEqual(names({ filter: 'designated' }), ['gone_tool', 'orphan_tool', 'send_email_tool']);
    assert.deepEqual(names({ filter: 'unusable' }), ['gone_tool', 'orphan_tool']);
    assert.deepEqual(names({ filter: 'undesignated', skill: 'supabase-project-admin' }), ['execute_sql', 'list_tables']);
    assert.deepEqual(names({ filter: 'all', query: 'sql' }), ['execute_sql']);
});

// 2026-10-15 화면 점검(관리자·비관리자로 처음부터 끝까지)에서 막힌 곳
const SUPA = [
    { name: 'list_tables', source: 'mcp', server: 'supabase', description: 'Lists all tables in one or more schemas.', category: 'bindable' },
    { name: 'apply_migration', source: 'mcp', server: 'supabase', description: 'Applies a migration to the database.', category: 'bindable' },
    { name: 'execute_sql', source: 'mcp', server: 'supabase', description: 'Executes raw SQL in the Postgres database.', category: 'bindable' }
];

test('검색: MCP 서버 이름으로 그 서버 도구를 모두 찾는다(설명에 서버 이름이 없어도)', () => {
    const groups = searchTools([...CATALOG, ...SUPA], 'supabase');
    assert.deepEqual(groups.map((g) => g.key), ['mcp:supabase']);
    assert.deepEqual(groups[0].tools.map((t) => t.name).sort(), ['apply_migration', 'execute_sql', 'list_tables']);
    const rows = adminRows([...CATALOG, ...SUPA], {}, []);
    assert.equal(filterAdminRows(rows, { query: 'supabase' }).length, 3);
});

test('여러 도구 한 번에 추가: 연결된 것·기본 도구는 빼고, 지정된 것은 연결만, 나머지는 관리자만 지정과 연결', () => {
    const tools = [...SUPA, CATALOG[2]];
    const admin = addManyPlan(tools, { isAdmin: true, skillOnly: ['execute_sql'], connected: ['list_tables'] });
    assert.deepEqual(admin, { connect: ['execute_sql'], designate: ['apply_migration'], blocked: [] });
    const author = addManyPlan(tools, { isAdmin: false, skillOnly: ['execute_sql'], connected: [] });
    assert.deepEqual(author, { connect: ['execute_sql'], designate: [], blocked: ['list_tables', 'apply_migration'] });
});

test('비관리자: 고를 수 없는 이유는 추가 창 맨 위에 한 번만, 관리자에게는 없다', () => {
    const groups = searchTools([...CATALOG, ...SUPA], '');
    assert.equal(pickerNotice(groups, { isAdmin: false, skillOnly: [] }), COPY.adminOnlyReason);
    assert.equal(pickerNotice(groups, { isAdmin: true, skillOnly: [] }), '');
    // 모두 이미 스킬 전용이면 막힌 도구가 없으니 이유도 없다
    const all = [...CATALOG, ...SUPA].filter((t) => t.category !== 'unbindable').map((t) => t.name);
    assert.equal(pickerNotice(groups, { isAdmin: false, skillOnly: all }), '');
    assert.match(COPY.adminOnlyReason, /관리자/);
});

test('스킬에 연결 대상에서 서비스 기본 스킬(process-gpt-system)은 뺀다', () => {
    const list = [
        { name: 'room-booking-check', collection: 'local' },
        { name: 'expense-limit-reviewer', collection: 'c301e192' },
        { name: 'bsc-strategy-interview', collection: 'process-gpt-system' }
    ];
    assert.deepEqual(connectableSkills(list), ['room-booking-check', 'expense-limit-reviewer']);
});

test('확인 창의 긴 도구 목록은 앞의 몇 개와 남은 수로 줄인다', () => {
    assert.equal(shortList(['a', 'b']), 'a, b');
    assert.equal(shortList(['a', 'b', 'c', 'd', 'e']), 'a, b, c 외 2개');
});

test('출처 구분: 딥 에이전트 서비스 도구와 MCP 서버 도구는 다른 묶음·아이콘이다', () => {
    const service = toolSource({ name: 'execute_process', source: 'service' });
    const mcp = toolSource({ name: 'list_tables', source: 'mcp', server: 'supabase' });
    assert.equal(service.kind, 'service');
    assert.equal(mcp.kind, 'mcp');
    assert.equal(mcp.label, 'supabase');
    assert.notEqual(service.icon, mcp.icon);
});

test('관리자 표: 서비스 도구 묶음 → MCP 서버별 묶음(이름순) → 목록에 없는 지정 순으로 나눈다', () => {
    const catalog = [
        ...SUPA,
        { name: 'send_email_tool', source: 'mcp', server: 'gmail-mcp', description: '', category: 'bindable' },
        { name: 'execute_process', source: 'service', server: null, description: '', category: 'bindable' },
        { name: 'read_file', source: 'service', server: null, description: '', category: 'unbindable' }
    ];
    const groups = groupBySource(adminRows(catalog, {}, ['gone_tool']));
    assert.deepEqual(groups.map((g) => g.key), ['service', 'mcp:gmail-mcp', 'mcp:supabase', 'missing']);
    assert.deepEqual(groups[0].items.map((r) => r.name), ['execute_process']);
    assert.equal(groups[2].items.length, 3);
    // 도구 추가 창도 같은 묶음 순서를 쓴다
    assert.deepEqual(searchTools(catalog, '').map((g) => g.key), ['service', 'mcp:gmail-mcp', 'mcp:supabase']);
});
