<template>
    <div class="pr-def-compare">
        <div v-if="!hasSource" class="pdc-note">{{ $t('pr.changes.compare.noDetail') }}</div>

        <!-- 의사결정: 입력 데이터 · 결정 · 규칙표까지 이미 그려 주는 화면을 그대로 쓴다. -->
        <template v-else-if="isDmn">
            <DmnDiffView v-if="dmnPair" :previous="dmnPair.previous" :current="dmnPair.current" class="pdc-dmn" />
            <div v-else class="pdc-note">{{ $t('pr.changes.compare.noDetail') }}</div>
        </template>

        <!-- 프로세스: 정의가 곧 그림이다. 바뀐 요소에 색을 칠한 두 벌을 나란히 세운다. -->
        <template v-else>
            <div class="pdc-bar">
                <span class="pdc-legend">
                    <span class="pdc-dot pdc-dot--added"></span>{{ $t('pr.changes.compare.legendAdded') }}
                    <span class="pdc-dot pdc-dot--modified"></span>{{ $t('pr.changes.compare.legendModified') }}
                    <span class="pdc-dot pdc-dot--removed"></span>{{ $t('pr.changes.compare.legendRemoved') }}
                </span>
                <!--
                    폭이 좁으면 두 캔버스 모두 읽을 수 없게 눌린다. 그때는 한 벌씩 보여 주고
                    변경 전/후를 눌러 오가게 한다 — 색칠은 그대로라 무엇이 바뀌었는지는 남는다.
                -->
                <button class="pdc-mode" @click="side = side === 'both' ? 'head' : 'both'">
                    {{ side === 'both' ? $t('pr.changes.compare.showOne') : $t('pr.changes.compare.showBoth') }}
                </button>
            </div>

            <div v-if="undrawn.length" class="pdc-undrawn">
                {{ $t('pr.changes.compare.undrawn', { count: undrawn.length, names: undrawn.slice(0, 3).join(', ') }) }}
            </div>

            <div :class="['pdc-panes', { 'pdc-panes--single': side !== 'both' }]">
                <div v-if="side === 'both' || side === 'base'" class="pdc-pane">
                    <button :class="['pdc-pane-tab', { on: side !== 'both' }]" :disabled="side === 'both'" @click="side = 'head'">
                        {{ $t('pr.changes.compare.diagramBefore') }}
                    </button>
                    <div class="pdc-canvas">
                        <BpmnUengineViewer
                            ref="viewerBase"
                            :key="'base-' + renderKey"
                            :bpmn="baseXml"
                            :diffActivities="diffActivitiesBase"
                            :disable-auto-orientation="true"
                            @rendered="onRendered('base')"
                        />
                    </div>
                </div>

                <div v-if="side === 'both' || side === 'head'" class="pdc-pane">
                    <button :class="['pdc-pane-tab', { on: side !== 'both' }]" :disabled="side === 'both'" @click="side = 'base'">
                        {{ $t('pr.changes.compare.diagramAfter') }}
                    </button>
                    <div class="pdc-canvas">
                        <BpmnUengineViewer
                            ref="viewerHead"
                            :key="'head-' + renderKey"
                            :bpmn="headXml"
                            :diffActivities="diffActivitiesHead"
                            :disable-auto-orientation="true"
                            @rendered="onRendered('head')"
                        />
                    </div>
                </div>
            </div>
        </template>

        <!-- 원문은 판단하는 자리가 아니라 마지막으로 확인하는 자리다 — 한 단계 안쪽에 둔다. -->
        <div v-if="hasSource" class="pdc-raw">
            <button class="pdc-raw-toggle" @click="showRaw = !showRaw">
                {{ showRaw ? $t('pr.changes.compare.rawHide') : $t('pr.changes.compare.rawToggle') }}
            </button>
            <template v-if="showRaw">
                <div class="pdc-raw-note">{{ $t('pr.changes.compare.rawNote') }}</div>
                <div class="pdc-raw-diff">
                    <div v-for="(line, i) in rawDiff" :key="i" :class="['pdc-dl', 'pdc-dl--' + line.type]">
                        <span class="pdc-dl-mark">{{ line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' ' }}</span>
                        <span class="pdc-dl-text">{{ line.text }}</span>
                    </div>
                </div>
            </template>
        </div>
    </div>
</template>

<script>
import BpmnUengineViewer from '@/components/BpmnUengineViewer.vue';
import DmnDiffView from '@/components/dmn/DmnDiffView.vue';
import { parseDmnXml } from '@/utils/dmnParser';
import { diffLines } from '@/utils/lineDiff';

