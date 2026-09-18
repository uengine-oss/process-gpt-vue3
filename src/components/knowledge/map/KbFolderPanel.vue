<template>
    <div class="kfp">
        <div class="kfp__crumb">
            <v-icon size="15" class="mr-1">mdi-map-outline</v-icon>
            <button type="button" class="kfp__crumb-item" :class="{ 'is-current': !folderPath }" @click="$emit('select', '')">지식베이스</button>
            <template v-for="(seg, i) in crumbs" :key="seg.path">
                <v-icon size="14" class="kfp__crumb-sep">mdi-chevron-right</v-icon>
                <button type="button" class="kfp__crumb-item" :class="{ 'is-current': i === crumbs.length - 1 }" @click="$emit('select', seg.path)">
                    {{ seg.name }}
                </button>
            </template>
        </div>

        <!-- 루트: 지도 전체 상태 -->
        <template v-if="!folderPath">
            <div class="kfp__card kfp__card--root">
                <div class="kfp__card-head">
                    <v-icon size="18" color="primary">mdi-map-search-outline</v-icon>
                    <span class="kfp__card-title">{{ role.label }} 지도</span>
                </div>
                <p class="kfp__lead">
                    폴더마다 무엇이 있고 무엇부터 읽어야 하는지가 카드로 정리됩니다. 채팅에서 폴더를 고르면 에이전트가 이 지도를 보고
                    문서를 찾아 들어갑니다.
                </p>
                <KbReadiness :readiness="overallReadiness" />
                <div v-if="roots.length" class="kfp__grid mt-3">
                    <button v-for="f in roots" :key="f.path" type="button" class="kfp__sub" @click="$emit('select', f.path)">
                        <div class="kfp__sub-head">
                            <v-icon size="16" color="#ffa726">mdi-folder</v-icon>
                            <span class="kfp__sub-name">{{ f.name }}</span>
                            <span class="kfp__sub-count">{{ f.nTotal }}</span>
                        </div>
                        <div v-if="f.card && f.card.summary" class="kfp__sub-summary">{{ f.card.summary }}</div>
                        <div v-else class="kfp__sub-summary kfp__sub-summary--empty">아직 폴더 카드가 없습니다</div>
                    </button>
                </div>
                <div v-else class="kfp__empty">왼쪽에서 폴더를 만들고 문서를 올리면 여기에 지도가 생깁니다.</div>
            </div>
        </template>

        <template v-else>
            <!-- 폴더 카드 -->
            <div class="kfp__card">
                <div class="kfp__card-head">
                    <v-icon size="18" color="primary">mdi-card-text-outline</v-icon>
                    <span class="kfp__card-title">{{ leaf }}</span>
                    <v-chip v-if="cardState === 'pending'" size="x-small" color="grey" variant="tonal">
                        <v-progress-circular indeterminate size="10" width="2" class="mr-1" />카드 만드는 중
                    </v-chip>
                    <v-chip v-else-if="card && card.built_at" size="x-small" variant="text" class="text-medium-emphasis">{{ formatDate(card.built_at) }} 기준</v-chip>
                    <v-spacer />
                    <v-btn
                        v-if="canManage && node && node.nTotal"
                        size="x-small"
                        variant="text"
                        prepend-icon="mdi-map-refresh"
                        :loading="rebuilding"
                        @click="$emit('rebuild-card')"
                    >
                        카드 다시 만들기
                    </v-btn>
                </div>

                <template v-if="card && card.summary">
                    <p class="kfp__lead">{{ card.summary }}</p>
                    <div v-if="card.topics && card.topics.length" class="kfp__tags">
                        <span v-for="t in card.topics" :key="t" class="kfp__tag">{{ t }}</span>
                    </div>
                    <div v-if="card.reading_guide && card.reading_guide.length" class="kfp__guide">
                        <div class="kfp__guide-title"><v-icon size="14" class="mr-1">mdi-sign-direction</v-icon>어떻게 읽나</div>
                        <ul>
                            <li v-for="g in card.reading_guide" :key="g">{{ g }}</li>
                        </ul>
                    </div>
                    <div v-if="card.start_with && card.start_with.length" class="kfp__start">
                        <span class="kfp__start-label">먼저 열 문서</span>
                        <button
                            v-for="name in card.start_with"
                            :key="name"
                            type="button"
                            class="kfp__start-chip"
                            :disabled="!docByName(name)"
                            @click="docByName(name) && $emit('open-doc', docByName(name))"
                        >
                            <v-icon size="13">mdi-file-document-outline</v-icon>{{ name }}
                        </button>
                    </div>
                </template>
                <p v-else-if="cardState === 'pending'" class="kfp__lead kfp__lead--muted">
                    문서 카드가 준비되는 대로 폴더 카드를 만듭니다. 그동안에도 본문은 읽을 수 있습니다.
                </p>
                <p v-else-if="node && node.nTotal" class="kfp__lead kfp__lead--muted">
                    아직 이 폴더의 카드가 없습니다.
                    <a v-if="canManage" href="#" @click.prevent="$emit('rebuild-card')">지금 만들기</a>
                </p>
                <p v-else class="kfp__lead kfp__lead--muted">빈 폴더입니다. 문서를 올리면 카드가 만들어집니다.</p>

                <KbReadiness v-if="node && node.nTotal" :readiness="node.readiness" class="mt-3" />
            </div>

            <!-- 하위 폴더 -->
            <div v-if="subfolders.length" class="kfp__grid">
                <button v-for="f in subfolders" :key="f.folder_path" type="button" class="kfp__sub" @click="$emit('select', f.folder_path)">
                    <div class="kfp__sub-head">
                        <v-icon size="16" color="#ffa726">mdi-folder</v-icon>
                        <span class="kfp__sub-name">{{ f.name }}</span>
                        <span class="kfp__sub-count">{{ f.n_docs_total }}</span>
                    </div>
                    <div v-if="f.card && f.card.summary" class="kfp__sub-summary">{{ f.card.summary }}</div>
                    <div v-else class="kfp__sub-summary kfp__sub-summary--empty">아직 폴더 카드가 없습니다</div>
                </button>
            </div>

            <KbUploadZone :folder-path="folderPath" :role="role.value" class="mt-3" @uploaded="$emit('uploaded', $event)" @notify="$emit('notify', $event)" />

            <div class="kfp__docs">
                <div class="kfp__docs-head">
                    <span class="kfp__docs-title">문서</span>
                    <span class="kfp__docs-count">{{ nDirect }}</span>
                </div>
                <KbDocList :docs="docs" :loading="loading" :overflow="overflow" :n-direct="nDirect" @open="$emit('open-doc', $event)" @query="$emit('query', $event)" />
            </div>
        </template>
    </div>
