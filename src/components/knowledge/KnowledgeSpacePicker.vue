<template>
    <v-dialog
        :modelValue="modelValue"
        @update:modelValue="$emit('update:modelValue', $event)"
        max-width="780"
        class="ksp-dialog"
    >
        <v-card class="ksp-card">
            <div class="ksp-header">
                <div class="ksp-title">
                    <v-icon size="20" color="primary" class="mr-2">mdi-bookshelf</v-icon>
                    <span>지식 베이스</span>
                    <span class="ksp-subtitle">채팅에 활용할 자료를 선택하세요</span>
                </div>
                <v-btn icon variant="text" size="small" @click="reload" :disabled="loading">
                    <v-icon>mdi-refresh</v-icon>
                </v-btn>
                <v-btn icon variant="text" size="small" @click="$emit('update:modelValue', false)">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </div>

            <!-- 출처 탭 -->
            <v-tabs v-model="activeSource" color="primary" density="compact" class="ksp-source-tabs">
                <!-- Google Drive 탭 숨김 (폐쇄망 운영) -->
                <!-- <v-tab value="drive">
                    <v-icon start size="16">mdi-google-drive</v-icon>
                    Google Drive
                    <v-chip size="x-small" color="primary" variant="tonal" class="ml-2">{{ counts.drive }}</v-chip>
                </v-tab> -->
                <v-tab value="upload">
                    <v-icon start size="16">mdi-cloud-upload-outline</v-icon>
                    Storage
                    <v-chip size="x-small" color="success" variant="tonal" class="ml-2">{{ counts.upload }}</v-chip>
                </v-tab>
            </v-tabs>
            <v-divider />

            <!-- 역할(doc_role) 필터 — Storage 탭에서만. 자료 종류별로 좁혀 보기. -->
            <div v-if="activeSource === 'upload'" class="ksp-role-bar">
                <button
                    v-for="r in roleFilterOptions"
                    :key="r.value"
                    class="ksp-role-chip"
                    :class="{ 'is-active': currentRole === r.value, [`is-${r.value}`]: true }"
                    @click="currentRole = r.value"
                >
                    <v-icon size="13" class="mr-1">{{ r.icon }}</v-icon>
                    <span>{{ r.label }}</span>
                    <span class="ksp-role-chip-count">{{ roleCounts[r.value] || 0 }}</span>
                </button>
            </div>

            <!-- 자동 활용 안내 배너 — 사전/양식이 선택돼 있으면 사용자가 의미를 알도록 -->
            <div v-if="autoUseHints.length > 0" class="ksp-auto-banner">
                <v-icon size="14" color="primary" class="mr-1">mdi-auto-fix</v-icon>
                <span class="text-caption">
                    <span v-for="(h, i) in autoUseHints" :key="h.role">
                        <span v-if="i > 0"> · </span>
                        <strong>{{ h.label }} {{ h.count }}개</strong> {{ h.action }}
                    </span>
                </span>
            </div>

            <div class="ksp-toolbar">
                <v-text-field
                    v-model="search"
                    density="compact"
                    variant="outlined"
                    hide-details
                    placeholder="파일명 검색"
                    prepend-inner-icon="mdi-magnify"
                    clearable
                    class="ksp-search"
                />
                <v-btn
                    variant="text"
                    size="small"
                    :prepend-icon="allExpanded ? 'mdi-collapse-all-outline' : 'mdi-expand-all-outline'"
                    @click="toggleExpandAll"
                >
                    {{ allExpanded ? '모두 접기' : '모두 펼치기' }}
                </v-btn>
            </div>

            <div class="ksp-bulk-row">
                <v-btn
                    variant="text"
                    size="small"
                    prepend-icon="mdi-checkbox-blank-off-outline"
                    :disabled="!hasSelection"
                    @click="clearSelection"
                >
                    선택 해제
                </v-btn>
                <span class="text-caption text-medium-emphasis ml-auto">
                    선택됨 {{ selectionLabel }}
                </span>
            </div>

            <v-divider />

            <div class="ksp-list">
                <div v-if="loading" class="ksp-state">
                    <v-progress-circular indeterminate color="primary" size="32" />
                    <div class="text-body-2 text-medium-emphasis mt-3">지식공간 폴더 로드 중...</div>
                </div>
                <div v-else-if="error" class="ksp-state">
                    <v-icon size="40" color="error">mdi-alert-circle-outline</v-icon>
                    <div class="text-body-2 text-medium-emphasis mt-2">{{ error }}</div>
                    <v-btn class="mt-3" variant="tonal" size="small" @click="reload">다시 시도</v-btn>
                </div>
                <div v-else-if="!hasStructure && !search" class="ksp-state">
                    <v-icon size="40" color="grey-lighten-1">mdi-cloud-upload-outline</v-icon>
                    <div class="text-body-2 text-medium-emphasis mt-2">Storage에 인덱싱된 문서가 없습니다</div>
                    <div class="text-caption text-medium-emphasis mt-1">
                        설정 → 지식 베이스 탭에서 Storage로 파일을 올릴 수 있습니다
                    </div>
                </div>
                <div v-else-if="search && searchLoading" class="ksp-state">
                    <v-progress-circular indeterminate color="primary" size="28" />
                    <div class="text-body-2 text-medium-emphasis mt-3">검색 중...</div>
                </div>
                <div v-else-if="search && searchResults.length === 0" class="ksp-state">
                    <v-icon size="40" color="grey-lighten-1">mdi-file-search-outline</v-icon>
                    <div class="text-body-2 text-medium-emphasis mt-2">검색 결과가 없습니다</div>
                </div>

                <!-- 검색 모드: 평탄 리스트 (서버 검색 결과) -->
                <template v-else-if="search">
                    <div
                        v-for="f in searchResults"
                        :key="f.key"
                        class="ksp-file"
                        :class="{ 'is-selected': selectedKeysSet.has(f.key) }"
                        @click="toggleFile(f)"
                    >
                        <v-checkbox
                            :modelValue="selectedKeysSet.has(f.key)"
                            @update:modelValue="toggleFile(f)"
                            @click.stop
                            density="compact"
                            hide-details
                            color="primary"
                            class="ksp-checkbox"
                        />
                        <v-icon size="18" :color="iconOf(f.name).color">{{ iconOf(f.name).icon }}</v-icon>
                        <div class="ksp-file-body">
                            <div class="ksp-file-name">
                                {{ f.name }}
                                <span
                                    v-if="f.docRole && f.docRole !== 'content'"
                                    class="ksp-role-badge"
                                    :class="`is-${f.docRole}`"
                                >
                                    {{ roleMeta(f.docRole).short }}
                                </span>
                                <span class="ksp-status-badge" :class="`is-${f.indexStatus}`" v-if="f.indexStatus">
                                    {{ statusLabel(f.indexStatus) }}
                                </span>
                            </div>
                            <div class="ksp-file-meta">
                                <span class="ksp-file-folder">
                                    <v-icon size="11">mdi-folder-outline</v-icon>
                                    {{ f.folderPath || '(루트)' }}
                                </span>
                                <span v-if="f.sizeBytes">{{ formatBytes(f.sizeBytes) }}</span>
                                <span v-if="f.modifiedTime">{{ formatRelativeTime(f.modifiedTime) }}</span>
                                <span v-if="f.owner">{{ f.owner }}</span>
                            </div>
                        </div>
                        <v-tooltip :text="f.sourceType === 'drive' ? 'Drive에서 보기' : '다운로드'" location="top">
                            <template v-slot:activator="{ props }">
                                <v-btn
                                    v-bind="props"
                                    icon
                                    variant="text"
                                    size="small"
                                    class="ksp-file-action"
                                    @click.stop="openFile(f)"
                                >
                                    <v-icon size="16">
                                        {{ f.sourceType === 'drive' ? 'mdi-open-in-new' : 'mdi-download-outline' }}
                                    </v-icon>
                                </v-btn>
                            </template>
                        </v-tooltip>
                    </div>
                </template>

                <!-- 트리 모드 -->
                <template v-else>
                    <KnowledgeTreeNode
                        v-for="node in tree"
                        :key="node.path"
                        :node="node"
                        :depth="0"
                        :expanded="expandedPaths"
                        :selectedKeysSet="selectedKeysSet"
                        :selCountMap="folderSelCounts"
                        :folderScope="selectedFolderPaths"
                        @toggle-folder="toggleFolder"
                        @toggle-file="toggleFile"
                        @toggle-folder-select="toggleFolderSelect"
                        @open-file="openFile"
                    />
                </template>
            </div>

            <v-divider />

            <div class="ksp-footer">
                <span v-if="!loading && !error && hasStructure" class="text-caption text-medium-emphasis">
                    Storage · {{ roleIndexedTotal }}개 문서 · {{ folderCount }}개 폴더
                </span>
                <v-spacer />
                <v-btn variant="text" @click="$emit('update:modelValue', false)">취소</v-btn>
                <v-btn color="primary" variant="flat" @click="confirm" :disabled="loading">
                    <v-icon start size="16">mdi-check</v-icon>
                    {{ hasSelection ? `${selectionLabel} 사용` : '선택 없이 닫기' }}
                </v-btn>
            </div>
        </v-card>
    </v-dialog>
