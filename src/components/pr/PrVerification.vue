<template>
    <div class="pr-verification">
        <!-- 검증할 시나리오 자체가 없는 리소스 -->
        <div v-if="loaded && !hasSuite" class="pv-empty">
            <!-- 생성 중 -->
            <template v-if="backfilling">
                <v-progress-circular indeterminate size="30" width="2.5" color="primary" />
                <div class="pv-empty-title">{{ backfillPhaseTitle }}</div>
                <div class="pv-empty-desc">
                    변경 전(<code>{{ backfill.base_ref }}</code
                    >) 버전으로 후보 시나리오를 실제로 실행해 보고, 지금 버전이 실제로 통과하는 단계만 남깁니다. 몇 분 걸립니다 — 이 탭을
                    벗어나도 계속 진행됩니다.
                </div>
            </template>

            <!-- 생성해 볼 수 있는 상태 -->
            <template v-else>
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.35">
                    <path d="M9 3h6M10 3v6l-5.5 9A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-3L14 9V3" />
                </svg>
                <div class="pv-empty-title">병합 전에 비교할 시나리오가 없습니다</div>

                <!-- 스킬: 지금 만들어 둘 수 있다 -->
                <template v-if="isSkill">
                    <div class="pv-empty-desc">
                        이 스킬은 주요 시나리오를 확보하는 단계를 거치지 않고 만들어졌습니다. 비교 기준이 없어 이 병합이 기존 동작을
                        깨뜨리는지 자동으로 확인할 수 없습니다.
                    </div>
                    <div class="pv-empty-desc mt-2">
                        지금 <b>변경 전 버전의 동작</b>을 기준으로 시나리오를 만들어 둘 수 있습니다. 만든 뒤에는 이 병합은 물론 앞으로의
                        변경도 검증할 수 있습니다.
                    </div>

                    <div v-if="backfillFailed" class="pv-error mt-3" style="text-align: left">
                        시나리오를 만들지 못했습니다. {{ backfill.error }}
                    </div>
                    <div v-if="backfillError" class="pv-error mt-3" style="text-align: left">{{ backfillError }}</div>

                    <button class="pv-run-btn mt-3" @click="generate">
                        {{ backfillFailed ? '시나리오 다시 만들기' : '시나리오 만들기' }}
                    </button>
                </template>

                <!-- 의사결정: 규칙 표에서 바로 파생할 수 있다(모델 호출 없음). -->
                <template v-else-if="isDmn">
                    <div class="pv-empty-desc">
                        이 의사결정에는 병합 전에 비교할 시나리오가 아직 없습니다. 비교 기준이 없어 이 병합이 기존 판정을 바꾸는지 자동으로
                        확인할 수 없습니다.
                    </div>
                    <div class="pv-empty-desc mt-2">
                        <b>변경 전 규칙 표</b>에서 시나리오를 만들 수 있습니다 — 규칙 행마다 그 행을 맞히는 입력과 임계값 경계, 어느 행에도
                        맞지 않는 입력을 뽑아 지금 표가 내는 결론을 기준으로 굳힙니다.
                    </div>

                    <div v-if="backfillError" class="pv-error mt-3" style="text-align: left">{{ backfillError }}</div>

                    <button class="pv-run-btn mt-3" :disabled="buildingScenarios" @click="generate">
                        {{ buildingScenarios ? '만드는 중…' : '시나리오 만들기' }}
                    </button>
                </template>

                <!-- 프로세스: 변경 전 정의의 갈림길 조합에서 바로 파생할 수 있다.
                     병합 전 검증도 저장된 분기 판정으로 정의를 재생하는 방식이라, 시나리오에
                     필요한 것은 실행 기록이 아니라 정의뿐이다(모델·엔진 호출 없음). -->
                <template v-else>
                    <div class="pv-empty-desc">
                        이 프로세스는 만들 때 <b>실행 엔진 검증</b>을 거치지 않아 비교에 쓸 시나리오가 남아 있지 않습니다. 비교 기준이 없어
                        이 병합이 기존 흐름을 바꾸는지 자동으로 확인할 수 없습니다.
                    </div>
                    <div class="pv-empty-desc mt-2">
                        <b>변경 전 정의</b>에서 시나리오를 만들 수 있습니다 — 갈림길마다 어느 분기로 갔을 때 어떤 경로를 지나는지를 지금
                        정의가 내는 흐름 그대로 굳힙니다.
                    </div>

                    <div v-if="backfillError" class="pv-error mt-3" style="text-align: left">{{ backfillError }}</div>

                    <button class="pv-run-btn mt-3" :disabled="buildingScenarios" @click="generate">
                        {{ buildingScenarios ? '만드는 중…' : '시나리오 만들기' }}
                    </button>
                </template>

                <div class="pv-empty-note">직접 검토하려면 변경사항 탭의 diff 를 보세요.</div>
            </template>
        </div>

        <template v-else>
            <!-- 자동 생성된 스위트라는 사실을 숨기지 않는다: 사람이 고른 시나리오가 아니라
                 변경 전 버전의 동작에서 뽑아낸 기준선이므로, "무엇을 지키는 중인지" 는
                 리뷰어가 직접 읽고 판단해야 한다. -->
            <div v-if="isSkill && generatedSuite" class="pv-origin">
                이 시나리오는 변경 전(<code>{{ backfill.base_ref }}</code
                >) 버전의 동작에서 자동으로 만들어졌습니다. 후보 {{ backfill.summary?.proposed }}건 중 그 버전이 실제로 통과한
                {{ backfill.summary?.accepted }}건만 남겼습니다.
            </div>

            <!-- 실행 컨트롤 -->
            <div class="pv-bar">
                <div class="pv-bar-text">
                    <template v-if="running">
                        <v-progress-circular indeterminate size="14" width="2" color="primary" class="mr-2" />
                        변경 전 / 변경 후 두 벌로 시나리오 {{ cases.length }}건을 실행하는 중…
                    </template>
                    <template v-else-if="run && run.status === 'failed'"> 검증이 완료되지 못했습니다. </template>
                    <template v-else-if="run"> {{ formatRelativeTime(run.finished_at || run.started_at) }} 검증 </template>
                    <template v-else> 시나리오 {{ cases.length }}건으로 병합 전후 동작을 비교합니다. </template>
                </div>
                <button class="pv-run-btn" :disabled="running" @click="start">
                    {{ run ? '다시 검증' : '검증 실행' }}
                </button>
            </div>

            <div v-if="startError" class="pv-error">{{ startError }}</div>
            <div v-if="run && run.status === 'failed'" class="pv-error">{{ run.error }}</div>

            <!-- 판정 배너 -->
            <div v-if="succeeded" class="pv-verdict" :class="verdictClass">
                <div class="pv-verdict-head">
                    <span class="pv-verdict-title">{{ verdictTitle }}</span>
                    <span class="pv-verdict-ref">{{ run.base_ref }} → {{ run.head_ref }}</span>
                </div>
                <div class="pv-verdict-sub">{{ verdictDesc }}</div>
            </div>

            <!-- 깨진 단계 -->
            <template v-if="succeeded && brokenByCase.length">
                <div class="pv-sec">병합하면 깨지는 단계</div>
                <div v-for="grp in brokenByCase" :key="grp.eval_name" class="pv-case broken">
                    <div class="pv-case-head">
                        <span class="pv-case-name">{{ grp.eval_name }}</span>
                        <span class="pv-cmp">
                            <span class="chip base">변경 전 {{ grp.baseLabel }}</span>
                            <span class="chip arrow">→</span>
                            <span class="chip head bad">변경 후 {{ grp.headLabel }}</span>
                        </span>
                    </div>
                    <div v-for="(b, i) in grp.broken" :key="i" class="pv-step broken">
                        <span class="pv-step-mark">✕</span>
                        <div>
                            <div class="pv-step-text">{{ b.step }}</div>
                            <div v-if="b.evidence" class="pv-step-ev">{{ b.evidence }}</div>
                        </div>
                    </div>
                </div>
            </template>

            <!-- 좋아진 단계 -->
            <template v-if="succeeded && fixed.length">
                <div class="pv-sec">이 변경으로 통과하게 된 단계</div>
                <div class="pv-case fixed">
                    <div v-for="(f, i) in fixed" :key="i" class="pv-step fixed">
                        <span class="pv-step-mark ok">✓</span>
                        <div>
                            <div class="pv-step-text">{{ f.step }}</div>
                            <div class="pv-step-sub">{{ f.eval_name }}</div>
                        </div>
                    </div>
                </div>
            </template>

            <!-- 신호를 얻지 못한 시나리오 -->
            <template v-if="succeeded && noSignal.length">
                <div class="pv-sec">판단할 수 없는 시나리오</div>
                <div class="pv-case warn">
                    <div v-for="name in noSignal" :key="name" class="pv-step">
                        <span class="pv-step-mark warn">!</span>
                        <div>
                            <div class="pv-step-text">{{ name }}</div>
                            <div class="pv-step-sub">
                                변경 전/후 모두 한 단계도 통과하지 못했습니다 — 달라졌는지 알 수 없습니다.
                                <template v-if="missingInputs[name]">
                                    시나리오가 참조하는 첨부 문서를 가져오지 못했습니다({{ missingInputs[name].join(', ') }}).
                                </template>
                            </div>
                        </div>
                    </div>
                </div>
            </template>

            <!-- 비교하지 못한 시나리오 -->
            <template v-if="succeeded && incomparable.length">
                <div class="pv-sec">비교하지 못한 시나리오</div>
                <div class="pv-case">
                    <div class="pv-step">
                        <span class="pv-step-mark warn">!</span>
                        <div>
                            <div class="pv-step-text">{{ incomparable.join(', ') }}</div>
                            <div class="pv-step-sub">두 버전 중 한쪽 실행이 완료되지 않아 달라졌는지 판단할 수 없습니다.</div>
                        </div>
                    </div>
                </div>
            </template>

            <!-- 검증 대상 시나리오 -->
            <div class="pv-sec">
                검증 대상 시나리오
                <span class="pv-sec-n">{{ cases.length }}</span>
                <!-- 자동으로 뽑은 시나리오가 늘 기준선으로 쓸 만한 것은 아니다. 리뷰어가
                     읽어 보고 미덥지 않다고 판단하면 현재 버전 기준으로 다시 뽑을 수 있어야
                     한다. 지금 것을 지우는 일이라 확인을 한 번 받는다. -->
                <span class="pv-sec-actions">
                    <template v-if="backfilling || buildingScenarios">
                        <v-progress-circular indeterminate size="12" width="2" color="primary" class="mr-1" />
                        {{ regeneratingLabel }}
                    </template>
                    <template v-else-if="confirmingRegenerate">
                        <span class="pv-confirm-text">지금 시나리오를 버리고 다시 만들까요?</span>
                        <button class="pv-link danger" :disabled="running" @click="regenerate">다시 만들기</button>
                        <button class="pv-link" @click="confirmingRegenerate = false">취소</button>
                    </template>
                    <button v-else class="pv-link" :disabled="running" @click="confirmingRegenerate = true">시나리오 다시 만들기</button>
                </span>
            </div>
            <div v-if="backfillFailed && hasSuite" class="pv-error">
                시나리오를 다시 만들지 못했습니다. {{ backfill.error }} — 기존 시나리오는 그대로 남아 있습니다.
            </div>
            <div v-if="backfillError && hasSuite" class="pv-error">{{ backfillError }}</div>
            <div v-for="c in cases" :key="c.eval_name" class="pv-case">
                <div class="pv-case-head">
                    <span class="pv-case-name">{{ c.eval_name }}</span>
                    <span v-if="caseCompare[c.eval_name]" class="pv-cmp">
                        <span class="chip base">변경 전 {{ caseCompare[c.eval_name].baseLabel }}</span>
                        <span class="chip arrow">→</span>
                        <span class="chip head" :class="caseCompare[c.eval_name].headClass">
                            변경 후 {{ caseCompare[c.eval_name].headLabel }}
                        </span>
                    </span>
                    <span v-else class="pv-case-n">검증 {{ (c.assertions || []).length }}단계</span>
                </div>
                <div class="pv-case-prompt">{{ casePromptText(c) }}</div>
            </div>
        </template>
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import { formatRelativeTime } from '@/composables/usePrUtils';

