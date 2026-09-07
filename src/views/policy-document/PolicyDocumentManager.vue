<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import BackendFactory from '@/components/api/BackendFactory';
import { useAdminConsoleStore } from '@/stores/adminConsole';
import { formatKST } from '@/utils/datetime';

type PolicyKind = 'file' | 'link';
type Policy = {
    id?: string;
    name: string;
    kind: PolicyKind;
    size: string;
    uploadedAt: string;
    author_name?: string;
    author_team?: string;
    file?: File;
    file_path?: string;
    link?: string;
    domains: string[];
};

interface AuditPolicyRow {
    id: string;
    name: string;
    kind: PolicyKind;
    file_path: string | null;
    file_size_bytes: number | null;
    link_url: string | null;
    author_id: string | null;
    author_name: string | null;
    author_team: string | null;
    created_at: string;
    domains: string[] | null;
}

type DomainOption = { id: string; name: string; color: string };

const supabase = (window as any).$supabase;
const tenantId = (window as any).$tenantName;
const backend = BackendFactory.createBackend();
const adminStore = useAdminConsoleStore();

const uploadedPolicies = ref<Policy[]>([]);
const loadingPolicies = ref(false);
const currentUser = ref<{ id: string; name: string; team: string }>({ id: '', name: '', team: '' });
const domainOptions = ref<DomainOption[]>([]);
const domainMap = computed<Record<string, DomainOption>>(() => {
    const map: Record<string, DomainOption> = {};
    domainOptions.value.forEach((d) => {
        map[d.id] = d;
    });
    return map;
});

async function loadDomainOptions() {
    try {
        const [metrics, procMap]: [any, any] = await Promise.all([
            (backend as any).getMetricsMap?.(),
            (backend as any).getProcessDefinitionMap?.()
        ]);
        const seen = new Map<string, DomainOption>();

        // 1) 마스터 도메인 우선 등록 (color 등 메타 보존)
        const masterList = Array.isArray(metrics?.domains) ? metrics.domains : [];
        for (const d of masterList) {
            if (!d?.name && !d?.id) continue;
            const key = String(d.name || d.id);
            if (seen.has(key)) continue;
            seen.set(key, {
                id: String(d.id || d.name),
                name: String(d.name || d.id),
                color: String(d.color || '#0085db')
            });
        }

        // 2) 정의체계도와 동일하게 mega_proc_list 의 major_proc_list[].domain 값 in-memory 추출
        const megaList = Array.isArray(procMap?.mega_proc_list) ? procMap.mega_proc_list : [];
        for (const mega of megaList) {
            const majors = Array.isArray(mega?.major_proc_list) ? mega.major_proc_list : [];
            for (const major of majors) {
                const raw =
                    major?.domain ??
                    major?.domain_id ??
                    major?.business_domain ??
                    major?.businessDomain ??
                    major?.network_domain ??
                    major?.networkDomain;
                const value = raw == null ? '' : String(raw).trim();
                if (!value) continue;
                if (seen.has(value)) continue;
                seen.set(value, { id: value, name: value, color: '#0085db' });
            }
        }

        domainOptions.value = Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    } catch (e) {
        console.warn('[auditPolicy] 도메인 옵션 로드 실패:', e);
        domainOptions.value = [];
    }
}

async function resolveCurrentUser() {
    // 우선 localStorage / window 캐시로 즉시 채워두고, supabase 조회로 보강
    const cachedId = localStorage.getItem('uid') || '';
    const cachedName = localStorage.getItem('userName') || localStorage.getItem('email') || (window as any).$userName || '';
    currentUser.value = { id: cachedId, name: cachedName, team: currentUser.value.team };

    if (!supabase) return;
    try {
        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user;
        const userId = user?.id || cachedId;
        if (!userId) {
            console.warn('[auditPolicy] 현재 사용자 ID 를 찾지 못함');
            return;
        }
        const { data: userRow } = await supabase.from('users').select('username, email, org_name').eq('id', userId).maybeSingle();
        currentUser.value = {
            id: userId,
            name: userRow?.username || userRow?.email || user?.email || cachedName,
            team: userRow?.org_name || ''
        };
    } catch (e) {
        console.warn('[auditPolicy] 현재 사용자 조회 실패:', e);
    }
}

