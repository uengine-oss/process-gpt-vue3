<template>
    <div>
        <!-- 폼 / JSON 전환 -->
        <div class="d-flex align-center mb-2">
            <v-btn-toggle v-model="mode" density="compact" variant="outlined" divided mandatory>
                <v-btn value="form" size="small" :disabled="!canUseForm">
                    <v-icon size="16" class="mr-1">mdi-form-select</v-icon>
                    {{ $t('codeEdit.formView') }}
                </v-btn>
                <v-btn value="json" size="small">
                    <v-icon size="16" class="mr-1">mdi-code-json</v-icon>
                    JSON
                </v-btn>
            </v-btn-toggle>
            <v-spacer />
            <v-btn v-if="mode === 'form'" size="small" variant="text" color="primary" @click="addParameter()">
                <v-icon size="18" class="mr-1">mdi-plus</v-icon>
                {{ $t('codeEdit.addParameter') }}
            </v-btn>
        </div>

        <!-- 코드가 쓰는데 스펙에 없는 이름. 목록에는 나타날 수 없으므로 여기서 바로 만들게 한다. -->
        <v-alert v-if="mode === 'form' && missingNames.length > 0" type="error" variant="tonal" density="compact" class="mb-2">
            <div class="text-caption mb-1">{{ $t('codeEdit.specMissingShort') }}</div>
            <v-chip
                v-for="name in missingNames"
                :key="name"
                size="small"
                class="mr-1"
                color="error"
                variant="flat"
                @click="addParameter(name)"
            >
                <v-icon size="14" class="mr-1">mdi-plus</v-icon>
                {{ name }}
            </v-chip>
        </v-alert>

        <!-- 폼 -->
        <div v-if="mode === 'form'" class="parameter-form-box" :class="boxClass">
            <div v-if="list.length === 0" class="pa-6 text-center text-medium-emphasis text-body-2">
                {{ $t('codeEdit.noParameters') }}
            </div>

            <v-expansion-panels v-else v-model="openPanel" variant="accordion" class="parameter-panels">
                <v-expansion-panel v-for="(param, index) in list" :key="index">
                    <v-expansion-panel-title class="py-2">
                        <div class="d-flex align-center flex-grow-1 overflow-hidden">
                            <v-icon size="18" class="mr-2" :color="sourceMeta(param).color">{{ sourceMeta(param).icon }}</v-icon>
                            <div class="overflow-hidden">
                                <div class="d-flex align-center">
                                    <span class="font-weight-medium text-body-2">{{ param.name || $t('codeEdit.unnamedParameter') }}</span>
                                    <span class="text-caption text-medium-emphasis ml-2">{{ param.type || 'string' }}</span>
                                    <v-icon v-if="issueOf(param)" size="14" class="ml-2" :color="issueOf(param).color">
                                        mdi-alert-circle
                                    </v-icon>
                                </div>
                                <div class="text-caption text-medium-emphasis text-truncate">
                                    {{ issueOf(param) ? issueOf(param).text : summaryOf(param) }}
                                </div>
                            </div>
                        </div>
                    </v-expansion-panel-title>

                    <v-expansion-panel-text>
                        <div class="d-flex align-center mb-3">
                            <v-text-field
                                :model-value="param.name"
                                @update:model-value="updateField(index, 'name', $event)"
                                :label="$t('codeEdit.paramName')"
                                density="compact"
                                variant="outlined"
                                hide-details
                                class="mr-2"
                            />
                            <v-select
                                :model-value="param.type || 'string'"
                                @update:model-value="updateField(index, 'type', $event)"
                                :items="typeOptions(param)"
                                :label="$t('codeEdit.paramType')"
                                density="compact"
                                variant="outlined"
                                hide-details
                                style="max-width: 130px"
                            />
                            <v-btn
                                icon="mdi-arrow-up"
                                size="x-small"
                                variant="text"
                                class="ml-1"
                                :disabled="index === 0"
                                @click="moveParameter(index, -1)"
                            />
                            <v-btn
                                icon="mdi-arrow-down"
                                size="x-small"
                                variant="text"
                                :disabled="index === list.length - 1"
                                @click="moveParameter(index, 1)"
                            />
                            <v-btn icon="mdi-delete-outline" size="x-small" variant="text" color="error" @click="removeParameter(index)" />
                        </div>

                        <v-select
                            :model-value="sourceOf(param)"
                            @update:model-value="setSource(index, $event)"
                            :items="sourceOptions"
                            item-title="title"
                            item-value="value"
                            :label="$t('codeEdit.paramSource')"
                            density="compact"
                            variant="outlined"
                            hide-details
                            class="mb-3"
                        >
                            <template v-slot:item="{ props, item }">
                                <v-list-item v-bind="props" :subtitle="item.raw.hint" :prepend-icon="item.raw.icon" />
                            </template>
                        </v-select>

                        <!-- 지시문에서 찾기 -->
                        <div v-if="sourceOf(param) === 'query'" class="d-flex">
                            <v-text-field
                                :model-value="param.label"
                                @update:model-value="updateField(index, 'label', $event)"
                                :label="$t('codeEdit.paramLabel')"
                                :placeholder="param.name"
                                :hint="$t('codeEdit.paramLabelHint')"
                                persistent-hint
                                density="compact"
                                variant="outlined"
                                class="mr-2"
                            />
                            <v-select
                                :model-value="param.label_position || 'before'"
                                @update:model-value="updateField(index, 'label_position', $event)"
                                :items="labelPositionOptions"
                                item-title="title"
                                item-value="value"
                                :label="$t('codeEdit.paramLabelPosition')"
                                density="compact"
                                variant="outlined"
                                hide-details
                                style="max-width: 150px"
                            />
                        </div>

                        <!-- 실행 정보 -->
                        <v-combobox
                            v-else-if="sourceOf(param) === 'runtime'"
                            :model-value="param.runtime"
                            @update:model-value="updateField(index, 'runtime', $event)"
                            :items="runtimeKeyOptions"
                            :label="$t('codeEdit.paramRuntimeKey')"
                            :hint="$t('codeEdit.paramRuntimeHint')"
                            persistent-hint
                            density="compact"
                            variant="outlined"
                        />

                        <!-- 앞 액티비티 산출물 -->
                        <div v-else>
                            <v-combobox
                                :model-value="upstreamActivityModel(param)"
                                @update:model-value="updateUpstreamActivity(index, $event)"
                                :items="activityItems"
                                item-title="title"
                                item-value="value"
                                :return-object="false"
                                :label="$t('codeEdit.paramUpstreamActivity')"
                                :hint="$t('codeEdit.paramUpstreamActivityHint')"
                                persistent-hint
                                density="compact"
                                variant="outlined"
                                class="mb-2"
                            />
                            <v-text-field
                                :model-value="pathText(param)"
                                @update:model-value="updatePath(index, $event)"
                                :label="$t('codeEdit.paramUpstreamPath')"
                                :hint="$t('codeEdit.paramUpstreamPathHint')"
                                persistent-hint
                                density="compact"
                                variant="outlined"
                            />
                        </div>

                        <v-text-field
                            :model-value="exampleText(param)"
                            @update:model-value="updateExample(index, $event)"
                            :label="$t('codeEdit.paramExample')"
                            :hint="$t('codeEdit.paramExampleHint')"
                            persistent-hint
                            density="compact"
                            variant="outlined"
                            class="mt-3"
                        />
                    </v-expansion-panel-text>
                </v-expansion-panel>
            </v-expansion-panels>
        </div>

        <!-- JSON -->
        <div v-else class="parameter-json-box" :class="boxClass">
            <vue-monaco-editor :value="modelValue" @change="$emit('update:modelValue', $event)" language="json" :options="monacoOptions" />
        </div>
    </div>
