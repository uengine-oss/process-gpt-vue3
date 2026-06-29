<template>
    <div class="fp-wrap">
        <div class="fp-header">
            <v-icon size="20" color="primary" class="mr-2">mdi-shield-account-outline</v-icon>
            <span class="fp-title">폴더 권한 관리</span>
            <span class="fp-sub">사용자를 선택하고, 조회를 허용할 지식베이스 폴더를 체크하세요. (체크한 폴더의 하위 폴더는 자동 포함)</span>
            <v-spacer />
            <v-btn icon variant="text" size="small" @click="reloadAll" :disabled="loading">
                <v-icon>mdi-refresh</v-icon>
            </v-btn>
        </div>

        <v-divider />

        <div class="fp-body">
            <!-- 좌: 사용자 목록 -->
            <div class="fp-users">
                <v-text-field
                    v-model="userSearch"
                    density="compact"
                    variant="outlined"
                    hide-details
                    placeholder="사용자 검색"
                    prepend-inner-icon="mdi-magnify"
                    clearable
                    class="fp-user-search"
                />
                <div class="fp-user-list">
                    <div v-if="loadingUsers" class="fp-state">
                        <v-progress-circular indeterminate color="primary" size="24" />
                    </div>
                    <div v-else-if="filteredUsers.length === 0" class="fp-state text-caption text-medium-emphasis">
                        사용자가 없습니다
                    </div>
                    <div
                        v-for="u in filteredUsers"
                        :key="u.id"
                        class="fp-user"
                        :class="{ 'is-active': selectedUser && selectedUser.id === u.id }"
                        @click="selectUser(u)"
                    >
                        <v-avatar size="28" class="mr-2">
                            <v-img v-if="u.profile" :src="u.profile" />
                            <v-icon v-else size="18">mdi-account</v-icon>
                        </v-avatar>
                        <div class="fp-user-body">
                            <div class="fp-user-name">
                                {{ u.username || u.email || '(이름 없음)' }}
                                <span v-if="u.role === 'PocAdmin'" class="fp-badge is-admin">PocAdmin</span>
                                <span v-else-if="u.is_admin" class="fp-badge">admin</span>
                            </div>
                            <div class="fp-user-email">{{ u.email }}</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 우: 폴더 권한 -->
            <div class="fp-folders">
                <div v-if="!selectedUser" class="fp-state">
                    <v-icon size="40" color="grey-lighten-1">mdi-account-arrow-left-outline</v-icon>
                    <div class="text-body-2 text-medium-emphasis mt-2">왼쪽에서 사용자를 선택하세요</div>
                </div>
                <template v-else>
                    <div class="fp-folders-head">
                        <div>
                            <strong>{{ selectedUser.username || selectedUser.email }}</strong> 님이 조회할 수 있는 폴더
                        </div>
                        <div class="fp-folders-head-actions">
                            <v-btn
                                v-if="folderNodes.some((n) => n.hasChildren)"
                                variant="text"
                                size="x-small"
                                :prepend-icon="allExpanded ? 'mdi-unfold-less-horizontal' : 'mdi-unfold-more-horizontal'"
                                @click="allExpanded ? collapseAll() : expandAll()"
                            >
                                {{ allExpanded ? '모두 접기' : '모두 펼치기' }}
                            </v-btn>
                            <span class="fp-allow-count">허용 {{ allowedPaths.length }}개</span>
                        </div>
                    </div>

                    <div
                        v-if="selectedUser.role === 'PocAdmin'"
                        class="fp-admin-note text-caption"
                    >
                        <v-icon size="14" class="mr-1">mdi-information-outline</v-icon>
                        PocAdmin 은 권한 설정과 무관하게 모든 폴더를 조회할 수 있습니다.
                    </div>

                    <div class="fp-folder-list">
                        <div v-if="loadingFolders" class="fp-state">
                            <v-progress-circular indeterminate color="primary" size="24" />
                        </div>
                        <div v-else-if="folderNodes.length === 0" class="fp-state text-caption text-medium-emphasis">
                            지식베이스에 폴더가 없습니다
                        </div>
                        <div
                            v-for="node in visibleFolderNodes"
                            :key="node.path"
                            class="fp-folder"
                            :class="{ 'is-allowed': isAllowed(node.path) }"
                        >
                            <!-- 트리 라인 (depth 만큼 세로 가이드) -->
                            <span v-for="i in node.depth" :key="i" class="fp-rail"></span>
                            <!-- 펼침 토글 -->
                            <span
                                class="fp-twisty"
                                :class="{ 'is-leaf': !node.hasChildren }"
                                @click="node.hasChildren && toggleExpand(node.path)"
                            >
                                <v-icon v-if="node.hasChildren" size="18">
                                    {{ expandedPaths.has(node.path) ? 'mdi-menu-down' : 'mdi-menu-right' }}
                                </v-icon>
                            </span>
                            <v-checkbox
                                :modelValue="isAllowed(node.path)"
                                @update:modelValue="(v) => toggleFolder(node.path, v)"
                                :disabled="saving || (!isAllowed(node.path) && isInheritedAllowed(node.path))"
                                density="compact"
                                hide-details
                                color="primary"
                                class="fp-folder-check"
                            />
                            <v-icon size="16" class="mr-1" color="amber-darken-2">
                                {{ node.hasChildren && expandedPaths.has(node.path) ? 'mdi-folder-open-outline' : 'mdi-folder-outline' }}
                            </v-icon>
                            <span class="fp-folder-name" @click="node.hasChildren && toggleExpand(node.path)">{{ node.name }}</span>
                            <span class="fp-folder-count">{{ node.fileCount }}</span>
                            <span
                                v-if="!isAllowed(node.path) && isInheritedAllowed(node.path)"
                                class="fp-inherit"
                            >
                                <v-icon size="12">mdi-arrow-up-left</v-icon> 상위 폴더에서 상속됨
                            </span>
                        </div>
                    </div>
                </template>
            </div>
        </div>
    </div>