export default {
    name: 'PrDefinitionCompare',
    components: { BpmnUengineViewer, DmnDiffView },
    props: {
        /** 'bpmn' | 'dmn' */
        resourceType: { type: String, default: 'bpmn' },
        baseXml: { type: String, default: '' },
        headXml: { type: String, default: '' },
        diffActivitiesBase: { type: Object, default: () => ({}) },
        diffActivitiesHead: { type: Object, default: () => ({}) }
    },
    data() {
        return {
            // 좁은 화면에서 시작하면 처음부터 한 벌씩 — 눌린 캔버스 둘보다 읽히는 하나가 낫다.
            side: typeof window !== 'undefined' && window.innerWidth < 1400 ? 'head' : 'both',
            showRaw: false,
            renderKey: 0,
            /** 도형 좌표가 없어 그려지지 못한 요소 이름들. 침묵하면 "안 바뀌었다" 로 읽힌다. */
            undrawn: []
        };
    },
    computed: {
        isDmn() {
            return this.resourceType === 'dmn';
        },
        hasSource() {
            return !!(this.baseXml && this.headXml);
        },
        dmnPair() {
            if (!this.hasSource) return null;
            try {
                return { previous: parseDmnXml(this.baseXml), current: parseDmnXml(this.headXml) };
            } catch (e) {
                return null;
            }
        },
        rawDiff() {
            return this.hasSource ? diffLines(this.baseXml, this.headXml) : [];
        }
    },
    watch: {
        // 캔버스가 새로 붙을 때마다 다시 그린다 — 숨겨진 동안 크기가 0 이라 그대로 두면 빈 칸이 된다.
        side() {
            this.renderKey += 1;
        },
        headXml() {
            this.undrawn = [];
        }
    },
    methods: {
        /**
         * 바뀐 요소에 색을 칠한다.
         *
         * 뷰어도 import 직후 한 번 칠하지만, 자동 배치를 거치면 그 표시가 날아간다.
         * 같은 마커를 다시 얹는 것은 무해하므로 그리기가 끝날 때마다 한 번 더 칠한다.
         */
        paintMarkers(viewer, map) {
            const canvas = viewer.get('canvas');
            const registry = viewer.get('elementRegistry');
            Object.keys(map || {}).forEach((id) => {
                if (!registry.get(id)) return;
                try {
                    canvas.addMarker(id, `bpmn-diff-${map[id]}`);
                } catch (e) {
                    // 요소 하나가 실패해도 나머지 표시는 계속한다.
                }
            });
        },
        /** id → 이름. 못 그린 요소를 id 가 아니라 사람이 읽는 이름으로 부르기 위해서다. */
        nameOf(xml, ids) {
            const out = [];
            if (typeof DOMParser === 'undefined') return ids;
            try {
                const doc = new DOMParser().parseFromString(xml || '', 'application/xml');
                ids.forEach((id) => {
                    const el = doc.querySelector(`[id="${id}"]`);
                    out.push((el && el.getAttribute('name')) || id);
                });
            } catch (e) {
                return ids;
            }
            return out;
        },
        /**
         * 새로 추가된 요소가 도형 좌표(BPMNDI) 없이 저장돼 있으면 bpmn-js 는 그 요소를
         * 아예 그리지 않는다. 그러면 이 병합이 더하는 것이 그림에서 통째로 빠지는데,
         * 검토자에게는 "아무것도 안 바뀌었다" 로 보인다 — 빠졌다는 사실을 반드시 말한다.
         * (좌표를 지어내 다시 그려 봤지만 연결선이 끊긴 그림이 나와, 사실을 알리는 쪽을 택했다.)
         */
        reportUndrawn(viewer, map, xml) {
            const registry = viewer.get('elementRegistry');
            const missing = Object.keys(map || {}).filter((id) => !registry.get(id));
            this.undrawn = missing.length ? this.nameOf(xml, missing) : [];
        },
        onRendered(which) {
            const comp = which === 'base' ? this.$refs.viewerBase : this.$refs.viewerHead;
            const viewer = comp?.bpmnViewer;
            if (!viewer) return;
            const map = which === 'base' ? this.diffActivitiesBase : this.diffActivitiesHead;
            this.paintMarkers(viewer, map);
            // 못 그린 요소는 '변경 후' 쪽에서만 따진다 — 삭제된 요소가 '변경 후' 에 없는 것은 정상이다.
            if (which === 'head') this.reportUndrawn(viewer, map, this.headXml);
        }
    }
};
</script>

