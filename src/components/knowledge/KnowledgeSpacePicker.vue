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
                <v-tab value="drive">
                    <v-icon start size="16">mdi-google-drive</v-icon>
                    Google Drive
                    <v-chip size="x-small" color="primary" variant="tonal" class="ml-2">{{ counts.drive }}</v-chip>
                </v-tab>
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
                    placeholder="파일/폴더 검색"
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
                <v-checkbox
                    :modelValue="allFilteredSelected"
                    :indeterminate="someFilteredSelected && !allFilteredSelected"
                    @update:modelValue="toggleSelectAllFiltered"
                    density="compact"
                    hide-details
                    color="primary"
                    class="ksp-bulk-checkbox"
                    :disabled="visibleFiles.length === 0"
                >
                    <template v-slot:label>
                        <span class="text-caption">{{ search ? `검색 결과 ${visibleFiles.length}개 전체` : `이 탭 전체 ${tabFiles.length}개` }} 선택</span>
                    </template>
                </v-checkbox>
                <span class="text-caption text-medium-emphasis ml-auto">
                    선택됨 <strong class="text-primary">{{ selectedKeys.length }}</strong>개
                </span>
            </div>

            <v-divider />

            <div class="ksp-list">
                <div v-if="loading" class="ksp-state">
                    <v-progress-circular indeterminate color="primary" size="32" />
                    <div class="text-body-2 text-medium-emphasis mt-3">지식공간 문서 로드 중...</div>
                </div>
                <div v-else-if="error" class="ksp-state">
                    <v-icon size="40" color="error">mdi-alert-circle-outline</v-icon>
                    <div class="text-body-2 text-medium-emphasis mt-2">{{ error }}</div>
                    <v-btn class="mt-3" variant="tonal" size="small" @click="reload">다시 시도</v-btn>
                </div>
                <div v-else-if="tabFiles.length === 0" class="ksp-state">
                    <v-icon size="40" color="grey-lighten-1">
                        {{ activeSource === 'drive' ? 'mdi-google-drive' : 'mdi-cloud-upload-outline' }}
                    </v-icon>
                    <div class="text-body-2 text-medium-emphasis mt-2">
                        {{ activeSource === 'drive' ? 'Drive에 인덱싱된 문서가 없습니다' : 'Storage에 업로드된 문서가 없습니다' }}
                    </div>
                    <div class="text-caption text-medium-emphasis mt-1">
                        {{ activeSource === 'drive'
                            ? "드라이브 설정의 '문서 처리' 후 여기에 표시됩니다"
                            : '설정 → 지식 베이스 탭에서 Storage로 파일을 올릴 수 있습니다' }}
                    </div>
                </div>
                <div v-else-if="visibleFiles.length === 0 && search" class="ksp-state">
                    <v-icon size="40" color="grey-lighten-1">mdi-file-search-outline</v-icon>
                    <div class="text-body-2 text-medium-emphasis mt-2">검색 결과가 없습니다</div>
                </div>

                <!-- 검색 모드: 평탄 리스트 -->
                <template v-else-if="search">
                    <div
                        v-for="f in visibleFiles"
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
                        @toggle-folder="toggleFolder"
                        @toggle-file="toggleFile"
                        @toggle-folder-select="toggleFolderSelect"
                        @open-file="openFile"
                    />
                </template>
            </div>

            <v-divider />

            <div class="ksp-footer">
                <span v-if="!loading && !error && tabFiles.length > 0" class="text-caption text-medium-emphasis">
                    {{ activeSource === 'drive' ? 'Drive' : 'Storage' }}
                    · {{ tabFiles.length }}개 문서 · {{ folderCount }}개 폴더
                </span>
                <v-spacer />
                <v-btn variant="text" @click="$emit('update:modelValue', false)">취소</v-btn>
                <v-btn color="primary" variant="flat" @click="confirm" :disabled="loading">
                    <v-icon start size="16">mdi-check</v-icon>
                    {{ selectedKeys.length > 0 ? `${selectedKeys.length}개 사용` : '선택 없이 닫기' }}
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