</template>

<script>
import axios from 'axios';

export default {
    name: 'FolderPermissionsTab',
    data() {
        return {
            users: [],
            selectedUser: null,
            userSearch: '',
            files: [], // /memento/documents/list 의 file_details
            allowedPaths: [], // 선택 사용자의 허용 folder_path 목록
            expandedPaths: new Set(), // 펼쳐진 폴더 경로
            loadingUsers: false,
            loadingFolders: false,
            saving: false
        };
    },
    computed: {
        loading() {
            return this.loadingUsers || this.loadingFolders;
        },
        filteredUsers() {
            const q = (this.userSearch || '').trim().toLowerCase();
            const list = this.users;
            if (!q) return list;
            return list.filter(
                (u) =>
                    (u.username || '').toLowerCase().includes(q) ||
                    (u.email || '').toLowerCase().includes(q)
            );
        },
        // 파일들의 folder_path 에서 모든 조상 폴더를 포함한 고유 폴더 트리(평탄 + depth)
        folderNodes() {
            const direct = {}; // path -> 직속 파일 수
            const total = {}; // path -> 하위 전체 파일 수
            const all = new Set();
            for (const f of this.files) {
                const fp = (f.folder_path || f.drive_folder_name || '').trim().replace(/^\/+|\/+$/g, '');
                if (!fp) continue;
                direct[fp] = (direct[fp] || 0) + 1;
                const segs = fp.split('/').filter(Boolean);
                let acc = '';
                for (const s of segs) {
                    acc = acc ? `${acc}/${s}` : s;
                    all.add(acc);
                    total[acc] = (total[acc] || 0) + 1;
                }
            }
            const sorted = [...all].sort();
            return sorted.map((p) => ({
                path: p,
                name: p.split('/').pop(),
                depth: p.split('/').length - 1,
                fileCount: total[p] || 0,
                hasChildren: sorted.some((q) => q.startsWith(p + '/'))
            }));
        },
        // 접힌 조상이 있는 노드는 숨김 (트리 접기/펼치기)
        visibleFolderNodes() {
            return this.folderNodes.filter((n) => {
                const segs = n.path.split('/');
                let acc = '';
                for (let i = 0; i < segs.length - 1; i++) {
                    acc = acc ? `${acc}/${segs[i]}` : segs[i];
                    if (!this.expandedPaths.has(acc)) return false;
                }
                return true;
            });
        },
        allExpanded() {
            const withKids = this.folderNodes.filter((n) => n.hasChildren);
            return withKids.length > 0 && withKids.every((n) => this.expandedPaths.has(n.path));
        }
    },
    mounted() {
        this.loadUsers();
        this.loadFolders();
    },
    methods: {
        reloadAll() {
            this.loadUsers();
            this.loadFolders();
            if (this.selectedUser) this.loadPermissions(this.selectedUser.id);
        },
        async loadUsers() {
            this.loadingUsers = true;
            try {
                const { data, error } = await window.$supabase
                    .from('users')
                    .select('id, username, email, role, is_admin, profile')
                    .match({ tenant_id: window.$tenantName, is_agent: false })
                    .order('username', { ascending: true });
                if (error) throw error;
                this.users = data || [];
            } catch (e) {
                console.error('[FolderPermissionsTab] loadUsers failed', e);
                this.users = [];
            } finally {
                this.loadingUsers = false;
            }
        },
        async loadFolders() {
            this.loadingFolders = true;
            try {
                const { data } = await axios.get('/memento/documents/list', {
                    params: { tenant_id: window.$tenantName || '' }
                });
                this.files = Array.isArray(data?.file_details) ? data.file_details : [];
                // 기본: 전체 펼친 상태로 시작 (접기 가능)
                this.expandedPaths = new Set(this.folderNodes.map((n) => n.path));
            } catch (e) {
                console.error('[FolderPermissionsTab] loadFolders failed', e);
                this.files = [];
            } finally {
                this.loadingFolders = false;
            }
        },
        toggleExpand(path) {
            const next = new Set(this.expandedPaths);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            this.expandedPaths = next;
        },
        expandAll() {
            this.expandedPaths = new Set(this.folderNodes.map((n) => n.path));
        },
        collapseAll() {
            this.expandedPaths = new Set();
        },
        async selectUser(u) {
            this.selectedUser = u;
            await this.loadPermissions(u.id);
        },
        async loadPermissions(userId) {
            try {
                const { data, error } = await window.$supabase
                    .from('folder_permissions')
                    .select('folder_path')
                    .match({ tenant_id: window.$tenantName, user_id: userId });
                if (error) throw error;
                this.allowedPaths = (data || []).map((r) => r.folder_path);
            } catch (e) {
                console.error('[FolderPermissionsTab] loadPermissions failed', e);
                this.allowedPaths = [];
            }
        },
        isAllowed(path) {
            return this.allowedPaths.includes(path);
        },
        // 상위 폴더가 명시 허용되면 하위는 자동 상속(체크 불필요)
        isInheritedAllowed(path) {
            return this.allowedPaths.some((a) => path === a || path.startsWith(a + '/'));
        },
        async toggleFolder(path, checked) {
            if (this.saving) return;
            this.saving = true;
            const tenant = window.$tenantName;
            const uid = this.selectedUser.id;
            try {
                if (checked) {
                    const { error } = await window.$supabase
                        .from('folder_permissions')
                        .upsert(
                            { tenant_id: tenant, user_id: uid, folder_path: path },
                            { onConflict: 'tenant_id,user_id,folder_path' }
                        );
                    if (error) throw error;
                    if (!this.allowedPaths.includes(path)) this.allowedPaths = [...this.allowedPaths, path];
                } else {
                    const { error } = await window.$supabase
                        .from('folder_permissions')
                        .delete()
                        .match({ tenant_id: tenant, user_id: uid, folder_path: path });
                    if (error) throw error;
                    this.allowedPaths = this.allowedPaths.filter((p) => p !== path);
                }
            } catch (e) {
                console.error('[FolderPermissionsTab] toggleFolder failed', e);
                alert('권한 저장에 실패했습니다: ' + (e?.message || e));
            } finally {
                this.saving = false;
            }
        }
    }
};
</script>

