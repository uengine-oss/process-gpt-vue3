<template>
    <!--
        인스턴스가 지금 어디쯤인지. 같은 계산(shared/instanceSteps)을 세 모양으로 그린다.

        strip  가로 띠 — 넓은 화면의 대화 칸 위. 끝난 것·하는 중인 것·남은 것을 색으로 가른다.
        pill   한 줄 알약 — 휴대폰 입력창 바로 위. 대화 위에 띠를 얹으면 화면을 너무 먹고
               대화와 따로 노는 것처럼 보였다. Claude Code 가 할 일을 입력창 위 한 줄로
               접어 두는 것처럼 '지금 단계 · 끝난 수/전체' 만 두고, 누르면 목록을 연다.
        list   세로 체크리스트 — 진행 상황 패널 안. 클로드 Cowork 의 '진행 상황' 과 같은 자리다.
    -->
    <div v-if="steps.length > 0 && variant === 'strip'" class="pg-flow" data-testid="instance-flow">
        <div ref="track" class="pg-flow__track">
            <template v-for="(item, i) in items" :key="itemKey(item)">
                <div
                    v-if="item.type === 'step'"
                    class="pg-flow__step"
                    :class="`pg-flow__step--${item.step.state}`"
                    :ref="item.step.state === 'current' ? 'current' : undefined"
                    :data-testid="`flow-step-${item.step.state}`"
                >
                    <div class="pg-flow__mark">
                        <span v-if="i > 0" class="pg-flow__line"></span>
                        <span class="pg-flow__dot">
                            <v-icon v-if="item.step.state === 'done'" size="12">mdi-check</v-icon>
                            <v-icon v-else-if="item.step.state === 'current'" size="12">mdi-circle-medium</v-icon>
                        </span>
                    </div>
                    <div class="pg-flow__name" :title="item.step.name">{{ item.step.name }}</div>
                    <div v-if="item.step.state === 'skipped'" class="pg-flow__who">건너뜀</div>
                    <div v-else-if="item.step.who" class="pg-flow__who">{{ item.step.who }}</div>
                </div>

                <!-- 분기: 갈래들을 한 칸에 겹쳐 쌓는다. 간 갈래는 표시, 가지 않은 갈래는 줄을 긋는다. -->
                <div
                    v-else
                    class="pg-flow__step pg-flow__step--branch"
                    :class="{ 'pg-flow__step--done': laneDone(item) }"
                    :ref="hasCurrent(item) ? 'current' : undefined"
                    data-testid="flow-branch"
                >
                    <div class="pg-flow__mark">
                        <span v-if="i > 0" class="pg-flow__line"></span>
                        <span class="pg-flow__diamond" :class="{ 'pg-flow__diamond--decided': item.decided }"></span>
                    </div>
                    <div class="pg-flow__name" :title="branchTitle(item)">{{ branchTitle(item) }}</div>
                    <div
                        v-for="lane in item.lanes"
                        :key="lane.lane"
                        class="pg-flow__lane"
                        :class="`pg-flow__lane--${lane.state}`"
                        :title="laneName(lane)"
                    >
                        <v-icon v-if="lane.state === 'taken' && laneFinished(lane)" size="11">mdi-check</v-icon>
                        <v-icon v-else-if="lane.state === 'taken'" size="11">mdi-circle-medium</v-icon>
                        <span class="pg-flow__lane-name">{{ laneName(lane) }}</span>
                    </div>
                </div>
            </template>
        </div>
    </div>

    <button
        v-else-if="steps.length > 0 && variant === 'pill'"
        type="button"
        class="pg-flow-pill"
        data-testid="instance-flow-pill"
        :aria-label="`진행 상황 — ${pillText}`"
        @click="$emit('open')"
    >
        <span class="pg-flow-pill__ring" :style="ringStyle" aria-hidden="true"></span>
        <span class="pg-flow-pill__text">
            <strong v-if="summary.current && summary.current.mine">내 차례</strong>
            {{ pillText }}
        </span>
        <span class="pg-flow-pill__count">{{ summary.done }}/{{ summary.total }}</span>
        <v-icon size="16" class="pg-flow-pill__chev">mdi-chevron-up</v-icon>
    </button>

    <ol v-else-if="steps.length > 0 && variant === 'list'" class="pg-flow-list" data-testid="instance-flow-list">
        <template v-for="item in items" :key="itemKey(item)">
            <li v-if="item.type === 'step'" class="pg-flow-list__item" :class="`pg-flow-list__item--${item.step.state}`">
                <span class="pg-flow-list__mark" aria-hidden="true">
                    <v-icon v-if="item.step.state === 'done'" size="12">mdi-check</v-icon>
                </span>
                <span class="pg-flow-list__body">
                    <span class="pg-flow-list__name">{{ item.step.name }}</span>
                    <span v-if="item.step.who && item.step.state !== 'skipped'" class="pg-flow-list__who">{{ item.step.who }}</span>
                </span>
                <span v-if="item.step.state === 'current'" class="pg-flow-list__tag">{{ item.step.mine ? '내 차례' : '진행 중' }}</span>
                <span v-else-if="item.step.state === 'skipped'" class="pg-flow-list__tag pg-flow-list__tag--muted">건너뜀</span>
            </li>

            <!--
                분기 — 1 > 2 > (3-a 또는 3-b 또는 3-c) > 4.
                갈래를 모두 보여 주되, 실제로 간 갈래만 체크하고 나머지는 '건너뜀' 으로 둔다.
            -->
            <li v-else class="pg-flow-list__item pg-flow-list__item--branch" data-testid="flow-branch">
                <span
                    class="pg-flow-list__mark pg-flow-list__mark--gw"
                    :class="{ 'pg-flow-list__mark--decided': item.decided }"
                    aria-hidden="true"
                ></span>
                <span class="pg-flow-list__body">
                    <span class="pg-flow-list__name">{{ branchTitle(item) }}</span>
                    <span class="pg-flow-list__who">{{ item.decided ? '조건에 따라 한 갈래로 진행했습니다' : `${item.lanes.length}갈래 중 하나로 진행합니다` }}</span>
                    <span class="pg-flow-lanes">
                        <template v-for="(lane, li) in item.lanes" :key="lane.lane">
                            <span v-if="li > 0" class="pg-flow-lanes__or">또는</span>
                            <span class="pg-flow-lanes__lane" :class="`pg-flow-lanes__lane--${lane.state}`" data-testid="flow-lane" :data-state="lane.state">
                                <span
                                    v-for="step in lane.steps"
                                    :key="step.id"
                                    class="pg-flow-list__item pg-flow-list__item--sub"
                                    :class="`pg-flow-list__item--${step.state}`"
                                >
                                    <span class="pg-flow-list__mark" aria-hidden="true">
                                        <v-icon v-if="step.state === 'done'" size="12">mdi-check</v-icon>
                                    </span>
                                    <span class="pg-flow-list__body">
                                        <span class="pg-flow-list__name">{{ step.name }}</span>
                                        <span v-if="step.who && step.state !== 'skipped'" class="pg-flow-list__who">{{ step.who }}</span>
                                    </span>
                                    <span v-if="step.state === 'current'" class="pg-flow-list__tag">{{ step.mine ? '내 차례' : '진행 중' }}</span>
                                    <span v-else-if="step.state === 'skipped'" class="pg-flow-list__tag pg-flow-list__tag--muted">건너뜀</span>
                                </span>
                            </span>
                        </template>
                    </span>
                </span>
            </li>
        </template>
    </ol>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import { buildSteps, groupSteps, summarizeSteps } from '@/shared/instanceSteps';