type PolicyTypeMeta = { label: string; color: string; icon: string };
function getPolicyTypeMeta(policy: Policy): PolicyTypeMeta {
    if (policy.kind === 'link') return { label: '링크', color: 'info', icon: 'mdi-link-variant' };
    const lower = policy.name.toLowerCase();
    if (lower.endsWith('.csv')) return { label: 'CSV', color: 'success', icon: 'mdi-file-delimited-outline' };
    if (lower.endsWith('.pdf')) return { label: 'PDF', color: 'error', icon: 'mdi-file-pdf-box' };
    return { label: '파일', color: 'grey', icon: 'mdi-file-outline' };
}

const policyKeyword = ref('');

const filteredPolicies = computed(() => {
    const keyword = policyKeyword.value.trim().toLowerCase();
    if (!keyword) return uploadedPolicies.value;
    return uploadedPolicies.value.filter((p) => {
        if (p.name.toLowerCase().includes(keyword)) return true;
        const authorName = (p.author_name || '').toLowerCase();
        if (authorName.includes(keyword)) return true;
        const domainLabels = (p.domains || []).map((id) => (domainMap.value[id]?.name || id).toLowerCase());
        if (domainLabels.some((label) => label.includes(keyword))) return true;
        return false;
    });
});

const policyHeaders = [
    { title: '도메인', key: 'domains', sortable: false, width: '12%' },
    { title: '문서명', key: 'name', sortable: true, width: '32%' },
    { title: '형식', key: 'kind', sortable: true, width: '12%' },
    { title: '작성자', key: 'author_name', sortable: true, width: '12%', align: 'center' as const },
    { title: '크기', key: 'size', sortable: false, width: '12%', align: 'end' as const },
    { title: '업로드 시각', key: 'uploadedAt', sortable: true, width: '12%' },
    { title: '작업', key: 'actions', sortable: false, width: '8%', align: 'end' as const }
];

const fileInputEl = ref<HTMLInputElement | null>(null);
const linkDialog = ref(false);
const linkForm = ref<{ links: Array<{ name: string; url: string }>; domain: string }>({
    links: [],
    domain: ''
});
const linkInput = ref<{ name: string; url: string }>({ name: '', url: '' });
const linkDomainSearch = ref('');
const registeringLinks = ref(false);

const fileDialog = ref(false);
const fileForm = ref<{ files: File[]; domain: string }>({
    files: [],
    domain: ''
});
const fileDomainSearch = ref('');
const uploadingFiles = ref(false);

function onLinkDomainChange() {
    linkDomainSearch.value = '';
}

function onFileDomainChange() {
    fileDomainSearch.value = '';
}

function addLinkToList() {
    const url = linkInput.value.url.trim();
    if (!url) return;
    const name = linkInput.value.name.trim() || url;
    linkForm.value.links.push({ name, url });
    linkInput.value = { name: '', url: '' };
}

function removeLinkFromList(index: number) {
    linkForm.value.links.splice(index, 1);
}