</template>

<script>
import axios from 'axios';
import KnowledgeTreeNode from './KnowledgeTreeNode.vue';
import { mimeIcon } from '@/utils/fileIcon';

function extToMime(name) {
    const ext = (name || '').split('.').pop()?.toLowerCase() || '';
    const map = {
        pdf: 'application/pdf',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xls: 'application/vnd.ms-excel',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ppt: 'application/vnd.ms-powerpoint',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        hwp: 'application/x-hwp',
        hwpx: 'application/vnd.hancom.hwpx',
        md: 'text/markdown',
        txt: 'text/plain'
    };
    return map[ext] || '';
}

// knowledge_files row → 프론트 파일 객체(공통 매핑)
function mapDetail(d) {
    return {
        // 같은 파일명이 여러 폴더에 있을 수 있어 source_ref 우선, 없으면 폴더+파일명 조합
        key: d.source_ref
            ? `${d.source_type || 'drive'}:${d.source_ref}`
            : `${d.folder_path || d.drive_folder_name || ''}::${d.file_name}`,
        name: d.file_name,
        folderPath: d.folder_path || d.drive_folder_name || '',
        mimeType: d.mime_type || extToMime(d.file_name),
        sourceType: d.source_type || 'drive',
        sourceRef: d.source_ref || '',
        sizeBytes: d.size_bytes,
        modifiedTime: d.modified_time,
        owner: d.owner,
        indexStatus: d.index_status,
        indexError: d.index_error,
        indexedAt: d.indexed_at,
        docRole: d.doc_role || 'content'
    };
}