const backend = BackendFactory.createBackend();

export default {
    name: 'InstanceFlow',
    props: {
        instance: { type: Object, default: null },
        /** 이 인스턴스의 업무 목록. 대화 화면이 이미 들고 있는 것을 그대로 받는다. */
        workList: { type: Array, default: () => [] },
        /** 'strip' | 'pill' | 'list' */
        variant: { type: String, default: 'strip' },
        /** 지금 내 차례인 업무. 알약과 목록에 '내 차례' 로 표시한다. */
        mineTaskId: { type: String, default: '' }
    },
    emits: ['open'],
    data: () => ({
        activities: [],
        sequences: [],
        events: [],
        gateways: []
    }),
    mounted() {
        this.loadDefinition();
    },
    watch: {
        defId: {
            handler(v, old) {
                if (v && v !== old) this.loadDefinition();
            }
        },
        steps: {
            deep: true,
            handler() {
                this.$nextTick(this.scrollToCurrent);
            }
        }
    },
    computed: {
        defId() {
            return this.instance && this.instance.defId;
        },

        steps() {
            return buildSteps({
                activities: this.activities,
                sequences: this.sequences,
                events: this.events,
                gateways: this.gateways,
                workList: this.workList,
                whoOf: this.displayName,
                mineTaskId: this.mineTaskId,
                finished: /^(COMPLETED|DONE)$/i.test(String((this.instance && this.instance.status) || ''))
            });
        },

        /** 그릴 줄 — 단계 하나, 또는 한 게이트웨이의 갈래 묶음. */
        items() {
            return groupSteps(this.steps);
        },

        summary() {
            return summarizeSteps(this.steps);
        },

        pillText() {
            const s = this.summary;
            if (s.current) return s.current.name;
            if (s.finished) return '모든 단계를 마쳤습니다';
            return s.next ? `다음: ${s.next.name}` : '';
        },

        /** 끝난 만큼 채운 작은 원. 몇 단계 남았는지를 숫자 전에 먼저 보여 준다. */
        ringStyle() {
            const s = this.summary;
            const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
            return { '--pg-ring': `${pct}%` };
        }
    },
    methods: {
        itemKey(item) {
            return item.type === 'step' ? item.step.id : `gw-${item.id}`;
        },

        /** 게이트웨이 이름이 없으면 '분기' 로. */
        branchTitle(item) {
            return item.name || '분기';
        },

        laneName(lane) {
            return lane.steps.map((s) => s.name).join(' → ');
        },

        laneFinished(lane) {
            return lane.steps.every((s) => s.state === 'done' || s.state === 'skipped');
        },

        /** 간 갈래가 끝까지 끝났는가 — 띠에서 분기 칸을 '끝난 칸' 으로 칠한다. */
        laneDone(item) {
            return item.lanes.some((l) => l.state === 'taken' && this.laneFinished(l));
        },

        hasCurrent(item) {
            return item.lanes.some((l) => l.steps.some((s) => s.state === 'current'));
        },

        displayName(work) {
            if (!work) return '';
            const raw = work.username || '';
            // username 이 이메일로 들어오는 경우가 있다. 그대로 두면 줄이 길어진다.
            return raw.includes('@') ? raw.split('@')[0] : raw;
        },

        async loadDefinition() {
            if (!this.defId) return;
            try {
                const row = await backend.getRawDefinition(this.defId);
                const raw = row && row.definition;
                const def = typeof raw === 'string' ? JSON.parse(raw) : raw;
                this.activities = (def && def.activities) || [];
                this.sequences = (def && def.sequences) || [];
                this.events = (def && def.events) || [];
                this.gateways = (def && def.gateways) || [];
                this.$nextTick(this.scrollToCurrent);
            } catch (e) {
                // 흐름을 못 읽어도 대화는 열려야 한다. 줄만 접는다.
                this.activities = [];
                this.sequences = [];
                this.events = [];
                this.gateways = [];
            }
        },

        scrollToCurrent() {
            const track = this.$refs.track;
            const current = Array.isArray(this.$refs.current) ? this.$refs.current[0] : this.$refs.current;
            if (!track || !current) return;
            const left = current.offsetLeft - track.clientWidth / 2 + current.clientWidth / 2;
            track.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
        }
    }
};
</script>