function formatFileSize(bytes: number | null | undefined): string {
    if (bytes == null) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimestamp(iso: string | null | undefined): string {
    if (!iso) return '-';
    return formatKST(iso, 'MM-DD HH:mm');
}

function rowToPolicy(row: AuditPolicyRow): Policy {
    return {
        id: row.id,
        name: row.name,
        kind: row.kind,
        size: row.kind === 'link' ? '-' : formatFileSize(row.file_size_bytes),
        uploadedAt: formatTimestamp(row.created_at),
        author_name: row.author_name || undefined,
        author_team: row.author_team || undefined,
        file_path: row.file_path || undefined,
        link: row.link_url || undefined,
        domains: Array.isArray(row.domains) ? row.domains : []
    };
}

async function loadPolicies() {
    if (!supabase) return;
    loadingPolicies.value = true;
    try {
        const { data, error } = await supabase
            .from('audit_policy')
            .select('*')
            .eq('tenant_id', tenantId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
        if (error) throw error;
        uploadedPolicies.value = (data || []).map((row: AuditPolicyRow) => rowToPolicy(row));
    } catch (e) {
        console.error('[auditPolicy] 조회 실패:', e);
    } finally {
        loadingPolicies.value = false;
    }
}

onMounted(async () => {
    await resolveCurrentUser();
    await loadDomainOptions();
    await loadPolicies();
});

function openFileDialog() {
    fileForm.value = { files: [], domain: '' };
    fileDomainSearch.value = '';
    fileDialog.value = true;
}

function triggerFilePicker() {
    fileInputEl.value?.click();
}

function onFileInputChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const list = input.files;
    if (!list || list.length === 0) return;
    const existingKeys = new Set(fileForm.value.files.map((f) => `${f.name}::${f.size}`));
    for (const file of Array.from(list)) {
        const key = `${file.name}::${file.size}`;
        if (existingKeys.has(key)) continue;
        fileForm.value.files.push(file);
        existingKeys.add(key);
    }
    input.value = '';
}

function removeStagedFile(index: number) {
    fileForm.value.files.splice(index, 1);
}

async function submitFileUpload() {
    if (!supabase) return;
    if (fileForm.value.files.length === 0) return;
    uploadingFiles.value = true;
    const selectedDomains = fileForm.value.domain ? [fileForm.value.domain] : [];
    try {
        for (const file of fileForm.value.files) {
            try {
                const uploaded = await backend.uploadFile(file.name, file);
                const filePath = uploaded?.path;
                if (!filePath) {
                    console.error('[auditPolicy] 업로드 결과에 path 없음:', uploaded);
                    continue;
                }
                const { data, error } = await supabase
                    .from('audit_policy')
                    .insert({
                        tenant_id: tenantId,
                        name: file.name,
                        kind: 'file',
                        file_path: filePath,
                        file_size_bytes: file.size,
                        author_id: currentUser.value.id || null,
                        author_name: currentUser.value.name || null,
                        author_team: currentUser.value.team || null,
                        domains: selectedDomains
                    })
                    .select()
                    .single();
                if (error) {
                    await supabase.storage
                        .from('files')
                        .remove([filePath])
                        .catch(() => undefined);
                    throw error;
                }
                const policy = rowToPolicy(data as AuditPolicyRow);
                policy.file = file;
                uploadedPolicies.value.unshift(policy);
                adminStore.writeAdminAuditLog({
                    action: 'audit_policy_create',
                    target_type: 'audit_policy',
                    target_id: policy.id || '',
                    target_name: policy.name,
                    after_value: {
                        kind: 'file',
                        file_path: policy.file_path || null,
                        file_size_bytes: file.size,
                        domains: selectedDomains
                    }
                });
            } catch (e) {
                console.error('[auditPolicy] 업로드 실패:', e);
            }
        }
        fileDialog.value = false;
    } finally {
        uploadingFiles.value = false;
    }
}

function openLinkDialog() {
    linkForm.value = { links: [], domain: '' };
    linkInput.value = { name: '', url: '' };
    linkDomainSearch.value = '';
    linkDialog.value = true;
}

async function registerLinks() {
    if (!supabase) return;
    const pendingLinks = [...linkForm.value.links];
    const draftUrl = linkInput.value.url.trim();
    if (draftUrl) {
        const draftName = linkInput.value.name.trim() || draftUrl;
        pendingLinks.push({ name: draftName, url: draftUrl });
    }
    if (pendingLinks.length === 0) return;
    const selectedDomains = linkForm.value.domain ? [linkForm.value.domain] : [];
    registeringLinks.value = true;
    try {
        for (const link of pendingLinks) {
            try {
                const { data, error } = await supabase
                    .from('audit_policy')
                    .insert({
                        tenant_id: tenantId,
                        name: link.name,
                        kind: 'link',
                        link_url: link.url,
                        author_id: currentUser.value.id || null,
                        author_name: currentUser.value.name || null,
                        author_team: currentUser.value.team || null,
                        domains: selectedDomains
                    })
                    .select()
                    .single();
                if (error) throw error;
                const policy = rowToPolicy(data as AuditPolicyRow);
                uploadedPolicies.value.unshift(policy);
                adminStore.writeAdminAuditLog({
                    action: 'audit_policy_create',
                    target_type: 'audit_policy',
                    target_id: policy.id || '',
                    target_name: policy.name,
                    after_value: {
                        kind: 'link',
                        link_url: link.url,
                        domains: selectedDomains
                    }
                });
            } catch (e) {
                console.error('[auditPolicy] 링크 등록 실패:', e);
            }
        }
        linkDialog.value = false;
    } finally {
        registeringLinks.value = false;
    }
}

async function openPolicyTarget(policy: Policy) {
    if (policy.kind === 'link') {
        if (policy.link) {
            window.open(policy.link, '_blank', 'noopener,noreferrer');
        }
        return;
    }
    await downloadPolicy(policy);
}

async function downloadPolicy(policy: Policy) {
    if (policy.kind === 'link' && policy.link) {
        window.open(policy.link, '_blank', 'noopener,noreferrer');
        return;
    }
    let file = policy.file;
    if (!file && policy.file_path) {
        try {
            const result = await backend.downloadFile(policy.file_path);
            file = result?.file;
        } catch (e) {
            console.error('[auditPolicy] 다운로드 실패:', e);
            return;
        }
    }
    if (!file) return;
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = policy.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

type PreviewKind = 'pdf' | 'csv' | 'none';
const previewDialog = ref(false);
const previewPolicy = ref<Policy | null>(null);
const previewUrl = ref<string | null>(null);
const previewMime = ref<string>('');
const previewKind = ref<PreviewKind>('none');
const previewCsvRows = ref<string[][]>([]);

function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quoted) {
            if (ch === '"') {
                if (text[i + 1] === '"') {
                    cell += '"';
                    i++;
                } else {
                    quoted = false;
                }
            } else {
                cell += ch;
            }
        } else if (ch === '"') {
            quoted = true;
        } else if (ch === ',') {
            row.push(cell);
            cell = '';
        } else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && text[i + 1] === '\n') i++;
            row.push(cell);
            rows.push(row);
            row = [];
            cell = '';
        } else {
            cell += ch;
        }
    }
    if (cell.length > 0 || row.length > 0) {
        row.push(cell);
        rows.push(row);
    }
    return rows.filter((r) => r.some((c) => c.length > 0));
}