</template>

<script>
import KbUploadZone from './KbUploadZone.vue';
import KbDocList from './KbDocList.vue';
import KbReadiness from './KbReadiness.vue';
import { roleMeta } from './kbRoles';
import { formatDate, leafOf, ancestorsOf } from './kbFormat';

export default {
    name: 'KbFolderPanel',
    components: { KbUploadZone, KbDocList, KbReadiness },
    props: {
        folderPath: { type: String, default: '' },
        roleValue: { type: String, default: 'content' },
        // /folders/open 응답
        data: { type: Object, default: null },
        // 트리의 이 폴더 노드(readiness, nTotal)
        node: { type: Object, default: null },
        roots: { type: Array, default: () => [] },
        overallReadiness: { type: Object, default: null },
        loading: { type: Boolean, default: false },
        rebuilding: { type: Boolean, default: false },
        canManage: { type: Boolean, default: false }
    },
    emits: ['select', 'open-doc', 'uploaded', 'notify', 'rebuild-card', 'query'],
    computed: {
        role() {
            return roleMeta(this.roleValue);
        },
        leaf() {
            return leafOf(this.folderPath);
        },
        crumbs() {
            return ancestorsOf(this.folderPath).map((p) => ({ path: p, name: leafOf(p) }));
        },
        card() {
            return this.data?.card || this.node?.card || null;
        },
        // 카드가 없는데 문서 카드가 아직 만들어지는 중이면 폴더 카드도 곧 온다.
        cardState() {
            if (this.card && this.card.summary) return 'done';
            const r = this.node?.readiness || {};
            return r.pending ? 'pending' : 'none';
        },
        subfolders() {
            return this.data?.subfolders || [];
        },
        docs() {
            return this.data?.docs || [];
        },
        overflow() {
            return !!this.data?.overflow;
        },
        nDirect() {
            return this.data?.n_docs_direct ?? this.docs.length;
        }
    },
    methods: {
        formatDate,
        docByName(name) {
            return this.docs.find((d) => d.file_name === name) || null;
        }
    }
};
</script>

