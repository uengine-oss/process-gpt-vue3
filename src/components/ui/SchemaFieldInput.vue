<template>
    <!-- 조건부 표시(config.visible_when): 같은 model 의 다른 필드 값으로 노출을 결정한다.
         숨겨져도 저장된 값은 지우지 않는다 (조건이 다시 참이 되면 그대로 복원). -->
    <div v-if="condVisible" class="schema-field-input">
        <!-- 라벨 행: 라벨 + 타입/상태 칩 + 설명 툴팁 -->
        <div v-if="showLabel" class="field-label">
            <span class="field-label-left">
                {{ field.property_label || field.property_key }}
                <v-chip label size="x-small" density="compact" color="grey" class="ml-1 schema-type-chip">{{ typeLabel }}</v-chip>
                <v-chip v-if="field.is_deprecated_field" label size="x-small" density="compact" color="warning" class="ml-1 schema-type-chip">사용 중단</v-chip>
                <v-chip v-else-if="field.is_readonly" label size="x-small" density="compact" color="primary" class="ml-1 schema-type-chip">읽기 전용</v-chip>
                <v-chip v-if="field.is_required && !field.is_deprecated_field" label size="x-small" density="compact" color="red" class="ml-1 schema-type-chip">필수</v-chip>
            </span>
            <v-tooltip v-if="field.description" location="top" max-width="320">
                <template #activator="{ props: tp }">
                    <v-icon v-bind="tp" size="14" color="grey">mdi-information-outline</v-icon>
                </template>
                <div style="white-space: pre-line;">{{ field.description }}</div>
            </v-tooltip>
        </div>

        <!-- ── 타입별 입력 위젯 ───────────────────────────── -->
        <v-text-field
            v-if="type === 'string'"
            v-model="value"
            density="compact" variant="outlined" hide-details class="mb-3"
            :placeholder="field.placeholder"
            :disabled="isDisabled"
        />
        <v-textarea
            v-else-if="type === 'textarea'"
            v-model="value"
            density="compact" variant="outlined" hide-details rows="3" auto-grow class="mb-3"
            :placeholder="field.placeholder"
            :disabled="isDisabled"
        />
        <v-text-field
            v-else-if="type === 'number'"
            :model-value="numberDisplay"
            @focus="onNumberFocus($event)"
            @blur="onNumberBlur($event)"
            density="compact" variant="outlined" hide-details="auto" class="mb-3"
            :placeholder="field.placeholder"
            :suffix="field.number_unit || undefined"
            :rules="numberRules"
            :disabled="isDisabled"
        />
        <v-text-field
            v-else-if="type === 'url'"
            v-model="value"
            density="compact" variant="outlined" hide-details class="mb-3"
            :placeholder="field.placeholder || 'https://...'"
            :disabled="isDisabled"
        >
            <template v-slot:prepend-inner>
                <v-icon size="14" color="grey">mdi-link-variant</v-icon>
            </template>
        </v-text-field>
        <!-- API 검색 모드: 입력어를 search_param 쿼리로 보내 원격 검색 -->
        <v-autocomplete
            v-else-if="type === 'select' && apiSearchParam"
            v-model="value"
            v-model:search="apiSearchText"
            :items="selectItems"
            item-title="label" item-value="value"
            density="compact" variant="outlined" hide-details class="mb-3"
            :placeholder="field.placeholder || '검색어 입력...'"
            :loading="itemsLoading"
            no-filter
            :clearable="!isDisabled"
            :disabled="isDisabled"
        />
        <v-select
            v-else-if="type === 'select' || type === 'db-select'"
            v-model="value"
            :items="selectItems"
            item-title="label" item-value="value"
            density="compact" variant="outlined" hide-details class="mb-3"
            :placeholder="field.placeholder"
            :loading="itemsLoading"
            :clearable="!isDisabled"
            :disabled="isDisabled"
        />
        <v-select
            v-else-if="type === 'multiselect'"
            v-model="value"
            :items="selectItems"
            item-title="label" item-value="value"
            density="compact" variant="outlined" hide-details class="mb-3"
            :loading="itemsLoading"
            :clearable="!isDisabled"
            multiple chips
            :closable-chips="!isDisabled"
            :disabled="isDisabled"
        />
        <v-text-field
            v-else-if="type === 'date'"
            v-model="value"
            density="compact" variant="outlined" hide-details type="date" class="mb-3"
            :placeholder="field.placeholder"
            :disabled="isDisabled"
        />
        <div v-else-if="type === 'daterange'" class="daterange-row mb-3">
            <v-text-field
                v-model="rangeStart"
                density="compact" variant="outlined" hide-details type="date"
                :placeholder="field.placeholder || 'Start'"
                :disabled="isDisabled"
            />
            <span class="daterange-separator">~</span>
            <v-text-field
                v-model="rangeEnd"
                density="compact" variant="outlined" hide-details type="date"
                placeholder="End"
                :disabled="isDisabled"
            />
        </div>
        <v-autocomplete
            v-else-if="type === 'user'"
            v-model="value"
            :items="userItems"
            item-title="name" item-value="id"
            density="compact" variant="outlined" hide-details class="mb-3"
            :placeholder="field.placeholder || 'Search user... (Enter)'"
            :clearable="!isDisabled"
            :loading="userLoading"
            :disabled="isDisabled"
            @keydown.enter="isDisabled ? null : searchUsers($event.target.value)"
        >
            <template v-slot:prepend-inner>
                <v-icon size="14" color="grey">mdi-account-search-outline</v-icon>
            </template>
        </v-autocomplete>
        <v-switch
            v-else-if="type === 'boolean'"
            v-model="value"
            density="compact" color="primary" hide-details class="mb-3"
            :disabled="isDisabled"
        />
        <!-- 파일: config.file 로 버킷/경로/확장자/크기 제한을 제어 -->
        <div v-else-if="type === 'file'" class="file-field mb-3">
            <input ref="fileInput" type="file" style="display: none" :accept="fileAccept || undefined" :multiple="fileMultiple" @change="onFilePicked" />
            <div v-for="(f, idx) in fileList" :key="f.path || idx" class="file-row">
                <v-icon size="15" color="indigo">mdi-paperclip</v-icon>
                <a v-if="f.publicUrl" class="file-name" :href="f.publicUrl" target="_blank" rel="noopener">{{ f.fileName || f.path }}</a>
                <span v-else class="file-name">{{ f.fileName || f.path }}</span>
                <v-btn v-if="!isDisabled" icon variant="text" size="x-small" @click="removeFile(idx)">
                    <v-icon size="13">mdi-close</v-icon>
                </v-btn>
            </div>
            <v-btn
                v-if="!isDisabled && (fileMultiple || fileList.length === 0)"
                size="small" variant="tonal" color="primary" class="text-none"
                prepend-icon="mdi-upload-outline"
                :loading="fileUploading"
                @click="$refs.fileInput.click()"
            >
                파일 업로드
            </v-btn>
            <div v-if="fileHint" class="file-hint">{{ fileHint }}</div>
            <div v-if="fileError" class="file-error">{{ fileError }}</div>
        </div>
        <!-- table: 컬럼 정의(config.table_columns) 기반 반복 행 편집기 -->
        <div v-else-if="type === 'table'" class="table-field mb-3">
            <table v-if="tableColumns.length" class="table-field__grid">
                <thead>
                    <tr>
                        <th v-for="col in tableColumns" :key="col.key">{{ col.label || col.key }}</th>
                        <th v-if="!isDisabled" class="table-field__actions-col"></th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(row, ri) in tableRows" :key="ri">
                        <td v-for="col in tableColumns" :key="col.key">
                            <select
                                v-if="col.type === 'select'"
                                v-model="row[col.key]"
                                class="table-field__input"
                                :disabled="isDisabled"
                                @change="commitTableRows()"
                            >
                                <option value=""></option>
                                <option v-for="opt in col.options || []" :key="opt" :value="opt">{{ opt }}</option>
                            </select>
                            <input
                                v-else
                                v-model="row[col.key]"
                                class="table-field__input"
                                :type="col.type === 'number' ? 'number' : 'text'"
                                :disabled="isDisabled"
                                @change="commitTableRows()"
                            />
                        </td>
                        <td v-if="!isDisabled" class="table-field__actions-col">
                            <v-btn icon variant="text" size="x-small" @click="removeTableRow(ri)">
                                <v-icon size="13">mdi-close</v-icon>
                            </v-btn>
                        </td>
                    </tr>
                    <tr v-if="!tableRows.length">
                        <td :colspan="tableColumns.length + (isDisabled ? 0 : 1)" class="table-field__empty">행이 없습니다</td>
                    </tr>
                </tbody>
            </table>
            <div v-else class="table-field__empty">컬럼이 정의되지 않았습니다 (속성 스키마에서 설정)</div>
            <v-btn v-if="!isDisabled && tableColumns.length" size="x-small" variant="tonal" class="text-none mt-1" prepend-icon="mdi-plus" @click="addTableRow">
                행 추가
            </v-btn>
        </div>
        <!-- formula: 계산 필드 — 입력이 아니라 결과 표시 -->
        <v-text-field
            v-else-if="type === 'formula'"
            :model-value="value"
            density="compact" variant="outlined" hide-details class="mb-3"
            :placeholder="field.placeholder || '계산식 결과'"
            disabled
        />
        <!-- 미지의 타입: 텍스트 폴백 -->
        <v-text-field
            v-else
            v-model="value"
            density="compact" variant="outlined" hide-details class="mb-3"
            :placeholder="field.placeholder"
            :disabled="isDisabled"
        />
    </div>