// "A/B/C" 경로 배열의 파일들로 트리 빌드
// node 형태:
//   { type: 'folder', name, path, children: [...nodes], files: [...] }
//   children 안에 폴더, files 안에 파일 (UI에서 폴더 → 파일 순으로 렌더)
function buildTree(files) {
    const root = { type: 'folder', name: '(루트)', path: '__root__', children: {}, files: [] };

    for (const f of files) {
        const segments = (f.folderPath || '').split('/').map((s) => s.trim()).filter(Boolean);
        let cursor = root;
        let acc = '';
        for (const seg of segments) {
            acc = acc ? `${acc}/${seg}` : seg;
            if (!cursor.children[seg]) {
                cursor.children[seg] = { type: 'folder', name: seg, path: acc, children: {}, files: [] };
            }
            cursor = cursor.children[seg];
        }
        cursor.files.push(f);
    }

    function normalize(node) {
        const childFolders = Object.values(node.children)
            .map(normalize)
            .sort((a, b) => a.name.localeCompare(b.name));
        const sortedFiles = [...node.files].sort((a, b) => a.name.localeCompare(b.name));
        // 누적 카운트(자손 파일 수) — UI 표시용
        const descendantCount = sortedFiles.length + childFolders.reduce((s, c) => s + c.descendantCount, 0);
        return {
            type: 'folder',
            name: node.name,
            path: node.path,
            children: childFolders,
            files: sortedFiles,
            descendantCount
        };
    }

    const normalized = normalize(root);
    // 루트는 그 자체로 가짜 폴더 — children + files를 평탄화해서 최상위 노드 배열로 반환
    const top = [...normalized.children];
    if (normalized.files.length > 0) {
        top.push({
            type: 'folder',
            name: '(루트)',
            path: '__root__',
            children: [],
            files: normalized.files,
            descendantCount: normalized.files.length
        });
    }
    return top;
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

function collectFilesUnder(node) {
    const out = [...node.files];
    for (const c of node.children) out.push(...collectFilesUnder(c));
    return out;
}

export default {
    name: 'KnowledgeSpacePicker',
    components: { KnowledgeTreeNode },
    props: {
        modelValue: { type: Boolean, default: false },
        initiallySelectedIds: { type: Array, default: () => [] }
    },
    emits: ['update:modelValue', 'confirm'],
    data() {
        return {
            search: '',
            loading: false,
            error: '',
            allFiles: [], // [{ key, name, folderPath, mimeType, sourceType, docRole, ... }]
            expandedPaths: new Set(),
            selectedKeysSet: new Set(),
            activeSource: 'drive', // 'drive' | 'upload'
            // 역할(doc_role) 필터 — Storage 탭에서만 적용. 항상 단일 role 만 활성.
            currentRole: 'content',
            roleFilterOptions: [
                { value: 'content',   label: '일반',     icon: 'mdi-file-document-outline',   short: '일반' },
                { value: 'glossary',  label: '용어 사전', icon: 'mdi-book-alphabet',           short: '사전' },
                { value: 'template',  label: '양식',     icon: 'mdi-file-document-edit-outline', short: '양식' },
                { value: 'reference', label: '참조',     icon: 'mdi-bookmark-outline',        short: '참조' },
                { value: 'dataset',   label: '데이터',    icon: 'mdi-table',                   short: '데이터' }
            ]
        };
    },
    computed: {
        selectedKeys() {
            return [...this.selectedKeysSet];
        },
        counts() {
            const c = { drive: 0, upload: 0 };
            for (const f of this.allFiles) {
                if (f.sourceType === 'drive') c.drive++;
                else if (f.sourceType === 'upload') c.upload++;
            }
            return c;
        },
        // 현재 탭에 속하는 파일들 (Drive 탭은 role 필터 적용 안 함)
        tabFiles() {
            const bySource = this.allFiles.filter((f) => f.sourceType === this.activeSource);
            if (this.activeSource !== 'upload') return bySource;
            return bySource.filter((f) => (f.docRole || 'content') === this.currentRole);
        },
        // 현재 Storage 탭 안 role 별 개수 (role 칩 카운트용)
        roleCounts() {
            const c = { all: 0, content: 0, glossary: 0, template: 0, reference: 0, dataset: 0 };
            for (const f of this.allFiles) {
                if (f.sourceType !== 'upload') continue;
                c.all++;
                const r = f.docRole || 'content';
                if (c[r] !== undefined) c[r]++;
            }
            return c;
        },
        // 선택된 자료 중 사전·양식이 있으면 사용자에게 자동 활용 의미 안내
        autoUseHints() {
            const hits = { glossary: 0, template: 0, dataset: 0 };
            for (const f of this.allFiles) {
                if (!this.selectedKeysSet.has(f.key)) continue;
                const r = f.docRole || 'content';
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
        // 현재 탭 기준 트리
        tree() {
            return buildTree(this.tabFiles);
        },
        folderCount() {
            return collectAllFolderPaths(this.tree).length;
        },
        allExpanded() {
            const all = collectAllFolderPaths(this.tree);
            if (all.length === 0) return false;
            return all.every((p) => this.expandedPaths.has(p));
        },
        visibleFiles() {
            // 검색 모드일 때 평탄 리스트 (현재 탭 한정)
            const q = (this.search || '').trim().toLowerCase();
            if (!q) return this.tabFiles;
            return this.tabFiles.filter((f) => {
                return (
                    f.name.toLowerCase().includes(q) ||
                    (f.folderPath || '').toLowerCase().includes(q)
                );
            });
        },
        allFilteredSelected() {
            if (this.visibleFiles.length === 0) return false;
            return this.visibleFiles.every((f) => this.selectedKeysSet.has(f.key));
        },
        someFilteredSelected() {
            return this.visibleFiles.some((f) => this.selectedKeysSet.has(f.key));
        }
    },
    watch: {
        modelValue(v) {
            if (v) {
                this.selectedKeysSet = new Set(this.initiallySelectedIds || []);
                this.search = '';
                if (this.allFiles.length === 0) this.fetchDocs();
                else this.expandToSelected();
            }
        },
        activeSource() {
            // 탭 전환 시 검색 초기화 + 역할 필터를 기본(일반)으로 리셋
            this.search = '';
            this.currentRole = 'content';
            this.expandToSelected();
        },
        currentRole() {
            // role 필터 전환 시 검색 초기화 (트리 컨텍스트 리셋)
            this.search = '';
            this.expandToSelected();
        }
    },
    methods: {
        roleMeta(role) {
            return (
                this.roleFilterOptions.find((r) => r.value === role) ||
                this.roleFilterOptions[1] // content
            );
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
        async fetchDocs() {
            const tenantId = (typeof window !== 'undefined' && window.$tenantName) || '';
            if (!tenantId) {
                this.error = '테넌트 정보를 확인할 수 없습니다';
                return;
            }
            this.loading = true;
            this.error = '';
            try {
                const { data } = await axios.get('/memento/documents/list', {
                    params: { tenant_id: tenantId }
                });
                const details = Array.isArray(data?.file_details) ? data.file_details : [];
                this.allFiles = details.map((d) => ({
                    // 같은 파일명이 여러 폴더에 있을 수 있어 source_ref 우선, 없으면 폴더+파일명 조합
                    key: d.source_ref ? `${d.source_type || 'drive'}:${d.source_ref}` : `${d.folder_path || d.drive_folder_name || ''}::${d.file_name}`,
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
                }));
                this.expandToSelected();
            } catch (e) {
                console.error('[KnowledgeSpacePicker] fetch failed', e);
                this.error = e?.response?.data?.detail || e?.message || '문서 목록을 가져오지 못했습니다';
                this.allFiles = [];
            } finally {
                this.loading = false;
            }
        },
        reload() {
            this.fetchDocs();
        },
        expandToSelected() {
            // 선택된 파일들의 부모 폴더는 자동으로 펼쳐서 보이게
            const next = new Set(this.expandedPaths);
            // 기본 1뎁스 폴더는 펼쳐두기
            for (const n of this.tree) next.add(n.path);
            for (const f of this.allFiles) {
                if (!this.selectedKeysSet.has(f.key)) continue;
                const segs = (f.folderPath || '').split('/').filter(Boolean);
                let acc = '';
                for (const s of segs) {
                    acc = acc ? `${acc}/${s}` : s;
                    next.add(acc);
                }
            }
            this.expandedPaths = next;
        },
        toggleFolder(path) {
            const next = new Set(this.expandedPaths);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            this.expandedPaths = next;
        },
        toggleExpandAll() {
            if (this.allExpanded) {
                this.expandedPaths = new Set();
            } else {
                this.expandedPaths = new Set(collectAllFolderPaths(this.tree));
            }
        },
        toggleFile(f) {
            const next = new Set(this.selectedKeysSet);
            if (next.has(f.key)) next.delete(f.key);
            else next.add(f.key);
            this.selectedKeysSet = next;
        },
        toggleFolderSelect({ node, select }) {
            const files = collectFilesUnder(node);
            const next = new Set(this.selectedKeysSet);
            for (const f of files) {
                if (select) next.add(f.key);
                else next.delete(f.key);
            }
            this.selectedKeysSet = next;
        },
        toggleSelectAllFiltered(checked) {
            const next = new Set(this.selectedKeysSet);
            for (const f of this.visibleFiles) {
                if (checked) next.add(f.key);
                else next.delete(f.key);
            }
            this.selectedKeysSet = next;
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
            const selectedDocs = this.allFiles
                .filter((f) => this.selectedKeysSet.has(f.key))
                .map((f) => ({
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
                    owner: f.owner
                }));
            this.$emit('confirm', selectedDocs);
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
    background: #fff;
    cursor: pointer;
    font-size: 12px;
    color: rgba(0, 0, 0, 0.7);
    transition: background 0.12s, border-color 0.12s, color 0.12s;
}

.ksp-role-chip:hover {
    background: rgba(0, 0, 0, 0.04);
}

.ksp-role-chip.is-active.is-all       { background: rgba(97, 97, 97, 0.12); border-color: rgba(97, 97, 97, 0.4); color: #424242; }
.ksp-role-chip.is-active.is-content   { background: rgba(25, 118, 210, 0.12); border-color: rgba(25, 118, 210, 0.5); color: #1976d2; }
.ksp-role-chip.is-active.is-glossary  { background: rgba(123, 31, 162, 0.12); border-color: rgba(123, 31, 162, 0.5); color: #7b1fa2; }
.ksp-role-chip.is-active.is-template  { background: rgba(239, 108, 0, 0.12); border-color: rgba(239, 108, 0, 0.5); color: #ef6c00; }
.ksp-role-chip.is-active.is-reference { background: rgba(56, 142, 60, 0.12); border-color: rgba(56, 142, 60, 0.5); color: #388e3c; }
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
.ksp-role-badge.is-template  { background: rgba(239, 108, 0, 0.12);  color: #ef6c00; }
.ksp-role-badge.is-reference { background: rgba(56, 142, 60, 0.12);  color: #388e3c; }

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

.ksp-bulk-checkbox :deep(.v-selection-control) {
    min-height: 24px;
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
    color: #1976d2;
}

.ksp-status-badge.is-failed {
    background: rgba(244, 67, 54, 0.12);
    color: #c62828;
}

.ksp-status-badge.is-excluded {
    background: rgba(158, 158, 158, 0.18);
    color: #616161;
}

.ksp-footer {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
}
</style>