// lazy 트리 빌드 — *파일 전체* 대신 폴더 경로 목록 + (인덱싱)직속 카운트 + 로드된 폴더별 파일로 구성.
//   folderPaths: 표시할 폴더 경로 집합(등록 폴더 ∪ 파일 있는 폴더)
//   directIndexed: { folder_path: 인덱싱 직속 파일수 } — descendantCount(하위 포함) 집계용
//   filesByFolder: { folder_path: [로드된 인덱싱 파일...] } — 펼친 폴더에만 채워짐
// node: { type:'folder', name, path, children:[...], files:[...], descendantCount }
function buildLazyTree(folderPaths, directIndexed, filesByFolder) {
    const root = { children: {} };
    const ensure = (path) => {
        const segs = (path || '').split('/').map((s) => s.trim()).filter(Boolean);
        let cursor = root;
        let acc = '';
        for (const seg of segs) {
            acc = acc ? `${acc}/${seg}` : seg;
            if (!cursor.children[seg]) cursor.children[seg] = { name: seg, path: acc, children: {} };
            cursor = cursor.children[seg];
        }
        return cursor;
    };
    for (const p of folderPaths) if (p) ensure(p);

    function normalize(node) {
        const childFolders = Object.values(node.children)
            .map(normalize)
            .sort((a, b) => a.name.localeCompare(b.name));
        const files = (filesByFolder[node.path] || []).slice().sort((a, b) => a.name.localeCompare(b.name));
        const direct = directIndexed[node.path] || 0; // 이 폴더 직속 인덱싱 파일수
        const descendantCount = direct + childFolders.reduce((s, c) => s + c.descendantCount, 0);
        return {
            type: 'folder',
            name: node.name,
            path: node.path,
            children: childFolders,
            files,
            descendantCount
        };
    }
    return Object.values(root.children).map(normalize).sort((a, b) => a.name.localeCompare(b.name));
}

function collectAllFolderPaths(nodes) {
    const out = [];
    const walk = (arr) => {
        for (const n of arr) {
            out.push(n.path);
            walk(n.children);
        }
    };
    walk(nodes);
    return out;
}

