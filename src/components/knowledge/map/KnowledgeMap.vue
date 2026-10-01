<template>
    <div class="kbm">
        <header class="kbm__head">
            <div class="kbm__head-text">
                <h2 class="kbm__title">지식 베이스</h2>
                <p class="kbm__subtitle">문서를 올리면 본문을 저장하고 카드로 지도를 만듭니다. 채팅에서 폴더를 고르면 에이전트가 이 지도로 문서를 찾습니다.</p>
            </div>
            <div class="kbm__head-actions">
                <v-chip v-if="queue.active" size="small" color="info" variant="tonal">
                    <v-progress-circular indeterminate size="12" width="2" class="mr-2" />처리 중 {{ queue.active }}
                </v-chip>
                <v-btn variant="text" size="small" prepend-icon="mdi-refresh" :loading="loadingTree" @click="reload">새로고침</v-btn>
            </div>
        </header>

        <div class="kbm__body">
            <aside class="kbm__side">
                <KbFolderTree
                    :nodes="nodes"
                    :current="current"
                    :expanded="expanded"
                    :can-manage="me.isAdmin"
                    @select="select"
                    @toggle="toggle"
                    @expand-all="expandAll"
                    @create="createFolder"
                    @rename="askRename"
                    @remove="askRemoveFolder"
                    @rebuild-card="rebuildFolderCard($event.path)"
                />
            </aside>
            <main class="kbm__main">
                <KbFolderPanel
                    :folder-path="current"
                    :data="folderData"
                    :node="currentNode"
                    :roots="rootNodes"
                    :overall-readiness="overallReadiness"
                    :loading="loadingFolder"
                    :rebuilding="rebuilding"
                    :can-manage="me.isAdmin"
                    @select="select"
                    @open-doc="drawerDoc = $event"
                    @uploaded="onUploaded"
                    @notify="notify"
                    @rebuild-card="rebuildFolderCard(current)"
                    @query="onQuery"
                />
            </main>
        </div>

        <KbDocDrawer
            :doc="drawerDoc"
            :can-manage="canManageDoc(drawerDoc)"
            @close="drawerDoc = null"
            @delete="askRemoveDoc"
            @changed="onDocChanged"
            @notify="notify"
        />

        <v-dialog v-model="rename.show" max-width="420">
            <v-card>
                <v-card-title class="text-subtitle-1">폴더 이름 변경</v-card-title>
                <v-card-text>
                    <v-text-field v-model="rename.name" label="새 이름" density="compact" variant="outlined" autofocus hide-details @keyup.enter="doRename" />
                    <div class="text-caption text-medium-emphasis mt-2">하위 폴더와 문서 경로가 함께 바뀝니다. 에이전트가 보는 지도도 새 이름을 씁니다.</div>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="rename.show = false">취소</v-btn>
                    <v-btn color="primary" variant="flat" :loading="rename.loading" :disabled="!rename.name.trim()" @click="doRename">변경</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <v-dialog v-model="removeFolder.show" max-width="440">
            <v-card>
                <v-card-title class="text-subtitle-1">폴더 삭제</v-card-title>
                <v-card-text class="text-body-2">
                    <strong>{{ removeFolder.node && removeFolder.node.path }}</strong> 폴더와 하위 문서
                    <strong>{{ removeFolder.node && removeFolder.node.nTotal }}</strong>건을 지도와 스토리지에서 영구 삭제합니다.
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="removeFolder.show = false">취소</v-btn>
                    <v-btn color="error" variant="flat" :loading="removeFolder.loading" @click="doRemoveFolder">삭제</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <v-dialog v-model="removeDoc.show" max-width="440">
            <v-card>
                <v-card-title class="text-subtitle-1">문서 삭제</v-card-title>
                <v-card-text class="text-body-2">
                    <strong>{{ removeDoc.doc && removeDoc.doc.file_name }}</strong> 을(를) 지도와 스토리지에서 영구 삭제합니다.
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="removeDoc.show = false">취소</v-btn>
                    <v-btn color="error" variant="flat" :loading="removeDoc.loading" @click="doRemoveDoc">삭제</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <v-snackbar v-model="snack.show" :color="snack.color" :timeout="4000" location="bottom right">{{ snack.text }}</v-snackbar>
    </div>