<style scoped>
.pr-def-compare {
    display: flex;
    flex-direction: column;
    min-height: 0;
    flex: 1;
}

.pdc-note {
    padding: 28px 20px;
    text-align: center;
    font-size: 12px;
    color: rgba(var(--v-theme-on-surface), 0.5);
}

.pdc-dmn {
    padding: 12px 14px;
    overflow-y: auto;
}

/* ── 프로세스 다이어그램 ── */
.pdc-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 12px;
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    flex: none;
}
.pdc-legend {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: rgba(var(--v-theme-on-surface), 0.55);
}
.pdc-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
    margin-left: 8px;
}
.pdc-dot--added {
    background: #2e6b16;
    margin-left: 0;
}
.pdc-dot--modified {
    background: #d99000;
}
.pdc-dot--removed {
    background: #c62828;
}
.pdc-mode {
    margin-left: auto;
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    background: none;
    font-family: inherit;
    font-size: 11.5px;
    padding: 3px 10px;
    border-radius: 7px;
    color: rgba(var(--v-theme-on-surface), 0.6);
    cursor: pointer;
}
.pdc-mode:hover {
    border-color: rgba(var(--v-theme-primary), 0.5);
}

/* 그림에서 빠진 것을 말해 주는 줄. 침묵이 곧 오해가 되는 자리라 눈에 띄게 둔다. */
.pdc-undrawn {
    margin: 8px 8px 0;
    padding: 7px 10px;
    border-radius: 8px;
    background: #fbf0da;
    color: #92610a;
    font-size: 12px;
    line-height: 1.5;
}

.pdc-panes {
    display: flex;
    gap: 8px;
    flex: 1;
    /*
     * 캔버스는 제 높이를 스스로 갖는다. 상세 영역은 스크롤 컨테이너라 flex 로만 두면
     * 내용 높이(=0)로 눌려 다이어그램이 띠처럼 얇아진다. 화면 높이를 따라가되 위아래로
     * 한계를 둔다 — 확대·이동은 뷰어가 알아서 한다.
     */
    height: clamp(320px, 48vh, 560px);
    padding: 8px;
}
.pdc-pane {
    display: flex;
    flex-direction: column;
    flex: 1 1 0;
    min-width: 0;
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    border-radius: 9px;
    overflow: hidden;
}
.pdc-pane-tab {
    border: none;
    background: rgba(var(--v-theme-on-surface), 0.04);
    font-family: inherit;
    font-size: 11.5px;
    font-weight: 600;
    color: rgba(var(--v-theme-on-surface), 0.6);
    padding: 5px 10px;
    text-align: left;
    cursor: default;
}
.pdc-pane-tab.on {
    cursor: pointer;
    color: rgb(var(--v-theme-primary));
}
.pdc-canvas {
    flex: 1;
    min-height: 0;
    position: relative;
}

/* ── 원문 ── */
.pdc-raw {
    flex: none;
    border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    padding: 8px 12px 12px;
}
.pdc-raw-toggle {
    border: none;
    background: none;
    padding: 0;
    font-family: inherit;
    font-size: 11.5px;
    color: rgba(var(--v-theme-on-surface), 0.5);
    text-decoration: underline;
    cursor: pointer;
}
.pdc-raw-note {
    margin: 6px 0;
    font-size: 11px;
    color: rgba(var(--v-theme-on-surface), 0.45);
}
.pdc-raw-diff {
    max-height: 320px;
    overflow: auto;
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    border-radius: 8px;
    padding: 6px 0;
    background: rgba(var(--v-theme-on-surface), 0.02);
}
.pdc-dl {
    display: flex;
    gap: 6px;
    font-family: ui-monospace, Menlo, monospace;
    font-size: 11px;
    line-height: 1.5;
    padding: 0 10px;
    white-space: pre-wrap;
    word-break: break-all;
}
.pdc-dl-mark {
    flex: none;
    width: 8px;
    color: rgba(var(--v-theme-on-surface), 0.35);
}
.pdc-dl--add {
    background: rgba(46, 107, 22, 0.1);
    color: #2e6b16;
}
.pdc-dl--del {
    background: rgba(var(--v-theme-error), 0.09);
    color: rgb(var(--v-theme-error));
}
.pdc-dl--ctx {
    color: rgba(var(--v-theme-on-surface), 0.55);
}
</style>
