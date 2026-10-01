<template>
    <span :class="['pr-type-chip', 'ptc--' + (type || 'skill')]">{{ resourceTypeLabel(type) }}</span>
</template>

<script>
import { resourceTypeLabel } from '@/composables/usePrUtils';

export default {
    name: 'PrTypeChip',
    props: {
        /** 'skill' | 'bpmn' | 'dmn' */
        type: { type: String, default: 'skill' }
    },
    methods: { resourceTypeLabel }
};
</script>

<style scoped>
/* 종류는 글자보다 색으로 먼저 갈린다 — 목록을 훑을 때 읽지 않고 알아보게 한다. */
.pr-type-chip {
    display: inline-block;
    font-size: 10.5px;
    font-weight: 700;
    line-height: 1.6;
    border-radius: 5px;
    padding: 0 6px;
    white-space: nowrap;
}
.ptc--skill {
    background: rgba(107, 70, 193, 0.12);
    color: #5b46b8;
}
.ptc--bpmn {
    background: rgba(47, 107, 255, 0.12);
    color: #2f6bff;
}
.ptc--dmn {
    background: rgba(224, 130, 43, 0.16);
    color: #a75f12;
}
</style>