export default {
    name: 'KnowledgeSpacePicker',
    components: { KnowledgeTreeNode },
    props: {
        modelValue: { type: Boolean, default: false },
        initiallySelectedIds: { type: Array, default: () => [] },
        // 이전에 선택된 문서(전체 shape). lazy 로딩이라 파일 전체를 안 들고 있으므로,
        // 선택 상태 복원 + confirm 시 누락 방지를 위해 부모가 전체 doc 을 넘겨준다.
        initiallySelectedDocs: { type: Array, default: () => [] },
        // 이전에 폴더째 선택한 경로들 (복원용)
        initiallySelectedFolders: { type: Array, default: () => [] }
    },
    emits: ['update:modelValue', 'confirm'],
    data() {
        return {
            search: '',
            loading: false,
            error: '',
            // lazy 누적 — 펼치거나 검색해 로드된 파일만 담긴다(전체 아님)
            allFiles: [],
            loadedFolders: new Set(), // 직속 파일을 이미 로드한 폴더 경로
            folders: [], // [{ folder_path, doc_role }] — 경량 폴더 목록
            folderCounts: { role_totals: {}, folder_direct: {}, folder_direct_indexed: {}, status_totals: {} },
            expandedPaths: new Set(),
            selectedKeysSet: new Set(),
            // key → emit 형태 doc. lazy 로드 사이에도 선택을 보존해 confirm 시 누락되지 않게 한다.
            selectedDocsMap: {},
            // 폴더째 체크한 경로들 → confirm 시 knowledge_folders 로 emit (deepagents 폴더 스코프)
            selectedFolderPaths: new Set(),
            searchResults: [],
            searchLoading: false,
            searchToken: 0,
            searchTimer: null,
            activeSource: 'upload', // 'drive' | 'upload' — Google Drive 탭 숨김으로 항상 upload
            currentRole: 'content',
            roleFilterOptions: [
                { value: 'content',   label: '일반',     icon: 'mdi-file-document-outline',   short: '일반' },
                { value: 'glossary',  label: '용어 사전', icon: 'mdi-book-alphabet',           short: '사전' },
                { value: 'template',  label: '양식',     icon: 'mdi-file-document-edit-outline', short: '양식' },
                { value: 'reference', label: '참조',     icon: 'mdi-bookmark-outline',        short: '참조' },
                { value: 'dataset',   label: '데이터',    icon: 'mdi-table',                   short: '데이터' },
                { value: 'legal_review', label: '검토 사례', icon: 'mdi-gavel',                  short: '검토' }
            ]
        };
    },
    computed: {
        selectedKeys() {
            return [...this.selectedKeysSet];
        },
        selectedFolderCount() {
            return this.selectedFolderPaths ? this.selectedFolderPaths.size : 0;
        },
        hasSelection() {
            return this.selectedKeys.length > 0 || this.selectedFolderCount > 0;
        },
        // 폴더째 선택은 파일을 안 세고 '폴더 N'으로 표시(수천 파일이 폴더 1건으로 접힘)
        selectionLabel() {
            const parts = [];
            if (this.selectedFolderCount > 0) parts.push(`폴더 ${this.selectedFolderCount}`);
            if (this.selectedKeys.length > 0) parts.push(`파일 ${this.selectedKeys.length}`);
            return parts.length ? parts.join(' · ') : '0';
        },
        counts() {
            const rt = this.folderCounts.role_totals || {};
            const upload = Object.values(rt).reduce((s, n) => s + (n || 0), 0);
            return { drive: 0, upload };
        },
        // 역할별 총계 (role 칩 카운트) — 경량 카운트 엔드포인트 기준(전역 정확)
        roleCounts() {
            return this.folderCounts.role_totals || {};
        },
        // 현재 role 의 폴더 목록(권한 필터는 로드 시 적용됨)
        tabFolders() {
            return this.folders.filter((f) => (f.doc_role || 'content') === this.currentRole);
        },
        // 현재 role 의 폴더별 인덱싱 직속 카운트
        directIndexed() {
            return (this.folderCounts.folder_direct_indexed && this.folderCounts.folder_direct_indexed[this.currentRole]) || {};
        },
        // 로드된 인덱싱 파일을 폴더별로 (현재 탭/역할 한정) — 트리 노드 file 목록 + 선택 카운트용
        filesByFolder() {
            const m = {};
            for (const f of this.allFiles) {
                if (f.sourceType !== this.activeSource) continue;
                if ((f.docRole || 'content') !== this.currentRole) continue;
                if (f.indexStatus !== 'indexed') continue;
                const p = f.folderPath || '__root__';
                (m[p] = m[p] || []).push(f);
            }
            return m;
        },
        tree() {
            const paths = new Set();
            for (const f of this.tabFolders) paths.add(f.folder_path);
            for (const p of Object.keys(this.directIndexed)) paths.add(p);
            for (const p of Object.keys(this.filesByFolder)) if (p !== '__root__') paths.add(p);
            return buildLazyTree([...paths], this.directIndexed, this.filesByFolder);
        },
        hasStructure() {
            return this.tree.length > 0;
        },
        // 현재 role 전체 인덱싱 문서 수(푸터 표시)
        roleIndexedTotal() {
            return Object.values(this.directIndexed).reduce((sum, count) => sum + (count || 0), 0);
        },
        // 선택된 자료 중 사전·양식이 있으면 사용자에게 자동 활용 의미 안내 (선택 doc 기준)
        autoUseHints() {
            const hits = { glossary: 0, template: 0, dataset: 0 };
            for (const k of this.selectedKeysSet) {
                const d = this.selectedDocsMap[k];
                if (!d) continue;
                const r = d.docRole || d.doc_role || 'content';
                if (r in hits) hits[r]++;
            }
            const out = [];
            if (hits.glossary > 0) {
                out.push({ role: 'glossary', label: '용어 사전', count: hits.glossary, action: '→ 답변 작성 시 용어 매핑으로 자동 참조됩니다' });
            }
            if (hits.template > 0) {
                out.push({ role: 'template', label: '양식', count: hits.template, action: '→ DOCX 생성 시 양식으로 활용됩니다' });
            }
            if (hits.dataset > 0) {
                out.push({ role: 'dataset', label: '데이터', count: hits.dataset, action: '→ 정량 분석 질문 시 코드 실행으로 처리됩니다' });
            }
            return out;
        },
        // 폴더경로 → 그 하위에서 선택된 (로드된)파일 수. buildLazyTree 와 동일한 경로 규칙.
        folderSelCounts() {
            const m = Object.create(null);
            const sel = this.selectedKeysSet;
            for (const p of Object.keys(this.filesByFolder)) {
                for (const f of this.filesByFolder[p]) {
                    if (!sel.has(f.key)) continue;
                    const segs = (f.folderPath || '').split('/').map((s) => s.trim()).filter(Boolean);
                    if (segs.length === 0) {
                        m.__root__ = (m.__root__ || 0) + 1;
                        continue;
                    }
                    let acc = '';
                    for (const s of segs) {
                        acc = acc ? `${acc}/${s}` : s;
                        m[acc] = (m[acc] || 0) + 1;
                    }
                }
            }
            return m;
        },
        folderCount() {
            return collectAllFolderPaths(this.tree).length;
        },
        allExpanded() {
            const all = collectAllFolderPaths(this.tree);
            if (all.length === 0) return false;
            return all.every((p) => this.expandedPaths.has(p));
        }
    },
    watch: {
        modelValue(v) {
            if (v) {
                this.seedSelection();
                this.search = '';
                this.searchResults = [];
                this.loadStructure();
            }
        },
        activeSource() {
            this.search = '';
            this.searchResults = [];
            this.currentRole = 'content';
            this.collapseAll();
        },
        currentRole() {
            this.search = '';
            this.searchResults = [];
            this.collapseAll();
        },
        search(v) {
            this.runSearch(v);
        }
    },
    beforeUnmount() {
        if (this.searchTimer) clearTimeout(this.searchTimer);
    },
    methods: {
        roleMeta(role) {
            return this.roleFilterOptions.find((r) => r.value === role) || this.roleFilterOptions[0];
        },
        iconOf(name) {
            return mimeIcon(extToMime(name));
        },
        formatBytes(b) {
            if (!b && b !== 0) return '';
            if (b < 1024) return `${b} B`;
            if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
            if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
            return `${(b / 1024 / 1024 / 1024).toFixed(1)} GB`;
        },
        formatRelativeTime(iso) {
            if (!iso) return '';
            const d = new Date(iso);
            const now = new Date();
            const diffMs = now.getTime() - d.getTime();
            const day = 24 * 60 * 60 * 1000;
            if (diffMs < day) return '오늘';
            if (diffMs < 2 * day) return '어제';
            if (diffMs < 7 * day) return `${Math.floor(diffMs / day)}일 전`;
            if (diffMs < 30 * day) return `${Math.floor(diffMs / (7 * day))}주 전`;
            if (diffMs < 365 * day) return `${Math.floor(diffMs / (30 * day))}개월 전`;
            return d.toLocaleDateString('ko-KR');
        },
        statusLabel(s) {
            return {
                pending: '대기',
                processing: '처리중',
                indexed: '',
                failed: '실패',
                excluded: '제외'
            }[s] || '';
        },
        // 이전 선택 복원 — 부모가 넘긴 전체 doc(권장) 또는 id 목록(fallback)으로 seed.
        seedSelection() {
            const docs = (this.initiallySelectedDocs && this.initiallySelectedDocs.length)
                ? this.initiallySelectedDocs
                : (this.initiallySelectedIds || []).map((id) => ({ id }));
            const set = new Set();
            const map = {};
            for (const d of docs) {
                const key = d && d.id;
                if (!key) continue;
                set.add(key);
                map[key] = this.normalizeDoc(d);
            }
            this.selectedKeysSet = set;
            this.selectedDocsMap = map;
            // 폴더째 선택 복원
            const folders = new Set();
            for (const p of this.initiallySelectedFolders || []) {
                if (typeof p === 'string' && p.trim()) {
                    folders.add(p.trim().replace(/^\/+|\/+$/g, ''));
                }
            }
            this.selectedFolderPaths = folders;
        },
        // 폴더+카운트만 로드(경량). 파일은 펼치거나 검색할 때 lazy.
        async loadStructure(force = false) {
            const tenantId = (typeof window !== 'undefined' && window.$tenantName) || '';
            if (!tenantId) {
                this.error = '테넌트 정보를 확인할 수 없습니다';
                return;
            }
            if (!force && this.folders.length > 0) {
                this.afterStructure();
                return;
            }
            this.loading = true;
            this.error = '';
            try {
                const [foldersRes, countsRes] = await Promise.all([
                    axios.get('/memento/knowledge/folders', { params: { tenant_id: tenantId } }),
                    axios.get('/memento/knowledge/files/counts', { params: { tenant_id: tenantId } })
                ]);
                const raw = Array.isArray(foldersRes.data?.folders) ? foldersRes.data.folders : [];
                this.folders = raw.map((f) =>
                    typeof f === 'string'
                        ? { folder_path: f, doc_role: 'content' }
                        : { folder_path: f?.folder_path || '', doc_role: f?.doc_role || 'content' }
                ).filter((f) => f.folder_path);
                const c = countsRes.data || {};
                this.folderCounts = {
                    role_totals: c.role_totals || {},
                    folder_direct: c.folder_direct || {},
                    folder_direct_indexed: c.folder_direct_indexed || {},
                    status_totals: c.status_totals || {}
                };
                this.afterStructure();
            } catch (e) {
                console.error('[KnowledgeSpacePicker] structure load failed', e);
                this.error = e?.response?.data?.detail || e?.message || '폴더 목록을 가져오지 못했습니다';
            } finally {
                this.loading = false;
            }
        },
        reload() {
            this.loadStructure(true);
        },
        afterStructure() {
            this.collapseAll();
        },
        collapseAll() {
            this.expandedPaths = new Set();
        },
        mergeFiles(files) {
            if (!files || !files.length) return;
            const byKey = new Map(this.allFiles.map((f) => [f.key, f]));
            for (const f of files) byKey.set(f.key, f);
            this.allFiles = [...byKey.values()];
        },
        filesInFolder(path) {
            return this.allFiles.filter((f) => f.folderPath === path);
        },
        // 폴더 파일 lazy 로드. recursive=true 면 하위 전체(폴더 선택 → 파일 refs 해결용).
        async loadFolderFiles(path, opts = {}) {
            const recursive = !!opts.recursive;
            if (!path) return [];
            const tenantId = (typeof window !== 'undefined' && window.$tenantName) || '';
            if (!tenantId) return [];
            if (!recursive && this.loadedFolders.has(path)) return this.filesInFolder(path);
            try {
                const { data } = await axios.get('/memento/documents/list', {
                    params: { tenant_id: tenantId, folder_path: path, recursive }
                });
                const files = (Array.isArray(data?.file_details) ? data.file_details : []).map(mapDetail);
                this.mergeFiles(files);
                const loaded = new Set(this.loadedFolders);
                loaded.add(path); // recursive 도 직속 포함 → 로드 완료로 표시
                this.loadedFolders = loaded;
                return files;
            } catch (e) {
                console.error('[KnowledgeSpacePicker] folder files load failed', e);
                return [];
            }
        },
        toDoc(f) {
            return {
                id: f.key,
                name: f.name,
                file_name: f.name,
                folderPath: f.folderPath,
                drive_folder_name: f.folderPath,
                mimeType: f.mimeType,
                sourceType: f.sourceType,
                sourceRef: f.sourceRef,
                sizeBytes: f.sizeBytes,
                modifiedTime: f.modifiedTime,
                owner: f.owner,
                // 역할(양식/사업개요 등) — 백엔드가 템플릿/자료 구분에 사용. 누락 시 초안 템플릿 인식 불가.
                doc_role: f.docRole || 'content',
                docRole: f.docRole || 'content'
            };
        },
        // 부모가 넘긴 doc → confirm emit shape 로 정규화(id 키 보존)
        normalizeDoc(d) {
            const role = d.docRole || d.doc_role || 'content';
            const folderPath = d.folderPath || d.drive_folder_name || '';
            return {
                id: d.id,
                name: d.name || d.file_name,
                file_name: d.file_name || d.name,
                folderPath,
                drive_folder_name: folderPath,
                mimeType: d.mimeType,
                sourceType: d.sourceType,
                sourceRef: d.sourceRef,
                sizeBytes: d.sizeBytes,
                modifiedTime: d.modifiedTime,
                owner: d.owner,
                doc_role: role,
                docRole: role
            };
        },
        toggleFolder(path) {
            const next = new Set(this.expandedPaths);
            if (next.has(path)) next.delete(path);
            else {
                next.add(path);
                this.loadFolderFiles(path); // 펼칠 때 직속 파일 lazy 로드
            }
            this.expandedPaths = next;
        },
        toggleExpandAll() {
            if (this.allExpanded) {
                this.expandedPaths = new Set();
                return;
            }
            const all = collectAllFolderPaths(this.tree);
            this.expandedPaths = new Set(all);
            // 펼친 폴더 중 파일 있는 폴더만 lazy 로드(빈 폴더는 요청 낭비 방지)
            for (const p of all) if ((this.directIndexed[p] || 0) > 0) this.loadFolderFiles(p);
        },
        toggleFile(f) {
            const set = new Set(this.selectedKeysSet);
            const map = { ...this.selectedDocsMap };
            const deselecting = set.has(f.key);
            if (deselecting) {
                set.delete(f.key);
                delete map[f.key];
                // 이 파일을 포함하던 '폴더째 선택'은 더 이상 완전선택이 아니므로 해제 → file 스코프로 폴백
                const fp = f.folderPath || '';
                const fset = new Set(this.selectedFolderPaths);
                let changed = false;
                for (const p of [...fset]) {
                    if (fp === p || fp.startsWith(p + '/')) {
                        fset.delete(p);
                        changed = true;
                    }
                }
                if (changed) this.selectedFolderPaths = fset;
            } else {
                set.add(f.key);
                map[f.key] = this.toDoc(f);
            }
            this.selectedKeysSet = set;
            this.selectedDocsMap = map;
        },
        // 폴더 체크 = *폴더 스코프* 로 기록. 하위 파일을 일일이 선택/전송하지 않는다(수천 file_id
        // flatten·재조회 회피). deepagents 는 folder_paths 로 그 폴더 subtree 를 탐색하고, confirm 은
        // 폴더로 커버된 개별 파일을 knowledge_docs 에서 접는다. 파일 커버 표시는 folderScope 로 O(1).
        toggleFolderSelect({ node, select }) {
            const fset = new Set(this.selectedFolderPaths);
            if (select) {
                // 조상/자손 폴더 중복 스코프 제거 — 이 폴더로 병합
                for (const p of [...fset]) {
                    if (p === node.path || p.startsWith(node.path + '/') || node.path.startsWith(p + '/')) {
                        fset.delete(p);
                    }
                }
                fset.add(node.path);
                // 이 폴더로 커버되는 개별 파일 선택은 제거(폴더 스코프가 대신)
                const set = new Set(this.selectedKeysSet);
                const map = { ...this.selectedDocsMap };
                let changed = false;
                for (const k of [...set]) {
                    const d = map[k];
                    const fp = (d && (d.folderPath || d.drive_folder_name)) || '';
                    if (fp === node.path || fp.startsWith(node.path + '/')) {
                        set.delete(k);
                        delete map[k];
                        changed = true;
                    }
                }
                if (changed) {
                    this.selectedKeysSet = set;
                    this.selectedDocsMap = map;
                }
            } else {
                fset.delete(node.path);
            }
            this.selectedFolderPaths = fset;
        },
        /** 이 모달의 선택(파일 + 폴더 스코프)을 전부 비운다. */
        clearSelection() {
            this.selectedKeysSet = new Set();
            this.selectedDocsMap = {};
            this.selectedFolderPaths = new Set();
        },
        runSearch(v) {
            const q = (v || '').trim();
            if (this.searchTimer) clearTimeout(this.searchTimer);
            if (!q) {
                this.searchToken++; // 진행 중 검색 무효화
                this.searchResults = [];
                this.searchLoading = false;
                return;
            }
            this.searchLoading = true;
            this.searchTimer = setTimeout(() => this.doSearch(q), 300);
        },
        // 서버측 파일명 검색 — 전체 로드 없이 상위 N건만. 현재 탭/역할로 좁힘.
        async doSearch(q) {
            const tenantId = (typeof window !== 'undefined' && window.$tenantName) || '';
            if (!tenantId) {
                this.searchLoading = false;
                return;
            }
            const token = ++this.searchToken;
            try {
                const { data } = await axios.get('/memento/knowledge/files/search', {
                    params: { tenant_id: tenantId, q, indexed_only: true, limit: 300 }
                });
                if (token !== this.searchToken) return; // stale
                const files = (Array.isArray(data?.file_details) ? data.file_details : [])
                    .map(mapDetail)
                    .filter((f) => f.sourceType === this.activeSource && (f.docRole || 'content') === this.currentRole);
                this.mergeFiles(files); // 선택/토글이 트리와 일관되게
                this.searchResults = files;
            } catch (e) {
                if (token === this.searchToken) {
                    console.error('[KnowledgeSpacePicker] search failed', e);
                    this.searchResults = [];
                }
            } finally {
                if (token === this.searchToken) this.searchLoading = false;
            }
        },
        async openFile(f) {
            const tenantId = window.$tenantName || '';
            if (!tenantId || !f?.sourceRef) return;
            try {
                const { data } = await axios.get('/memento/knowledge/files/url', {
                    params: {
                        tenant_id: tenantId,
                        source_type: f.sourceType,
                        source_ref: f.sourceRef,
                        file_name: f.name || ''
                    }
                });
                if (data?.url) window.open(data.url, '_blank', 'noopener');
            } catch (e) {
                console.error('[KnowledgeSpacePicker] open file failed', e);
            }
        },
        confirm() {
            // 선택된 key 를 보존된 doc map 으로 해석 → lazy 로드 사이에도 누락 없음
            // 폴더째 선택 경로 — deepagents 가 폴더 스코프로 탐색(수천 file_id 나열 회피)
            const folders = [...this.selectedFolderPaths].filter((p) => typeof p === 'string' && p.trim());
            const coveredByFolder = (fp) => {
                const p = (fp || '').trim().replace(/^\/+|\/+$/g, '');
                return folders.some((r) => p === r || p.startsWith(r + '/'));
            };
            // ⚠️ 폴더로 커버되는 파일은 knowledge_docs 에서 제외 — 폴더 1건이 그 안 수천 파일을 대신한다.
            //    (안 그러면 활동탭 패널·방 컨텍스트·매 메시지 metadata 에 수천 doc 이 그대로 실려 부하 폭증)
            //    폴더 스코프로 접근되므로 개별 file_id 나열 불필요. 폴더에 안 덮인 개별 파일만 남긴다.
            const selectedDocs = [...this.selectedKeysSet]
                .map((k) => this.selectedDocsMap[k])
                .filter(Boolean)
                .filter((d) => !coveredByFolder(d.folderPath || d.drive_folder_name || ''));
            this.$emit('confirm', selectedDocs, folders);
            this.$emit('update:modelValue', false);
        }
    }
};
</script>