async function openPreview(policy: Policy) {
    if (previewUrl.value) {
        URL.revokeObjectURL(previewUrl.value);
        previewUrl.value = null;
    }
    previewPolicy.value = policy;
    previewCsvRows.value = [];
    previewKind.value = 'none';
    previewMime.value = '';
    previewDialog.value = true;

    if (policy.kind !== 'file') return;

    let file = policy.file;
    if (!file && policy.file_path) {
        try {
            const result = await backend.downloadFile(policy.file_path);
            file = result?.file;
        } catch (e) {
            console.error('[auditPolicy] 미리보기 다운로드 실패:', e);
            return;
        }
    }
    if (!file) return;

    const lower = file.name.toLowerCase();
    const isPdf = file.type === 'application/pdf' || lower.endsWith('.pdf');
    const isCsv = file.type === 'text/csv' || lower.endsWith('.csv');
    if (isPdf) {
        previewUrl.value = URL.createObjectURL(file);
        previewMime.value = 'application/pdf';
        previewKind.value = 'pdf';
    } else if (isCsv) {
        const text = await file.text();
        previewCsvRows.value = parseCsv(text);
        previewKind.value = 'csv';
    }
}

function handlePreviewDialogChange(value: boolean) {
    if (!value && previewUrl.value) {
        URL.revokeObjectURL(previewUrl.value);
        previewUrl.value = null;
    }
}

const deleteDialog = ref<{ visible: boolean; item: Policy | null }>({
    visible: false,
    item: null
});
const deletingPolicy = ref(false);

function openDeleteDialog(policy: Policy) {
    deleteDialog.value = { visible: true, item: policy };
}

function cancelDelete() {
    deleteDialog.value = { visible: false, item: null };
}

async function confirmDeletePolicy() {
    const policy = deleteDialog.value.item;
    if (!policy) return;
    if (!policy.id || !supabase) {
        uploadedPolicies.value = uploadedPolicies.value.filter((p) => p !== policy);
        deleteDialog.value = { visible: false, item: null };
        return;
    }
    deletingPolicy.value = true;
    try {
        // deleted_by 는 DB 트리거가 JWT 클레임에서 자동 추출해 채움
        const { error } = await supabase
            .from('audit_policy')
            .update({
                deleted_at: new Date().toISOString()
            })
            .eq('id', policy.id)
            .eq('tenant_id', tenantId);
        if (error) throw error;
        uploadedPolicies.value = uploadedPolicies.value.filter((p) => p.id !== policy.id);
        adminStore.writeAdminAuditLog({
            action: 'audit_policy_soft_delete',
            target_type: 'audit_policy',
            target_id: policy.id,
            target_name: policy.name
        });
        deleteDialog.value = { visible: false, item: null };
    } catch (e) {
        console.error('[auditPolicy] 삭제 실패:', e);
    } finally {
        deletingPolicy.value = false;
    }
}
</script>

