<template>
    <div>
        <v-card flat class="mb-4 bg-lightprimary received-output" data-testid="received-output">
            <div class="pa-4">
                <div class="text-h6 d-flex align-center mb-2" data-testid="received-output-title">
                    {{ $t('ActivityInputData.previousInput') }}
                    <DetailComponent
                        class="ml-1"
                        :title="$t('ActivityInputData.previousInputDescription')"
                        :details="previousInputDetails"
                    />
                </div>
                <!-- 앞 단계마다 한 칸: 어느 단계의 산출물인지 + 한 줄 미리보기를 접어 두고, 눌러서 펼친다.
                     예전의 기울어진 미니 카드(SummaryButton)는 글씨가 6px 이라 읽을 수 없고 누를 곳인지도 알기 어려웠다. -->
                <div
                    v-for="field in inputFields"
                    :key="field.formId"
                    class="received-output__item"
                    :class="{ 'is-open': isOpen(field.formId) }"
                    data-testid="received-output-item"
                >
                    <button
                        type="button"
                        class="received-output__head"
                        :aria-expanded="isOpen(field.formId) ? 'true' : 'false'"
                        @click="toggle(field.formId)"
                    >
                        <v-icon class="received-output__icon" size="18">mdi-file-document-outline</v-icon>
                        <span class="received-output__meta">
                            <span class="received-output__line">
                                <span class="received-output__source" data-testid="received-output-source">{{
                                    getActivityName(field.formId)
                                }}</span>
                                <template v-if="getAssignee(field.formId)">
                                    <v-avatar size="18" class="ml-2">
                                        <v-img
                                            :src="getAssignee(field.formId).profile || '/images/defaultUser.png'"
                                            :alt="getAssignee(field.formId).name"
                                        />
                                    </v-avatar>
                                    <span class="received-output__who">{{ getAssignee(field.formId).name }}</span>
                                </template>
                                <span v-if="previews[field.formId].count" class="received-output__count" data-testid="received-output-count">
                                    · {{ $t('ActivityInputData.fieldCount', { count: previews[field.formId].count }) }}
                                </span>
                            </span>
                            <span v-if="!isOpen(field.formId)" class="received-output__preview" data-testid="received-output-preview">{{
                                previews[field.formId].text || $t('ActivityInputData.empty')
                            }}</span>
                        </span>
                        <span class="received-output__toggle" data-testid="received-output-toggle">
                            {{ isOpen(field.formId) ? $t('ActivityInputData.collapse') : $t('ActivityInputData.expand') }}
                            <v-icon size="18">{{ isOpen(field.formId) ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
                        </span>
                    </button>
                    <v-expand-transition>
                        <div v-if="isOpen(field.formId)" class="received-output__body" data-testid="received-output-body">
                            <DynamicForm
                                v-if="presentedHtml[field.formId]"
                                :formHTML="presentedHtml[field.formId]"
                                v-model="field.formValue"
                                :readonly="true"
                            ></DynamicForm>
                            <!-- 폼 정의를 못 받았으면 값만이라도 이름과 함께 보인다(내부 id 대신 읽을 이름) -->
                            <div v-else class="received-output__plain">
                                <div v-for="row in plainRows(field)" :key="row.key" class="received-output__plain-row">
                                    <div class="received-output__plain-label">{{ row.label }}</div>
                                    <div class="received-output__plain-value">{{ row.value }}</div>
                                </div>
                            </div>
                        </div>
                    </v-expand-transition>
                </div>
            </div>

            <!-- 기존 일반 텍스트 표시 방식 (더 이상 사용하지 않음 - 혹시 몰라서 주석 유지) -->
            <!-- <v-expand-transition>
                <v-card-text v-show="expanded" class="pa-4 pt-0">
                    <div v-for="field in inputFields" :key="field.formId" class="mb-4">
                        <div>
                            <div class="text-subtitle-1 font-weight-medium">
                                <v-icon class="mr-2" size="small">mdi-form-select</v-icon>
                                {{ getActivityName(field.formId) }}
                            </div>
                            <v-divider class="my-2"></v-divider>
                            <v-row class="ma-0 pa-0">
                                <v-col v-for="(value, key) in field.formValue" :key="key" cols="12"
                                    class="pa-4 pb-0 pl-0"
                                >
                                    <div class="d-flex align-center">
                                        <div class="text-caption text-medium-emphasis mr-3 flex-shrink-0">
                                            {{ getFieldText(key, field.formId) }}
                                        </div>
                                        <div class="text-body-2">
                                            {{ formatValue(value) }}
                                        </div>
                                    </div>
                                </v-col>
                            </v-row>
                        </div>
                    </div>
                </v-card-text>
            </v-expand-transition> -->
        </v-card>
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import DynamicForm from '@/components/designer/DynamicForm.vue';
import DetailComponent from '@/components/ui-components/details/DetailComponent.vue';
import { outputPreview, hasValue } from '@/shared/workItemOutput.js';
import { fallbackFieldLabel, fieldLabelForKey, presentFormHtml } from '@/shared/formPresentation/index.js';

export default {
    components: {
        DynamicForm,
        DetailComponent
    },
    props: {
        inputFields: Array,
        workItem: Object // workItem에서 procDefId 추출용
    },
    data() {
        return {
            backend: null,
            fieldMetadata: {}, // 폼별 필드 메타데이터 저장 (레이지 로딩)
            activityMetadata: null, // proc_def의 activities 정보 (레이지 로딩)
            formHtmlData: {}, // 폼별 HTML 데이터 저장
            assigneeMap: {},
            activityNameMap: {}, // formId → 업무 이름(정의에서 못 찾을 때 내부 폼 id 대신 쓴다)
            openForms: {},
            previousInputDetails: [
                {
                    title: 'ActivityInputData.previousInputDetail'
                }
            ]
        };
    },
    async mounted() {
        this.backend = BackendFactory.createBackend();

        // 백그라운드에서 비동기로 메타데이터 로딩 (UI 블로킹 없음)
        if (this.inputFields && Array.isArray(this.inputFields)) {
            const formIds = [...new Set(this.inputFields.map((field) => field.formId))];

            // 비동기로 로딩하여 UI 블로킹하지 않음
            formIds.forEach((formId) => {
                this.fetchFieldsMetadata(formId);
                this.fetchFormHtml(formId);
            });
        }

        // proc_def의 activities 정보도 백그라운드에서 로딩
        if (this.workItem && this.workItem.worklist && this.workItem.worklist.defId) {
            this.fetchActivityMetadata();
            this.fetchAssignees();
        }
    },
    computed: {
        /**
         * 접힌 칸에 보일 한 줄 미리보기와 값이 든 항목 수(폼 id → {text, count}) — 폼 정의의 필드 순서를 따른다.
         * 줄마다 세 곳(항목 수 · 미리보기)에서 쓰므로 그릴 때마다 다시 셈하지 않게 한 번에 만들어 둔다.
         */
        previews() {
            const out = {};
            (Array.isArray(this.inputFields) ? this.inputFields : []).forEach((field) => {
                if (!field || out[field.formId]) return;
                const meta = this.fieldMetadata[field.formId];
                const order = Array.isArray(meta) ? meta.map((m) => m && m.key).filter(Boolean) : [];
                out[field.formId] = outputPreview(field.formValue, { order });
            });
            return out;
        },
        /** 업무 화면용으로 보이는 이름을 고친 폼 HTML(빈 alias → 「텍스트 2」, 자유입력 → 「작업 내용」) */
        presentedHtml() {
            const translate = (key) => (this.$te && this.$te(key) ? this.$t(key) : null);
            const out = {};
            Object.keys(this.formHtmlData).forEach((formId) => {
                out[formId] = presentFormHtml(this.formHtmlData[formId], {
                    translate,
                    freeInputTitle: this.$t('FormWorkItem.freeInputTitle'),
                    freeInputPlaceholder: this.$t('FormWorkItem.freeInputPlaceholder')
                });
            });
            return out;
        }
    },
    watch: {
        // inputFields가 변경될 때 새로운 formId에 대해 메타데이터 로딩
        inputFields(newFields) {
            if (newFields && Array.isArray(newFields)) {
                const formIds = [...new Set(newFields.map((field) => field.formId))];

                // 새로운 formId만 비동기로 로딩
                formIds.forEach((formId) => {
                    if (!this.fieldMetadata[formId]) {
                        this.fetchFieldsMetadata(formId);
                    }
                    if (!this.formHtmlData[formId]) {
                        this.fetchFormHtml(formId);
                    }
                });
            }
        },
        // workItem이 변경될 때 액티비티 메타데이터 로딩
        workItem(newWorkItem) {
            if (newWorkItem && newWorkItem.worklist && newWorkItem.worklist.defId) {
                this.activityMetadata = null; // 초기화
                this.fetchActivityMetadata();
            }
        }
    },
    methods: {
        isOpen(formId) {
            return !!this.openForms[formId];
        },
        toggle(formId) {
            this.openForms = { ...this.openForms, [formId]: !this.openForms[formId] };
        },
        /** 폼 HTML 이 없을 때의 값 목록(이름은 폼 정의의 text, 없으면 읽을 수 있는 이름) */
        plainRows(field) {
            const meta = Array.isArray(this.fieldMetadata[field.formId]) ? this.fieldMetadata[field.formId] : [];
            const values = field.formValue || {};
            const translate = (key) => (this.$te && this.$te(key) ? this.$t(key) : null);
            return Object.keys(values)
                .filter((key) => hasValue(values[key]))
                .map((key) => {
                    const m = meta.find((item) => item && item.key === key);
                    // 폼 정의에 종류가 있으면 그 종류로, 없으면 산출물 카드와 같은 규칙(키 모양으로 짐작)으로
                    const label =
                        (m && m.text) ||
                        (m && m.type
                            ? fallbackFieldLabel(`${m.type}-field`, key, translate)
                            : fieldLabelForKey(key, { translate, freeInputTitle: this.$t('FormWorkItem.freeInputTitle') }));
                    const v = values[key];
                    return { key, label, value: typeof v === 'object' ? JSON.stringify(v) : String(v) };
                });
        },
        // formId를 통해 fields_json 메타데이터를 백그라운드에서 가져오는 함수
        async fetchFieldsMetadata(formDefId) {
            // 이미 로딩중이거나 로딩완료된 경우 중복 요청 방지
            if (this.fieldMetadata[formDefId] !== undefined) {
                return;
            }

            // 로딩 중임을 표시 (빈 배열로 초기화)
            this.fieldMetadata[formDefId] = [];

            try {
                // backend의 getData 메서드를 활용
                const formObject = await this.backend.getData(`form_def/${formDefId}`, { key: 'id' });

                if (formObject && formObject.fields_json) {
                    // Vue 3에서는 직접 할당으로 반응성 자동 처리
                    this.fieldMetadata[formDefId] = formObject.fields_json;
                } else {
                    this.fieldMetadata[formDefId] = [];
                }
            } catch (error) {
                console.warn('필드 메타데이터를 가져오는 중 오류:', error);
                this.fieldMetadata[formDefId] = [];
            }
        },
        // formId를 통해 HTML 폼 데이터를 백그라운드에서 가져오는 함수
        async fetchFormHtml(formDefId) {
            // 이미 로딩중이거나 로딩완료된 경우 중복 요청 방지
            if (this.formHtmlData[formDefId] !== undefined) {
                return;
            }

            // 로딩 중임을 표시
            this.formHtmlData[formDefId] = null;

            try {
                const html = await this.backend.getRawDefinition(formDefId, { type: 'form' });

                if (html) {
                    this.formHtmlData[formDefId] = html;
                } else {
                    this.formHtmlData[formDefId] = null;
                }
            } catch (error) {
                console.warn('폼 HTML 데이터를 가져오는 중 오류:', error);
                this.formHtmlData[formDefId] = null;
            }
        },
        // proc_def에서 activities 정보를 백그라운드에서 가져오는 함수
        async fetchActivityMetadata() {
            if (this.activityMetadata !== null) {
                return; // 이미 로딩중이거나 완료된 경우
            }

            // 로딩 중임을 표시
            this.activityMetadata = [];

            try {
                const procDefId = this.workItem.worklist.defId;

                const process = await this.backend.getRawDefinition(procDefId);

                if (process && process.definition && process.definition.activities) {
                    this.activityMetadata = process.definition.activities;
                } else {
                    this.activityMetadata = [];
                }
            } catch (error) {
                console.warn('액티비티 메타데이터를 가져오는 중 오류:', error);
                this.activityMetadata = [];
            }
        },
        // formId로 해당하는 activity name을 찾는 헬퍼 함수 (레이지 방식)
        getActivityName(formId) {
            // 메타데이터가 아직 로딩되지 않은 경우 formId 반환
            if (!this.activityMetadata || !Array.isArray(this.activityMetadata)) {
                return formId;
            }

            // activities에서 tool이 "formHandler:formId"와 일치하는 항목 찾기
            const activity = this.activityMetadata.find((activity) => activity.tool === `formHandler:${formId}`);

            if (activity && activity.name) {
                return activity.name;
            }

            // 정의에서 못 찾으면 이 인스턴스의 업무 이름, 그것도 없으면 폼 id
            return this.activityNameMap[formId] || formId;
        },
        // 일반 텍스트 표시용 헬퍼 함수들 (더 이상 사용하지 않음 - 혹시 몰라서 주석 유지)
        // key 값으로 해당하는 text를 찾는 헬퍼 함수 (레이지 방식)
        // getFieldText(key, formDefId) {
        //     const metadata = this.fieldMetadata[formDefId];
        //
        //     // 메타데이터가 아직 로딩되지 않았거나 로딩 중인 경우 key 반환
        //     if (!metadata || !Array.isArray(metadata) || metadata.length === 0) {
        //         return key;
        //     }
        //
        //     // 메타데이터에서 해당 key의 text 찾기
        //     const field = metadata.find(item => item.key === key);
        //     if (field && field.text) {
        //         return field.text;
        //     }
        //
        //     // 해당 키를 찾을 수 없는 경우 원래 key 값 반환
        //     return key;
        // },
        // formatValue(value) {
        //     if (value === null || value === undefined) {
        //         return '';
        //     }
        //     if (typeof value === 'string') {
        //         return value;
        //     }
        //     if (typeof value === 'object') {
        //         if (Array.isArray(value)) {
        //             const isObject = value.some(item => {
        //                 return typeof item === 'object';
        //             });
        //             if (isObject) {
        //                 return JSON.stringify(value, null, 2);
        //             } else {
        //                 return value.join(', ');
        //             }
        //         }
        //         // 객체인 경우 JSON.stringify로 변환하되, 너무 길면 잘라서 표시
        //         const jsonString = JSON.stringify(value, null, 2);
        //         if (jsonString.length > 100) {
        //             return jsonString.substring(0, 100) + '...';
        //         }
        //         return jsonString;
        //     }
        //     return String(value);
        // },
        async fetchAssignees() {
            try {
                const instId = this.workItem.worklist.instId;
                const workList = await this.backend.getWorkListByInstId(instId);
                if (!workList || !Array.isArray(workList)) return;

                const nameMap = {};
                const activityNames = {};
                workList.forEach((item) => {
                    if (item.tool && item.tool.includes('formHandler:') && (item.status === 'DONE' || item.status === 'COMPLETED')) {
                        const formId = item.tool.split('formHandler:')[1];
                        if (formId && !nameMap[formId]) {
                            nameMap[formId] = item.username || item.endpoint || null;
                        }
                        if (formId && !activityNames[formId] && item.name) activityNames[formId] = item.name;
                    }
                });
                this.activityNameMap = activityNames;

                const usernames = [...new Set(Object.values(nameMap).filter(Boolean))];
                let userProfileMap = {};
                if (usernames.length > 0) {
                    try {
                        const users = await this.backend.getUserList({});
                        if (users && Array.isArray(users)) {
                            users.forEach((u) => {
                                if (u.username) userProfileMap[u.username] = u.profile || null;
                                if (u.email) userProfileMap[u.email] = u.profile || null;
                            });
                        }
                    } catch (e) {
                        console.warn('사용자 프로필을 가져오는 중 오류:', e);
                    }
                }

                const map = {};
                Object.keys(nameMap).forEach((formId) => {
                    const name = nameMap[formId];
                    map[formId] = {
                        name,
                        profile: userProfileMap[name] || null
                    };
                });
                this.assigneeMap = map;
            } catch (e) {
                console.warn('담당자 정보를 가져오는 중 오류:', e);
            }
        },
        getAssignee(formId) {
            return this.assigneeMap[formId] || null;
        }
    }
};
</script>

<style scoped>
.received-output__item + .received-output__item {
    margin-top: 8px;
}
/* 접힌 칸: 흰 바탕 한 줄 — 누를 수 있는 곳이라는 것이 보이게 테두리와 오른쪽 「펼쳐 보기」 */
.received-output__head {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--cds-border);
    border-radius: 8px;
    background: var(--cds-surface-1, #fff);
    text-align: left;
    cursor: pointer;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.received-output__head:hover,
.received-output__head:focus-visible {
    border-color: rgb(var(--v-theme-primary));
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
    outline: none;
}
.received-output__icon {
    flex-shrink: 0;
    color: var(--cds-text-secondary);
}
.received-output__meta {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1 1 auto;
}
/* 좁은 화면에서는 단계 이름을 자르지 않고 담당자 · 항목 수를 다음 줄로 내린다 */
.received-output__line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    row-gap: 2px;
    min-width: 0;
    font-size: 14px;
    color: var(--cds-text-primary);
}
.received-output__source {
    max-width: 100%;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.received-output__who {
    margin-left: 4px;
    font-size: 12px;
    color: var(--cds-text-secondary);
    white-space: nowrap;
}
.received-output__count {
    margin-left: 6px;
    font-size: 12px;
    color: var(--cds-text-secondary);
    white-space: nowrap;
}
.received-output__preview {
    margin-top: 2px;
    font-size: 13px;
    color: var(--cds-text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.received-output__toggle {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    font-size: 13px;
    font-weight: 600;
    color: rgb(var(--v-theme-primary));
    white-space: nowrap;
}
/* 펼친 본문: 폼 카드가 테두리를 갖고 있어 겉 상자를 하나 더 두르지 않는다 */
.received-output__body {
    padding-top: 8px;
}
.received-output__plain {
    padding: 12px;
    border: 1px solid var(--cds-border);
    border-radius: 8px;
    background: var(--cds-surface-1, #fff);
}
.received-output__plain-row + .received-output__plain-row {
    margin-top: 8px;
}
.received-output__plain-label {
    font-size: 12px;
    color: var(--cds-text-secondary);
}
.received-output__plain-value {
    font-size: 14px;
    white-space: pre-wrap;
    word-break: break-word;
}
</style>