<style scoped>
.pg-flow {
    flex: 0 0 auto;
    border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
    padding: 8px 0 10px;
}

.pg-flow__track {
    display: flex;
    align-items: flex-start;
    overflow-x: auto;
    scrollbar-width: none;
    padding: 0 10px;
}

.pg-flow__track::-webkit-scrollbar {
    display: none;
}

.pg-flow__step {
    flex: 0 0 auto;
    width: 92px;
    text-align: center;
}

/* 점과 잇는 선. 선은 점의 왼쪽으로 뻗어 앞 단계와 이어진다. */
.pg-flow__mark {
    position: relative;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.pg-flow__line {
    position: absolute;
    right: 50%;
    left: -50%;
    height: 2px;
    background: rgba(var(--v-theme-on-surface), 0.16);
}

.pg-flow__dot {
    position: relative;
    z-index: 1;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgb(var(--v-theme-surface));
    border: 2px solid rgba(var(--v-theme-on-surface), 0.2);
    color: #fff;
}

.pg-flow__name {
    margin-top: 4px;
    font-size: 0.6875rem;
    line-height: 1.3;
    color: rgba(var(--v-theme-on-surface), 0.55);
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    padding: 0 4px;
}

.pg-flow__who {
    font-size: 0.625rem;
    color: rgba(var(--v-theme-on-surface), 0.38);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 0 4px;
}

/* 끝난 단계 */
.pg-flow__step--done .pg-flow__dot {
    background: rgb(var(--v-theme-primary));
    border-color: rgb(var(--v-theme-primary));
}

.pg-flow__step--done .pg-flow__line {
    background: rgb(var(--v-theme-primary));
}

/* 지금 하는 단계 — 이름을 진하게 해 눈이 먼저 가게 한다. */
.pg-flow__step--current .pg-flow__dot {
    background: rgb(var(--v-theme-primary));
    border-color: rgb(var(--v-theme-primary));
    box-shadow: 0 0 0 4px rgba(var(--v-theme-primary), 0.18);
}

.pg-flow__step--current .pg-flow__name {
    color: rgb(var(--v-theme-primary));
    font-weight: 700;
}

/* 건너뛴 단계 */
.pg-flow__step--skipped .pg-flow__name,
.pg-flow__step--skipped .pg-flow__who {
    text-decoration: line-through;
    opacity: 0.6;
}

/* ---- pill: 입력창 위 한 줄 ---------------------------------------------- */
.pg-flow-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 36px;
    padding: 6px 12px;
    border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
    border-radius: 10px;
    background: rgb(var(--v-theme-surface));
    font-size: 13px;
    line-height: 18px;
    color: rgba(var(--v-theme-on-surface), 0.7);
    text-align: left;
    -webkit-tap-highlight-color: transparent;
}