</template>

<script>
/**
 * 사용자 정의 속성(task_property_schema) 1개 필드의 공용 렌더러.
 *
 * ProcessHierarchyProperties(속성패널)의 프로세스/Task 탭과 관리자 속성 스키마
 * 스튜디오의 미리보기가 이 컴포넌트를 함께 사용한다 — 관리자 화면에서 보이는
 * 형태가 곧 실제 패널의 형태가 되도록 렌더링을 한 곳에 모았다.
 *
 * 값 저장 방식은 패널의 기존 구조를 그대로 따른다:
 *   - model[field.property_key] 를 직접 읽고 쓴다 (props 객체의 내부 변이).
 *   - daterange 는 model[key+'_start'] / model[key+'_end'] 두 키.
 *   - file 은 {fileName, path, publicUrl} 또는 (multiple) 그 배열.
 *
 * 선택지 소스:
 *   - static: field.options
 *   - api:    field.select_api_endpoint (+ label/value field) — 최초 1회 fetch, 모듈 캐시
 *   - db-select: field.config.db { table, value_column, label_column, filter_column,
 *                filter_value, order_by, tenant_scoped } — supabase 조회, 모듈 캐시
 */
import BackendFactory from '@/components/api/BackendFactory';
import { PROPERTY_TYPES } from '@/stores/taskCatalog';

