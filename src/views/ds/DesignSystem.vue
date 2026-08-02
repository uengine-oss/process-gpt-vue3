<template>
    <PgAppShell>
        <template #sidebar>
            <div class="ds-brand">Process GPT</div>
            <PgTabs v-model="pane" :items="paneTabs" class="ds-seg" />
            <nav class="ds-nav">
                <PgListItem
                    v-for="s in sections"
                    :key="s.id"
                    :icon="s.icon"
                    :title="s.label"
                    :active="active === s.id"
                    @click="scrollTo(s.id)"
                />
            </nav>
            <div class="ds-sidebar-foot">
                <PgAvatar name="Process GPT" size="sm" />
                <span class="pg-truncate">디자인 시스템</span>
                <PgChip size="sm">v1</PgChip>
            </div>
        </template>

        <template #topbar>
            <strong>디자인 시스템</strong>
            <PgChip size="sm" tone="brand">Claude 스타일</PgChip>
            <span class="pg-spacer" />
            <PgTooltip text="라이트 / 다크 전환">
                <PgButton icon size="sm" variant="ghost" aria-label="테마 전환" @click="toggle">
                    <PgIcon :name="isDark ? 'mdi-weather-sunny' : 'mdi-weather-night'" :size="16" />
                </PgButton>
            </PgTooltip>
        </template>

        <div ref="scroller" class="ds-scroll">
            <!-- 색 -->
            <section id="color" class="ds-sec">
                <h2 class="ds-sec__title">색</h2>
                <p class="ds-sec__desc">
                    전부 CSS custom property 다. 런타임 테마 객체가 없으므로 다크 전환은
                    <code>&lt;html data-mode&gt;</code> 하나로 끝난다.
                </p>
                <div class="ds-swatches">
                    <div v-for="c in swatches" :key="c.var" class="ds-swatch">
                        <span class="ds-swatch__chip" :style="{ background: `var(${c.var})` }" />
                        <span class="ds-swatch__name">{{ c.label }}</span>
                        <code class="ds-swatch__var">{{ c.var }}</code>
                    </div>
                </div>
            </section>

            <!-- 타이포 -->
            <section id="type" class="ds-sec">
                <h2 class="ds-sec__title">타이포그래피</h2>
                <div class="ds-stack">
                    <div class="pg-title">타이틀 22 / 28</div>
                    <div class="pg-heading">헤딩 15 / 20</div>
                    <div class="pg-body">본문 14 / 20 — UI 텍스트의 기본값입니다.</div>
                    <div class="pg-footnote pg-text-secondary">각주 13 / 17</div>
                    <div class="pg-caption pg-text-muted">캡션 12 / 17</div>
                    <div class="pg-voice">
                        응답 본문은 세리프 16 / 26.4 로 렌더합니다. 읽는 흐름을 UI 텍스트와 분리하기 위한 장치입니다.
                    </div>
                    <div class="pg-mono">코드 ui-monospace 13 / 19</div>
                </div>
            </section>

            <!-- 버튼 -->
            <section id="button" class="ds-sec">
                <h2 class="ds-sec__title">버튼</h2>
                <div class="ds-row">
                    <PgButton variant="primary">기본 액션</PgButton>
                    <PgButton variant="brand">브랜드</PgButton>
                    <PgButton variant="outline">아웃라인</PgButton>
                    <PgButton>표준</PgButton>
                    <PgButton variant="ghost">고스트</PgButton>
                    <PgButton variant="danger">삭제</PgButton>
                    <PgButton disabled>비활성</PgButton>
                    <PgButton :loading="loading" variant="primary" @click="fakeLoad">
                        {{ loading ? '처리 중' : '로딩 데모' }}
                    </PgButton>
                </div>
                <div class="ds-row">
                    <PgButton size="sm" variant="outline">small</PgButton>
                    <PgButton size="md" variant="outline">medium</PgButton>
                    <PgButton size="lg" variant="outline">large</PgButton>
                    <PgButton icon variant="ghost" aria-label="더보기"><PgIcon name="mdi-dots-horizontal" /></PgButton>
                    <PgButton icon variant="outline" aria-label="추가"><PgIcon name="mdi-plus" /></PgButton>
                </div>
            </section>

            <!-- 폼 -->
            <section id="form" class="ds-sec">
                <h2 class="ds-sec__title">폼</h2>
                <div class="ds-grid">
                    <PgTextField v-model="form.name" label="프로세스 이름" placeholder="예: 휴가 신청" clearable />
                    <PgTextField
                        v-model="form.email"
                        label="담당자 이메일"
                        type="email"
                        :error="emailError"
                        hint="승인 알림이 이 주소로 갑니다"
                    />
                    <PgSelect v-model="form.type" label="유형" :items="typeItems" placeholder="선택하세요" />
                    <PgTextField v-model="form.code" label="코드" placeholder="PRC-001">
                        <template #prepend><PgIcon name="mdi-pound" :size="14" /></template>
                    </PgTextField>
                </div>
                <PgTextarea v-model="form.desc" label="설명" placeholder="이 프로세스가 하는 일을 적어주세요" auto-grow />
                <div class="ds-row ds-row--top">
                    <PgCheckbox v-model="form.agree" label="자동 배포에 동의" />
                    <PgSwitch v-model="form.notify" label="알림 받기" />
                </div>
                <PgRadioGroup v-model="form.mode" label="실행 모드" :items="modeItems" inline />
            </section>

            <!-- 표시 -->
            <section id="display" class="ds-sec">
                <h2 class="ds-sec__title">표시</h2>
                <div class="ds-row">
                    <PgChip>기본</PgChip>
                    <PgChip tone="accent">진행중</PgChip>
                    <PgChip tone="success">완료</PgChip>
                    <PgChip tone="warning">지연</PgChip>
                    <PgChip tone="danger">실패</PgChip>
                    <PgChip tone="brand">에이전트</PgChip>
                    <PgChip closable @close="() => {}">닫기 가능</PgChip>
                </div>
                <div class="ds-row">
                    <PgAvatar name="장진영" />
                    <PgAvatar name="Rickie Jang" />
                    <PgAvatar name="Process GPT" size="lg" />
                    <PgSpinner />
                    <div style="width: 160px"><PgProgress :value="62" /></div>
                    <div style="width: 160px"><PgProgress indeterminate /></div>
                </div>
                <div class="ds-grid">
                    <PgCard title="카드" subtitle="hairline 기본값">
                        내용 영역입니다. 표면은 <code>--cds-surface-2</code>, 테두리는 0.5px 헤어라인입니다.
                    </PgCard>
                    <PgCard title="상승 카드" subtitle="raised" elevation="raised">그림자가 있는 변형입니다.</PgCard>
                </div>
                <div class="ds-row">
                    <PgSkeleton width="180px" />
                    <PgSkeleton shape="circle" />
                    <PgSkeleton shape="block" width="200px" />
                </div>
                <div class="ds-stack">
                    <PgAlert tone="info" title="안내">프로세스 정의가 저장되었습니다.</PgAlert>
                    <PgAlert tone="success" title="배포 완료">3개 액티비티가 활성화되었습니다.</PgAlert>
                    <PgAlert tone="warning" title="검토 필요">게이트웨이 분기 조건이 비어 있습니다.</PgAlert>
                    <PgAlert tone="danger" title="실행 실패" closable>외부 시스템 연결이 거부되었습니다.</PgAlert>
                </div>
            </section>

            <!-- 데이터 -->
            <section id="data" class="ds-sec">
                <h2 class="ds-sec__title">표 · 탭 · 메뉴</h2>
                <PgTabs v-model="tab" :items="tabItems" variant="underline" />
                <PgTable
                    v-model:sort-by="sortBy"
                    v-model:sort-desc="sortDesc"
                    :columns="columns"
                    :rows="sortedRows"
                    row-key="id"
                    clickable
                >
                    <template #cell-status="{ value }">
                        <PgChip size="sm" :tone="statusTone(value)">{{ value }}</PgChip>
                    </template>
                </PgTable>
                <div class="ds-row">
                    <PgMenu>
                        <template #trigger>
                            <PgButton variant="outline">
                                메뉴 열기 <PgIcon name="mdi-chevron-down" :size="14" />
                            </PgButton>
                        </template>
                        <template #default="{ close }">
                            <PgMenuItem icon="mdi-pencil-outline" @click="close">이름 변경</PgMenuItem>
                            <PgMenuItem icon="mdi-content-copy" shortcut="⌘D" @click="close">복제</PgMenuItem>
                            <PgDivider />
                            <PgMenuItem icon="mdi-delete-outline" danger @click="close">삭제</PgMenuItem>
                        </template>
                    </PgMenu>
                    <PgButton variant="outline" @click="dialog = true">다이얼로그 열기</PgButton>
                </div>
            </section>

            <!-- 대화 -->
            <section id="chat" class="ds-sec">
                <h2 class="ds-sec__title">대화</h2>
                <div class="ds-chat">
                    <PgThread>
                        <PgMessage role="user">이 프로세스에서 병목이 어디인지 표로 정리해줘.</PgMessage>
                        <PgMessage role="assistant" thinking="인스턴스 1,204건을 분석했습니다">
                            <p>구간별 평균 체류 시간은 다음과 같습니다.</p>
                            <table>
                                <thead>
                                    <tr><th>액티비티</th><th>평균</th><th>비중</th></tr>
                                </thead>
                                <tbody>
                                    <tr><td>구매 승인</td><td>4.2일</td><td>61%</td></tr>
                                    <tr><td>견적 검토</td><td>1.1일</td><td>16%</td></tr>
                                    <tr><td>발주</td><td>0.6일</td><td>9%</td></tr>
                                </tbody>
                            </table>
                            <p>
                                <strong>구매 승인</strong>이 전체 리드타임의 61%를 차지합니다. 결재선을
                                <code>2단계</code>로 줄이면 약 2.4일 단축됩니다.
                            </p>
                            <template #actions>
                                <PgButton icon size="sm" variant="ghost" aria-label="복사">
                                    <PgIcon name="mdi-content-copy" :size="14" />
                                </PgButton>
                                <PgButton icon size="sm" variant="ghost" aria-label="다시 생성">
                                    <PgIcon name="mdi-refresh" :size="14" />
                                </PgButton>
                            </template>
                        </PgMessage>
                        <PgMessage role="user">그 결재선 변경을 BPMN 으로 반영해줘.</PgMessage>
                        <PgMessage role="assistant">
                            <PgToolSteps>
                                <PgToolStep icon="mdi-file-search-outline" label="프로세스 정의 조회" />
                                <PgToolStep icon="mdi-sitemap-outline" label="게이트웨이 재구성" />
                                <PgToolStep icon="mdi-check-circle-outline" label="검증 통과" running />
                            </PgToolSteps>
                            <PgCodeBlock lang="xml" :code="bpmnSnippet" />
                        </PgMessage>
                    </PgThread>
                    <PgComposer
                        v-model="draft"
                        disclaimer="Process GPT는 실수할 수 있습니다. 중요한 결정은 확인해 주세요."
                        @submit="draft = ''"
                    >
                        <template #left>
                            <PgButton icon size="sm" variant="ghost" aria-label="첨부">
                                <PgIcon name="mdi-plus" :size="18" />
                            </PgButton>
                        </template>
                        <template #right>
                            <PgChip size="sm">Opus 5</PgChip>
                        </template>
                    </PgComposer>
                </div>
            </section>
        </div>

        <PgDialog v-model="dialog" title="프로세스 삭제" size="sm">
            <p>
                <strong>구매 요청</strong> 정의를 삭제하면 실행 중인 인스턴스 12건이 함께 중단됩니다. 계속할까요?
            </p>
            <template #footer>
                <PgButton variant="ghost" @click="dialog = false">취소</PgButton>
                <PgButton variant="primary" @click="dialog = false">삭제</PgButton>
            </template>
        </PgDialog>
    </PgAppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { getMode, toggleMode } from '@/ds';