</template>

<script>
import KbFolderTree from './KbFolderTree.vue';
import KbFolderPanel from './KbFolderPanel.vue';
import KbDocDrawer from './KbDocDrawer.vue';
import { ancestorsOf, leafOf, parentOf } from './kbFormat';
import * as api from './kbApi';

const LS_EXPANDED = 'kb.map.expanded';
const LS_FOLDER = 'kb.map.folder';
const POLL_MS = 4000;

function readJson(key, fallback) {
    try {
        const v = JSON.parse(localStorage.getItem(key) || 'null');
        return v == null ? fallback : v;
    } catch (e) {
        return fallback;
    }
}

export default {
    name: 'KnowledgeMap',
    components: { KbFolderTree, KbFolderPanel, KbDocDrawer },
    data() {
        return {
            me: api.requester(),
            tree: [],
            overallReadiness: null,
            emptyFolders: [],
            counts: {},
            expanded: readJson(LS_EXPANDED, {}),
            current: '',
            folderData: null,
            query: '',
            loadingTree: false,
            loadingFolder: false,
            rebuilding: false,
            drawerDoc: null,
            queue: { active: 0, terminal: -1 },
            pollTimer: null,
            rename: { show: false, node: null, name: '', loading: false },
            removeFolder: { show: false, node: null, loading: false },
            removeDoc: { show: false, doc: null, loading: false },
            snack: { show: false, text: '', color: 'success' }
        };
    },
    computed: {
        // 트리(/folders/tree) + 빈 폴더 레지스트리를 경로순 평탄 목록으로.
        nodes() {
            const byPath = new Map();
            const walk = (n) => {
                byPath.set(n.folder_path, {
                    path: n.folder_path,
                    name: n.name,
                    nDirect: n.n_docs_direct || 0,
                    nTotal: n.n_docs_total || 0,
                    readiness: n.readiness || null,
                    card: n.card || null
                });
                (n.children || []).forEach(walk);
            };
            this.tree.forEach(walk);
            for (const f of this.emptyFolders) {
                for (const p of ancestorsOf(f.folder_path)) {
                    if (!byPath.has(p)) byPath.set(p, { path: p, name: leafOf(p), nDirect: 0, nTotal: 0, readiness: null, card: null });
                }
            }
            return [...byPath.values()]
                .sort((a, b) => a.path.localeCompare(b.path, 'ko'))
                .map((n) => ({ ...n, depth: n.path.split('/').length - 1 }));
        },
        currentNode() {
            return this.nodes.find((n) => n.path === this.current) || null;
        },
        rootNodes() {
            return this.nodes.filter((n) => n.depth === 0);
        }
    },
    watch: {
        current(v) {
            localStorage.setItem(LS_FOLDER, v || '');
            this.query = '';
            this.openCurrent();
        }
    },
    mounted() {
        this.current = localStorage.getItem(LS_FOLDER) || '';
        this.reload().then(() => {
            if (!Object.keys(this.expanded).length) this.rootNodes.forEach((n) => (this.expanded[n.path] = true));
            for (const p of ancestorsOf(parentOf(this.current))) this.expanded[p] = true;
            this.startPolling();
        });
    },
    beforeUnmount() {
        this.stopPolling();
    },
    methods: {
        notify(payload) {
            const { text, color = 'success' } = typeof payload === 'string' ? { text: payload } : payload || {};
            this.snack = { show: true, text, color };
        },
        canManageDoc(doc) {
            if (!doc) return false;
            return this.me.isAdmin || (!!this.me.uid && String(doc.uploaded_by_uid || '') === String(this.me.uid));
        },
        async reload() {
            this.loadingTree = true;
            try {
                const [tree, empty, counts] = await Promise.all([
                    api.fetchTree(),
                    api.listEmptyFolders(),
                    api.fetchCounts()
                ]);
                this.tree = tree?.tree || [];
                this.overallReadiness = tree?.readiness || null;
                this.emptyFolders = empty;
                this.counts = counts;
                if (this.current && !this.nodes.some((n) => n.path === this.current)) this.current = '';
                else await this.openCurrent();
            } catch (e) {
                this.notify({ text: api.errorText(e, '지도를 불러오지 못했습니다'), color: 'error' });
            } finally {
                this.loadingTree = false;
            }
        },
        async openCurrent() {
            if (!this.current) {
                this.folderData = null;
                return;
            }
            const path = this.current;
            this.loadingFolder = true;
            try {
                const data = await api.openFolder(path, { query: this.query });
                if (this.current === path) this.folderData = data;
            } catch (e) {
                if (this.current === path) this.folderData = null;
                this.notify({ text: api.errorText(e, '폴더를 열지 못했습니다'), color: 'error' });
            } finally {
                this.loadingFolder = false;
            }
        },
        onQuery(q) {
            this.query = q || '';
            this.openCurrent();
        },
        select(path) {
            this.current = path || '';
            for (const p of ancestorsOf(parentOf(path))) this.expanded[p] = true;
            this.persistExpanded();
        },
        toggle(path) {
            this.expanded[path] = !this.expanded[path];
            this.persistExpanded();
        },
        expandAll(open) {
            for (const n of this.nodes) this.expanded[n.path] = !!open;
            this.persistExpanded();
        },
        persistExpanded() {
            localStorage.setItem(LS_EXPANDED, JSON.stringify(this.expanded));
        },
        async createFolder(path) {
            try {
                await api.createFolder(path);
                await this.reload();
                this.select(path);
            } catch (e) {
                this.notify({ text: api.errorText(e, '폴더를 만들지 못했습니다'), color: 'error' });
            }
        },
        askRename(node) {
            this.rename = { show: true, node, name: node.name, loading: false };
        },
        async doRename() {
            const node = this.rename.node;
            const name = (this.rename.name || '').trim().replace(/[\\/]+/g, '-');
            if (!node || !name || name === node.name) {
                this.rename.show = false;
                return;
            }
            const newPath = [parentOf(node.path), name].filter(Boolean).join('/');
            this.rename.loading = true;
            try {
                await api.renameFolder(node.path, newPath);
                if (this.current === node.path || this.current.startsWith(node.path + '/')) {
                    this.current = newPath + this.current.slice(node.path.length);
                }
                this.rename.show = false;
                await this.reload();
                this.notify('폴더 이름을 바꿨습니다');
            } catch (e) {
                this.notify({ text: api.errorText(e, '이름을 바꾸지 못했습니다'), color: 'error' });
            } finally {
                this.rename.loading = false;
            }
        },
        askRemoveFolder(node) {
            this.removeFolder = { show: true, node, loading: false };
        },
        async doRemoveFolder() {
            const node = this.removeFolder.node;
            if (!node) return;
            this.removeFolder.loading = true;
            try {
                const res = await api.deleteFolder(node.path);
                if (res && res.ok === false) throw new Error('일부 문서를 지우지 못했습니다');
                if (this.current === node.path || this.current.startsWith(node.path + '/')) this.current = parentOf(node.path);
                this.removeFolder.show = false;
                await this.reload();
                this.notify(res?.partial ? '폴더를 지웠지만 일부 인덱스 정리가 남았습니다' : '폴더를 삭제했습니다', res?.partial ? 'warning' : 'success');
            } catch (e) {
                this.notify({ text: api.errorText(e, '폴더를 삭제하지 못했습니다'), color: 'error' });
            } finally {
                this.removeFolder.loading = false;
            }
        },
        askRemoveDoc(doc) {
            this.removeDoc = { show: true, doc, loading: false };
        },
        async doRemoveDoc() {
            const doc = this.removeDoc.doc;
            if (!doc) return;
            this.removeDoc.loading = true;
            try {
                await api.deleteFile(doc);
                this.removeDoc.show = false;
                this.drawerDoc = null;
                await Promise.all([this.openCurrent(), this.reload()]);
                this.notify('문서를 삭제했습니다');
            } catch (e) {
                this.notify({ text: api.errorText(e, '문서를 삭제하지 못했습니다'), color: 'error' });
            } finally {
                this.removeDoc.loading = false;
            }
        },
        async onDocChanged() {
            await Promise.all([this.openCurrent(), this.reload()]);
            if (this.drawerDoc && this.folderData) {
                const fresh = (this.folderData.docs || []).find((d) => d.source_ref === this.drawerDoc.source_ref);
                if (fresh) this.drawerDoc = fresh;
            }
            this.startPolling();
        },
        onUploaded({ done, failed }) {
            if (done) this.notify(`${done}개를 접수했습니다. 본문 저장과 카드 생성은 백그라운드로 진행됩니다.`);
            if (failed) this.notify({ text: `${failed}개 업로드 실패`, color: 'error' });
            this.reload();
            this.startPolling();
        },
        // 폴더 카드는 백그라운드로 만들어진다 — built_at 이 바뀔 때까지 몇 번 들여다본다.
        async rebuildFolderCard(path) {
            if (!path) return;
            const before = (this.folderData?.card?.built_at || this.currentNode?.card?.built_at) ?? null;
            this.rebuilding = true;
            try {
                await api.refreshFolderCards([path]);
                for (let i = 0; i < 12; i++) {
                    await new Promise((r) => setTimeout(r, 5000));
                    const res = await api.fetchFolderCard(path);
                    if (res?.card && res.built_at && res.built_at !== before) break;
                }
                await this.reload();
                this.notify('폴더 카드를 갱신했습니다');
            } catch (e) {
                this.notify({ text: api.errorText(e, '폴더 카드를 만들지 못했습니다'), color: 'error' });
            } finally {
                this.rebuilding = false;
            }
        },
        // 인제스트 상태 카운트만 가볍게 폴링 — 완료 수가 바뀔 때만 지도를 다시 그린다.
        startPolling() {
            if (this.pollTimer) return;
            this.queue.terminal = -1;
            this.pollTimer = setInterval(() => this.poll(), POLL_MS);
            this.poll();
        },
        stopPolling() {
            if (this.pollTimer) clearInterval(this.pollTimer);
            this.pollTimer = null;
        },
        async poll() {
            try {
                const st = await api.ingestStatus();
                const c = st?.counts || {};
                const active = (c.pending || 0) + (c.processing || 0);
                const terminal = (c.indexed || 0) + (c.failed || 0);
                const hasPendingCards = (this.overallReadiness?.pending || 0) > 0;
                this.queue.active = active;
                if (terminal !== this.queue.terminal) {
                    const first = this.queue.terminal === -1;
                    this.queue.terminal = terminal;
                    if (!first) await this.reload();
                } else if (hasPendingCards) {
                    await this.reload();
                }
                if (!active && !hasPendingCards) this.stopPolling();
            } catch (e) {
                // 다음 tick 에 다시
            }
        }
    }
};
</script>

<style scoped>
.kbm {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--cds-surface-1, transparent);
}
.kbm__head {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px 6px;
}
.kbm__head-text {
    flex: 1;
    min-width: 0;
}
.kbm__title {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: var(--cds-text-primary);
}
.kbm__subtitle {
    margin: 2px 0 0;
    font-size: 12.5px;
    color: var(--cds-text-muted);
}
.kbm__head-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}
.kbm__body {
    flex: 1;
    display: flex;
    min-height: 0;
}
.kbm__side {
    flex: 0 0 260px;
    border-right: 1px solid var(--cds-border);
    min-height: 0;
}
.kbm__main {
    flex: 1;
    min-width: 0;
    overflow: auto;
}
@media (max-width: 900px) {
    .kbm__body {
        flex-direction: column;
    }
    .kbm__side {
        flex: 0 0 auto;
        max-height: 40vh;
        border-right: 0;
        border-bottom: 1px solid var(--cds-border);
    }
}
</style>
