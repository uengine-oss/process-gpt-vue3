import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * 폼 편집기 반응형 회귀 테스트.
 *
 * 레이아웃은 CSS 라 노드에서 그릴 수 없다. 실제 화면(폭별 캡처)은 업무 리포트에 두고,
 * 여기서는 되돌리면 깨지는 약속만 고정한다:
 *  - 편집기는 뷰포트가 아니라 놓인 칸 폭(컨테이너 쿼리)을 보고 좁아진다
 *  - 좁은 규칙은 기본 규칙보다 뒤에 있어야 한다(앞에 두면 같은 우선순위에서 져서 안 먹는다)
 *  - 데스크톱 패널(약 443px)은 좁은 폭으로 치지 않는다
 *  - 폼 편집 화면의 채팅은 좁으면 편집기 아래로 내려간다
 */
const read = (name) => readFileSync(new URL(name, import.meta.url), 'utf8');

const designer = read('./FormDesigner.vue');
const block = read('./FormBlockView.vue');
const definition = readFileSync(new URL('../../FormDefinition.vue', import.meta.url), 'utf8');

const NARROW = /@container fd \(max-width: (\d+)px\)/;
const DESKTOP_PANEL_WIDTH = 443;

test('편집기와 행 보기는 같은 컨테이너 임계값을 쓴다', () => {
    const a = designer.match(NARROW);
    const b = block.match(NARROW);
    assert.ok(a && b, '컨테이너 쿼리가 있어야 한다');
    assert.equal(a[1], b[1]);
});

test('데스크톱 패널 폭은 좁은 폭에 들지 않는다', () => {
    assert.ok(Number(designer.match(NARROW)[1]) < DESKTOP_PANEL_WIDTH);
});

test('편집기 루트는 컨테이너다', () => {
    assert.match(designer, /\.fd-host\s*{\s*container:\s*fd \/ inline-size/);
    assert.match(designer, /<div class="fd-host">/);
});

test('좁은 규칙은 기본 규칙보다 뒤에 있다', () => {
    const narrow = designer.indexOf('@container fd');
    assert.ok(narrow > designer.indexOf('.fd-rail {'));
    assert.ok(narrow > designer.indexOf('.fd-palette {'));
    assert.ok(narrow > designer.indexOf('.fd-rail-item {'));
    assert.ok(block.indexOf('@container fd') > block.indexOf('.fd-col {'));
});

test('좁은 폭에서 팔레트는 가로줄, 칸은 세로로 쌓인다', () => {
    const rules = designer.slice(designer.indexOf('@container fd'));
    assert.match(rules, /\.fd-rail\s*{[^}]*flex-direction:\s*row/);
    assert.match(rules, /\.fd-palette\s*{[^}]*flex-direction:\s*row/);
    assert.match(block.slice(block.indexOf('@container fd')), /\.fd-col\s*{[^}]*flex:\s*0 0 100% !important/);
});

test('폼 편집 화면은 좁으면 채팅을 편집기 아래로 내린다', () => {
    assert.match(definition, /class="form-definition-root"/);
    const q = definition.slice(definition.indexOf('@container fd-def'));
    assert.match(q, /\.form-definition-chat-box\s*{[^}]*flex-direction:\s*column/);
    assert.match(q, /max-width:\s*100% !important/);
});

test('좁은 폼 화면은 칸의 좌우 패딩을 지워 입력칸 오른쪽 끝을 맞춘다', () => {
    const css = readFileSync(new URL('../../../assets/css/globalStyle.css', import.meta.url), 'utf8');
    const mobile = css.slice(css.indexOf('.form-layout-card-contents-mobile {'));
    assert.match(mobile.slice(0, 900), /padding-right:\s*0 !important/);
    const container = css.slice(css.indexOf('@container (max-width: 560px)'));
    assert.match(container.slice(0, 900), /padding-right:\s*0 !important/);
});

test('여러 행 입력 칸은 좁으면 세로로 쌓이고, 휴대폰에서는 내부 스크롤이 없다', () => {
    const css = readFileSync(new URL('../../../assets/css/globalStyle.css', import.meta.url), 'utf8');
    assert.match(css, /\.row-layout-box\s*{\s*container:\s*rlb \/ inline-size/);
    const q = css.slice(css.indexOf('@container rlb'));
    assert.match(q, /\.row-layout-box \.row\s*{[^}]*flex-direction:\s*column !important/);
    assert.match(css, /max-width: 768px\)\s*{\s*\.row-layout-box\s*{\s*max-height:\s*none/);
});

test('휴대폰에서 제출·이전 단계 버튼은 40px 이상이다', () => {
    const css = readFileSync(new URL('../../../assets/css/globalStyle.css', import.meta.url), 'utf8');
    assert.match(css, /\.Process-gpt-execute-mobile-layout \.v-row\.mt-4 > \.v-btn\.v-btn--density-compact[\s\S]*?min-height:\s*40px/);
});

test('휴대폰 실행 화면: 제목·닫기 한 줄, 역할 지정은 칩 요약, 소스는 아이콘+eager 다이얼로그', () => {
    const exec = readFileSync(new URL('../../apps/definition-map/ProcessGPTExecute.vue', import.meta.url), 'utf8');
    assert.match(exec, /execute-header-mobile/);
    assert.match(exec, /v-if="isSimulate == 'false' && isMobile"/);
    assert.match(exec, /v-else-if="isSimulate == 'false'" class="pa-4"/); // 데스크톱 블록은 그대로
    assert.match(exec, /roleSummary\(role\)/);
    assert.match(exec, /mdi-paperclip/);
    // 닫아도 마운트가 유지돼야 sourceList 가 실행 입력(source_list)에 실린다
    assert.match(exec, /<v-dialog v-model="sourceOpen" eager/);
    assert.match(exec, /input\.source_list = me\.\$refs\.instanceSourceRef\.sourceList/);
    // 이름을 못 찾는 id 는 UUID 대신 '알 수 없음'
    assert.match(exec, /'알 수 없음'/);
});

test('목록으로 돌아가기 화살표는 시뮬레이션·실행 팝업에서 숨긴다', () => {
    const wi = readFileSync(new URL('../../apps/todolist/WorkItem.vue', import.meta.url), 'utf8');
    assert.match(wi, /v-if="isSimulate != 'true' && !isDryRun"\s+@click="goBackToPreviousPage"/);
});