</template>

<script>
/**
 * 파라미터 스펙(`mcp_python_code.parameters`) 편집기.
 *
 * 값이 어떻게 정해지는지는 실행 런타임(`_parameter_values`)이 정한 순서를 그대로 따른다 —
 * `upstream` 이 있으면 앞 액티비티 산출물, 다음으로 `runtime` 이면 워크아이템 행의 컬럼,
 * 둘 다 없으면 워크아이템 지시문에서 이름표로 찾는다. 셋은 배타적이라 폼에서도 하나만 고른다.
 *
 * 접힌 목록에서는 각 파라미터가 **무엇을 하는지 한 줄로** 읽히게 한다. 필드 이름만 늘어놓으면
 * `label_position` 이 무슨 뜻인지 아는 사람만 고칠 수 있는 화면이 된다.
 *
 * 폼이 모르는 키는 건드리지 않고 그대로 둔다. 스펙에 나중에 필드가 늘어도 이 화면을 거치면서
 * 조용히 사라지면 안 되기 때문이다. 그런 필드를 직접 봐야 할 때를 위해 JSON 보기를 남겨 둔다.
 *
 * 단일 원본은 부모가 들고 있는 JSON 텍스트다. 폼은 그것을 읽어 그리고, 실제로 필드를 바꿀 때만
 * 다시 문자열로 만들어 올려보낸다 — 보기만 해서는 변경으로 잡히지 않는다.
 */
