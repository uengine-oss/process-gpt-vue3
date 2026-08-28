<template>
    <div class="form-folder-field">
        <label v-if="label" class="text-subtitle-2 font-weight-medium d-block mb-1">{{ label }}</label>

        <div class="d-flex align-center flex-wrap" style="gap: 6px">
            <v-chip
                v-for="(p, i) in selectedFolders"
                :key="p"
                size="small"
                color="primary"
                variant="tonal"
                :closable="!isReadonly"
                @click:close="removeAt(i)"
            >
                <v-icon start size="14">mdi-folder-outline</v-icon>
                {{ shortPath(p) }}
            </v-chip>

            <v-btn
                v-if="!isReadonly"
                size="small"
                variant="outlined"
                prepend-icon="mdi-folder-search-outline"
                @click="pickerOpen = true"
            >
                {{ selectedFolders.length ? '폴더 변경' : '지식베이스 폴더 선택' }}
            </v-btn>
        </div>

        <div v-if="!selectedFolders.length" class="text-caption text-medium-emphasis mt-1">
            근거로 사용할 지식베이스 폴더를 선택하세요.
        </div>

        <!-- picker 는 열림 상태를 v-if 로 걸면 안 된다. 목록 로딩이 modelValue
             false→true 워처에서만 도니, 이미 true 인 채로 생성되면 영영 안 뛴다. -->
        <KnowledgeSpacePicker
            v-model="pickerOpen"
            :initiallySelectedFolders="selectedFolders"
            @confirm="onConfirm"
        />
    </div>
</template>

<script>
// 채팅에서 쓰는 지식베이스 picker 를 폼 필드로 감싼다. 폴더 트리·권한·doc_role 배지 등
// 동작이 이미 검증돼 있어 새로 만들지 않는다 — 이 컴포넌트는 선택 결과를 formValues 에
// 담는 역할만 한다.
import KnowledgeSpacePicker from '@/components/knowledge/KnowledgeSpacePicker.vue';
import { commonSettingInfos } from './CommonSettingInfos.vue';

export default {
    name: 'FolderField',
    components: { KnowledgeSpacePicker },
    props: {
        modelValue: { type: [Object, Array, String], default: null },
        name: String,
        alias: String,
        readonly: String,
        disabled: String,
        // 편집기가 렌더된 컴포넌트를 다시 태그로 되돌릴 때 쓴다(없으면 <undefined> 로 나간다).
        tagName: String,
        vueRenderUUID: String
    },
    emits: ['update:modelValue'],
    data() {
        return {
            pickerOpen: false,
            selectedFolders: [],

            // 폼 편집기(KEditor)가 요구하는 인터페이스. 편집기는 렌더된 컴포넌트를 다시
            // 태그로 되돌릴 때 settingInfos 를 훑는다 — 없으면 getKEditorContentHtml 이
            // 예외로 죽고, 그 뒤 저장·미리보기 갱신이 통째로 멈춘다.
            localName: '',
            localAlias: '',
            localDisabled: false,
            localReadonly: false,
            settingInfos: [
                commonSettingInfos['localName'],
                commonSettingInfos['localAlias'],
                commonSettingInfos['localDisabled'],
                commonSettingInfos['localReadonly']
            ]
        };
    },
    created() {
        this.localName = this.name || '';
        this.localAlias = this.alias || '';
        this.localDisabled = String(this.disabled) === 'true';
        this.localReadonly = String(this.readonly) === 'true';
    },
    computed: {
        // 편집기에서는 localReadonly/localDisabled 가 실시간으로 바뀐다.
        isReadonly() {
            return !!this.localReadonly || !!this.localDisabled;
        },
        label() {
            return this.localAlias || this.alias || '';
        }
    },
    watch: {
        modelValue: { handler(v) { this.selectedFolders = this.normalize(v); }, immediate: true }
    },
    methods: {
        /** 저장 형태가 배열/객체/문자열 어느 쪽이어도 경로 배열로 읽는다. */
        normalize(v) {
            if (!v) return [];
            if (typeof v === 'string') return v ? [v] : [];
            if (Array.isArray(v)) return v.map((x) => (typeof x === 'string' ? x : x?.folder_path)).filter(Boolean);
            if (Array.isArray(v.folders)) return v.folders.filter(Boolean);
            return [];
        },
        shortPath(p) {
            const parts = String(p || '').split('/').filter(Boolean);
            return parts.length > 2 ? `…/${parts.slice(-2).join('/')}` : p;
        },
        emitValue() {
            // deepagents 어댑터가 folders 키를 보고 폴더 스코프로 넘긴다.
            this.$emit('update:modelValue', { folders: [...this.selectedFolders] });
        },
        removeAt(i) {
            this.selectedFolders.splice(i, 1);
            this.emitValue();
        },
        onConfirm(_docs, folders) {
            const list = Array.isArray(folders) ? folders : [];
            this.selectedFolders = list.map((f) => (typeof f === 'string' ? f : f?.folder_path)).filter(Boolean);
            this.emitValue();
        }
    }
};
</script>

<style scoped>
.form-folder-field {
    margin-bottom: 12px;
}
</style>