const pane = ref('components');
const paneTabs = [
    { label: '컴포넌트', value: 'components' },
    { label: '토큰', value: 'tokens' }
];

const sections = [
    { id: 'color', label: '색', icon: 'mdi-palette-outline' },
    { id: 'type', label: '타이포그래피', icon: 'mdi-format-text' },
    { id: 'button', label: '버튼', icon: 'mdi-gesture-tap-button' },
    { id: 'form', label: '폼', icon: 'mdi-form-textbox' },
    { id: 'display', label: '표시', icon: 'mdi-shape-outline' },
    { id: 'data', label: '표 · 탭 · 메뉴', icon: 'mdi-table' },
    { id: 'chat', label: '대화', icon: 'mdi-message-outline' }
];

const swatches = [
    { label: '앱 배경', var: '--cds-surface-0' },
    { label: '올라온 면', var: '--cds-surface-1' },
    { label: '카드 · 컴포저', var: '--cds-surface-2' },
    { label: '본문 텍스트', var: '--cds-text-primary' },
    { label: '보조 텍스트', var: '--cds-text-secondary' },
    { label: '흐린 텍스트', var: '--cds-text-muted' },
    { label: '중립 배경', var: '--cds-bg-neutral' },
    { label: '강조 배경', var: '--cds-bg-accent' },
    { label: '성공 배경', var: '--cds-bg-success' },
    { label: '경고 배경', var: '--cds-bg-warning' },
    { label: '위험 배경', var: '--cds-bg-danger' }
];

