<template>
    <div class="included" style="margin-bottom: 22px">
        <v-autocomplete
            v-model="value"
            :items="items"
            :disabled="disabled"
            :item-title="autocompleteItemTitleFn"
            :item-value="bindOptions.itemValue"
            :color="bindOptions.color"
            :label="options.label"
            :variant="bindOptions.variant"
            :hide-details="bindOptions.hideDetails"
            :return-object="bindOptions.returnObject"
            :loading="loading"
        >
            <template v-slot:item="{ props, item }">
                <v-list-item v-if="mode == 'ProcessGPT'" v-bind="props" :title="item.raw[bindOptions.itemTitle]"></v-list-item>
                <v-list-item
                    v-else
                    v-bind="props"
                    :title="itemDisplayTitle(item.raw)"
                    :subtitle="itemSubtitle(item.raw)"
                ></v-list-item>
            </template>
            <!-- <template v-slot:item="{ item }">
                <div style="margin: 5px;" @click="selectItem(item.raw)">
                    <div v-if="bindOptions.returnObject">
                        <div style="font-size: 0.8em; color: grey;">{{ item.raw.displayPath }}</div>
                        <div>{{ item.raw[bindOptions.itemTitle] }}</div>
                    </div>
                    <div v-else>
                        <div>{{ item.raw }}</div>
                    </div>
                </div>
            </template> -->
        </v-autocomplete>
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';