<template>
    <v-card elevation="10" class="rounded-xl sk-page-card">
        <!-- Header (공통 page-header 패턴) -->
        <div class="page-header">
            <div class="page-header-left">
                <div class="d-flex align-center ga-2">
                    <h1 class="page-title">사내 정책문서 관리</h1>
                    <v-chip size="small" variant="tonal" color="grey">총 {{ uploadedPolicies.length }}건</v-chip>
                </div>
                <p class="page-subtitle">BPMN 분석 Agent 가 활용할 컴플라이언스 PDF/CSV 또는 외부 문서 링크를 등록·관리합니다.</p>
            </div>
        </div>

        <v-card-text class="pa-4 pt-0 sk-page-card-text">
            <!-- Filter Bar -->
            <v-row dense align="center" class="pt-4 pb-4">
                <v-col cols="12" sm="auto" style="min-width: 320px">
                    <v-text-field
                        v-model="policyKeyword"
                        label="검색"
                        placeholder="도메인·문서명·작성자"
                        prepend-inner-icon="mdi-magnify"
                        density="compact"
                        variant="outlined"
                        hide-details
                        clearable
                    />
                </v-col>
                <v-spacer />
                <v-col cols="12" sm="auto">
                    <div class="d-flex align-center ga-2">
                        <v-btn color="grey" variant="flat" prepend-icon="mdi-link-plus" @click="openLinkDialog"> 링크 등록 </v-btn>
                        <v-tooltip text="PDF, CSV 파일 업로드 가능" location="top">
                            <template #activator="{ props }">
                                <v-btn
                                    v-bind="props"
                                    color="primary"
                                    variant="flat"
                                    prepend-icon="mdi-file-upload-outline"
                                    @click="openFileDialog"
                                >
                                    문서 등록
                                </v-btn>
                            </template>
                        </v-tooltip>
                        <input ref="fileInputEl" type="file" accept=".pdf,.csv" multiple style="display: none" @change="onFileInputChange" />
                    </div>
                </v-col>
            </v-row>

            <!-- Data Table -->
            <v-data-table
                :headers="policyHeaders"
                :items="filteredPolicies"
                :loading="loadingPolicies"
                density="compact"
                hover
                :items-per-page="25"
                :items-per-page-options="[25, 50, 100, 200]"
                item-value="id"
                class="sk-data-table"
                no-data-text="등록된 정책 문서가 없습니다."
            >
                <template v-slot:[`item.name`]="{ item }">
                    <div class="d-flex align-center ga-2">
                        <v-icon size="16" :color="getPolicyTypeMeta(item).color">
                            {{ getPolicyTypeMeta(item).icon }}
                        </v-icon>
                        <a
                            class="policy-name-link"
                            :class="{ 'is-disabled': item.kind === 'file' && !item.file && !item.file_path }"
                            href="#"
                            :title="item.kind === 'link' ? '링크 열기' : '다운로드'"
                            @click.prevent.stop="openPolicyTarget(item)"
                        >
                            {{ item.name }}
                        </a>
                    </div>
                </template>
                <template v-slot:[`item.kind`]="{ item }">
                    <v-chip
                        size="x-small"
                        :color="getPolicyTypeMeta(item).color"
                        :prepend-icon="getPolicyTypeMeta(item).icon"
                        variant="tonal"
                    >
                        {{ getPolicyTypeMeta(item).label }}
                    </v-chip>
                </template>
                <template v-slot:[`item.domains`]="{ item }">
                    <div v-if="item.domains && item.domains.length > 0" class="d-flex flex-wrap ga-1">
                        <v-chip
                            v-for="domainId in item.domains"
                            :key="domainId"
                            size="x-small"
                            variant="tonal"
                            :color="domainMap[domainId]?.color || 'grey'"
                        >
                            {{ domainMap[domainId]?.name || domainId }}
                        </v-chip>
                    </div>
                    <span v-else class="cell-muted">-</span>
                </template>
                <template v-slot:[`item.author_name`]="{ item }">
                    <div v-if="item.author_name" class="cell-author">
                        <span>{{ item.author_name }}</span>
                        <span v-if="item.author_team" class="cell-author-team">({{ item.author_team }})</span>
                    </div>
                    <span v-else class="cell-muted">-</span>
                </template>
                <template v-slot:[`item.uploadedAt`]="{ item }">
                    <span class="cell-date">{{ item.uploadedAt }}</span>
                </template>
                <template v-slot:[`item.actions`]="{ item }">
                    <div class="d-flex align-center justify-end ga-1 flex-nowrap">
                        <v-tooltip v-if="item.kind !== 'link'" text="문서 미리보기" location="top">
                            <template #activator="{ props }">
                                <v-btn
                                    v-bind="props"
                                    icon="mdi-eye-outline"
                                    size="x-small"
                                    variant="text"
                                    @click.stop="openPreview(item)"
                                />
                            </template>
                        </v-tooltip>
                        <v-tooltip text="삭제" location="top">
                            <template #activator="{ props }">
                                <v-btn
                                    v-bind="props"
                                    icon="mdi-trash-can-outline"
                                    size="x-small"
                                    variant="text"
                                    color="error"
                                    @click.stop="openDeleteDialog(item)"
                                />
                            </template>
                        </v-tooltip>
                    </div>
                </template>
            </v-data-table>
        </v-card-text>

        <!-- Delete Confirmation Dialog -->
        <v-dialog v-model="deleteDialog.visible" max-width="440" persistent>
            <v-card>
                <v-card-title class="d-flex align-center">
                    <v-icon color="error" class="me-2">mdi-alert-circle-outline</v-icon>
                    정책문서 삭제
                </v-card-title>
                <v-card-text>
                    <p class="mb-3">선택한 정책문서를 삭제하시겠습니까?</p>
                    <v-sheet v-if="deleteDialog.item" color="grey-lighten-4" rounded class="pa-3">
                        <div class="d-flex justify-space-between mb-1">
                            <span class="text-caption text-medium-emphasis">문서명</span>
                            <span class="text-caption font-weight-medium">{{ deleteDialog.item.name }}</span>
                        </div>
                        <div class="d-flex justify-space-between mb-1">
                            <span class="text-caption text-medium-emphasis">형식</span>
                            <span class="text-caption font-weight-medium">{{ getPolicyTypeMeta(deleteDialog.item).label }}</span>
                        </div>
                        <div v-if="deleteDialog.item.author_name" class="d-flex justify-space-between">
                            <span class="text-caption text-medium-emphasis">작성자</span>
                            <span class="text-caption font-weight-medium">
                                {{ deleteDialog.item.author_name }}
                                <span v-if="deleteDialog.item.author_team" class="text-medium-emphasis">
                                    ({{ deleteDialog.item.author_team }})
                                </span>
                            </span>
                        </div>
                    </v-sheet>
                    <p class="text-caption text-medium-emphasis mt-3 mb-0">
                        삭제된 항목은 휴지통에서 30일간 보관되며, 이후 영구 삭제됩니다.
                    </p>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" :disabled="deletingPolicy" @click="cancelDelete">취소</v-btn>
                    <v-btn
                        color="error"
                        variant="flat"
                        :loading="deletingPolicy"
                        prepend-icon="mdi-trash-can-outline"
                        @click="confirmDeletePolicy"
                    >
                        삭제
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- File Upload Dialog -->
        <v-dialog v-model="fileDialog" max-width="560" persistent>
            <v-card>
                <v-card-title class="d-flex align-center ga-2">
                    <v-icon color="primary">mdi-file-upload-outline</v-icon>
                    <span>문서 등록</span>
                </v-card-title>
                <v-divider />
                <v-card-text class="py-4">
                    <div class="mb-3">
                        <v-btn
                            color="primary"
                            variant="tonal"
                            prepend-icon="mdi-paperclip"
                            :disabled="uploadingFiles"
                            @click="triggerFilePicker"
                        >
                            파일 선택
                        </v-btn>
                        <span class="text-caption text-medium-emphasis ms-2">PDF, CSV 다중 선택 가능</span>
                    </div>
                    <v-sheet
                        v-if="fileForm.files.length > 0"
                        rounded
                        color="grey-lighten-4"
                        class="pa-2 mb-3"
                    >
                        <div
                            v-for="(file, idx) in fileForm.files"
                            :key="idx"
                            class="d-flex align-center ga-2 py-1"
                        >
                            <v-icon size="16" color="grey-darken-1">mdi-file-document-outline</v-icon>
                            <span class="text-body-2 text-truncate flex-grow-1">{{ file.name }}</span>
                            <span class="text-caption text-medium-emphasis">{{ formatFileSize(file.size) }}</span>
                            <v-btn
                                icon="mdi-close"
                                size="x-small"
                                variant="text"
                                :disabled="uploadingFiles"
                                @click="removeStagedFile(idx)"
                            />
                        </div>
                    </v-sheet>
                    <v-autocomplete
                        v-model="fileForm.domain"
                        v-model:search="fileDomainSearch"
                        :items="domainOptions"
                        item-title="name"
                        item-value="id"
                        label="도메인"
                        placeholder="도메인 검색"
                        density="compact"
                        variant="outlined"
                        hide-details
                        clearable
                        @update:model-value="onFileDomainChange"
                    />
                </v-card-text>
                <v-divider />
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" :disabled="uploadingFiles" @click="fileDialog = false">취소</v-btn>
                    <v-btn
                        color="primary"
                        variant="flat"
                        :loading="uploadingFiles"
                        :disabled="fileForm.files.length === 0"
                        @click="submitFileUpload"
                    >
                        등록
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Link Registration Dialog -->
        <v-dialog v-model="linkDialog" max-width="560" persistent>
            <v-card>
                <v-card-title class="d-flex align-center ga-2">
                    <v-icon color="primary">mdi-link-plus</v-icon>
                    <span>링크 등록</span>
                </v-card-title>
                <v-divider />
                <v-card-text class="py-4">
                    <v-text-field
                        v-model="linkInput.name"
                        label="문서명 (선택)"
                        placeholder="예: 망 운영 정책 가이드"
                        density="compact"
                        variant="outlined"
                        hide-details
                        class="mb-2"
                    />
                    <div class="d-flex align-center ga-2 mb-3">
                        <v-text-field
                            v-model="linkInput.url"
                            label="링크 URL"
                            placeholder="https://..."
                            density="compact"
                            variant="outlined"
                            hide-details
                            class="flex-grow-1"
                            @keydown.enter.prevent="addLinkToList"
                        />
                        <v-btn
                            color="primary"
                            variant="tonal"
                            prepend-icon="mdi-plus"
                            :disabled="!linkInput.url.trim() || registeringLinks"
                            @click="addLinkToList"
                        >
                            추가
                        </v-btn>
                    </div>
                    <v-sheet
                        v-if="linkForm.links.length > 0"
                        rounded
                        color="grey-lighten-4"
                        class="pa-2 mb-3"
                    >
                        <div
                            v-for="(link, idx) in linkForm.links"
                            :key="idx"
                            class="d-flex align-center ga-2 py-1"
                        >
                            <v-icon size="16" color="grey-darken-1">mdi-link-variant</v-icon>
                            <div class="d-flex flex-column flex-grow-1 text-truncate">
                                <span class="text-body-2 text-truncate">{{ link.name }}</span>
                                <span class="text-caption text-medium-emphasis text-truncate">{{ link.url }}</span>
                            </div>
                            <v-btn
                                icon="mdi-close"
                                size="x-small"
                                variant="text"
                                :disabled="registeringLinks"
                                @click="removeLinkFromList(idx)"
                            />
                        </div>
                    </v-sheet>
                    <v-autocomplete
                        v-model="linkForm.domain"
                        v-model:search="linkDomainSearch"
                        :items="domainOptions"
                        item-title="name"
                        item-value="id"
                        label="도메인"
                        placeholder="도메인 검색"
                        density="compact"
                        variant="outlined"
                        hide-details
                        clearable
                        @update:model-value="onLinkDomainChange"
                    />
                    <p class="text-caption text-medium-emphasis mt-3 mb-0">
                        O365 또는 Confluence 링크를 등록하면 BPMN 분석 Agent 가 참고 문서로 활용합니다.
                    </p>
                </v-card-text>
                <v-divider />
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" :disabled="registeringLinks" @click="linkDialog = false">취소</v-btn>
                    <v-btn
                        color="primary"
                        variant="flat"
                        :loading="registeringLinks"
                        :disabled="linkForm.links.length === 0 && !linkInput.url.trim()"
                        @click="registerLinks"
                    >
                        등록
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Preview Dialog -->
        <v-dialog v-model="previewDialog" width="90vw" max-width="1400" scrollable @update:model-value="handlePreviewDialogChange">
            <v-card v-if="previewPolicy">
                <v-card-title class="d-flex align-center ga-2">
                    <v-icon color="primary">mdi-file-document-outline</v-icon>
                    <span>{{ previewPolicy.name }}</span>
                </v-card-title>
                <v-divider />
                <v-card-text class="py-4">
                    <div class="d-flex flex-wrap align-center ga-3 text-body-2 preview-meta">
                        <v-chip
                            size="x-small"
                            :color="getPolicyTypeMeta(previewPolicy).color"
                            :prepend-icon="getPolicyTypeMeta(previewPolicy).icon"
                            variant="tonal"
                        >
                            {{ getPolicyTypeMeta(previewPolicy).label }}
                        </v-chip>
                        <span class="meta-divider">·</span>
                        <span><span class="text-medium-emphasis">크기</span> {{ previewPolicy.size }}</span>
                        <span class="meta-divider">·</span>
                        <span><span class="text-medium-emphasis">업로드</span> {{ previewPolicy.uploadedAt }}</span>
                    </div>

                    <v-divider class="my-3" />

                    <div class="text-subtitle-2 mb-2">문서 본문</div>
                    <v-sheet v-if="previewKind === 'pdf' && previewUrl" rounded="lg" class="preview-frame">
                        <iframe :src="previewUrl" :type="previewMime" class="preview-iframe" title="문서 미리보기" />
                    </v-sheet>
                    <v-sheet v-else-if="previewKind === 'csv'" rounded="lg" class="preview-frame">
                        <div class="preview-csv-wrap">
                            <table v-if="previewCsvRows.length > 0" class="preview-csv">
                                <thead>
                                    <tr>
                                        <th v-for="(col, i) in previewCsvRows[0]" :key="i">{{ col }}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="(row, ri) in previewCsvRows.slice(1)" :key="ri">
                                        <td v-for="(col, ci) in row" :key="ci">{{ col }}</td>
                                    </tr>
                                </tbody>
                            </table>
                            <div v-else class="pa-4 text-medium-emphasis">CSV 본문이 비어 있습니다.</div>
                        </div>
                    </v-sheet>
                    <v-sheet v-else rounded="lg" class="preview-body pa-4">
                        <p class="mb-2 font-weight-medium">컴플라이언스 가이드라인</p>
                        <p class="text-body-2 mb-2">
                            본 샘플은 시연용 더미 항목으로, 원본 파일이 보관되어 있지 않아 본문을 표시할 수 없습니다. 직접 업로드한 PDF/CSV
                            문서는 이 영역에서 바로 확인할 수 있습니다.
                        </p>
                        <p class="text-body-2 mb-0 text-medium-emphasis">
                            * 우측 상단 업로드 영역에서 파일을 등록한 후 다시 미리보기를 열어 주세요.
                        </p>
                    </v-sheet>
                </v-card-text>
                <v-divider />
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="previewDialog = false">닫기</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-card>
</template>