<style scoped>
.fp-wrap {
    display: flex;
    flex-direction: column;
    height: 100%;
}
.fp-header {
    display: flex;
    align-items: center;
    padding: 14px 20px;
}
.fp-title {
    font-size: 16px;
    font-weight: 600;
}
.fp-sub {
    font-size: 12px;
    color: rgba(0, 0, 0, 0.55);
    margin-left: 12px;
}
.fp-body {
    display: flex;
    flex: 1 1 0;
    min-height: 0;
}
.fp-users {
    width: 300px;
    flex: 0 0 auto;
    border-right: 1px solid rgba(0, 0, 0, 0.08);
    display: flex;
    flex-direction: column;
    padding: 12px;
}
.fp-user-search {
    flex: 0 0 auto;
    margin-bottom: 8px;
}
.fp-user-list {
    overflow-y: auto;
    flex: 1 1 0;
    min-height: 0;
}
.fp-user {
    display: flex;
    align-items: center;
    padding: 8px 10px;
    border-radius: 8px;
    cursor: pointer;
    border: 1px solid transparent;
}
.fp-user:hover {
    background: rgba(var(--v-theme-primary), 0.04);
}
.fp-user.is-active {
    background: rgba(var(--v-theme-primary), 0.1);
    border-color: rgba(var(--v-theme-primary), 0.3);
}
.fp-user-body {
    min-width: 0;
}
.fp-user-name {
    font-size: 13px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
}
.fp-user-email {
    font-size: 11px;
    color: rgba(0, 0, 0, 0.5);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.fp-badge {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.08);
    color: rgba(0, 0, 0, 0.6);
    font-weight: 500;
}
.fp-badge.is-admin {
    background: rgba(var(--v-theme-primary), 0.14);
    color: rgb(var(--v-theme-primary));
}
.fp-folders {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    padding: 12px 16px;
}
.fp-folders-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 4px 10px;
    font-size: 13px;
}
.fp-admin-note {
    background: rgba(var(--v-theme-primary), 0.07);
    border-left: 3px solid rgb(var(--v-theme-primary));
    border-radius: 4px;
    padding: 6px 10px;
    margin-bottom: 8px;
    color: rgba(0, 0, 0, 0.7);
}
.fp-folder-list {
    overflow-y: auto;
    flex: 1 1 0;
    min-height: 0;
}
.fp-folder {
    display: flex;
    align-items: center;
    padding: 2px 4px;
    border-radius: 6px;
    min-height: 30px;
}
.fp-folder:hover {
    background: rgba(0, 0, 0, 0.035);
}
.fp-folder.is-allowed {
    background: rgba(var(--v-theme-primary), 0.06);
}
.fp-folder.is-allowed:hover {
    background: rgba(var(--v-theme-primary), 0.1);
}
/* 트리 라인 — depth 만큼 세로 가이드 */
.fp-rail {
    width: 20px;
    flex: 0 0 auto;
    align-self: stretch;
    border-left: 1px solid rgba(0, 0, 0, 0.12);
}
/* 펼침 토글 */
.fp-twisty {
    width: 22px;
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: rgba(0, 0, 0, 0.45);
    border-radius: 4px;
}
.fp-twisty:hover {
    background: rgba(0, 0, 0, 0.06);
}
.fp-twisty.is-leaf {
    cursor: default;
}
.fp-twisty.is-leaf:hover {
    background: transparent;
}
.fp-folder-check {
    flex: 0 0 auto;
}
.fp-folder-check :deep(.v-selection-control) {
    min-height: 24px;
}
.fp-folder-name {
    font-size: 13px;
    color: rgba(0, 0, 0, 0.85);
    cursor: pointer;
}
.fp-folders-head-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}
.fp-allow-count {
    font-size: 12px;
    color: rgba(0, 0, 0, 0.5);
}
.fp-folder-count {
    margin-left: 8px;
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.06);
    color: rgba(0, 0, 0, 0.5);
}
.fp-inherit {
    margin-left: 10px;
    font-size: 11px;
    color: rgb(var(--v-theme-primary));
    opacity: 0.8;
}
.fp-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 0;
}
</style>