const backend = BackendFactory.createBackend();

// api/db 선택지 캐시 — 같은 정의를 쓰는 필드가 요소 이동마다 재요청하지 않도록.
const remoteItemsCache = new Map();

function toSafeText(value) {
    if (value === null || value === undefined) return '';
    return String(value);
}

export default {
    name: 'SchemaFieldInput',
    props: {
        /** task_property_schema 행 (normalizeSchemaFields 통과본 권장) */
        field: { type: Object, required: true },
        /** 값을 담는 객체 — processForm / taskForm.schemaProps / 미리보기 모델 */
        model: { type: Object, required: true },
        /** 읽기 전용 강제 (view mode 등). field.is_readonly 와 OR 로 동작 */
        disabled: { type: Boolean, default: false },
        /** 라벨 행 표시 여부 */
        showLabel: { type: Boolean, default: true },
        /** 미리보기 모드 — 파일 업로드 등 실제 부수효과를 막는다 */
        preview: { type: Boolean, default: false },
        /** model 에서 읽고 쓸 키 재지정 — 내장 필드처럼 스키마 키와 모델 키가 다를 때 사용 */
        modelKey: { type: String, default: '' }
    },
    emits: ['dirty'],
    data() {
        return {
            remoteItems: null,
            itemsLoading: false,
            userItems: [],
            userLoading: false,
            apiSearchText: '',
            _apiSearchTimer: null,
            fileUploading: false,
            fileError: ''
        };
    },
    computed: {
        type() {
            return toSafeText(this.field?.property_type).trim() || 'string';
        },
        typeLabel() {
            const found = PROPERTY_TYPES.find((t) => t.value === this.type);
            return found ? found.label : this.type;
        },
        isDisabled() {
            return this.disabled || !!this.field?.is_readonly;
        },
        key() {
            return this.modelKey || toSafeText(this.field?.property_key).trim();
        },
        value: {
            get() {
                return this.model[this.key];
            },
            set(v) {
                this.model[this.key] = v;
                this.$emit('dirty');
            }
        },
        rangeStart: {
            get() {
                return this.model[this.key + '_start'];
            },
            set(v) {
                this.model[this.key + '_start'] = v;
                this.$emit('dirty');
            }
        },
        rangeEnd: {
            get() {
                return this.model[this.key + '_end'];
            },
            set(v) {
                this.model[this.key + '_end'] = v;
                this.$emit('dirty');
            }
        },
        selectItems() {
            if (this.remoteItems) return this.normalizeSelectItems(this.remoteItems);
            return this.normalizeSelectItems(this.field?.options || []);
        },
        numberDisplay() {
            const val = this.value;
            if (val === null || val === undefined || val === '') return '';
            const normalized = toSafeText(val).replace(/,/g, '');
            if (this.field?.number_use_comma) {
                const num = Number(normalized);
                return Number.isFinite(num) ? num.toLocaleString() : '';
            }
            return normalized;
        },
        numberRules() {
            const field = this.field || {};
            const min = field.number_min != null ? Number(toSafeText(field.number_min)) : null;
            const max = field.number_max != null ? Number(toSafeText(field.number_max)) : null;
            return [
                (v) => {
                    if (v === '' || v === null || v === undefined) return true;
                    const num = Number(String(v).replace(/,/g, ''));
                    if (isNaN(num)) return '숫자만 입력 가능합니다';
                    if (min !== null && Number.isFinite(min) && num < min) return `최소 ${min} 이상`;
                    if (max !== null && Number.isFinite(max) && num > max) return `최대 ${max} 이하`;
                    return true;
                }
            ];
        },
        tableColumns() {
            const cols = this.field?.config?.table_columns;
            return Array.isArray(cols) ? cols.filter((c) => c && toSafeText(c.key).trim()) : [];
        },
        tableRows() {
            return Array.isArray(this.value) ? this.value : [];
        },
        condVisible() {
            const cond = this.field?.config?.visible_when;
            if (!cond || typeof cond !== 'object') return true;
            const targetKey = toSafeText(cond.field).trim();
            if (!targetKey) return true;
            const current = this.model?.[targetKey];
            const currentText = toSafeText(current).trim();
            const expected = toSafeText(cond.value).trim();
            switch (toSafeText(cond.op).trim() || 'eq') {
                case 'eq':
                    return currentText === expected;
                case 'ne':
                    return currentText !== expected;
                case 'contains':
                    if (Array.isArray(current)) return current.map((v) => toSafeText(v)).includes(expected);
                    return currentText.includes(expected);
                case 'not_empty':
                    return Array.isArray(current) ? current.length > 0 : currentText !== '' && current !== false;
                case 'empty':
                    return Array.isArray(current) ? current.length === 0 : currentText === '' || current === null || current === undefined;
                default:
                    return true;
            }
        },
        apiConfig() {
            const cfg = this.field?.config?.api;
            return cfg && typeof cfg === 'object' ? cfg : {};
        },
        apiSearchParam() {
            return toSafeText(this.apiConfig.search_param).trim();
        },
        /** 엔드포인트의 {{fields.키}} 를 현재 model 값으로 치환. 미해결 키가 있으면 null (조회 보류) */
        resolvedApiEndpoint() {
            const raw = toSafeText(this.field?.select_api_endpoint).trim();
            if (!raw) return null;
            let unresolved = false;
            const resolved = raw.replace(/\{\{\s*fields\.([\w.]+)\s*\}\}/g, (_m, key) => {
                const v = this.model?.[key];
                if (v === undefined || v === null || v === '') {
                    unresolved = true;
                    return '';
                }
                return encodeURIComponent(toSafeText(v));
            });
            return unresolved ? null : resolved;
        },
        fileConfig() {
            const cfg = this.field?.config?.file;
            return cfg && typeof cfg === 'object' ? cfg : {};
        },
        fileMultiple() {
            return this.fileConfig.multiple === true;
        },
        fileAccept() {
            return toSafeText(this.fileConfig.accept).trim();
        },
        fileMaxSizeMb() {
            const n = Number(this.fileConfig.max_size_mb);
            return Number.isFinite(n) && n > 0 ? n : null;
        },
        fileHint() {
            const parts = [];
            if (this.fileAccept) parts.push(this.fileAccept);
            if (this.fileMaxSizeMb) parts.push(`최대 ${this.fileMaxSizeMb}MB`);
            return parts.join(' · ');
        },
        fileList() {
            const val = this.value;
            if (Array.isArray(val)) return val.filter((f) => f && typeof f === 'object');
            return val && typeof val === 'object' && (val.path || val.fileName) ? [val] : [];
        }
    },
    watch: {
        // 종속(cascading) 선택: {{fields.키}} 로 참조한 필드 값이 바뀌면 목록 재조회
        resolvedApiEndpoint(next, prev) {
            if (next === prev) return;
            this.remoteItems = null;
            this.prepareRemoteItems();
        },
        // API 검색 모드: 입력어 디바운스 조회
        apiSearchText(text) {
            if (!this.apiSearchParam) return;
            if (this._apiSearchTimer) clearTimeout(this._apiSearchTimer);
            this._apiSearchTimer = setTimeout(() => this.searchApiItems(text), 300);
        },
        // fill_map: 선택 값이 바뀌면 응답 원본의 다른 속성을 지정된 필드에 자동 입력
        value(next) {
            this.applyFillMap(next);
        },
        // 요소/필드 전환 시 원격 선택지·사용자 라벨을 다시 준비
        'field.id': {
            handler() {
                this.remoteItems = null;
                this.fileError = '';
                this.prepareRemoteItems();
                this.prepareUserLabel();
            }
        }
    },
    mounted() {
        this.prepareRemoteItems();
        this.prepareUserLabel();
    },
    methods: {
        normalizeSelectItems(items) {
            const list = Array.isArray(items) ? items : [];
            return list
                .map((item, index) => {
                    if (item && typeof item === 'object') {
                        const value = toSafeText(item.value ?? item.id ?? item.key ?? item.code ?? item.name ?? item.label ?? index).trim();
                        const label = toSafeText(item.label ?? item.title ?? item.name ?? item.text ?? item.displayName ?? value).trim();
                        if (!value && !label) return null;
                        return { ...item, value: value || label, label: label || value };
                    }
                    const text = toSafeText(item).trim();
                    return text ? { label: text, value: text } : null;
                })
                .filter(Boolean);
        },

        // ── 원격 선택지 (api / db-select) ─────────────────
        async prepareRemoteItems() {
            const field = this.field || {};
            if ((this.type === 'select' || this.type === 'multiselect') && field.select_source_type === 'api' && field.select_api_endpoint) {
                if (this.apiSearchParam) return; // 검색 모드는 입력 시점에 조회
                const endpoint = this.resolvedApiEndpoint;
                if (!endpoint) {
                    // 종속 필드가 아직 비어 있음 — 선택지 없음 상태 유지
                    this.remoteItems = [];
                    return;
                }
                await this.loadItems(`api::${endpoint}::${field.select_api_label_field}::${field.select_api_value_field}`, () =>
                    this.fetchApiItems(field, endpoint)
                );
                return;
            }
            if (this.type === 'db-select') {
                const db = field.config?.db;
                if (!db || !db.table) return;
                await this.loadItems(`db::${JSON.stringify(db)}::${window.$tenantName || ''}`, () => this.fetchDbItems(db));
            }
        },
        async loadItems(cacheKey, fetcher) {
            if (remoteItemsCache.has(cacheKey)) {
                this.remoteItems = remoteItemsCache.get(cacheKey);
                return;
            }
            this.itemsLoading = true;
            try {
                const items = await fetcher();
                remoteItemsCache.set(cacheKey, items);
                this.remoteItems = items;
            } catch (e) {
                console.warn('[SchemaFieldInput] 선택지 로드 실패:', this.key, e);
            } finally {
                this.itemsLoading = false;
            }
        },
        async fetchApiItems(field, endpoint) {
            const headers = {};
            for (const h of Array.isArray(this.apiConfig.headers) ? this.apiConfig.headers : []) {
                const k = toSafeText(h?.key).trim();
                if (k) headers[k] = toSafeText(h?.value);
            }
            const res = await fetch(endpoint || field.select_api_endpoint, { headers });
            const data = await res.json();
            const rows = Array.isArray(data) ? data : data.items || data.results || data.data || [];
            // __raw 에 응답 원본을 보관 — fill_map(선택 시 다른 필드 자동 입력)에 사용
            return rows.map((item) => ({
                label: toSafeText(item[field.select_api_label_field || 'label'] ?? item.name ?? item.label).trim(),
                value: toSafeText(item[field.select_api_value_field || 'value'] ?? item.id ?? item.value).trim(),
                __raw: item
            }));
        },
        async searchApiItems(text) {
            const keyword = toSafeText(text).trim();
            const endpoint = this.resolvedApiEndpoint;
            if (!endpoint || keyword.length < 2) return;
            const url = endpoint + (endpoint.includes('?') ? '&' : '?') + `${this.apiSearchParam}=${encodeURIComponent(keyword)}`;
            this.itemsLoading = true;
            try {
                this.remoteItems = await this.fetchApiItems(this.field, url);
            } catch (e) {
                console.warn('[SchemaFieldInput] API 검색 실패:', this.key, e);
            } finally {
                this.itemsLoading = false;
            }
        },
        /** fill_map: 선택된 항목의 응답 원본에서 지정 속성을 다른 필드(model 키)에 채운다 */
        applyFillMap(selectedValue) {
            const map = Array.isArray(this.apiConfig.fill_map) ? this.apiConfig.fill_map : [];
            if (!map.length || selectedValue === undefined) return;
            const item = (this.remoteItems || []).find((it) => toSafeText(it?.value) === toSafeText(selectedValue));
            for (const entry of map) {
                const from = toSafeText(entry?.from).trim();
                const to = toSafeText(entry?.to).trim();
                if (!from || !to || to === this.key) continue;
                if (!item) continue;
                // "a.b" 경로 지원
                const raw = from.split('.').reduce((acc, part) => (acc && typeof acc === 'object' ? acc[part] : undefined), item.__raw);
                if (raw !== undefined) {
                    this.model[to] = typeof raw === 'object' ? raw : toSafeText(raw);
                }
            }
            this.$emit('dirty');
        },
        async fetchDbItems(db) {
            const supabase = window.$supabase;
            if (!supabase) return [];
            const valueCol = toSafeText(db.value_column || 'id').trim();
            const labelCol = toSafeText(db.label_column || 'name').trim();
            let query = supabase.from(toSafeText(db.table).trim()).select(`${valueCol}, ${labelCol}`);
            if (db.tenant_scoped !== false && window.$tenantName) {
                query = query.eq('tenant_id', window.$tenantName);
            }
            if (db.filter_column && db.filter_value !== undefined && db.filter_value !== '') {
                query = query.eq(toSafeText(db.filter_column).trim(), db.filter_value);
            }
            query = query.order(toSafeText(db.order_by || labelCol).trim(), { ascending: true }).limit(500);
            const { data, error } = await query;
            if (error) throw error;
            return (data || []).map((row) => ({
                value: toSafeText(row[valueCol]).trim(),
                label: toSafeText(row[labelCol] ?? row[valueCol]).trim()
            }));
        },

        // ── 사용자 검색 ───────────────────────────────────
        async prepareUserLabel() {
            if (this.type !== 'user') return;
            const current = toSafeText(this.value).trim();
            if (!current) return;
            if (this.userItems.some((it) => toSafeText(it?.id).trim() === current)) return;
            try {
                const identityMap = await backend.resolveUserIdentities([current]);
                const identity = identityMap?.[current];
                const name = toSafeText(identity?.name || identity?.username || identity?.email || current).trim();
                this.userItems = [{ id: current, name }, ...this.userItems.filter((it) => toSafeText(it?.id).trim() !== current)];
            } catch (e) {
                // 라벨 못 잡아도 값(id)으로는 표시된다
                this.userItems = [{ id: current, name: current }, ...this.userItems];
            }
        },
        async searchUsers(keyword) {
            const normalized = toSafeText(keyword).trim();
            if (!normalized || normalized.length < 2) return;
            this.userLoading = true;
            try {
                const result = await backend.searchUsersByName(normalized);
                const current = toSafeText(this.value).trim();
                const preserved = current ? this.userItems.filter((it) => toSafeText(it?.id).trim() === current) : [];
                const items = (Array.isArray(result) ? result : []).map((u) => ({
                    id: toSafeText(u.id ?? u.email ?? u.uid).trim(),
                    name: toSafeText(u.name ?? u.username ?? u.email).trim()
                }));
                this.userItems = [...preserved, ...items.filter((it) => toSafeText(it.id).trim() !== current)];
            } catch (e) {
                console.warn('[SchemaFieldInput] 사용자 검색 실패:', e);
            } finally {
                this.userLoading = false;
            }
        },

        // ── number (콤마 표시 + min/max 클램프) ───────────
        onNumberFocus(e) {
            const input = e.target;
            const raw = String(input.value || '').replace(/,/g, '');
            input.type = 'number';
            setTimeout(() => {
                if (raw !== '') input.value = raw;
            }, 0);
        },
        onNumberBlur(e) {
            const input = e.target;
            const field = this.field || {};
            const raw = input.value;
            let num = Number(String(raw).replace(/,/g, ''));
            if (isNaN(num) || raw === '') num = null;
            const min = field.number_min != null ? Number(toSafeText(field.number_min)) : null;
            const max = field.number_max != null ? Number(toSafeText(field.number_max)) : null;
            if (num !== null) {
                if (min !== null && Number.isFinite(min) && num < min) num = min;
                if (max !== null && Number.isFinite(max) && num > max) num = max;
            }
            this.value = num;
            input.type = 'text';
            if (num !== null && field.number_use_comma) {
                input.value = Number(num).toLocaleString();
            }
        },

        // ── file 업로드 ───────────────────────────────────
        async onFilePicked(event) {
            const files = Array.from(event?.target?.files || []);
            if (event?.target) event.target.value = '';
            if (!files.length || this.isDisabled) return;
            this.fileError = '';

            if (this.preview) {
                // 미리보기: 실제 업로드 없이 표시만
                const mock = files.map((f) => ({ fileName: f.name, path: '', publicUrl: '' }));
                this.value = this.fileMultiple ? [...this.fileList, ...mock] : mock[0];
                return;
            }

            const maxBytes = this.fileMaxSizeMb ? this.fileMaxSizeMb * 1024 * 1024 : null;
            for (const f of files) {
                if (maxBytes && f.size > maxBytes) {
                    this.fileError = `${f.name}: 파일 크기가 ${this.fileMaxSizeMb}MB 를 초과합니다.`;
                    return;
                }
            }

            this.fileUploading = true;
            try {
                const uploaded = [];
                for (const f of files) {
                    uploaded.push(await this.uploadOne(f));
                }
                this.value = this.fileMultiple ? [...this.fileList, ...uploaded] : uploaded[0];
            } catch (e) {
                console.error('[SchemaFieldInput] 파일 업로드 실패:', e);
                this.fileError = '파일 업로드 중 오류가 발생했습니다.';
            } finally {
                this.fileUploading = false;
            }
        },
        async uploadOne(file) {
            const cfg = this.fileConfig;
            const bucket = toSafeText(cfg.bucket).trim() || 'files';
            const prefix = toSafeText(cfg.path_prefix).trim().replace(/^\/+|\/+$/g, '') || 'uploads';
            const ext = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : '';
            const base =
                cfg.name_strategy === 'original'
                    ? file.name.replace(/[^\w.\-가-힣]/g, '_')
                    : `${Date.now()}_${crypto.randomUUID().substring(0, 8)}${ext}`;
            const path = `${prefix}/${base}`;
            const supabase = window.$supabase;
            const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
                cacheControl: '3600',
                upsert: cfg.name_strategy === 'original',
                metadata: { original_filename: file.name }
            });
            if (error) throw error;
            const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
            return { fileName: file.name, path: data.path, bucket, publicUrl: urlData?.publicUrl || '' };
        },
        // ── table 행 편집 ─────────────────────────────────
        addTableRow() {
            const row = {};
            for (const col of this.tableColumns) row[col.key] = '';
            this.value = [...this.tableRows, row];
        },
        removeTableRow(index) {
            const next = [...this.tableRows];
            next.splice(index, 1);
            this.value = next;
        },
        commitTableRows() {
            // 셀은 행 객체를 직접 변이하므로 dirty 알림만 보낸다
            this.$emit('dirty');
        },
        removeFile(index) {
            if (this.isDisabled) return;
            if (this.fileMultiple) {
                const next = [...this.fileList];
                next.splice(index, 1);
                this.value = next;
            } else {
                this.value = null;
            }
        }
    }
};
</script>

