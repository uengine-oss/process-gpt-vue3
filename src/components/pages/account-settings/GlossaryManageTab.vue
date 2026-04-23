<template>
    <div class="glossary-manage-tab pa-4">
        <!-- <v-alert type="info" variant="tonal" class="mb-4">
            용어집 백엔드(`/robo`)와 직접 연결된 통합 화면입니다.
        </v-alert> -->

        <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-3" closable @click:close="errorMessage = ''">
            {{ errorMessage }}
        </v-alert>
        <v-alert v-if="successMessage" type="success" variant="tonal" class="mb-3" closable @click:close="successMessage = ''">
            {{ successMessage }}
        </v-alert>

        <v-row>
            <v-col cols="12" md="3">
                <v-card variant="outlined">
                    <v-card-title class="d-flex align-center justify-space-between">
                        <span>용어집 목록</span>
                        <v-btn size="small" color="primary" @click="openCreateGlossary">추가</v-btn>
                    </v-card-title>
                    <v-divider />
                    <v-list density="compact" lines="two">
                        <v-list-item
                            v-for="item in glossaries"
                            :key="item.id"
                            :active="selectedGlossaryId === item.id"
                            @click="selectGlossary(item.id)"
                        >
                            <template #title>
                                {{ item.name }}
                            </template>
                            <template #subtitle>
                                {{ item.type }} · {{ item.termCount || 0 }} terms
                            </template>
                        </v-list-item>
                        <v-list-item v-if="!loadingGlossaries && glossaries.length === 0">
                            <template #title>등록된 용어집이 없습니다.</template>
                        </v-list-item>
                    </v-list>
                </v-card>
            </v-col>

            <v-col cols="12" md="9">
                <v-card variant="outlined" class="mb-3">
                    <v-card-title class="d-flex align-center justify-space-between">
                        <div>
                            <div class="text-h6">{{ selectedGlossary ? selectedGlossary.name : '용어집을 선택하세요' }}</div>
                            <div class="text-caption text-medium-emphasis">{{ selectedGlossary ? selectedGlossary.description : '' }}</div>
                        </div>
                        <div class="d-flex ga-2">
                            <v-btn
                                size="small"
                                variant="outlined"
                                color="error"
                                :disabled="!selectedGlossary"
                                @click="deleteGlossary"
                            >
                                용어집 삭제
                            </v-btn>
                            <v-btn size="small" color="primary" :disabled="!selectedGlossary" @click="openCreateTerm">용어 추가</v-btn>
                        </div>
                    </v-card-title>
                    <v-divider />
                    <v-card-text>
                        <v-row>
                            <v-col cols="12" md="6">
                                <v-text-field
                                    v-model="searchQuery"
                                    density="compact"
                                    variant="outlined"
                                    hide-details
                                    label="용어 검색"
                                />
                            </v-col>
                            <v-col cols="12" md="3">
                                <v-select
                                    v-model="statusFilter"
                                    density="compact"
                                    variant="outlined"
                                    hide-details
                                    label="상태"
                                    :items="statusOptions"
                                    item-title="label"
                                    item-value="value"
                                />
                            </v-col>
                        </v-row>

                        <v-table class="mt-3">
                            <thead>
                                <tr>
                                    <th>용어</th>
                                    <th>설명</th>
                                    <th>상태</th>
                                    <th class="text-right">작업</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="term in filteredTerms" :key="term.id">
                                    <td>{{ term.name }}</td>
                                    <td>{{ term.description || '-' }}</td>
                                    <td>
                                        <v-chip size="x-small" :color="statusColor(term.status)" variant="flat">
                                            {{ term.status }}
                                        </v-chip>
                                    </td>
                                    <td class="text-right">
                                        <v-btn size="x-small" variant="text" @click="openEditTerm(term)">수정</v-btn>
                                        <v-btn size="x-small" color="error" variant="text" @click="deleteTerm(term)">삭제</v-btn>
                                    </td>
                                </tr>
                                <tr v-if="!loadingTerms && filteredTerms.length === 0">
                                    <td colspan="4" class="text-center text-medium-emphasis">표시할 용어가 없습니다.</td>
                                </tr>
                            </tbody>
                        </v-table>
                    </v-card-text>
                </v-card>

                <v-card variant="outlined">
                    <v-card-title>파일 업로드 (일괄 분석)</v-card-title>
                    <v-divider />
                    <v-card-text>
                        <v-file-input
                            v-model="uploadFiles"
                            multiple
                            show-size
                            density="comfortable"
                            variant="outlined"
                            accept=".csv,.xlsx,.xls,.txt,text/plain"
                            label="CSV/Excel/TXT 파일 선택"
                        />
                        <div class="d-flex justify-end">
                            <v-btn color="primary" :disabled="!selectedGlossary || !uploadFiles.length || uploading" @click="uploadBulkFiles">
                                {{ uploading ? '업로드 중...' : '업로드' }}
                            </v-btn>
                        </div>

                        <div v-if="bulkUploadResult" class="mt-4 text-body-2">
                            <div><strong>session_id:</strong> {{ bulkUploadResult.session_id }}</div>
                            <div><strong>term_source_file:</strong> {{ bulkUploadResult.term_source_file || '-' }}</div>
                            <div class="mt-2">
                                <div v-for="file in bulkUploadResult.files" :key="file.filename">
                                    - {{ file.filename }} ({{ file.total_rows }} rows)
                                </div>
                            </div>
                        </div>
                    </v-card-text>
                </v-card>
            </v-col>
        </v-row>

        <v-dialog v-model="glossaryDialog" max-width="500">
            <v-card>
                <v-card-title>용어집 추가</v-card-title>
                <v-card-text>
                    <v-text-field v-model="glossaryForm.name" label="이름" variant="outlined" density="comfortable" />
                    <v-text-field v-model="glossaryForm.type" label="유형 (Business/Technical/DataQuality)" variant="outlined" density="comfortable" />
                    <v-textarea v-model="glossaryForm.description" label="설명" variant="outlined" density="comfortable" rows="3" />
                </v-card-text>
                <v-card-actions class="justify-end">
                    <v-btn variant="text" @click="glossaryDialog = false">취소</v-btn>
                    <v-btn color="primary" @click="createGlossary">저장</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <v-dialog v-model="termDialog" max-width="640">
            <v-card>
                <v-card-title>{{ editingTerm ? '용어 수정' : '용어 추가' }}</v-card-title>
                <v-card-text>
                    <v-text-field v-model="termForm.name" label="용어명" variant="outlined" density="comfortable" />
                    <v-textarea v-model="termForm.description" label="설명" variant="outlined" density="comfortable" rows="3" />
                    <v-select
                        v-model="termForm.status"
                        label="상태"
                        variant="outlined"
                        density="comfortable"
                        :items="statusOptions.filter((item) => item.value)"
                        item-title="label"
                        item-value="value"
                    />
                    <v-combobox
                        v-model="termForm.synonyms"
                        label="동의어"
                        variant="outlined"
                        density="comfortable"
                        multiple
                        chips
                        closable-chips
                    />
                </v-card-text>
                <v-card-actions class="justify-end">
                    <v-btn variant="text" @click="termDialog = false">취소</v-btn>
                    <v-btn color="primary" @click="saveTerm">저장</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