<style scoped>
/* v-dialog 래퍼 자체에 height를 잡아야 v-card height가 안정적으로 적용된다.
   scoped + :deep — Vuetify 내부 클래스(.v-overlay__content)를 타겟. */
.ksp-dialog :deep(.v-overlay__content) {
    height: min(720px, 80vh);
    /* 모바일에서 좌우 패딩 고려해 width는 max-width prop에 위임 */
}

.ksp-card {
    display: flex;
    flex-direction: column;
    height: 100%;
}

.ksp-header {
    display: flex;
    align-items: center;
    padding: 14px 12px 10px 20px;
    gap: 4px;
}

.ksp-title {
    display: flex;
    align-items: center;
    font-size: 16px;
    font-weight: 600;
    flex: 1;
    min-width: 0;
}

.ksp-subtitle {
    font-size: 12px;
    font-weight: 400;
    color: rgba(0, 0, 0, 0.55);
    margin-left: 12px;
}

.ksp-source-tabs {
    padding: 0 12px;
    flex: 0 0 auto;
}

/* ─── 역할(doc_role) 필터 칩 바 ─── */
.ksp-role-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 10px 20px 4px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}

.ksp-role-chip {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 4px 10px;
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 14px;
    background: var(--cds-surface-2);
    cursor: pointer;
    font-size: 12px;
    color: rgba(0, 0, 0, 0.7);
    transition: background 0.12s, border-color 0.12s, color 0.12s;
}

