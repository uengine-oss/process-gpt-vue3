<template>
    <div class="kbt">
        <div class="kbt__head">
            <span class="kbt__title">폴더</span>
            <span class="kbt__spacer" />
            <v-btn
                v-if="hasChildren.size > 0"
                icon
                variant="text"
                size="x-small"
                :title="allExpanded ? '모두 접기' : '모두 펴기'"
                @click="$emit('expand-all', !allExpanded)"
            >
                <v-icon size="16">{{ allExpanded ? 'mdi-unfold-less-horizontal' : 'mdi-unfold-more-horizontal' }}</v-icon>
            </v-btn>
            <v-btn icon variant="text" size="x-small" title="새 폴더" @click="startCreate('')">
                <v-icon size="16">mdi-folder-plus-outline</v-icon>
            </v-btn>
        </div>

        <div class="kbt__list" @contextmenu.prevent="openMenu($event, null)">
            <div v-if="creating.active && creating.parent === ''" class="kbt__row kbt__row--input" style="padding-left: 8px">
                <span class="kbt__caret kbt__caret--spacer" />
                <v-icon size="14" color="#ffa726">mdi-folder-plus</v-icon>
                <input
                    ref="createInput"
                    v-model="creating.name"
                    class="kbt__input"
                    placeholder="새 폴더 이름 (Enter)"
                    @keyup.enter="commitCreate"
                    @keyup.esc="cancelCreate"
                    @blur="commitCreate"
                />
            </div>

            <div v-if="!nodes.length && !creating.active" class="kbt__empty">
                아직 폴더가 없습니다. 폴더를 만들고 문서를 올리면 지도가 만들어집니다.
            </div>

            <template v-for="node in visible" :key="node.path">
                <div
                    class="kbt__row"
                    :class="{ 'is-active': node.path === current }"
                    :style="{ paddingLeft: `${8 + node.depth * 12}px` }"
                    :title="node.path"
                    @click="$emit('select', node.path)"
                    @contextmenu.prevent.stop="openMenu($event, node)"
                >
                    <span v-if="hasChildren.has(node.path)" class="kbt__caret" @click.stop="$emit('toggle', node.path)">
                        <v-icon size="16">{{ expanded[node.path] ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                    </span>
                    <span v-else class="kbt__caret kbt__caret--spacer" />
                    <v-icon size="14" :color="node.nTotal ? '#ffa726' : '#9e9e9e'">
                        {{ expanded[node.path] && hasChildren.has(node.path) ? 'mdi-folder-open' : node.nTotal ? 'mdi-folder' : 'mdi-folder-outline' }}
                    </v-icon>
                    <span class="kbt__name">{{ node.name }}</span>
                    <span v-if="node.nTotal" class="kbt__dot" :class="`is-${dominant(node)}`" :title="readinessTitle(node)" />
                    <span v-if="node.nDirect" class="kbt__count">{{ node.nDirect }}</span>
                    <v-btn icon variant="text" size="x-small" class="kbt__more" @click.stop="openMenu($event, node)">
                        <v-icon size="15">mdi-dots-horizontal</v-icon>
                    </v-btn>
                </div>
                <div
                    v-if="creating.active && creating.parent === node.path"
                    class="kbt__row kbt__row--input"
                    :style="{ paddingLeft: `${8 + (node.depth + 1) * 12}px` }"
                >
                    <span class="kbt__caret kbt__caret--spacer" />
                    <v-icon size="14" color="#ffa726">mdi-folder-plus</v-icon>
                    <input
                        ref="createInput"
                        v-model="creating.name"
                        class="kbt__input"
                        placeholder="새 폴더 이름 (Enter)"
                        @keyup.enter="commitCreate"
                        @keyup.esc="cancelCreate"
                        @blur="commitCreate"
                    />
                </div>
            </template>
        </div>

        <v-menu v-model="menu.show" :target="[menu.x, menu.y]" location="bottom start" :close-on-content-click="true">
            <v-list density="compact" min-width="180">
                <v-list-item prepend-icon="mdi-folder-plus-outline" title="새 하위 폴더" @click="startCreate(menu.node ? menu.node.path : '')" />
                <template v-if="menu.node && canManage">
                    <v-list-item prepend-icon="mdi-map-refresh" title="폴더 카드 다시 만들기" @click="$emit('rebuild-card', menu.node)" />
                    <v-list-item prepend-icon="mdi-pencil-outline" title="이름 변경" @click="$emit('rename', menu.node)" />
                    <v-divider />
                    <v-list-item prepend-icon="mdi-delete-outline" title="폴더 삭제" class="text-error" @click="$emit('remove', menu.node)" />
                </template>
            </v-list>
        </v-menu>
    </div>
</template>

<script>
import { DOC_STATES } from './kbRoles';

export default {
    name: 'KbFolderTree',
    props: {
        // 평탄화된 폴더 노드 — {path, name, depth, nDirect, nTotal, readiness}. 경로순 정렬.
        nodes: { type: Array, default: () => [] },
        current: { type: String, default: '' },
        expanded: { type: Object, default: () => ({}) },
        canManage: { type: Boolean, default: false }
    },
    emits: ['select', 'toggle', 'expand-all', 'create', 'rename', 'remove', 'rebuild-card'],
    data() {
        return {
            creating: { active: false, parent: '', name: '' },
            menu: { show: false, x: 0, y: 0, node: null }
        };
    },
    computed: {
        hasChildren() {
            const set = new Set();
            for (const n of this.nodes) {
                const p = n.path.includes('/') ? n.path.slice(0, n.path.lastIndexOf('/')) : '';
                if (p) set.add(p);
            }
            return set;
        },
        visible() {
            return this.nodes.filter((n) => {
                const segs = n.path.split('/');
                let acc = '';
                for (let i = 0; i < segs.length - 1; i++) {
                    acc = acc ? `${acc}/${segs[i]}` : segs[i];
                    if (!this.expanded[acc]) return false;
                }
                return true;
            });
        },
        allExpanded() {
            if (!this.hasChildren.size) return false;
            for (const p of this.hasChildren) if (!this.expanded[p]) return false;
            return true;
        }
    },
    methods: {
        // 폴더의 대표 상태 — 실패가 하나라도 있으면 실패, 만드는 중이 있으면 진행, 다 됐으면 완료.
        dominant(node) {
            const r = node.readiness || {};
            if (r.failed) return 'failed';
            if (r.pending) return 'pending';
            if (r.ready) return 'ready';
            if (r.no_text) return 'no_text';
            return 'pending';
        },
        readinessTitle(node) {
            const r = node.readiness || {};
            return Object.keys(DOC_STATES)
                .filter((k) => r[k])
                .map((k) => `${DOC_STATES[k].label} ${r[k]}`)
                .join(' · ');
        },
        openMenu(e, node) {
            this.menu = { show: true, x: e.clientX, y: e.clientY, node };
        },
        startCreate(parent) {
            this.creating = { active: true, parent: parent || '', name: '' };
            if (parent && !this.expanded[parent]) this.$emit('toggle', parent);
            this.$nextTick(() => {
                const el = Array.isArray(this.$refs.createInput) ? this.$refs.createInput[0] : this.$refs.createInput;
                el && el.focus();
            });
        },
        cancelCreate() {
            this.creating = { active: false, parent: '', name: '' };
        },
        commitCreate() {
            if (!this.creating.active) return;
            const name = (this.creating.name || '').trim().replace(/[\\/]+/g, '-');
            const parent = this.creating.parent;
            this.cancelCreate();
            if (!name) return;
            this.$emit('create', parent ? `${parent}/${name}` : name);
        }
    }
};
</script>

<style scoped>
.kbt {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
}
.kbt__head {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 6px 8px 6px 12px;
    border-bottom: 1px solid var(--cds-border);
}
.kbt__title {
    font-size: 12px;
    font-weight: 600;
    color: var(--cds-text-secondary);
}
.kbt__spacer {
    flex: 1;
}
.kbt__list {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 4px 0;
}
.kbt__empty {
    padding: 16px 12px;
    font-size: 12px;
    color: var(--cds-text-muted);
    line-height: 1.5;
}
.kbt__row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px 4px 0;
    cursor: pointer;
    user-select: none;
    border-radius: 4px;
    margin: 0 4px;
}
.kbt__row:hover {
    background: var(--cds-bg-neutral);
}
.kbt__row.is-active {
    background: rgba(var(--v-theme-primary), 0.1);
}
.kbt__caret {
    flex: 0 0 16px;
    display: inline-flex;
    color: var(--cds-text-muted);
}
.kbt__caret--spacer {
    visibility: hidden;
}
.kbt__name {
    flex: 1;
    font-size: 13px;
    color: var(--cds-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.kbt__count {
    font-size: 11px;
    color: var(--cds-text-muted);
    background: var(--cds-bg-neutral);
    border-radius: 10px;
    padding: 1px 7px;
}
.kbt__dot {
    flex: 0 0 8px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
}
.kbt__dot.is-ready {
    background: var(--cds-text-success);
}
.kbt__dot.is-pending {
    background: #90a4ae;
    animation: kbt-pulse 1.6s ease-in-out infinite;
}
.kbt__dot.is-failed {
    background: var(--cds-text-danger);
}
.kbt__dot.is-no_text {
    background: var(--cds-text-warning);
}
@keyframes kbt-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.35; }
}
.kbt__more {
    opacity: 0;
}
.kbt__row:hover .kbt__more {
    opacity: 1;
}
.kbt__row--input {
    cursor: default;
}
.kbt__input {
    flex: 1;
    min-width: 0;
    font-size: 13px;
    padding: 2px 6px;
    border: 1px solid var(--cds-border-strong);
    border-radius: 4px;
    outline: none;
    background: var(--cds-surface-2, #fff);
}
</style>