import { referencedNames } from '@/utils/deterministicCodeSpec';

export default {
    props: {
        modelValue: { type: String, default: '' },
        /** 결정론적 코드. 어떤 파라미터가 실제로 쓰이는지 대조하는 데만 쓴다. */
        code: { type: String, default: '' },
        /** 같은 프로세스의 다른 액티비티들 — 앞 단계를 고르는 후보 */
        activityOptions: { type: Array, default: () => [] },
        monacoOptions: { type: Object, default: () => ({}) },
        /** 편집 영역 높이 클래스 (데스크톱/모바일이 다르다) */
        boxClass: { type: String, default: '' }
    },
    emits: ['update:modelValue'],
    data: () => ({
        mode: 'form',
        openPanel: null
    }),
    computed: {
        /** 파싱된 스펙 객체. JSON 이 깨져 있으면 null — 그때는 폼을 쓸 수 없다. */
        parsed() {
            const text = (this.modelValue || '').trim();
            if (!text) return { parameters: [] };
            try {
                const value = JSON.parse(text);
                if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
                if (!Array.isArray(value.parameters)) return null;
                return value;
            } catch (e) {
                return null;
            }
        },
        canUseForm() {
            return this.parsed !== null;
        },
        list() {
            return this.parsed ? this.parsed.parameters : [];
        },
        declared() {
            return new Set(this.list.map((param) => String(param?.name || '')).filter(Boolean));
        },
        referenced() {
            return referencedNames(this.code);
        },
        /** 코드가 쓰는데 스펙에 없는 이름. 목록에 없으니 배너에서 바로 만들 수 있게 한다. */
        missingNames() {
            return this.referenced.filter((name) => !this.declared.has(name));
        },
        activityItems() {
            return this.activityOptions.map((activity) => ({
                value: activity.id,
                // 이름만 보이면 같은 이름의 액티비티를 구분할 수 없고, id 만 보이면 무엇인지 모른다.
                title: activity.name === activity.id ? activity.id : `${activity.name} (${activity.id})`
            }));
        },
        sourceOptions() {
            return [
                {
                    value: 'query',
                    title: this.$t('codeEdit.sourceQuery'),
                    hint: this.$t('codeEdit.sourceQueryHint'),
                    icon: 'mdi-text-search'
                },
                {
                    value: 'runtime',
                    title: this.$t('codeEdit.sourceRuntime'),
                    hint: this.$t('codeEdit.sourceRuntimeHint'),
                    icon: 'mdi-cog-outline'
                },
                {
                    value: 'upstream',
                    title: this.$t('codeEdit.sourceUpstream'),
                    hint: this.$t('codeEdit.sourceUpstreamHint'),
                    icon: 'mdi-arrow-left-bold-outline'
                }
            ];
        },
        labelPositionOptions() {
            return [
                { value: 'before', title: this.$t('codeEdit.labelBefore') },
                { value: 'after', title: this.$t('codeEdit.labelAfter') }
            ];
        },
        /** 워크아이템 행에서 자주 쓰는 컬럼. 목록에 없는 값도 직접 넣을 수 있다(combobox). */
        runtimeKeyOptions() {
            return ['proc_inst_id', 'id', 'proc_def_id', 'activity_id', 'user_id', 'tenant_id'];
        }
    },
    watch: {
        // JSON 이 깨진 동안에는 폼을 그릴 수 없다. 빈 화면을 보여 주는 대신 JSON 보기로 넘긴다.
        canUseForm(usable) {
            if (!usable) this.mode = 'json';
        }
    },
    methods: {
        /** 런타임의 판정 순서와 같게 본다 — upstream 이 있으면 runtime 은 읽히지 않는다. */
        sourceOf(param) {
            if (param && param.upstream && typeof param.upstream === 'object') return 'upstream';
            if (param && String(param.runtime || '').trim()) return 'runtime';
            return 'query';
        },
        sourceMeta(param) {
            const source = this.sourceOf(param);
            if (source === 'upstream') return { icon: 'mdi-arrow-left-bold-outline', color: 'purple' };
            if (source === 'runtime') return { icon: 'mdi-cog-outline', color: 'blue-grey' };
            return { icon: 'mdi-text-search', color: 'primary' };
        },
        activityLabel(activityId) {
            const found = this.activityOptions.find((activity) => activity.id === activityId);
            return found ? found.name : activityId;
        },
        /** 이 파라미터가 실행 때 무엇을 하는지 한 줄로. 접힌 목록에서 읽는 문장이다. */
        summaryOf(param) {
            const source = this.sourceOf(param);
            if (source === 'upstream') {
                const path = this.pathText(param);
                return this.$t('codeEdit.summaryUpstream', {
                    activity: this.activityLabel(param.upstream.activity_id),
                    path
                });
            }
            if (source === 'runtime') {
                return this.$t('codeEdit.summaryRuntime', { key: param.runtime });
            }
            const label = String(param.label || '').trim();
            if (!label) return this.$t('codeEdit.summaryQueryByName', { name: param.name });
            return param.label_position === 'after'
                ? this.$t('codeEdit.summaryQueryAfter', { label })
                : this.$t('codeEdit.summaryQueryBefore', { label });
        },
        /**
         * 이 파라미터에 문제가 있는가. 요약 대신 이 문구를 보여 준다.
         * 설정이 덜 된 자리는 실행 때 값을 못 찾아 실패하므로 미리 드러낸다.
         */
        issueOf(param) {
            if (!param || !String(param.name || '').trim()) {
                return { color: 'error', text: this.$t('codeEdit.issueNoName') };
            }
            const source = this.sourceOf(param);
            if (source === 'upstream' && !String(param.upstream.activity_id || '').trim()) {
                return { color: 'warning', text: this.$t('codeEdit.issueNoActivity') };
            }
            if (source === 'upstream' && !this.pathText(param)) {
                return { color: 'warning', text: this.$t('codeEdit.issueNoPath') };
            }
            if (source === 'runtime' && !String(param.runtime || '').trim()) {
                return { color: 'warning', text: this.$t('codeEdit.issueNoRuntimeKey') };
            }
            if (this.code && !this.referenced.includes(param.name)) {
                return { color: 'warning', text: this.$t('codeEdit.issueUnused') };
            }
            return null;
        },
        typeOptions(param) {
            const base = ['string', 'integer', 'number', 'boolean'];
            const current = param && param.type;
            // 스펙에 int/float/bool 같은 별칭이 들어 있을 수 있다. 고르지 않은 채로 값이 바뀌면 안 된다.
            return current && !base.includes(current) ? [...base, current] : base;
        },
        pathText(param) {
            const path = param && param.upstream && param.upstream.path;
            return Array.isArray(path) ? path.join('.') : '';
        },
        upstreamActivityModel(param) {
            return (param && param.upstream && param.upstream.activity_id) || '';
        },
        exampleText(param) {
            const example = param && param.example;
            if (example === undefined || example === null) return '';
            return typeof example === 'object' ? JSON.stringify(example) : String(example);
        },
        /** 파라미터 목록을 바꿔 부모에게 올린다. 최상위의 다른 키는 그대로 둔다. */
        commit(nextList) {
            const base = this.parsed || { parameters: [] };
            this.$emit('update:modelValue', JSON.stringify({ ...base, parameters: nextList }, null, 4));
        },
        updateField(index, key, value) {
            const next = this.list.map((param, i) => {
                if (i !== index) return param;
                const updated = { ...param };
                // 빈 값은 키째로 지운다. 런타임이 `param.get("label")` 로 읽고 빈 문자열도
                // 이름표로 취급하므로, 빈 채로 남기면 "이름표 없음" 과 구분되지 않는다.
                if (value === '' || value === null || value === undefined) delete updated[key];
                else updated[key] = value;
                return updated;
            });
            this.commit(next);
        },
        updateExample(index, value) {
            const param = this.list[index] || {};
            const type = String(param.type || 'string').toLowerCase();
            let parsedValue = value;
            if (value !== '' && ['integer', 'int', 'number', 'float'].includes(type)) {
                const num = Number(value);
                if (!Number.isNaN(num)) parsedValue = num;
            }
            this.updateField(index, 'example', parsedValue);
        },
        updateUpstream(index, key, value) {
            const next = this.list.map((param, i) => {
                if (i !== index) return param;
                const upstream = { ...(param.upstream || {}) };
                if (value === '' || value === null || value === undefined) delete upstream[key];
                else upstream[key] = value;
                return { ...param, upstream };
            });
            this.commit(next);
        },
        /** combobox 는 목록에서 고르면 value 를, 직접 입력하면 문자열을 준다. 둘 다 id 로 받는다. */
        updateUpstreamActivity(index, selected) {
            const activityId = selected && typeof selected === 'object' ? selected.value : selected;
            this.updateUpstream(index, 'activity_id', activityId || '');
        },
        updatePath(index, text) {
            // 배열 인덱스는 정수라야 `_descend` 가 리스트를 파고든다. 숫자로만 된 조각은 정수로 넣는다.
            const path = String(text || '')
                .split('.')
                .map((segment) => segment.trim())
                .filter(Boolean)
                .map((segment) => (/^\d+$/.test(segment) ? Number(segment) : segment));
            this.updateUpstream(index, 'path', path);
        },
        setSource(index, source) {
            const next = this.list.map((param, i) => {
                if (i !== index) return param;
                const updated = { ...param };
                // 쓰지 않는 출처의 키는 지운다. 남겨 두면 판정 순서 때문에 화면에서 고른 것과
                // 다른 출처가 조용히 이긴다.
                delete updated.upstream;
                delete updated.runtime;
                if (source === 'upstream') updated.upstream = { activity_id: '', path: [] };
                if (source === 'runtime') updated.runtime = '';
                return updated;
            });
            this.commit(next);
        },
        /** 이름을 주면 그 이름으로 만든다 — 코드가 쓰는데 없던 파라미터를 배너에서 바로 채울 때. */
        addParameter(name = '') {
            this.commit([...this.list, { name, type: 'string' }]);
            // 새로 만든 것은 곧바로 펼쳐 준다. 접힌 채로 추가되면 어디에 생겼는지 알 수 없다.
            this.openPanel = this.list.length;
        },
        removeParameter(index) {
            this.commit(this.list.filter((_, i) => i !== index));
            this.openPanel = null;
        },
        /**
         * 순서를 바꾼다. 이름표로 못 찾은 값은 지시문에 나온 순서대로 집어 오므로
         * (`_parameter_values` 의 위치 폴백) 목록 순서가 결과를 바꾼다.
         */
        moveParameter(index, delta) {
            const target = index + delta;
            if (target < 0 || target >= this.list.length) return;
            const next = [...this.list];
            [next[index], next[target]] = [next[target], next[index]];
            this.commit(next);
            this.openPanel = target;
        }
    }
};
</script>

<style scoped>
.parameter-form-box {
    overflow-y: auto;
}
.parameter-json-box {
    overflow: hidden;
}
.parameter-panels :deep(.v-expansion-panel-title__overlay) {
    opacity: 0;
}
</style>