// 검증이 도는 동안의 폴링 간격(ms). 실행은 수 분 걸리므로 촘촘히 볼 이유가 없다.
const POLL_MS = 5000;

export default {
    name: 'PrVerification',
    props: {
        skillName: { type: String, required: true },
        // 스킬 병합 요청의 깃 PR 번호. 프로세스·DMN 요청에는 깃 PR 이 없어 비어 있다.
        prNumber: { type: Number, default: null },
        // 리소스 중립 경로용. 'skill' 이 아니면 prId 로 병합 요청을 찾는다.
        resourceType: { type: String, default: 'skill' },
        prId: { type: String, default: '' },
        // 변경 전 버전. 의사결정 시나리오를 이 버전의 규칙 표에서 뽑는다.
        baseRef: { type: String, default: '' }
    },
    emits: ['status'],
    data() {
        return {
            backend: null,
            loaded: false,
            hasSuite: false,
            cases: [],
            run: null,
            results: [],
            startError: '',
            // 시나리오 확보(backfill) 회차 — 시나리오가 없는 스킬에서만 의미가 있다.
            backfill: null,
            backfillError: '',
            confirmingRegenerate: false,
            buildingScenarios: false,
            pollTimer: null
        };
    },
    computed: {
        isSkill() {
            return (this.resourceType || 'skill') === 'skill';
        },
        isDmn() {
            return this.resourceType === 'dmn';
        },
        /** 프로세스(BPMN) 병합 요청인가 — 시나리오를 정의에서 파생하는 쪽. */
        isProcess() {
            return !this.isSkill && !this.isDmn;
        },
        /** 시나리오를 다시 뽑는 동안 그 자리에 띄울 문구. */
        regeneratingLabel() {
            if (this.isDmn) return '규칙 표에서 시나리오를 다시 뽑는 중…';
            if (this.isProcess) return '변경 전 정의에서 시나리오를 다시 뽑는 중…';
            return this.backfillPhaseTitle;
        },
        /** 이 병합 요청을 가리킬 수 있는가 — 스킬은 깃 PR 번호, 나머지는 요청 id. */
        addressed() {
            return this.isSkill ? !!this.prNumber : !!this.prId;
        },
        running() {
            return this.run?.status === 'running';
        },
        backfilling() {
            return this.backfill?.status === 'running';
        },
        backfillFailed() {
            return this.backfill?.status === 'failed';
        },
        /** 확보 단계를 그대로 노출한다 — 몇 분 걸리는 작업이라 어디쯤인지 보여야 한다. */
        backfillPhaseTitle() {
            const phase = this.backfill?.summary?.phase;
            if (phase === 'calibrating') {
                const n = this.backfill?.summary?.proposed;
                return n ? `후보 시나리오 ${n}건을 변경 전 버전으로 확인하는 중…` : '변경 전 버전으로 확인하는 중…';
            }
            return '변경 전 버전을 읽고 시나리오를 만드는 중…';
        },
        /** 이 스위트가 사람 손이 아니라 현재 동작에서 자동으로 뽑힌 것인지. */
        generatedSuite() {
            return this.backfill?.status === 'succeeded';
        },
        succeeded() {
            return this.run?.status === 'succeeded';
        },
        summary() {
            return this.run?.summary || {};
        },
        broken() {
            return this.summary.broken || [];
        },
        fixed() {
            return this.summary.fixed || [];
        },
        incomparable() {
            return this.summary.incomparable || [];
        },
        /** 두 버전 모두 한 단계도 통과하지 못해 아무 신호도 못 얻은 시나리오. */
        noSignal() {
            return this.summary.no_signal || [];
        },
        /** {시나리오: [준비 실패한 첨부 경로]} — no_signal 의 가장 흔한 원인. */
        missingInputs() {
            return this.summary.missing_inputs || {};
        },
        inconclusive() {
            return this.noSignal.length + this.incomparable.length;
        },
        verdictClass() {
            if (this.broken.length) return 'bad';
            return this.inconclusive ? 'warn' : 'ok';
        },
        verdictTitle() {
            if (this.broken.length) return `기존 동작 ${this.broken.length}개 단계가 깨집니다`;
            if (this.inconclusive) return `시나리오 ${this.inconclusive}건은 판단할 수 없습니다`;
            return '기존 동작이 깨지지 않습니다';
        },
        verdictDesc() {
            if (this.broken.length) {
                return '변경 전에는 통과하던 단계입니다. 병합하면 이 동작이 사라집니다.';
            }
            if (this.noSignal.length) {
                return '두 버전 모두 한 단계도 통과하지 못해 달라졌는지 알 수 없습니다. 깨진 곳이 없다는 뜻이 아닙니다.';
            }
            if (this.incomparable.length) {
                return '비교된 시나리오에서는 깨진 단계가 없지만, 한쪽 실행이 끝나지 않아 확인하지 못한 시나리오가 있습니다.';
            }
            return `시나리오 ${this.cases.length}건을 변경 전/후로 돌린 결과, 통과하던 단계가 깨진 곳이 없습니다.`;
        },
        /** eval_name → 변경 전/후 통과 수 비교 라벨 */
        caseCompare() {
            const out = {};
            for (const [name, v] of Object.entries(this.summary.per_case || {})) {
                if (!v.comparable) continue;
                const brokenN = (v.broken || []).length;
                out[name] = {
                    baseLabel: this.countLabel(v.base),
                    headLabel: this.countLabel(v.head),
                    headClass: brokenN ? 'bad' : 'good'
                };
            }
            return out;
        },
        brokenByCase() {
            return Object.entries(this.summary.per_case || {})
                .filter(([, v]) => (v.broken || []).length)
                .map(([name, v]) => ({
                    eval_name: name,
                    broken: v.broken,
                    baseLabel: this.countLabel(v.base),
                    headLabel: this.countLabel(v.head)
                }));
        }
    },
    watch: {
        prNumber() {
            this.reload();
        }
    },
    async created() {
        this.backend = BackendFactory.createBackend();
        await this.reload();
    },
    beforeUnmount() {
        this.stopPolling();
    },
    methods: {
        formatRelativeTime,
        /**
         * 시나리오 한 줄 요약.
         *
         * 스킬 시나리오의 prompt 는 사람이 읽는 지시문이라 그대로 보여 준다. 프로세스는
         * 입력값과 갈림길 판정을 담은 JSON 이라 그대로 뿌리면 읽을 수 없다 — 리뷰어가
         * 알아야 하는 것은 "어떤 입력으로 어느 길을 갔는가" 뿐이다.
         */
        casePromptText(c) {
            const raw = c.prompt || '';
            if (this.isSkill) return raw;
            let parsed;
            try {
                parsed = JSON.parse(raw);
            } catch (e) {
                return raw;
            }
            const parts = [];
            if (this.isDmn) {
                const values = parsed.inputs || {};
                const pairs = Object.entries(values)
                    .filter(([, v]) => v !== '' && v !== null && v !== undefined)
                    .map(([k, v]) => `${k}=${v}`);
                return pairs.length ? pairs.join(', ') : '입력값 없음';
            }
            const inputs = parsed.activity_inputs || {};
            for (const [activityId, values] of Object.entries(inputs)) {
                const pairs = Object.entries(values || {})
                    .map(([k, v]) => `${k}=${v}`)
                    .join(', ');
                if (pairs) parts.push(`${activityId}: ${pairs}`);
            }
            const decisions = parsed.gateway_decisions || {};
            for (const [gatewayId, d] of Object.entries(decisions)) {
                const seqs = (d && d.sequences) || {};
                const chosen = ((d && d.selected) || [])
                    .map((seqId) => (seqs[seqId] && (seqs[seqId].condition || seqs[seqId].target)) || seqId)
                    .join(', ');
                if (chosen) parts.push(`${gatewayId} → ${chosen}`);
            }
            if (parts.length) return parts.join(' · ');
            // 갈림길이 없는 프로세스는 고를 것도 넣을 것도 없다. 그렇다고 입력 JSON 을
            // 그대로 뿌리면 `{}` 만 보여 무엇을 지키는 시나리오인지 읽히지 않는다 —
            // 이 경우 지키려는 것은 경로 자체이므로 그것을 보여준다.
            return this.caseExpectedPath(c) || raw;
        },
        /** 이 시나리오가 기준으로 굳힌 실행 경로. 없으면 빈 문자열. */
        caseExpectedPath(c) {
            let expected;
            try {
                expected = JSON.parse(c.expected_output || '{}');
            } catch (e) {
                return '';
            }
            const order = (expected && expected.activity_order) || [];
            return order.length ? `경로 ${order.join(' → ')}` : '';
        },
        countLabel(v) {
            return v ? `${v.passed}/${v.total}` : '—';
        },
        async reload() {
            if (!this.backend || !this.skillName || !this.addressed) return;
            const data = this.isSkill
                ? await this.backend.getPrVerification(this.skillName, this.prNumber)
                : await this.backend.getResourceVerification(this.resourceType, this.skillName, this.prId);
            if (!data) {
                this.loaded = true;
                return;
            }
            this.hasSuite = !!data.has_suite;
            this.cases = data.cases || [];
            this.run = data.run || null;
            this.results = data.results || [];
            this.backfill = data.backfill || null;
            this.loaded = true;
            this.emitStatus();
            if (this.running || this.backfilling) this.startPolling();
            else this.stopPolling();
        },

        /** 변경 전 버전의 동작을 기준으로 시나리오를 만든다. */
        async generate(replace = false) {
            this.backfillError = '';
            if (this.isDmn) {
                // 규칙 표에서 파생하므로 바로 끝난다 — 폴링할 회차가 없다.
                this.buildingScenarios = true;
                try {
                    const built = await this.backend.buildDmnScenarios(this.skillName, {
                        baseRef: this.baseRef,
                        replace
                    });
                    if (built?.error) {
                        this.backfillError = built.message || built.error;
                        return;
                    }
                    await this.reload();
                } finally {
                    this.buildingScenarios = false;
                }
                return;
            }
            if (this.isProcess) {
                // 정의의 갈림길 조합에서 바로 파생하므로 바로 끝난다 — 폴링할 회차가 없다.
                this.buildingScenarios = true;
                try {
                    const built = await this.backend.buildProcessScenarios(this.skillName, {
                        baseRef: this.baseRef,
                        replace
                    });
                    if (built?.error) {
                        this.backfillError = built.message || built.error;
                        return;
                    }
                    await this.reload();
                } finally {
                    this.buildingScenarios = false;
                }
                return;
            }
            const data = await this.backend.startEvalBackfill(this.skillName, this.prNumber, { replace });
            if (data?.error) {
                this.backfillError = data.message || data.error;
                return;
            }
            this.backfill = data?.backfill || this.backfill;
            this.emitStatus();
            this.startPolling();
        },
        /** 지금 시나리오를 버리고 현재(변경 전) 버전 기준으로 다시 뽑는다. */
        async regenerate() {
            this.confirmingRegenerate = false;
            await this.generate(true);
        },
        async start() {
            this.startError = '';
            const data = this.isSkill
                ? await this.backend.startPrVerification(this.skillName, this.prNumber)
                : await this.backend.startResourceVerification(this.resourceType, this.skillName, this.prId);
            if (data?.error) {
                this.startError = data.message || data.error;
                return;
            }
            this.run = data?.run || this.run;
            this.emitStatus();
            this.startPolling();
        },
        startPolling() {
            this.stopPolling();
            this.pollTimer = setInterval(() => this.reload(), POLL_MS);
        },
        stopPolling() {
            if (this.pollTimer) {
                clearInterval(this.pollTimer);
                this.pollTimer = null;
            }
        },
        /** 병합 폼이 "깨진 단계가 있는데 병합하려는 상황" 을 알 수 있게 알린다. */
        emitStatus() {
            this.$emit('status', {
                hasSuite: this.hasSuite,
                status: this.run?.status || null,
                brokenCount: this.broken.length,
                incomparableCount: this.incomparable.length,
                noSignalCount: this.noSignal.length,
                backfillStatus: this.backfill?.status || null
            });
        }
    }
};
</script>