<style scoped>
.kfp {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px 16px 24px;
}
.kfp__crumb {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    font-size: 12.5px;
    color: var(--cds-text-muted);
}
.kfp__crumb-item {
    background: none;
    border: 0;
    padding: 2px 4px;
    font: inherit;
    color: var(--cds-text-secondary);
    cursor: pointer;
    border-radius: 4px;
}
.kfp__crumb-item:hover {
    background: var(--cds-bg-neutral);
}
.kfp__crumb-item.is-current {
    color: var(--cds-text-primary);
    font-weight: 600;
    cursor: default;
}
.kfp__crumb-sep {
    color: var(--cds-text-muted);
}
.kfp__card {
    border: 1px solid var(--cds-border);
    border-radius: var(--cds-radius, 10px);
    padding: 14px 16px;
    background: var(--cds-surface-2, #fff);
}
.kfp__card--root {
    background: linear-gradient(180deg, rgba(var(--v-theme-primary), 0.04), transparent 60%);
}
.kfp__card-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
}
.kfp__card-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--cds-text-primary);
}
.kfp__lead {
    margin: 0;
    font-size: 13.5px;
    line-height: 1.65;
    color: var(--cds-text-primary);
    white-space: pre-line;
}
.kfp__lead--muted {
    color: var(--cds-text-muted);
    font-size: 12.5px;
}
.kfp__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 10px;
}
.kfp__tag {
    font-size: 12px;
    padding: 2px 9px;
    border-radius: 12px;
    background: var(--cds-bg-neutral);
    color: var(--cds-text-secondary);
}
.kfp__guide {
    margin-top: 12px;
    padding: 10px 12px;
    border-radius: 8px;
    background: rgba(var(--v-theme-primary), 0.05);
}
.kfp__guide-title {
    display: flex;
    align-items: center;
    font-size: 12px;
    font-weight: 600;
    color: rgb(var(--v-theme-primary));
    margin-bottom: 4px;
}
.kfp__guide ul {
    margin: 0;
    padding-left: 18px;
    font-size: 13px;
    line-height: 1.6;
}
.kfp__start {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
}
.kfp__start-label {
    font-size: 12px;
    color: var(--cds-text-muted);
    margin-right: 2px;
}
.kfp__start-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font: inherit;
    font-size: 12px;
    padding: 3px 10px;
    border-radius: 12px;
    border: 1px solid var(--cds-border-strong);
    background: transparent;
    color: var(--cds-text-primary);
    cursor: pointer;
}
.kfp__start-chip:hover:not(:disabled) {
    background: var(--cds-bg-neutral);
}
.kfp__start-chip:disabled {
    opacity: 0.5;
    cursor: default;
}
.kfp__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 8px;
}
.kfp__sub {
    text-align: left;
    font: inherit;
    border: 1px solid var(--cds-border);
    border-radius: 8px;
    background: transparent;
    padding: 10px 12px;
    cursor: pointer;
    min-width: 0;
}
.kfp__sub:hover {
    background: var(--cds-bg-neutral);
}
.kfp__sub-head {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
}
.kfp__sub-name {
    flex: 1;
    font-size: 13px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.kfp__sub-count {
    font-size: 11px;
    color: var(--cds-text-muted);
    background: var(--cds-bg-neutral);
    border-radius: 10px;
    padding: 1px 7px;
}
.kfp__sub-summary {
    margin-top: 4px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--cds-text-secondary);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
.kfp__sub-summary--empty {
    color: var(--cds-text-muted);
    font-style: italic;
}
.kfp__empty {
    padding: 18px 0 4px;
    font-size: 12.5px;
    color: var(--cds-text-muted);
}
.kfp__docs-head {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin: 6px 0 8px;
}
.kfp__docs-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--cds-text-secondary);
}
.kfp__docs-count {
    font-size: 12px;
    color: var(--cds-text-muted);
}
</style>