export default {
    name: 'GlossaryManageTab',
    data() {
        return {
            apiBaseUrl: (window._env_?.VITE_ROBO_API_BASE_URL || import.meta.env.VITE_ROBO_API_BASE_URL || '/robo').replace(/\/+$/, ''),
            glossaries: [],
            terms: [],
            selectedGlossaryId: '',
            loadingGlossaries: false,
            loadingTerms: false,
            searchQuery: '',
            statusFilter: '',
            errorMessage: '',
            successMessage: '',
            glossaryDialog: false,
            glossaryForm: {
                name: '',
                type: 'Business',
                description: ''
            },
            termDialog: false,
            editingTerm: null,
            termForm: {
                id: '',
                name: '',
                description: '',
                status: 'Draft',
                synonyms: []
            },
            uploadFiles: [],
            uploading: false,
            bulkUploadResult: null,
            statusOptions: [
                { label: '전체', value: '' },
                { label: 'Draft', value: 'Draft' },
                { label: 'Pending', value: 'Pending' },
                { label: 'Approved', value: 'Approved' },
                { label: 'Deprecated', value: 'Deprecated' }
            ]
        };
    },
    computed: {
        selectedGlossary() {
            return this.glossaries.find((item) => item.id === this.selectedGlossaryId) || null;
        },
        filteredTerms() {
            const keyword = (this.searchQuery || '').toLowerCase();
            return this.terms.filter((term) => {
                const matchedSearch =
                    !keyword ||
                    (term.name || '').toLowerCase().includes(keyword) ||
                    (term.description || '').toLowerCase().includes(keyword);
                const matchedStatus = !this.statusFilter || term.status === this.statusFilter;
                return matchedSearch && matchedStatus;
            });
        }
    },
    async mounted() {
        await this.loadGlossaries();
    },
    methods: {
        resolveTenantId() {
            if (window.$tenantName) return window.$tenantName;
            const host = (window.location.hostname || '').toLowerCase();
            if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') return 'localhost';
            const parts = host.split('.');
            if (parts.length <= 2) return 'localhost';
            return parts[0] || 'localhost';
        },
        buildHeaders() {
            const headers = {
                Accept: 'application/json',
                'X-Tenant-Id': this.resolveTenantId()
            };
            const accessToken = window.localStorage.getItem('accessToken');
            if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
            return headers;
        },
        async parseResponse(response) {
            if (response.ok) {
                if (response.status === 204) return null;
                const text = await response.text();
                return text ? JSON.parse(text) : null;
            }
            const text = await response.text();
            let message = text || `HTTP ${response.status}`;
            try {
                const payload = JSON.parse(text);
                message = payload.detail || payload.message || message;
            } catch (e) {
                // ignore parse errors
            }
            throw new Error(message);
        },
        async loadGlossaries() {
            this.loadingGlossaries = true;
            this.errorMessage = '';
            try {
                const response = await fetch(`${this.apiBaseUrl}/glossary/`, {
                    method: 'GET',
                    headers: this.buildHeaders()
                });
                const data = await this.parseResponse(response);
                this.glossaries = data?.glossaries || [];
                if (!this.selectedGlossaryId && this.glossaries.length) {
                    this.selectedGlossaryId = this.glossaries[0].id;
                    await this.loadTerms();
                }
            } catch (e) {
                this.errorMessage = e.message || '용어집 목록 조회에 실패했습니다.';
            } finally {
                this.loadingGlossaries = false;
            }
        },
        async selectGlossary(glossaryId) {
            this.selectedGlossaryId = glossaryId;
            this.bulkUploadResult = null;
            await this.loadTerms();
        },
        async loadTerms() {
            if (!this.selectedGlossaryId) {
                this.terms = [];
                return;
            }
            this.loadingTerms = true;
            this.errorMessage = '';
            try {
                const response = await fetch(`${this.apiBaseUrl}/glossary/${this.selectedGlossaryId}/terms`, {
                    method: 'GET',
                    headers: this.buildHeaders()
                });
                const data = await this.parseResponse(response);
                this.terms = data?.terms || [];
            } catch (e) {
                this.errorMessage = e.message || '용어 목록 조회에 실패했습니다.';
            } finally {
                this.loadingTerms = false;
            }
        },
        openCreateGlossary() {
            this.glossaryForm = { name: '', type: 'Business', description: '' };
            this.glossaryDialog = true;
        },
        async createGlossary() {
            if (!this.glossaryForm.name.trim()) {
                this.errorMessage = '용어집 이름을 입력해주세요.';
                return;
            }
            try {
                const response = await fetch(`${this.apiBaseUrl}/glossary/`, {
                    method: 'POST',
                    headers: { ...this.buildHeaders(), 'Content-Type': 'application/json' },
                    body: JSON.stringify(this.glossaryForm)
                });
                await this.parseResponse(response);
                this.glossaryDialog = false;
                this.successMessage = '용어집이 생성되었습니다.';
                await this.loadGlossaries();
            } catch (e) {
                this.errorMessage = e.message || '용어집 생성에 실패했습니다.';
            }
        },
        async deleteGlossary() {
            if (!this.selectedGlossary) return;
            if (!window.confirm(`'${this.selectedGlossary.name}' 용어집을 삭제하시겠습니까?`)) return;
            try {
                const response = await fetch(`${this.apiBaseUrl}/glossary/${this.selectedGlossary.id}`, {
                    method: 'DELETE',
                    headers: this.buildHeaders()
                });
                await this.parseResponse(response);
                this.successMessage = '용어집이 삭제되었습니다.';
                this.selectedGlossaryId = '';
                this.terms = [];
                await this.loadGlossaries();
            } catch (e) {
                this.errorMessage = e.message || '용어집 삭제에 실패했습니다.';
            }
        },
        openCreateTerm() {
            this.editingTerm = null;
            this.termForm = { id: '', name: '', description: '', status: 'Draft', synonyms: [] };
            this.termDialog = true;
        },
        openEditTerm(term) {
            this.editingTerm = term;
            this.termForm = {
                id: term.id,
                name: term.name || '',
                description: term.description || '',
                status: term.status || 'Draft',
                synonyms: Array.isArray(term.synonyms) ? [...term.synonyms] : []
            };
            this.termDialog = true;
        },
        async saveTerm() {
            if (!this.selectedGlossaryId) return;
            if (!this.termForm.name.trim()) {
                this.errorMessage = '용어명을 입력해주세요.';
                return;
            }

            const payload = {
                name: this.termForm.name,
                description: this.termForm.description,
                status: this.termForm.status,
                synonyms: this.termForm.synonyms
            };
            try {
                const isEdit = !!this.editingTerm;
                const url = isEdit
                    ? `${this.apiBaseUrl}/glossary/${this.selectedGlossaryId}/terms/${this.termForm.id}`
                    : `${this.apiBaseUrl}/glossary/${this.selectedGlossaryId}/terms`;
                const response = await fetch(url, {
                    method: isEdit ? 'PUT' : 'POST',
                    headers: { ...this.buildHeaders(), 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                await this.parseResponse(response);
                this.termDialog = false;
                this.successMessage = isEdit ? '용어가 수정되었습니다.' : '용어가 생성되었습니다.';
                await this.loadTerms();
                await this.loadGlossaries();
            } catch (e) {
                this.errorMessage = e.message || '용어 저장에 실패했습니다.';
            }
        },
        async deleteTerm(term) {
            if (!this.selectedGlossaryId) return;
            if (!window.confirm(`'${term.name}' 용어를 삭제하시겠습니까?`)) return;
            try {
                const response = await fetch(`${this.apiBaseUrl}/glossary/${this.selectedGlossaryId}/terms/${term.id}`, {
                    method: 'DELETE',
                    headers: this.buildHeaders()
                });
                await this.parseResponse(response);
                this.successMessage = '용어가 삭제되었습니다.';
                await this.loadTerms();
                await this.loadGlossaries();
            } catch (e) {
                this.errorMessage = e.message || '용어 삭제에 실패했습니다.';
            }
        },
        async uploadBulkFiles() {
            if (!this.selectedGlossaryId || !this.uploadFiles.length) return;
            this.uploading = true;
            this.errorMessage = '';
            try {
                const formData = new FormData();
                this.uploadFiles.forEach((file) => formData.append('files', file, file.name));
                const headers = this.buildHeaders();
                delete headers['Content-Type'];

                const response = await fetch(`${this.apiBaseUrl}/glossary/${this.selectedGlossaryId}/terms/bulk-upload`, {
                    method: 'POST',
                    headers,
                    body: formData
                });
                const data = await this.parseResponse(response);
                this.bulkUploadResult = data;
                this.successMessage = '파일 업로드 및 분석이 완료되었습니다.';
            } catch (e) {
                this.errorMessage = e.message || '파일 업로드에 실패했습니다.';
            } finally {
                this.uploading = false;
            }
        },
        statusColor(status) {
            if (status === 'Approved') return 'success';
            if (status === 'Pending') return 'warning';
            if (status === 'Deprecated') return 'error';
            return 'default';
        }
    }
};
</script>