.ksp-role-chip:hover {
    background: rgba(0, 0, 0, 0.04);
}

.ksp-role-chip.is-active.is-all       { background: rgba(97, 97, 97, 0.12); border-color: rgba(97, 97, 97, 0.4); color: #424242; }
.ksp-role-chip.is-active.is-content   { background: rgba(25, 118, 210, 0.12); border-color: rgba(25, 118, 210, 0.5); color: hsl(var(--accent-brand)); }
.ksp-role-chip.is-active.is-glossary  { background: rgba(123, 31, 162, 0.12); border-color: rgba(123, 31, 162, 0.5); color: #7b1fa2; }
.ksp-role-chip.is-active.is-template  { background: rgba(239, 108, 0, 0.12); border-color: rgba(239, 108, 0, 0.5); color: var(--cds-text-warning); }
.ksp-role-chip.is-active.is-reference { background: rgba(56, 142, 60, 0.12); border-color: rgba(56, 142, 60, 0.5); color: var(--cds-text-success); }
.ksp-role-chip.is-active.is-dataset   { background: rgba(0, 137, 123, 0.12); border-color: rgba(0, 137, 123, 0.5); color: #00897b; }

.ksp-role-chip-count {
    margin-left: 4px;
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.06);
    color: rgba(0, 0, 0, 0.55);
}

.ksp-role-chip.is-active .ksp-role-chip-count {
    background: rgba(255, 255, 255, 0.6);
    color: inherit;
}

/* ─── 자동 활용 안내 배너 ─── */
.ksp-auto-banner {
    display: flex;
    align-items: center;
    padding: 8px 20px;
    margin: 8px 20px 0;
    background: rgba(var(--v-theme-primary), 0.07);
    border-left: 3px solid rgb(var(--v-theme-primary));
    border-radius: 4px;
}

/* ─── 행에 표시되는 role badge ─── */
.ksp-role-badge {
    display: inline-block;
    margin-left: 6px;
    font-size: 10px;
    padding: 1px 7px;
    border-radius: 8px;
    font-weight: 500;
    vertical-align: middle;
}

.ksp-role-badge.is-glossary  { background: rgba(123, 31, 162, 0.12); color: #7b1fa2; }
.ksp-role-badge.is-template  { background: rgba(239, 108, 0, 0.12);  color: var(--cds-text-warning); }
.ksp-role-badge.is-reference { background: rgba(56, 142, 60, 0.12);  color: var(--cds-text-success); }

.ksp-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
}

.ksp-search {
    flex: 1;
}

.ksp-bulk-row {
    display: flex;
    align-items: center;
    padding: 4px 20px 8px;
}


.ksp-list {
    overflow-y: auto;
    padding: 6px 8px;
    flex: 1 1 0;
    min-height: 0;
}

.ksp-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 0;
}

/* 검색모드 평탄 파일 행 */
.ksp-file {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 6px;
    cursor: pointer;
    border: 1px solid transparent;
}

.ksp-file:hover {
    background: rgba(var(--v-theme-primary), 0.04);
}

.ksp-file.is-selected {
    background: rgba(var(--v-theme-primary), 0.08);
    border-color: rgba(var(--v-theme-primary), 0.25);
}

.ksp-checkbox :deep(.v-selection-control) {
    min-height: 22px;
}

.ksp-file-body {
    flex: 1;
    min-width: 0;
}

.ksp-file-action {
    flex: 0 0 auto;
    opacity: 0;
    transition: opacity 0.12s;
}

.ksp-file:hover .ksp-file-action,
.ksp-file.is-selected .ksp-file-action {
    opacity: 1;
}

.ksp-file-name {
    font-size: 13px;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.87);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.ksp-file-folder {
    display: inline-flex;
    align-items: center;
    gap: 4px;
}

.ksp-file-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    font-size: 11px;
    color: rgba(0, 0, 0, 0.55);
    margin-top: 2px;
}

.ksp-status-badge {
    display: inline-block;
    margin-left: 6px;
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 8px;
    font-weight: 500;
    vertical-align: middle;
}

.ksp-status-badge.is-pending {
    background: rgba(0, 0, 0, 0.06);
    color: rgba(0, 0, 0, 0.55);
}

.ksp-status-badge.is-processing {
    background: rgba(33, 150, 243, 0.12);
    color: hsl(var(--accent-brand));
}

.ksp-status-badge.is-failed {
    background: rgba(244, 67, 54, 0.12);
    color: var(--cds-text-danger);
}

.ksp-status-badge.is-excluded {
    background: rgba(158, 158, 158, 0.18);
    color: var(--cds-text-secondary);
}

.ksp-footer {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
}
</style>