const isDark = ref(false);
function toggle() {
    toggleMode();
    isDark.value = getMode() === 'dark';
}

const loading = ref(false);
function fakeLoad() {
    loading.value = true;
    setTimeout(() => (loading.value = false), 1400);
}

const form = ref({
    name: '',
    email: 'not-an-email',
    type: '',
    code: '',
    desc: '',
    agree: false,
    notify: true,
    mode: 'auto'
});
const emailError = computed(() =>
    form.value.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.value.email) ? '올바른 이메일 형식이 아닙니다' : ''
);
const typeItems = [
    { label: '승인 프로세스', value: 'approval' },
    { label: '자동화 프로세스', value: 'automation' },
    { label: '분석 프로세스', value: 'analytics' }
];
const modeItems = [
    { label: '자동', value: 'auto' },
    { label: '수동', value: 'manual' },
    { label: '검토 후 실행', value: 'review' }
];

const tab = ref('all');
const tabItems = [
    { label: '전체', value: 'all', count: 3 },
    { label: '실행 중', value: 'running', count: 1 },
    { label: '완료', value: 'done', count: 1 },
    { label: '보관', value: 'archived' }
];

const columns = [
    { key: 'name', label: '프로세스', sortable: true },
    { key: 'owner', label: '담당자' },
    { key: 'status', label: '상태' },
    { key: 'updated', label: '수정', sortable: true, align: 'right' as const }
];
const rows = [
    { id: 1, name: '구매 요청', owner: '장진영', status: '실행 중', updated: '2분 전' },
    { id: 2, name: '휴가 신청', owner: '김상훈', status: '완료', updated: '1시간 전' },
    { id: 3, name: '협력사 온보딩', owner: '오승용', status: '지연', updated: '어제' }
];
const sortBy = ref('name');
const sortDesc = ref(false);
const sortedRows = computed(() => {
    const list = [...rows];
    list.sort((a: any, b: any) => String(a[sortBy.value]).localeCompare(String(b[sortBy.value]), 'ko'));
    return sortDesc.value ? list.reverse() : list;
});
function statusTone(v: string) {
    return { '실행 중': 'accent', 완료: 'success', 지연: 'warning' }[v] || 'neutral';
}