<style scoped>
.pr-verification {
    padding: 12px 16px 16px;
    text-align: left;
}

/* ── 빈 상태 ── */
.pv-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 36px 24px;
    color: rgba(var(--v-theme-on-surface), 0.6);
}
.pv-empty-title {
    margin-top: 10px;
    font-size: 13px;
    font-weight: 600;
    color: rgba(var(--v-theme-on-surface), 0.8);
}
.pv-empty-desc {
    margin-top: 6px;
    font-size: 12px;
    line-height: 1.55;
    max-width: 420px;
}
.pv-empty-note {
    margin-top: 10px;
    font-size: 11px;
    color: rgba(var(--v-theme-on-surface), 0.45);
}

/* ── 자동 생성된 스위트 출처 ── */
.pv-origin {
    font-size: 11.5px;
    line-height: 1.55;
    color: rgba(var(--v-theme-on-surface), 0.6);
    background: rgba(var(--v-theme-on-surface), 0.04);
    border-radius: 8px;
    padding: 8px 11px;
    margin-bottom: 10px;
}
.pv-origin code {
    font-size: 11px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    background: rgba(var(--v-theme-on-surface), 0.06);
    border-radius: 4px;
    padding: 1px 4px;
}

/* ── 실행 바 ── */
.pv-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    border-radius: 10px;
    margin-bottom: 10px;
}
.pv-bar-text {
    flex: 1;
    font-size: 12.5px;
    color: rgba(var(--v-theme-on-surface), 0.65);
    display: flex;
    align-items: center;
}
.pv-run-btn {
    border: none;
    background: rgb(var(--v-theme-primary));
    color: #fff;
    font-size: 12.5px;
    font-weight: 600;
    padding: 7px 14px;
    border-radius: 8px;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
}
.pv-run-btn:disabled {
    opacity: 0.5;
    cursor: default;
}