.pg-flow-pill__ring {
    flex: 0 0 auto;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: conic-gradient(rgb(var(--v-theme-primary)) var(--pg-ring, 0%), rgba(var(--v-theme-on-surface), 0.12) 0);
    -webkit-mask: radial-gradient(circle, transparent 3.5px, #000 4px);
    mask: radial-gradient(circle, transparent 3.5px, #000 4px);
}

.pg-flow-pill__text {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.pg-flow-pill__text strong {
    margin-right: 4px;
    font-weight: 600;
    color: rgb(var(--v-theme-primary));
}

.pg-flow-pill__count {
    flex: 0 0 auto;
    font-size: 12px;
    color: rgba(var(--v-theme-on-surface), 0.45);
    font-variant-numeric: tabular-nums;
}

.pg-flow-pill__chev {
    flex: 0 0 auto;
    color: rgba(var(--v-theme-on-surface), 0.45);
}

/* ---- list: 진행 상황 패널의 세로 체크리스트 -------------------------------- */
.pg-flow-list {
    list-style: none;
    margin: 0;
    padding: 0;
}

.pg-flow-list__item {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 6px 0;
}

/* 앞뒤 단계를 잇는 세로 선 — 표시(점) 가운데를 지난다. */
.pg-flow-list__item + .pg-flow-list__item::before {
    content: '';
    position: absolute;
    left: 8px;
    top: -6px;
    height: 12px;
    width: 1px;
    background: rgba(var(--v-theme-on-surface), 0.15);
}

.pg-flow-list__mark {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 17px;
    height: 17px;
    margin-top: 1px;
    border-radius: 50%;
    border: 1.5px solid rgba(var(--v-theme-on-surface), 0.25);
    color: #fff;
}

.pg-flow-list__item--done .pg-flow-list__mark {
    border-color: rgba(var(--v-theme-on-surface), 0.55);
    background: rgba(var(--v-theme-on-surface), 0.55);
}

.pg-flow-list__item--current .pg-flow-list__mark {
    border-color: rgb(var(--v-theme-primary));
    box-shadow: inset 0 0 0 3px rgb(var(--v-theme-surface)), inset 0 0 0 8px rgb(var(--v-theme-primary));
}

.pg-flow-list__body {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
}

.pg-flow-list__name {
    font-size: 14px;
    line-height: 20px;
    color: rgba(var(--v-theme-on-surface), 0.85);
}

.pg-flow-list__item--todo .pg-flow-list__name {
    color: rgba(var(--v-theme-on-surface), 0.5);
}

.pg-flow-list__item--current .pg-flow-list__name {
    font-weight: 600;
    color: rgba(var(--v-theme-on-surface), 0.95);
}

.pg-flow-list__item--skipped .pg-flow-list__name {
    text-decoration: line-through;
    color: rgba(var(--v-theme-on-surface), 0.4);
}

.pg-flow-list__who {
    font-size: 12px;
    line-height: 17px;
    color: rgba(var(--v-theme-on-surface), 0.45);
}

.pg-flow-list__tag {
    flex: 0 0 auto;
    margin-top: 1px;
    padding: 0 6px;
    border-radius: 6px;
    font-size: 11px;
    line-height: 18px;
    color: rgb(var(--v-theme-primary));
    background: rgba(var(--v-theme-primary), 0.1);
}

.pg-flow-list__tag--muted {
    color: rgba(var(--v-theme-on-surface), 0.5);
    background: rgba(var(--v-theme-on-surface), 0.06);
}
/* 분기 — 띠에서는 갈래를 한 칸에 겹쳐 쌓는다. */
.pg-flow__step--branch {
    width: 120px;
}

.pg-flow__diamond {
    position: relative;
    z-index: 1;
    width: 12px;
    height: 12px;
    transform: rotate(45deg);
    border: 2px solid rgba(var(--v-theme-on-surface), 0.3);
    background: rgb(var(--v-theme-surface));
}

.pg-flow__diamond--decided {
    border-color: rgb(var(--v-theme-primary));
    background: rgb(var(--v-theme-primary));
}

.pg-flow__lane {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    font-size: 0.625rem;
    line-height: 1.5;
    padding: 0 4px;
    color: rgba(var(--v-theme-on-surface), 0.55);
}

.pg-flow__lane-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.pg-flow__lane--taken {
    color: rgb(var(--v-theme-primary));
    font-weight: 700;
}

.pg-flow__lane--skipped {
    text-decoration: line-through;
    opacity: 0.55;
}

/* ---- list: 분기 묶음 ---------------------------------------------------- */
.pg-flow-list__mark--gw {
    width: 12px;
    height: 12px;
    margin: 3px 2px 0;
    border-radius: 2px;
    transform: rotate(45deg);
    border: 1.5px solid rgba(var(--v-theme-on-surface), 0.35);
}

.pg-flow-list__mark--decided {
    border-color: rgba(var(--v-theme-on-surface), 0.55);
    background: rgba(var(--v-theme-on-surface), 0.55);
}

.pg-flow-lanes {
    display: flex;
    flex-direction: column;
    margin-top: 6px;
    padding-left: 10px;
    border-left: 1px dashed rgba(var(--v-theme-on-surface), 0.2);
}

.pg-flow-lanes__or {
    font-size: 11px;
    line-height: 16px;
    color: rgba(var(--v-theme-on-surface), 0.4);
}

.pg-flow-lanes__lane {
    display: flex;
    flex-direction: column;
}

.pg-flow-list__item--sub {
    padding: 3px 0;
}

/* 갈래 안의 단계끼리는 세로 선을 잇지 않는다 — 갈래를 가르는 것은 '또는' 과 점선이다. */
.pg-flow-list__item--sub::before {
    display: none;
}

.pg-flow-lanes__lane--skipped .pg-flow-list__mark {
    border-style: dashed;
}
</style>