const dialog = ref(false);
const draft = ref('');
const bpmnSnippet = `<bpmn:exclusiveGateway id="approvalRoute">
  <bpmn:outgoing>toTeamLead</bpmn:outgoing>
  <bpmn:outgoing>toDirector</bpmn:outgoing>
</bpmn:exclusiveGateway>`;

// 스크롤 위치에 따라 사이드바 활성 항목 갱신
const scroller = ref<HTMLElement | null>(null);
const active = ref('color');
function onScroll() {
    const root = scroller.value;
    if (!root) return;
    for (const s of sections) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top - root.getBoundingClientRect().top <= 80) active.value = s.id;
    }
}
function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

onMounted(() => {
    isDark.value = getMode() === 'dark';
    scroller.value?.addEventListener('scroll', onScroll, { passive: true });
});
onBeforeUnmount(() => scroller.value?.removeEventListener('scroll', onScroll));
</script>

<style scoped>
.ds-brand {
    padding: 16px 16px 8px;
    font-family: var(--cds-font-voice);
    font-size: 20px;
    letter-spacing: -0.01em;
}
.ds-seg {
    margin: 0 12px 12px;
}
.ds-nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0 8px;
    overflow-y: auto;
    flex: 1 1 auto;
}
.ds-sidebar-foot {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-top: 0.5px solid var(--cds-border);
    color: var(--cds-text-secondary);
    font-size: var(--cds-font-size-footnote);
}

.ds-scroll {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding: 8px 32px 96px;
}

.ds-sec {
    max-width: 900px;
    margin: 0 auto 56px;
    scroll-margin-top: 16px;
}
.ds-sec__title {
    margin-bottom: 6px;
    font-size: var(--cds-font-size-title);
    line-height: var(--cds-leading-title);
    font-weight: var(--cds-font-weight-semibold);
}
.ds-sec__desc {
    margin-bottom: 16px;
    color: var(--cds-text-secondary);
}
.ds-sec > * + * {
    margin-top: 16px;
}

.ds-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
}
.ds-row--top {
    align-items: flex-start;
    gap: 24px;
}
.ds-stack {
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.ds-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 16px;
}

.ds-swatches {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 10px;
}
.ds-swatch {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px;
    border: 0.5px solid var(--cds-border);
    border-radius: var(--cds-radius);
}
.ds-swatch__chip {
    width: 28px;
    height: 28px;
    flex: 0 0 28px;
    border-radius: var(--cds-radius--xs);
    box-shadow: inset 0 0 0 0.5px var(--cds-border-strong);
}
.ds-swatch__name {
    flex: 1 1 auto;
    min-width: 0;
    font-size: var(--cds-font-size-footnote);
}
.ds-swatch__var {
    color: var(--cds-text-muted);
    font-size: 10px;
}

.ds-chat {
    display: flex;
    flex-direction: column;
    height: 620px;
    border: 0.5px solid var(--cds-border);
    border-radius: var(--cds-radius--lg);
    background: var(--cds-surface-0);
    overflow: hidden;
}

code {
    padding: 1px 5px;
    border-radius: 5px;
    background: var(--cds-bg-neutral);
    color: var(--cds-text-danger);
    font-size: 0.9em;
}
</style>