.pv-error {
    font-size: 12px;
    color: rgb(var(--v-theme-error));
    background: rgba(var(--v-theme-error), 0.08);
    border-radius: 8px;
    padding: 8px 11px;
    margin-bottom: 10px;
    line-height: 1.5;
}

/* ── 판정 ── */
.pv-verdict {
    border-radius: 12px;
    padding: 12px 14px;
    margin-bottom: 12px;
    border: 1px solid transparent;
}
.pv-verdict.ok {
    background: rgba(var(--v-theme-success), 0.08);
    border-color: rgba(var(--v-theme-success), 0.25);
}
.pv-verdict.bad {
    background: rgba(var(--v-theme-error), 0.08);
    border-color: rgba(var(--v-theme-error), 0.3);
}
.pv-verdict.warn {
    background: rgba(var(--v-theme-warning), 0.1);
    border-color: rgba(var(--v-theme-warning), 0.3);
}
.pv-verdict-head {
    display: flex;
    align-items: baseline;
    gap: 8px;
    flex-wrap: wrap;
}
.pv-verdict-title {
    font-size: 13.5px;
    font-weight: 700;
    color: rgba(var(--v-theme-on-surface), 0.87);
    /* 좁은 패널(병합 요청함 상세)에서는 옆의 브랜치 표기가 길어 제목이 한 글자씩
       세로로 접히곤 했다. 최소 폭을 줘서, 자리가 없으면 제목이 쪼개지는 대신
       브랜치 표기가 아랫줄로 내려가게 한다. */
    flex: 1 1 auto;
    min-width: 12em;
}
.pv-verdict-ref {
    font-size: 11px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    color: rgba(var(--v-theme-on-surface), 0.5);
    min-width: 0;
    overflow-wrap: anywhere;
}
.pv-verdict-sub {
    margin-top: 4px;
    font-size: 12px;
    line-height: 1.5;
    color: rgba(var(--v-theme-on-surface), 0.6);
}