<style scoped>
.field-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 4px;
    color: rgb(var(--v-theme-textPrimary));
}

.field-label-left {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 2px;
}

.schema-type-chip {
    font-size: 9px !important;
}

.daterange-row {
    display: flex;
    align-items: center;
    gap: 6px;
}

.daterange-separator {
    color: rgb(var(--v-theme-textSecondary));
    flex-shrink: 0;
}

.table-field__grid {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
}

.table-field__grid th {
    text-align: left;
    font-weight: 600;
    color: rgb(var(--v-theme-textSecondary));
    padding: 4px 6px;
    border-bottom: 1px solid rgb(var(--v-theme-borderColor));
    background: rgb(var(--v-theme-background));
}

.table-field__grid td {
    padding: 3px 4px;
    border-bottom: 1px solid rgb(var(--v-theme-borderColor));
    vertical-align: middle;
}

.table-field__input {
    width: 100%;
    padding: 4px 6px;
    border: 1px solid rgb(var(--v-theme-borderColor));
    border-radius: 4px;
    font-size: 12px;
    background: rgb(var(--v-theme-surface));
    color: rgb(var(--v-theme-textPrimary));
    outline: none;
}

.table-field__input:focus {
    border-color: rgb(var(--v-theme-primary));
}

.table-field__actions-col {
    width: 28px;
    text-align: center;
}

.table-field__empty {
    padding: 8px;
    text-align: center;
    font-size: 11px;
    color: rgb(var(--v-theme-textSecondary));
}

.file-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: flex-start;
}

.file-row {
    display: flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    padding: 4px 8px;
    border: 1px solid rgb(var(--v-theme-borderColor));
    border-radius: 6px;
    background: rgb(var(--v-theme-background));
}

.file-name {
    font-size: 12px;
    color: rgb(var(--v-theme-textPrimary));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-decoration: none;
}

a.file-name:hover {
    text-decoration: underline;
}

.file-hint {
    font-size: 11px;
    color: rgb(var(--v-theme-textSecondary));
}

.file-error {
    font-size: 11px;
    color: rgb(var(--v-theme-error));
}
</style>