<style scoped>
.policy-name-link {
    color: #0085db;
    text-decoration: none;
    cursor: pointer;
}

.policy-name-link:hover {
    text-decoration: underline;
}

.policy-name-link.is-disabled {
    color: #94a3b8;
    pointer-events: none;
    cursor: not-allowed;
}

.cell-author {
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1.3;
}

.cell-author-team {
    font-size: 11px;
    color: #6b7280;
}

.preview-body {
    background: #f8fafc;
    border: 1px solid #eceff3;
    max-height: 60vh;
    overflow-y: auto;
}

.preview-meta .meta-divider {
    color: #cbd5e1;
}

.preview-frame {
    border: 1px solid #eceff3;
    overflow: hidden;
}

.preview-iframe {
    display: block;
    width: 100%;
    height: 65vh;
    border: 0;
    background: #ffffff;
}

.preview-csv-wrap {
    max-height: 65vh;
    overflow: auto;
    background: #ffffff;
}

.preview-csv {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    color: #1f2937;
}

.preview-csv thead th {
    position: sticky;
    top: 0;
    background: #f8fafc;
    color: #374151;
    font-weight: 600;
    text-align: left;
    padding: 8px 12px;
    border-bottom: 1px solid #e5e7eb;
    white-space: nowrap;
}

.preview-csv tbody td {
    padding: 6px 12px;
    border-bottom: 1px solid #f1f5f9;
    vertical-align: top;
    white-space: pre-wrap;
}

.preview-csv tbody tr:hover {
    background: #f8fafc;
}
</style>