/* ── 섹션 ── */
.pv-sec {
    font-size: 11.5px;
    font-weight: 600;
    color: rgba(var(--v-theme-on-surface), 0.45);
    padding: 10px 2px 6px;
    display: flex;
    align-items: center;
    gap: 6px;
}
.pv-sec-n {
    font-weight: 400;
}
/* 섹션 헤더 오른쪽 끝의 보조 동작(다시 만들기 / 진행 표시) */
.pv-sec-actions {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
}
.pv-confirm-text {
    color: rgba(var(--v-theme-on-surface), 0.7);
}
.pv-link {
    background: none;
    border: 0;
    padding: 0;
    font: inherit;
    color: rgb(var(--v-theme-primary));
    cursor: pointer;
}
.pv-link:hover {
    text-decoration: underline;
}
.pv-link:disabled {
    color: rgba(var(--v-theme-on-surface), 0.3);
    cursor: default;
    text-decoration: none;
}
.pv-link.danger {
    color: rgb(var(--v-theme-error));
    font-weight: 600;
}

/* ── 시나리오 카드 ── */
.pv-case {
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    border-radius: 11px;
    padding: 11px 13px;
    margin-bottom: 8px;
    background: rgb(var(--v-theme-surface));
}
.pv-case.broken {
    border-color: rgba(var(--v-theme-error), 0.35);
}
.pv-case.warn {
    border-color: rgba(var(--v-theme-warning), 0.4);
}
.pv-case-head {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}
.pv-case-name {
    font-size: 12.5px;
    font-weight: 600;
    color: rgba(var(--v-theme-on-surface), 0.85);
    /* 같은 이유 — 옆의 통과 수 칩에 밀려 이름이 한 글자씩 접히지 않게 한다. */
    flex: 1 1 auto;
    min-width: 9em;
    word-break: break-word;
}
.pv-case-n {
    font-size: 10.5px;
    color: rgba(var(--v-theme-on-surface), 0.45);
    white-space: nowrap;
}
.pv-cmp {
    display: inline-flex;
    align-items: center;
    gap: 4px;
}
.chip {
    font-size: 10.5px;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 6px;
    white-space: nowrap;
}
.chip.base {
    background: rgba(var(--v-theme-on-surface), 0.07);
    color: rgba(var(--v-theme-on-surface), 0.55);
}
.chip.arrow {
    padding: 0;
    color: rgba(var(--v-theme-on-surface), 0.35);
}
.chip.head.good {
    background: rgba(var(--v-theme-success), 0.13);
    color: rgb(var(--v-theme-success));
}
.chip.head.bad {
    background: rgba(var(--v-theme-error), 0.13);
    color: rgb(var(--v-theme-error));
}
.chip.head {
    background: rgba(var(--v-theme-primary), 0.1);
    color: rgb(var(--v-theme-primary));
}
.pv-case-prompt {
    margin-top: 7px;
    font-size: 11.5px;
    line-height: 1.5;
    color: rgba(var(--v-theme-on-surface), 0.6);
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 6em;
    overflow-y: auto;
    background: rgba(var(--v-theme-on-surface), 0.03);
    border-radius: 7px;
    padding: 7px 9px;
}

/* ── 단계 ── */
.pv-step {
    display: grid;
    grid-template-columns: 18px 1fr;
    gap: 4px;
    padding: 6px 0 0;
    font-size: 12px;
}
.pv-step-mark {
    font-weight: 700;
    color: rgb(var(--v-theme-error));
    line-height: 1.4;
}
.pv-step-mark.ok {
    color: rgb(var(--v-theme-success));
}
.pv-step-mark.warn {
    color: rgb(var(--v-theme-warning));
}
.pv-step-text {
    color: rgba(var(--v-theme-on-surface), 0.85);
    word-break: break-word;
}
.pv-step-sub {
    margin-top: 2px;
    font-size: 11px;
    color: rgba(var(--v-theme-on-surface), 0.5);
}
.pv-step-ev {
    margin-top: 3px;
    font-size: 11px;
    line-height: 1.45;
    color: rgba(var(--v-theme-on-surface), 0.55);
    background: rgba(var(--v-theme-error), 0.06);
    border-radius: 6px;
    padding: 5px 8px;
    word-break: break-word;
}
</style>
