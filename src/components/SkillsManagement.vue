<template>
    <v-card elevation="10">
        <AppBaseCard :custom-menu-name="$t('SkillsManagement.title')" :is-instance-chat="true">
            <template v-slot:rightpart>
                <!-- 상단: 왼쪽 타이틀, 오른쪽 테이블/카드 + 스킬 추가 -->
                <div class="skills-management-header d-flex align-center flex-wrap pa-3">
                    <h5 class="text-h5 mb-0 mr-4">{{ $t('SkillsManagement.title') }}</h5>
                    <p class="text-body-1 text-medium-emphasis mb-0">{{ $t('SkillsManagement.description') }}</p>
                    <v-spacer />
                    <div class="d-flex align-center gap-2">
                        <v-btn-toggle
                            v-model="viewMode"
                            mandatory
                            density="compact"
                            variant="outlined"
                            divided
                            color="primary"
                        >
                            <v-btn value="table" size="small">
                                <v-icon size="small">mdi-table</v-icon>
                                <span class="ml-1 d-none d-sm-inline">{{ $t('SkillsManagement.viewTable') }}</span>
                            </v-btn>
                            <v-btn value="card" size="small">
                                <v-icon size="small">mdi-view-grid-outline</v-icon>
                                <span class="ml-1 d-none d-sm-inline">{{ $t('SkillsManagement.viewCard') }}</span>
                            </v-btn>
                        </v-btn-toggle>
                        <v-menu location="bottom end" :disabled="isUploading">
                            <template v-slot:activator="{ props }">
                                <v-btn v-bind="props" color="primary" variant="flat" size="small" :loading="isUploading">
                                    <v-icon start>mdi-plus</v-icon>
                                    {{ $t('SkillsManagement.addSkill') }}
                                </v-btn>
                            </template>
                            <v-list density="compact" min-width="200">
                                <v-list-item @click="openZipUpload" class="list-item-with-hint">
                                    <template v-slot:prepend>
                                        <v-icon color="primary">mdi-folder-zip-outline</v-icon>
                                    </template>
                                    <v-list-item-title>{{ $t('SkillsManagement.addFromZip') }}</v-list-item-title>
                                    <v-list-item-subtitle class="text-caption">{{ $t('SkillsManagement.addFromZipHint') }}</v-list-item-subtitle>
                                </v-list-item>
                                <v-list-item @click="openRepoDialog" class="list-item-with-hint">
                                    <template v-slot:prepend>
                                        <v-icon color="primary">mdi-github</v-icon>
                                    </template>
                                    <v-list-item-title>{{ $t('SkillsManagement.addFromRepo') }}</v-list-item-title>
                                    <v-list-item-subtitle class="text-caption">{{ $t('SkillsManagement.addFromRepoHint') }}</v-list-item-subtitle>
                                </v-list-item>
                            </v-list>
                        </v-menu>
                    </div>
                </div>
                <!-- 본문: 탭 + 목록 -->
                <div class="skills-management-body pa-3">
                <div v-if="isLoading" class="body-state body-loading">
                    <v-progress-circular indeterminate color="primary" size="40" width="3" />
                    <p class="text-body-1 mt-3 text-medium-emphasis">{{ $t('SkillList.loading') }}</p>
                </div>
                <template v-else>
                    <v-tabs
                        v-model="skillTab"
                        density="compact"
                        variant="plain"
                        class="skills-management-tabs mb-3"
                        hide-slider
                    >
                        <v-tab value="uploaded" class="text-body-2">{{ $t('SkillsManagement.uploadedSkills') }}</v-tab>
                        <v-tab value="builtin" class="text-body-2">{{ $t('SkillsManagement.builtinSkills') }}</v-tab>
                    </v-tabs>
                    <v-window v-model="skillTab" class="skills-tab-window">
                        <!-- 업로드된 스킬 탭 -->
                        <v-window-item value="uploaded">
                            <div class="skill-section">
                                <div v-if="skillList.length === 0 && !isUploading" class="body-state body-empty">
                                    <div v-if="builtinSkillList.length === 0" class="empty-illustration">
                                        <v-icon size="80" color="grey-lighten-1">mdi-lightning-bolt-outline</v-icon>
                                    </div>
                                    <h3 v-if="builtinSkillList.length === 0" class="empty-title">{{ $t('SkillsManagement.emptyTitle') }}</h3>
                                    <p class="empty-desc">{{ builtinSkillList.length === 0 ? $t('SkillsManagement.empty') : $t('SkillsManagement.uploadedEmpty') }}</p>
                                    <div v-if="builtinSkillList.length === 0" class="empty-actions">
                                        <v-card variant="outlined" class="empty-action-card" rounded="lg" @click="openZipUpload">
                                            <v-icon size="32" color="primary">mdi-folder-zip-outline</v-icon>
                                            <span class="empty-action-label">{{ $t('SkillsManagement.addFromZip') }}</span>
                                            <span class="text-caption text-medium-emphasis">{{ $t('SkillsManagement.addFromZipHint') }}</span>
                                        </v-card>
                                        <v-card variant="outlined" class="empty-action-card" rounded="lg" @click="openRepoDialog">
                                            <v-icon size="32" color="primary">mdi-github</v-icon>
                                            <span class="empty-action-label">{{ $t('SkillsManagement.addFromRepo') }}</span>
                                            <span class="text-caption text-medium-emphasis">{{ $t('SkillsManagement.addFromRepoHint') }}</span>
                                        </v-card>
                                    </div>
                                </div>
                                <template v-else>
                            <div v-if="viewMode === 'table'" class="table-wrap">
                                <v-table class="skill-management-table" hover>
                                    <thead>
                                        <tr>
                                            <th class="text-left table-header-name table-header-sort" @click="toggleSortOrder">
                                                <span class="d-inline-flex align-center">
                                                    {{ $t('SkillsManagement.skillName') }}
                                                    <v-icon size="18" class="ml-1" :class="{ 'sort-desc': tableSortOrder === 'desc' }">
                                                        {{ tableSortOrder === 'asc' ? 'mdi-sort-ascending' : 'mdi-sort-descending' }}
                                                    </v-icon>
                                                </span>
                                            </th>
                                            <th class="text-left table-header-desc">{{ $t('SkillsManagement.skillDescription') }}</th>
                                            <th class="text-right table-header-used">{{ $t('SkillsManagement.usedByAgents') }}</th>
                                            <th class="text-right table-header-actions"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-if="isUploading" class="table-row table-row-placeholder">
                                            <td class="td-name">
                                                <div class="name-cell">
                                                    <v-progress-circular indeterminate size="20" width="2" color="primary" class="mr-2" />
                                                    <span class="skill-name-text text-medium-emphasis">{{ $t('SkillsManagement.uploading') }}</span>
                                                </div>
                                            </td>
                                            <td class="td-desc text-medium-emphasis">—</td>
                                            <td class="td-used text-right text-medium-emphasis">—</td>
                                            <td class="td-actions text-right"></td>
                                        </tr>
                                        <tr
                                            v-for="skill in uploadedPaginated"
                                            :key="'uploaded-' + skill.name"
                                            class="table-row"
                                            :class="{ 'table-row-deleting': deletingSkillName === skill.name }"
                                            @click="deletingSkillName === skill.name ? null : $router.push(`/skills/${encodeURIComponent(skill.name)}`)"
                                        >
                                            <td class="td-name">
                                                <div class="name-cell">
                                                    <v-icon size="20" class="mr-2 skill-icon">mdi-lightning-bolt-outline</v-icon>
                                                    <span class="skill-name-text">{{ skill.name }}</span>
                                                    <v-icon v-if="deletingSkillName !== skill.name" size="16" class="open-hint">mdi-open-in-new</v-icon>
                                                </div>
                                            </td>
                                            <td class="td-desc text-medium-emphasis">
                                                {{ deletingSkillName === skill.name ? $t('SkillsManagement.deleting') : (skill.description || '—') }}
                                            </td>
                                            <td class="td-used text-right">
                                                <template v-if="isUsageLoading">
                                                    <v-progress-circular indeterminate size="18" width="2" color="primary" />
                                                </template>
                                                <template v-else>
                                                    <v-chip size="x-small" variant="tonal" color="primary">
                                                        {{ getUsageCount(skill.name) }}
                                                    </v-chip>
                                                </template>
                                            </td>
                                            <td class="td-actions text-right">
                                                <template v-if="deletingSkillName === skill.name">
                                                    <v-progress-circular indeterminate size="24" width="2" color="primary" />
                                                </template>
                                                <template v-else>
                                                    <v-tooltip location="left" :text="$t('common.delete')">
                                                        <template v-slot:activator="{ props }">
                                                            <v-btn
                                                                v-bind="props"
                                                                icon
                                                                variant="text"
                                                                size="small"
                                                                color="error"
                                                                @click.stop="confirmDelete(skill)"
                                                            >
                                                                <v-icon>mdi-delete-outline</v-icon>
                                                            </v-btn>
                                                        </template>
                                                    </v-tooltip>
                                                </template>
                                            </td>
                                        </tr>
                                    </tbody>
                                </v-table>
                                <div v-if="sortedUploadedList.length > tableItemsPerPage" class="table-pagination mt-3 d-flex justify-center">
                                    <v-pagination
                                        v-model="tablePage"
                                        :length="uploadedTotalPages"
                                        :total-visible="7"
                                        density="compact"
                                        variant="tonal"
                                        color="primary"
                                        rounded
                                    />
                                </div>
                            </div>
                            <v-row v-else-if="viewMode === 'card'" class="skill-card-list ma-0 pa-0">
                                <v-col v-if="isUploading" cols="12" sm="6" md="4" lg="3">
                                    <v-card variant="outlined" class="skill-card skill-card-placeholder" rounded="lg">
                                        <div class="card-inner">
                                            <div class="card-header">
                                                <v-progress-circular indeterminate size="24" width="2" color="primary" />
                                            </div>
                                            <h3 class="card-title text-medium-emphasis">{{ $t('SkillsManagement.uploading') }}</h3>
                                            <p class="card-desc">—</p>
                                            <div class="card-footer">
                                                <v-btn size="small" variant="tonal" color="primary" block disabled>
                                                    <v-icon start size="small">mdi-cloud-upload-outline</v-icon>
                                                    {{ $t('SkillsManagement.uploading') }}
                                                </v-btn>
                                            </div>
                                        </div>
                                    </v-card>
                                </v-col>
                                <v-col v-for="skill in sortedUploadedList" :key="'uploaded-' + skill.name" cols="12" sm="6" md="4" lg="3">
                                    <v-card
                                        variant="outlined"
                                        class="skill-card"
                                        rounded="lg"
                                        :class="{ 'skill-card-deleting': deletingSkillName === skill.name }"
                                        @click="deletingSkillName === skill.name ? null : $router.push(`/skills/${encodeURIComponent(skill.name)}`)"
                                    >
                                        <div class="card-inner">
                                            <div class="card-header">
                                                <v-chip size="x-small" variant="tonal" color="primary" class="flex-shrink-0">
                                                    <template v-if="isUsageLoading">
                                                        <v-progress-circular indeterminate size="14" width="2" color="primary" class="mr-1" />
                                                    </template>
                                                    <span v-else>{{ getUsageCount(skill.name) }}</span>
                                                    <span class="ml-1">{{ $t('SkillsManagement.usedByAgentsSuffix') }}</span>
                                                </v-chip>
                                                <template v-if="deletingSkillName === skill.name">
                                                    <v-progress-circular indeterminate size="28" width="2" color="primary" class="card-delete-btn" />
                                                </template>
                                                <v-btn
                                                    v-else
                                                    icon
                                                    variant="text"
                                                    size="x-small"
                                                    color="error"
                                                    class="card-delete-btn"
                                                    @click.stop="confirmDelete(skill)"
                                                >
                                                    <v-icon>mdi-delete-outline</v-icon>
                                                </v-btn>
                                            </div>
                                            <h3 class="card-title">{{ skill.name }}</h3>
                                            <p class="card-desc">{{ deletingSkillName === skill.name ? $t('SkillsManagement.deleting') : (skill.description || '') }}</p>
                                        </div>
                                    </v-card>
                                </v-col>
                            </v-row>
                        </template>
                    </div>
                        </v-window-item>
                        <!-- 기본 내장 스킬 탭 -->
                        <v-window-item value="builtin">
                            <div class="skill-section">
                        <p v-if="builtinSkillList.length === 0" class="section-empty text-medium-emphasis">{{ $t('SkillsManagement.builtinEmpty') }}</p>
                        <template v-else>
                            <div v-if="viewMode === 'table'" class="table-wrap">
                                <v-table class="skill-management-table" hover>
                                    <thead>
                                        <tr>
                                            <th class="text-left table-header-name table-header-sort" @click="toggleSortOrder">
                                                <span class="d-inline-flex align-center">
                                                    {{ $t('SkillsManagement.skillName') }}
                                                    <v-icon size="18" class="ml-1" :class="{ 'sort-desc': tableSortOrder === 'desc' }">
                                                        {{ tableSortOrder === 'asc' ? 'mdi-sort-ascending' : 'mdi-sort-descending' }}
                                                    </v-icon>
                                                </span>
                                            </th>
                                            <th class="text-left table-header-desc">{{ $t('SkillsManagement.skillDescription') }}</th>
                                            <th class="text-right table-header-used">{{ $t('SkillsManagement.usedByAgents') }}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr
                                            v-for="skill in builtinPaginated"
                                            :key="'builtin-' + skill.name"
                                            class="table-row"
                                            @click="$router.push(`/skills/${encodeURIComponent(skill.name)}`)"
                                        >
                                            <td class="td-name">
                                                <div class="name-cell">
                                                    <v-icon size="20" class="mr-2 skill-icon">mdi-package-variant</v-icon>
                                                    <span class="skill-name-text">{{ skill.name }}</span>
                                                    <v-icon size="16" class="open-hint">mdi-open-in-new</v-icon>
                                                </div>
                                            </td>
                                            <td class="td-desc text-medium-emphasis">{{ skill.description || '—' }}</td>
                                            <td class="td-used text-right">
                                                <template v-if="isUsageLoading">
                                                    <v-progress-circular indeterminate size="18" width="2" color="primary" />
                                                </template>
                                                <template v-else>
                                                    <v-chip size="x-small" variant="tonal" color="primary">
                                                        {{ getUsageCount(skill.name) }}
                                                    </v-chip>
                                                </template>
                                            </td>
                                        </tr>
                                    </tbody>
                                </v-table>
                                <div v-if="sortedBuiltinList.length > tableItemsPerPage" class="table-pagination mt-3 d-flex justify-center">
                                    <v-pagination
                                        v-model="tablePage"
                                        :length="builtinTotalPages"
                                        :total-visible="7"
                                        density="compact"
                                        variant="tonal"
                                        color="primary"
                                        rounded
                                    />
                                </div>
                            </div>
                            <v-row v-else-if="viewMode === 'card'" class="skill-card-list ma-0 pa-0">
                                <v-col v-for="skill in sortedBuiltinList" :key="'builtin-' + skill.name" cols="12" sm="6" md="4" lg="3">
                                    <v-card
                                        variant="outlined"
                                        class="skill-card skill-card-builtin"
                                        rounded="lg"
                                        @click="$router.push(`/skills/${encodeURIComponent(skill.name)}`)"
                                    >
                                        <div class="card-inner">
                                            <div class="card-header">
                                                <v-chip size="x-small" variant="tonal" color="primary" class="flex-shrink-0">
                                                    <template v-if="isUsageLoading">
                                                        <v-progress-circular indeterminate size="14" width="2" color="primary" class="mr-1" />
                                                    </template>
                                                    <span v-else>{{ getUsageCount(skill.name) }}</span>
                                                    <span class="ml-1">{{ $t('SkillsManagement.usedByAgentsSuffix') }}</span>
                                                </v-chip>
                                            </div>
                                            <h3 class="card-title">{{ skill.name }}</h3>
                                            <p class="card-desc">{{ skill.description || '' }}</p>
                                        </div>
                                    </v-card>
                                </v-col>
                            </v-row>
                        </template>
                            </div>
                        </v-window-item>
                    </v-window>
                </template>
            </div>
            </template>
        </AppBaseCard>

        <!-- ZIP 업로드 (숨김 input) -->
        <input
            ref="zipInputRef"
            type="file"
            accept=".zip"
            style="display: none;"
            @change="onZipSelected"
        />

        <!-- 스킬 추가: Repository URL 다이얼로그 -->
        <v-dialog v-model="showRepoDialog" max-width="400" persistent>
            <v-card>
                <v-card-title>{{ $t('SkillsManagement.addFromRepo') }}</v-card-title>
                <v-card-subtitle>{{ $t('SkillsManagement.addFromRepoHint') }}</v-card-subtitle>
                <v-card-text>
                    <v-text-field
                        v-model="repositoryUrl"
                        :label="$t('SkillsManagement.repositoryUrl')"
                        placeholder="https://github.com/username/repo.git"
                        variant="outlined"
                        density="compact"
                        hide-details
                        :disabled="isUploading"
                    />
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="flat" color="error" rounded @click="showRepoDialog = false">
                        {{ $t('common.cancel') }}
                    </v-btn>
                    <v-btn
                        variant="flat"
                        color="primary"
                        rounded
                        :loading="isUploading"
                        :disabled="!repositoryUrl.trim()"
                        @click="uploadFromRepo"
                    >
                        {{ $t('common.add') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- 삭제 확인 다이얼로그: 확인 후 닫고, 진행 상태는 목록 해당 행/카드에 표시 -->
        <v-dialog v-model="showDeleteDialog" max-width="400" persistent :scrollable="false">
            <v-card>
                <v-card-title class="d-flex justify-space-between pa-4 ma-0 pb-0">
                    {{ $t('SkillsManagement.deleteMessage') }}
                    <v-btn variant="text" density="compact" icon @click="showDeleteDialog = false">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-card-title>
                <v-card-text class="pa-4 pb-0">
                    <strong v-if="skillToDelete" class="d-block mt-2">{{ skillToDelete.name }}</strong>
                </v-card-text>
                <v-card-actions class="d-flex justify-end align-center pa-4">
                    <v-btn color="error" rounded variant="flat" @click="doDelete">
                        {{ $t('common.delete') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-card>
</template>

<script>
import AppBaseCard from '@/components/shared/AppBaseCard.vue';
import BackendFactory from '@/components/api/BackendFactory';

export default {
    name: 'SkillsManagement',
    components: { AppBaseCard },
    data() {
        return {
            backend: null,
            skillList: [],
            builtinSkillList: [],
            isLoading: true,
            isUploading: false,
            isUsageLoading: false,
            skillUsageCount: {},
            deletingSkillName: null,
            viewMode: 'table',
            skillTab: 'uploaded',
            tableSortOrder: 'asc',
            tablePage: 1,
            tableItemsPerPage: 10,
            showRepoDialog: false,
            repositoryUrl: '',
            showDeleteDialog: false,
            skillToDelete: null
        };
    },
    computed: {
        sortedUploadedList() {
            const list = [...this.skillList];
            const dir = this.tableSortOrder === 'asc' ? 1 : -1;
            return list.sort((a, b) => dir * String(a.name || '').localeCompare(String(b.name || '')));
        },
        sortedBuiltinList() {
            const list = [...this.builtinSkillList];
            const dir = this.tableSortOrder === 'asc' ? 1 : -1;
            return list.sort((a, b) => dir * String(a.name || '').localeCompare(String(b.name || '')));
        },
        uploadedPaginated() {
            const start = (this.tablePage - 1) * this.tableItemsPerPage;
            return this.sortedUploadedList.slice(start, start + this.tableItemsPerPage);
        },
        builtinPaginated() {
            const start = (this.tablePage - 1) * this.tableItemsPerPage;
            return this.sortedBuiltinList.slice(start, start + this.tableItemsPerPage);
        },
        uploadedTotalPages() {
            return Math.max(1, Math.ceil(this.sortedUploadedList.length / this.tableItemsPerPage));
        },
        builtinTotalPages() {
            return Math.max(1, Math.ceil(this.sortedBuiltinList.length / this.tableItemsPerPage));
        }
    },
    watch: {
        skillTab() {
            this.tablePage = 1;
        },
        uploadedTotalPages(pages) {
            if (this.skillTab === 'uploaded' && this.tablePage > pages) {
                this.tablePage = Math.max(1, pages);
            }
        },
        builtinTotalPages(pages) {
            if (this.skillTab === 'builtin' && this.tablePage > pages) {
                this.tablePage = Math.max(1, pages);
            }
        }
    },
    created() {
        this.backend = BackendFactory.createBackend();
    },
    mounted() {
        this.refreshAll();
    },
    methods: {
        async refreshAll() {
            await Promise.all([
                this.loadSkillList(),
                this.loadSkillUsageCounts()
            ]);
        },

        async loadSkillList() {
            this.isLoading = true;
            try {
                const tenantId = window.$tenantName;
                const [uploadedResult, builtinResult] = await Promise.all([
                    this.backend.getTenantSkills(tenantId),
                    this.backend.getTenantBuiltinSkills ? this.backend.getTenantBuiltinSkills() : Promise.resolve([])
                ]);
                const normalize = (result) => {
                    const raw = result?.skills ?? result;
                    const list = Array.isArray(raw) ? raw : (raw?.skills || []);
                    return list.map((s) => ({
                        name: typeof s === 'string' ? s : (s.name || s.skill_name || ''),
                        description: typeof s === 'string' ? '' : (s.description || '')
                    })).filter((s) => s.name);
                };
                this.skillList = normalize(uploadedResult);
                this.builtinSkillList = normalize(builtinResult || []);
            } catch (e) {
                console.error('Failed to load skills', e);
                this.skillList = [];
                this.builtinSkillList = [];
            } finally {
                this.isLoading = false;
            }
        },

        async loadSkillUsageCounts() {
            this.isUsageLoading = true;
            try {
                const counts = {};
                const rows = await this.backend.getAgentSkills({ tenantId: window.$tenantName });
                const list = Array.isArray(rows) ? rows : (rows || []);

                for (const row of list) {
                    if (!row) continue;
                    const skillName = (row.skill_name || row.skillName || '').trim();
                    if (!skillName) continue;
                    counts[skillName] = (counts[skillName] || 0) + 1;
                }
                this.skillUsageCount = counts;
            } catch (e) {
                console.error('Failed to load skill usage counts', e);
                this.skillUsageCount = {};
            } finally {
                this.isUsageLoading = false;
            }
        },

        getUsageCount(skillName) {
            return this.skillUsageCount?.[skillName] || 0;
        },

        toggleSortOrder() {
            this.tableSortOrder = this.tableSortOrder === 'asc' ? 'desc' : 'asc';
            this.tablePage = 1;
        },

        openZipUpload() {
            this.$refs.zipInputRef?.click();
        },
        openRepoDialog() {
            this.repositoryUrl = '';
            this.showRepoDialog = true;
        },

        onZipSelected(event) {
            const file = event.target?.files?.[0];
            if (!file) return;
            event.target.value = '';
            this.uploadFromZip(file);
        },

        async uploadFromZip(file) {
            this.isUploading = true;
            try {
                await this.backend.uploadSkills({ type: 'file', file });
                this.$try({
                    context: this,
                    action: async() => {
                        await this.refreshAll();
                    },
                    successMsg: this.$t('SkillsManagement.uploadSuccess')
                });
            } catch (e) {
                this.$try({
                    context: this,
                    action: () => {
                        console.error('Upload failed', e);
                        throw new Error('Upload failed');
                    },
                    errorMsg: 'Upload failed with error: ' + e.message
                });
            } finally {
                this.isUploading = false;
            }
        },

        async uploadFromRepo() {
            const url = this.repositoryUrl?.trim();
            if (!url) return;
            this.isUploading = true;
            try {
                await this.backend.uploadSkills({ type: 'url', url });
                this.showRepoDialog = false;
                this.repositoryUrl = '';
                this.$try({
                    context: this,
                    action: async() => {
                        await this.refreshAll();
                    },
                    successMsg: this.$t('SkillsManagement.uploadSuccess')
                });
            } catch (e) {
                this.$try({
                    context: this,
                    action: () => {
                        console.error('Upload from repo failed', e);
                        throw new Error('Upload from repo failed');
                    },
                    errorMsg: 'Upload from repo failed with error: ' + e.message
                });
            } finally {
                this.isUploading = false;
            }
        },

        confirmDelete(skill) {
            this.skillToDelete = skill;
            this.showDeleteDialog = true;
        },

        async doDelete() {
            if (!this.skillToDelete) return;
            const name = this.skillToDelete.name;
            this.showDeleteDialog = false;
            this.skillToDelete = null;
            this.deletingSkillName = name;
            try {
                await this.backend.deleteSkills({ skillName: name });
                this.$try({
                    context: this,
                    action: async() => {
                        await this.refreshAll();
                    },
                    successMsg: this.$t('SkillsManagement.deleteSuccess')
                });
            } catch (e) {
                this.$try({
                    context: this,
                    action: () => {
                        console.error('Delete failed', e);
                        throw new Error('Delete failed');
                    },
                    errorMsg: 'Delete failed with error: ' + e.message
                });
            } finally {
                this.deletingSkillName = null;
            }
        }
    }
};
</script>

<style scoped>
.skills-management-header {
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.skills-management-tabs :deep(.v-tab) {
    font-size: 0.8125rem;
    min-height: 36px;
    text-transform: none;
}

.skills-management-tabs :deep(.v-tabs-container) {
    min-height: 36px;
}

.skills-tab-window :deep(.v-window__container) {
    overflow: visible;
}

.skills-tab-window :deep(.v-window-item) {
    overflow: auto;
}

.list-item-with-hint :deep(.v-list-item-subtitle) {
    white-space: normal;
    margin-top: 2px;
}

.skills-management-body {
    min-height: 0;
    overflow: auto;
}

.skill-section {
    margin-bottom: 0;
}

.skill-section .section-title {
    font-size: 0.9375rem;
    font-weight: 600;
    margin: 0 0 12px 0;
    color: rgba(var(--v-theme-on-surface), 0.85);
}

.skill-section .section-empty {
    font-size: 0.875rem;
    margin: 0 0 16px 0;
    padding: 12px 16px;
    border-radius: 8px;
    background: rgba(var(--v-theme-on-surface), 0.04);
}

.skill-card-builtin .card-header {
    margin-bottom: 10px;
}

.upload-progress-banner {
    margin: -12px -12px 12px -12px;
    padding: 12px 16px;
    background: rgba(var(--v-theme-primary), 0.08);
    border-radius: 0 0 12px 12px;
    border: 1px solid rgba(var(--v-theme-primary), 0.2);
    border-top: none;
}

.upload-progress-text {
    display: flex;
    align-items: center;
    margin-top: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    color: rgb(var(--v-theme-primary));
}

.body-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 280px;
}

.body-loading {
    color: rgba(var(--v-theme-on-surface), 0.7);
}

/* 빈 상태 */
.body-empty {
    text-align: center;
    padding: 40px 24px;
}

.empty-illustration {
    margin-bottom: 16px;
}

.empty-title {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0 0 8px 0;
}

.empty-desc {
    font-size: 0.875rem;
    color: rgba(var(--v-theme-on-surface), 0.7);
    margin: 0 0 24px 0;
    max-width: 360px;
    margin-left: auto;
    margin-right: auto;
}

.empty-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    justify-content: center;
}

.empty-action-card {
    padding: 24px;
    min-width: 200px;
    max-width: 240px;
    cursor: pointer;
    transition: background-color 0.2s, box-shadow 0.2s;
}

.empty-action-card:hover {
    background: rgba(var(--v-theme-primary), 0.04);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.empty-action-card .v-icon {
    display: block;
    margin-bottom: 8px;
}

.empty-action-label {
    display: block;
    font-weight: 600;
    font-size: 0.9375rem;
    margin-bottom: 4px;
}

/* 테이블 */
.table-wrap {
    background: rgb(var(--v-theme-surface));
    border-radius: 12px;
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    overflow: hidden;
}

.skill-management-table {
    border-radius: 12px;
}

.skill-management-table :deep(thead) {
    background: rgba(var(--v-theme-on-surface), 0.04);
}

.skill-management-table :deep(th) {
    font-weight: 600;
    font-size: 0.8125rem;
    padding: 14px 16px;
}

.table-header-sort {
    cursor: pointer;
    user-select: none;
}

.table-header-sort:hover {
    background: rgba(var(--v-theme-on-surface), 0.06);
}

.table-header-actions {
    width: 100px;
}

.table-header-used {
    width: 140px;
}

.table-row {
    cursor: pointer;
    transition: background-color 0.15s;
}

.table-row:hover {
    background: rgba(var(--v-theme-primary), 0.06);
}

.table-row-placeholder {
    cursor: default;
}

.table-row-deleting {
    cursor: default;
    opacity: 0.85;
}

.table-row-deleting:hover {
    background: transparent;
}

.skill-management-table :deep(td) {
    padding: 14px 16px;
    vertical-align: middle;
}

.td-name {
    min-width: 200px;
}

.name-cell {
    display: flex;
    align-items: center;
}

.skill-icon {
    color: rgb(var(--v-theme-primary));
    flex-shrink: 0;
}

.skill-name-text {
    font-weight: 500;
    color: rgb(var(--v-theme-primary));
}

.open-hint {
    margin-left: 6px;
    opacity: 0.6;
}

.td-desc {
    font-size: 0.875rem;
    max-width: 360px;
}

.td-used {
    white-space: nowrap;
}

.td-actions {
    white-space: nowrap;
}

/* 카드 */
.skill-card-list {
    margin-top: 0;
}

.skill-card {
    cursor: pointer;
    transition: box-shadow 0.2s, transform 0.15s, border-color 0.2s;
    height: 100%;
}

.skill-card:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    border-color: rgba(var(--v-theme-primary), 0.3);
}

.skill-card-placeholder {
    cursor: default;
    pointer-events: none;
}

.skill-card-placeholder:hover {
    box-shadow: none;
    border-color: rgba(var(--v-border-color), var(--v-border-opacity));
}

.skill-card-deleting {
    cursor: default;
    opacity: 0.85;
}

.skill-card-deleting:hover {
    box-shadow: none;
    border-color: rgba(var(--v-border-color), var(--v-border-opacity));
}

.card-inner {
    padding: 16px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    min-height: 140px;
}

.card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
}

.card-skill-icon {
    color: rgb(var(--v-theme-primary));
}

.card-delete-btn {
    flex-shrink: 0;
}

.card-title {
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 6px 0;
    line-height: 1.3;
    word-break: break-word;
}

.card-desc {
    font-size: 0.8125rem;
    color: rgba(var(--v-theme-on-surface), 0.7);
    margin: 0 0 12px 0;
    flex: 1;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.card-footer {
    margin-top: auto;
    padding-top: 12px;
    border-top: 1px solid rgba(var(--v-border-color), 0.5);
}
</style>