export default {
    props: {
        /** 문자열(path/id) 또는 객체(ProcessDialog 등 returnObject) */
        modelValue: {
            type: [String, Object, Number],
            default: ''
        },
        fileExtensions: {
            type: Array,
            default: []
        },
        disabled: {
            type: Boolean,
            default: false
        },
        options: {
            type: Object,
            default: {}
        }
    },
    computed: {
        bindOptions() {
            return {
                color: this.options.color || 'primary',
                itemTitle: this.options.itemTitle || 'name',
                itemValue: this.options.itemValue || 'value',
                label: this.options.label || 'Select Definition',
                variant: this.options.variant || 'outlined',
                hideDetails: this.options.hideDetails || false,
                returnObject: this.options.returnObject || false
            };
        },
        /** CallActivityPanel 등 definitionId 문자열 바인딩 */
        isObjectModelValue() {
            const m = this.modelValue;
            return m != null && typeof m === 'object' && !Array.isArray(m);
        },
        mode() {
            return window.$mode;
        },
        /** v-autocomplete 선택칩·검색 매칭용 라벨 (uEngine: 표시명 + 경로) */
        autocompleteItemTitleFn() {
            const key = this.bindOptions.itemTitle;
            if (this.mode === 'ProcessGPT') {
                return (item) => (item != null && item[key] != null ? String(item[key]) : '');
            }
            return (item) => this.combinedItemLabel(item);
        }
    },
    data() {
        return {
            backend: null,
            items: [],
            value: this.normalizeInitialValue(this.modelValue),
            loading: false
        };
    },
    created() {
        this.init();
    },
    watch: {
        /** 부모가 modelValue를 바꿀 때 콤보 동기화 */
        modelValue(nv) {
            const next = this.normalizeInitialValue(nv);
            if (this.isObjectModelValue) {
                if (next !== this.value) {
                    this.value = next;
                }
            } else if (String(next ?? '') !== String(this.value ?? '')) {
                this.value = next;
            }
        },
        /**
         * - 객체 모드(returnObject): 펼친 객체를 emit (제자리 mutate 대비)
         * - 문자열 모드(CallActivity definitionId 등): path/id 문자열만 emit
         */
        value(val) {
            if (this.isObjectModelValue) {
                const parent = this.modelValue && typeof this.modelValue === 'object' ? { ...this.modelValue } : {};
                const merged =
                    val && typeof val === 'object' && !Array.isArray(val)
                        ? { ...parent, ...val }
                        : {
                              ...parent,
                              id: '',
                              name: '',
                              path: undefined,
                              definitionName: undefined,
                              directory: undefined,
                              isDeleted: undefined
                          };
                const m = this.modelValue || {};
                const samePick =
                    String(merged.path || '') === String(m.path || '') &&
                    String(merged.id ?? '') === String(m.id ?? '') &&
                    String(merged.definitionName || '') === String(m.definitionName || '') &&
                    String(merged.name || '') === String(m.name || '');
                if (samePick) return;
                this.$emit('update:modelValue', merged);
                return;
            }

            let out = '';
            if (val && typeof val === 'object' && !Array.isArray(val)) {
                const key = this.bindOptions.itemValue || 'path';
                const raw = val[key] ?? val.path ?? val.id;
                out = raw != null ? String(raw) : '';
            } else if (val != null) {
                out = String(val);
            }
            const cur = this.modelValue == null || this.modelValue === '' ? '' : String(this.modelValue);
            if (out === cur) return;
            this.$emit('update:modelValue', out);
        }
    },
    methods: {
        normalizeInitialValue(mv) {
            if (mv != null && typeof mv === 'object' && !Array.isArray(mv)) {
                return mv;
            }
            if (mv == null) return '';
            return String(mv);
        },
        normalizePathKey(s) {
            return String(s || '')
                .trim()
                .replace(/\.bpmn$/i, '')
                .replace(/\.xml$/i, '');
        },
        itemMatchesModel(item, primitiveModel) {
            if (!item || primitiveModel == null || String(primitiveModel).trim() === '') return false;
            const key = this.bindOptions.itemValue || 'path';
            const cand = item[key] ?? item.path ?? item.id;
            if (cand == null) return false;
            const a = this.normalizePathKey(cand);
            const b = this.normalizePathKey(primitiveModel);
            return cand === primitiveModel || a === b || String(cand) === String(primitiveModel);
        },
        init() {
            var me = this;
            me.$try({
                context: me,
                async action() {
                    me.loading = true;
                    me.backend = BackendFactory.createBackend();
                    let lists = [];
                    if (me.mode == 'ProcessGPT') {
                        lists = await me.retrieveFolder();
                    } else {
                        lists = await me.retrieveFolder();
                    }
                    lists = lists.filter((item) => !item.directory);

                    if (me.fileExtensions.length > 0 && me.mode !== 'ProcessGPT') {
                        lists = lists.filter((item) => {
                            const base = String(item.path || '')
                                .split('/')
                                .pop();
                            const label = base || item.name || '';
                            return me.fileExtensions.some((ext) => label.toLowerCase().endsWith(String(ext).toLowerCase()));
                        });
                    }

                    lists = lists.map((item) => {
                        const { _links, ...rest } = item; // _links 속성을 제거합니다.
                        return {
                            ...rest,
                            id: item.id ? item.id : item.path.split('.')[0]
                        };
                    });

                    // PAL 전용: definition-map에서 commonModule === true 인 프로세스만 표시
                    if (me.options.commonModuleOnly && typeof window !== 'undefined' && window.$pal) {
                        const commonIds = await me.getCommonModuleProcessIds();
                        if (commonIds.size > 0) {
                            lists = lists.filter((item) => {
                                const id = item.id || (item.path || '').replace(/\.(bpmn|xml)$/i, '');
                                const pathBase = (item.path || '').replace(/\.(bpmn|xml)$/i, '');
                                return (
                                    commonIds.has(id) ||
                                    commonIds.has(pathBase) ||
                                    (pathBase.includes('/') && commonIds.has(pathBase.split('/').pop()))
                                );
                            });
                        }
                    }

                    me.items = lists;
                    me.loading = false;
                    me.reconcileValueWithItems();
                }
            });
        },
        reconcileValueWithItems() {
            const me = this;
            if (!me.items?.length) return;

            if (me.isObjectModelValue) {
                const m = me.modelValue;
                if (!m || typeof m !== 'object') return;
                const keys = ['path', 'filePath', 'id'];
                for (const pk of keys) {
                    const ref = m[pk];
                    if (ref == null || ref === '') continue;
                    const selectedItem = me.items.find(
                        (item) => item.path === ref || item.id === ref || me.itemMatchesModel(item, ref)
                    );
                    if (selectedItem) {
                        if (me.bindOptions.returnObject) {
                            me.value = { ...selectedItem };
                        } else {
                            const key = me.bindOptions.itemValue || 'path';
                            me.value = selectedItem[key] ?? selectedItem.path ?? selectedItem.id;
                        }
                        return;
                    }
                }
                return;
            }

            const prim = me.modelValue == null ? '' : String(me.modelValue).trim();
            if (!prim) return;
            const selectedItem = me.items.find((item) => me.itemMatchesModel(item, prim));
            if (selectedItem) {
                const key = me.bindOptions.itemValue || 'path';
                me.value = selectedItem[key] ?? selectedItem.path ?? selectedItem.id ?? prim;
            }
        },
        async retrieveFolder(path) {
            var me = this;
            let lists = await me.backend.listDefinition(path);
            let results = [];
            if (!lists) {
                return results;
            }
            for (const item of lists) {
                if (item.directory) {
                    item.displayPath = `/${item.name}`;
                    let children = await me.retrieveFolder(item.name);
                    results = results.concat(children);
                } else {
                    item.displayPath = item.directory ? `${path}/${item.name}` : path ? `/${path}` : '/';
                }
                results.push(item);
            }
            return results;
        },
        selectItem(item) {
            this.value = this.bindOptions.returnObject ? item : item[this.bindOptions.itemTitle];
        },
        /**
         * uEngine: 목록 API name(표시명) + path(저장 경로/ID)를 한 줄로 (선택칩·검색용).
         * 표시명이 파일명과 같거나 비어 있으면 경로만.
         */
        combinedItemLabel(raw) {
            if (!raw) return '';
            const path = String(raw.path || raw.id || '').trim();
            const display = String(raw.definitionName || raw.displayName || raw.name || '').trim();
            const base = path.includes('/') ? path.split('/').pop() || path : path;
            const baseNoExt = base.replace(/\.(bpmn|xml)$/i, '');
            if (!path) return display || '';
            if (!display || display === path || display === base || display === baseNoExt) {
                return path;
            }
            return `${display} (${path})`;
        },
        /** 드롭다운 행 제목: 사람이 읽는 표시명 우선 */
        itemDisplayTitle(raw) {
            if (!raw) return '';
            const fromMeta = raw.definitionName || raw.displayName;
            if (fromMeta) return String(fromMeta).trim();
            const n = raw[this.bindOptions.itemTitle];
            if (n) return String(n).trim();
            const path = String(raw.path || raw.id || '').trim();
            return path.includes('/') ? path.split('/').pop() || path : path;
        },
        /** 드롭다운 행 부제: 기술 경로(정의 ID) */
        itemSubtitle(raw) {
            if (!raw) return '';
            return String(raw.path || raw.id || '').trim();
        },
        /** definition-map에서 commonModule === true 인 서브프로세스 id 집합 반환 (PAL 전용) */
        async getCommonModuleProcessIds() {
            const ids = new Set();
            try {
                const map = await this.backend.getProcessDefinitionMap();
                if (!map || !map.mega_proc_list) return ids;
                for (const mega of map.mega_proc_list) {
                    if (!mega.major_proc_list) continue;
                    for (const major of mega.major_proc_list) {
                        if (!major.sub_proc_list) continue;
                        for (const sub of major.sub_proc_list) {
                            if (sub.commonModule === true && sub.id) {
                                ids.add(String(sub.id).trim());
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn('[ProcessDefinitionDisplay] getCommonModuleProcessIds failed', e);
            }
            return ids;
        }
    }
};
</script>
