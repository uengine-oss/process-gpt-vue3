<template>
    <div v-if="total" class="kbr" :title="title">
        <div class="kbr__bar">
            <span v-for="k in keys" :key="k" class="kbr__seg" :class="`is-${k}`" :style="{ flex: r[k] }" />
        </div>
        <div class="kbr__legend">
            <span v-for="k in keys" :key="k" class="kbr__item" :class="`is-${k}`">
                <i class="kbr__swatch" />{{ DOC_STATES[k].label }} {{ r[k] }}
            </span>
            <span class="kbr__total">문서 {{ total }}</span>
        </div>
    </div>
</template>

<script>
import { DOC_STATES } from './kbConstants';

// 지도가 얼마나 채워졌는지 — 백엔드 readiness {ready,pending,failed,no_text,total} 그대로.
export default {
    name: 'KbReadiness',
    props: { readiness: { type: Object, default: null } },
    data() {
        return { DOC_STATES };
    },
    computed: {
        r() {
            return this.readiness || {};
        },
        total() {
            return this.r.total || 0;
        },
        keys() {
            return Object.keys(DOC_STATES).filter((k) => this.r[k]);
        },
        title() {
            return this.keys.map((k) => `${DOC_STATES[k].label} ${this.r[k]}`).join(' · ');
        }
    }
};
</script>

<style scoped>
.kbr__bar {
    display: flex;
    height: 6px;
    border-radius: 3px;
    overflow: hidden;
    background: var(--cds-bg-neutral);
    gap: 1px;
}
.kbr__seg.is-ready {
    background: var(--cds-text-success);
}
.kbr__seg.is-pending {
    background: #90a4ae;
}
.kbr__seg.is-failed {
    background: var(--cds-text-danger);
}
.kbr__seg.is-no_text {
    background: var(--cds-text-warning);
}
.kbr__legend {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    margin-top: 5px;
    font-size: 11.5px;
    color: var(--cds-text-secondary);
}
.kbr__item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
}
.kbr__swatch {
    width: 8px;
    height: 8px;
    border-radius: 2px;
    display: inline-block;
}
.kbr__item.is-ready .kbr__swatch {
    background: var(--cds-text-success);
}
.kbr__item.is-pending .kbr__swatch {
    background: #90a4ae;
}
.kbr__item.is-failed .kbr__swatch {
    background: var(--cds-text-danger);
}
.kbr__item.is-no_text .kbr__swatch {
    background: var(--cds-text-warning);
}
.kbr__total {
    margin-left: auto;
    color: var(--cds-text-muted);
}
</style>
