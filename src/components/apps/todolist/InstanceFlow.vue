<template>
    <!--
        인스턴스의 전체 흐름을 한 줄로 보여 준다.

        대화만 있으면 "지금 어디쯤인지" 를 알 수 없다. 지나간 말을 거슬러 세어야
        하고, 앞으로 무엇이 남았는지는 아예 알 길이 없다. 단계를 한 줄로 늘어놓고
        끝난 것·하는 중인 것·남은 것을 색으로 갈라 둔다.

        가로로 미는 까닭은 휴대폰 폭 때문이다. 세로로 쌓으면 대화가 시작되기도
        전에 화면이 다 찬다. 지금 단계는 열 때 자동으로 보이는 자리로 끌어온다.
    -->
    <div v-if="steps.length > 0" class="pg-flow" data-testid="instance-flow">
        <div ref="track" class="pg-flow__track">
            <div
                v-for="(step, i) in steps"
                :key="step.id"
                class="pg-flow__step"
                :class="`pg-flow__step--${step.state}`"
                :ref="step.state === 'current' ? 'current' : undefined"
                :data-testid="`flow-step-${step.state}`"
            >
                <div class="pg-flow__mark">
                    <span v-if="i > 0" class="pg-flow__line"></span>
                    <span class="pg-flow__dot">
                        <v-icon v-if="step.state === 'done'" size="12">mdi-check</v-icon>
                        <v-icon v-else-if="step.state === 'current'" size="12">mdi-circle-medium</v-icon>
                    </span>
                </div>
                <div class="pg-flow__name" :title="step.name">{{ step.name }}</div>
                <div v-if="step.who" class="pg-flow__who">{{ step.who }}</div>
            </div>
        </div>
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';

const backend = BackendFactory.createBackend();

/** 아직 끝나지 않았지만 이미 시작된 업무. 이 상태면 그 단계가 '진행 중' 이다. */
const LIVE = new Set(['IN_PROGRESS', 'SUBMITTED', 'PENDING', 'TODO', 'NEW', 'RUNNING', 'Running']);

export default {
    name: 'InstanceFlow',
    props: {
        instance: { type: Object, default: null },
        /** 이 인스턴스의 업무 목록. 대화 화면이 이미 들고 있는 것을 그대로 받는다. */
        workList: { type: Array, default: () => [] }
    },
    data: () => ({
        activities: [],
        sequences: [],
        events: []
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

        /** 업무를 액티비티 아이디로 묶는다. 같은 단계를 다시 한 경우 마지막 것만 본다. */
        taskByActivity() {
            const map = new Map();
            (this.workList || []).forEach((w) => {
                const key = w && (w.tracingTag || (w.task && w.task.activity_id));
                if (!key) return;
                const prev = map.get(key);
                const at = (x) => new Date((x && (x.endDate || x.startDate)) || 0).getTime();
                if (!prev || at(w) >= at(prev)) map.set(key, w);
            });
            return map;
        },

        steps() {
            return this.orderedActivities.map((activity) => {
                const work = this.taskByActivity.get(activity.id);
                let state = 'todo';
                if (work) {
                    if (work.status === 'DONE') state = 'done';
                    else if (work.status === 'CANCELLED') state = 'skipped';
                    else if (LIVE.has(work.status)) state = 'current';
                }
                return {
                    id: activity.id,
                    name: activity.name || activity.id,
                    who: this.displayName(work) || activity.role || '',
                    state
                };
            });
        },

        /**
         * 정의에 적힌 차례대로 액티비티를 늘어놓는다.
         *
         * 시작 이벤트에서 출발해 sequences 를 따라간다. 정의 파일의 배열 순서는
         * 그린 순서라 흐름과 다를 수 있다 — 실제로 이 저장소의 정의도 마지막
         * 단계가 배열 맨 앞에 있다.
         *
         * 갈래(gateway)가 있으면 나오는 차례대로 줄을 세운다. 가지 않은 가지는
         * 업무가 없으므로 '대기' 로 남는다.
         */
        orderedActivities() {
            const all = this.activities || [];
            if (all.length === 0) return [];

            const byId = new Map(all.map((a) => [a.id, a]));
            const next = new Map();
            (this.sequences || []).forEach((seq) => {
                if (!seq || !seq.source) return;
                if (!next.has(seq.source)) next.set(seq.source, []);
                next.get(seq.source).push(seq.target);
            });

            const start = (this.events || []).find((e) => e && e.type === 'startEvent');
            if (!start || next.size === 0) return all;

            const ordered = [];
            const seen = new Set();
            const walk = (id) => {
                if (!id || seen.has(id)) return;
                seen.add(id);
                if (byId.has(id)) ordered.push(byId.get(id));
                (next.get(id) || []).forEach(walk);
            };
            walk(start.id);

            // 흐름에서 닿지 못한 것(끊긴 정의 등)도 뒤에 붙인다. 빠뜨리는 것보다 낫다.
            all.forEach((a) => {
                if (!seen.has(a.id)) ordered.push(a);
            });
            return ordered;
        }
    },
    methods: {
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
                this.$nextTick(this.scrollToCurrent);
            } catch (e) {
                // 흐름을 못 읽어도 대화는 열려야 한다. 줄만 접는다.
                this.activities = [];
                this.sequences = [];
                this.events = [];
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
</style>
