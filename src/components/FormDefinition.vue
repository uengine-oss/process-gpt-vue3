<template>
    <div class="form-definition-root">
        <v-row class="ma-0 pa-0 form-definition-chat-box">
            <v-col v-if="type === 'edit'" class="pa-0 overflow-y-auto" style="height: calc(100vh - 260px)">
                <div v-if="isShowMashup">
                    <!-- 새 편집기. 예전 KEditor로 되돌리려면 localStorage.formEditor = 'legacy' -->
                    <FormDesigner v-if="useNewEditor" ref="designer" :source="designerSource" @update:modelValue="changedDesignerContent" />
                    <mashup
                        v-else
                        ref="mashup"
                        v-model="kEditorInput"
                        :key="mashupKey"
                        @onInitKEditorContent="updateKEditorContentBeforeSave"
                        @onChangeKEditorContent="changedKEditorContent"
                        @update:modelValue="(val) => (modelValue = val)"
                    />
                </div>
                <div v-else class="align-self-center">
                    <v-progress-circular color="primary" indeterminate></v-progress-circular>
                </div>
            </v-col>
            <!-- 오른쪽 세로선 추가 (한글 주석) -->
            <v-divider vertical v-if="type !== 'preview'"></v-divider>

            <v-col v-if="type === 'preview'" class="pa-0 pl-4 overflow-y-auto" style="height: calc(100vh - 260px)">
                <template v-if="isShowPreview">
                    <DynamicForm
                        class="form-definition-preview-form"
                        ref="dynamicForm"
                        :formHTML="previewHTML"
                        v-model="previewFormValues"
                    ></DynamicForm>
                    <!-- <template v-if="dev.isDevMode">
                        <v-textarea label="previewFormValuesToTest" rows="10" v-model="dev.previewFormValues"></v-textarea>
                        <v-btn color="primary" class="full-width my-5" @click="onClickPreviewApplyButton">적용</v-btn>
                    </template>

                    <v-row class="ma-0 pa-0">
                        <v-spacer></v-spacer>
                        <v-btn color="primary" @click="onClickPreviewSubmitButton">제출</v-btn>
                    </v-row> -->
                </template>
                <div v-else class="align-self-center">
                    <v-progress-circular color="primary" indeterminate></v-progress-circular>
                </div>
            </v-col>
            <v-col
                v-if="type != 'preview'"
                :class="type == 'simulation' ? '' : 'ml-auto'"
                :style="type == 'simulation' ? '' : 'max-width: 250px; height: calc(100vh - 260px) !important; overflow: auto;'"
                class="pa-0 form-definition-simulation-chat-box"
            >
                <Chat
                    :chatInfo="chatInfo"
                    :messages="messages"
                    :userInfo="userInfo"
                    :type="type == 'simulation' ? 'form_simulation' : 'form'"
                    @sendMessage="beforeSendMessage"
                    @sendEditedMessage="sendEditedMessage"
                    @stopMessage="stopMessage"
                >
                    <template v-slot:custom-title>
                        <div></div>
                    </template>
                </Chat>
            </v-col>
        </v-row>
    </div>
</template>

<script>
import Mashup from '@/components/designer/Mashup.vue';
import FormDesignSavePanel from '@/components/designer/FormDesignSavePanel.vue';
import ChatModule from './ChatModule.vue';
import ChatGenerator from './ai/FormDesignGenerator';
import Chat from './ui/Chat.vue';
import DynamicForm from '@/components/designer/DynamicForm.vue';
import FormDesigner from '@/components/designer/form/FormDesigner.vue';
import FormDefinitionModule from './FormDefinitionModule.vue';
import BackendFactory from '@/components/api/BackendFactory';
import { expandRowLayoutInPlace } from '@/utils/formLayout';
import { pickPreviewSource } from '@/utils/formPreviewSource';
import { describeFormStream, formatFormProgress, summarizeFormChange, formatFormChange } from '@/utils/formStreamProgress';
import { applyFormModifications } from '@/utils/formModifications';
import { buildStreamingFormHtml } from '@/utils/formStreamPreview';
import { parseForm, canonicalForm } from '@/utils/formModel';

const backend = BackendFactory.createBackend();

export default {
    mixins: [ChatModule, FormDefinitionModule],
    props: {
        type: {
            type: String,
            default: 'edit'
        },
        formId: {
            type: String,
            default: ''
        },
        modelValue: {
            type: String,
            default: ''
        },
        simulation_data: {
            type: Object,
            default: {}
        }
    },
    components: {
        Chat,
        Mashup,
        ChatGenerator,
        FormDesignSavePanel,
        DynamicForm,
        FormDesigner
    },
    data: () => ({
        chatInfo: {
            title: '',
            text: 'uiDefinition.uiDefinitionExplanation'
        },

        kEditorInput: ``, // Mashup 컴포넌트의 KEditor을 업데이트하기 위해서 전달되는 값
        mashupKey: 0, // kEditorInput가 변경되었을 경우, Mashup 컴포넌트를 다시 렌더링하기 위해서

        kEditorContent: '',

        prevFormOutput: '', // 폼 디자이너에게 이미 이전에 생성된 HTML 결과물을 전달하기 위해서
        prevMessageFormat: '', // 사용자가 KEditor를 변경할때마다 해당 포맷을 기반으로 System 메시지를 재구축해서 보내기 위해서

        formHTML: '',
        isShowMashup: false,

        previewHTML: '',
        previewFormValues: {},
        isShowPreview: false,

        dev: {
            isDevMode: window.localStorage.getItem('isDevMode') === 'true',
            previewFormValues: ''
        },

        // 새 편집기(FormDesigner)가 처음 읽을 폼 HTML(저장 형식)
        designerSource: '',
        useNewEditor: window.localStorage.getItem('formEditor') !== 'legacy',

        isAIUpdated: false,
        isRoutedWithUnsaved: false,
        datasourceURL: null,
        datasourceSchema: null
    }),
    async created() {
        // const reloadOnConnectionFailure = async () => {
        //     if (!(await this.storage.isConnection())) {
        //         const reloadOnConnectionSuccess = async () => {
        //             if(await this.storage.isConnection())
        //                 this.$router.go(0);
        //             else
        //                 setTimeout(reloadOnConnectionSuccess, 500);
        //         }
        //         setTimeout(reloadOnConnectionSuccess, 500);
        //     }
        // }
        // reloadOnConnectionFailure()

        if (this.modelValue != '') {
            this.kEditorInput = this.dynamicFormHTMLToKeditorContentHTML(this.modelValue);
        }

        const isUseDataSource = localStorage.getItem('isUseDataSource');
        if (isUseDataSource == 'true') {
            const isAdmin = localStorage.getItem('isAdmin') === 'true';
            this.$try({
                context: this,
                action: async () => {
                    const schema = await backend.extractDatasourceSchema();
                    this.datasourceSchema = Array.isArray(schema) ? schema : [];
                    this.datasourceURL = this.datasourceSchema.map((item) => item.endpoint);
                },
                errorMsg: isAdmin
                    ? this.$t('ProcessDefinitionChat.datasourceSchemaFailed')
                    : this.$t('ProcessDefinitionChat.datasourceSchemaFailedNoPermission')
            });
        }

        this.generator = new ChatGenerator(this, {
            isStream: true,
            preferredLanguage: 'Korean',
            // 받은 토큰을 0.15초마다 넘겨 진행 말풍선을 실시간으로 갱신한다
            streamThrottleMs: 150
        });
        await this.init();
    },
    computed: {
        isMobile() {
            return window.innerWidth <= 768;
        }
    },
    watch: {
        type(newVal, oldVal) {
            if (newVal === 'edit') {
                this.applyNewSrcToMashup(this.modelValue);
            } else {
                this.applyToPreviewTab();
            }
        },
        // 미리보기 탭은 한 번 열리면 계속 떠 있다. 편집 탭에서 고친 폼이 넘어오면 다시 그린다.
        modelValue(newVal, oldVal) {
            if (this.type === 'preview' && newVal !== oldVal) this.applyToPreviewTab();
        },
        previewHTML: {
            handler(newVal) {
                this.EventBus.emit('updatePreviewHTML', newVal);
            },
            immediate: true
        }
    },
    methods: {
        getFormHTML() {
            // 새 편집기는 저장 형식 그대로 돌려준다. 안 고친 폼은 읽은 문자열 그대로다
            if (this.$refs.designer) return this.$refs.designer.getFormHtml();
            if (this.$refs.mashup) {
                const kEditorContent = this.$refs.mashup.getKEditorContentHtml();
                return this.keditorContentHTMLToDynamicFormHTML(kEditorContent);
            } else {
                return this.formHTML;
            }
        },
        /** 기본 폼(defaultform)의 정규 형식 — 태스크 폼이 기본 폼을 복사한 것인지 내용으로 판단한다 */
        async loadDefaultForm() {
            if (this.defaultFormCanon !== undefined) return;
            this.defaultFormCanon = null;
            try {
                const html = await this.backend.getRawDefinition('defaultform', { type: 'form' });
                if (html) this.defaultFormCanon = canonicalForm(parseForm(html));
            } catch (error) {
                console.warn('[FormDefinition] 기본 폼을 읽지 못했습니다(기존 폼은 수정으로 보냅니다):', error);
            }
        },
        changedDesignerContent(html) {
            this.formHTML = html;
            this.$emit('update:modelValue', html);
        },
        changedKEditorContent(value) {
            this.formHTML = this.keditorContentHTMLToDynamicFormHTML(value.html);
            this.$emit('update:modelValue', this.formHTML);
        },
        updateKEditorContentBeforeSave(kEditorContent) {
            // this.kEditorContentBeforeSave = kEditorContent;
        },

        /**
         * DB에서 로드된 내용을 KEditor에 적용할 수 있는 형태로 바꾸기 위해서
         */
        dynamicFormHTMLToKeditorContentHTML(html) {
            const dom = new DOMParser().parseFromString(html, 'text/html');

            const rows = dom.querySelectorAll('row-layout');
            rows.forEach((row) => {
                const isMultiDataMode = row.getAttribute('is_multidata_mode');
                if (!isMultiDataMode || isMultiDataMode === 'false') {
                    expandRowLayoutInPlace(row);
                } else {
                    const newRow = document.createElement('div');

                    newRow.setAttribute('name', row.getAttribute('name') ?? '');
                    newRow.setAttribute('alias', row.getAttribute('alias') ?? '');
                    newRow.setAttribute('is_multidata_mode', row.getAttribute('is_multidata_mode') ?? 'false');

                    newRow.setAttribute('class', 'row');

                    $(row)
                        .children('div')
                        .children('div.row')
                        .children('[class^="col-sm-"]')
                        .each(function () {
                            var field = $(this)[0];
                            newRow.appendChild(field);
                        });

                    $(newRow)
                        .children('[class^="col-sm-"]')
                        .children('[v-model]')
                        .each(function () {
                            var field = $(this)[0];
                            field.removeAttribute('v-model');
                        });

                    $(newRow)
                        .children('[class^="col-sm-"]')
                        .children('*')
                        .each(function () {
                            var field = $(this)[0];
                            Array.from(field.attributes).forEach((attr) => {
                                if (attr.name.startsWith('v-on:')) {
                                    field.removeAttribute(attr.name);
                                }
                            });
                        });

                    row.parentNode.replaceChild(newRow, row);
                }
            });

            return dom.body.innerHTML.replace(/&quot;/g, `'`).replace('<br>', '\n');
        },

        /**
         * 'Save' 버튼을 누를 경우, 최종 결과를 DB에 저장하기 위해서
         */
        async saveFormDefinition() {
            // const DynamicFormHTML = this.keditorContentHTMLToDynamicFormHTML(this.modelValue);
            const latestHtml = this.getFormHTML();
            if (latestHtml) {
                // 새 편집기는 이미 저장 형식이다. 한 번 더 변환하면 row-layout이 겹쳐 HTML이 바뀐다
                this.previewHTML = this.$refs.designer ? latestHtml : this.keditorContentHTMLToDynamicFormHTML(latestHtml);
            }

            if (this.formId !== '' && this.formId !== null) {
                const options = {
                    type: 'form',
                    proc_def_id: this.simulation_data.proc_def_id ? this.simulation_data.proc_def_id : null,
                    activity_id: this.simulation_data.element_id ? this.simulation_data.element_id : null
                };
                if (window.location.pathname == '/definition-map') {
                    localStorage.setItem(this.formId, this.previewHTML);
                } else {
                    await this.backend.putRawDefinition(this.previewHTML, this.formId, options);
                }
            } else {
                //
            }
        },

        onClickPreviewSubmitButton() {
            const error = this.$refs.dynamicForm.validate();
            if (error && error.length > 0) alert(error);

            if (this.dev.isDevMode) this.dev.previewFormValues = JSON.stringify(this.previewFormValues);
            else alert(JSON.stringify(this.previewFormValues));
        },

        onClickPreviewApplyButton() {
            this.previewFormValues = JSON.parse(this.dev.previewFormValues);
        },

        /**
         * DB에서 Form 관련 데이터를 가져와서 KEditor에 반영하기 위해서 사용
         * @param {*} path
         */
        async loadData(path) {
            this.isShowMashup = false;
            this.formHTML = await this.backend.getRawDefinition(this.formId, { type: 'form' });

            if (this.useNewEditor && this.type === 'edit') {
                // 저장 형식을 그대로 넘긴다 — KEditor용 변환(dynamicFormHTMLToKeditorContentHTML 등)을 거치지 않는다
                this.designerSource = this.modelValue || this.formHTML || '';
                this.isShowMashup = true;
                this.loadDefaultForm();
                this.$nextTick(() => this.applyToPreviewTab());
                return;
            }

            let tempHTML = '';
            if (this.modelValue) {
                tempHTML = this.dynamicFormHTMLToKeditorContentHTML(this.modelValue);
            } else {
                tempHTML = this.dynamicFormHTMLToKeditorContentHTML(this.formHTML);
            }
            const kEditorContent = this.loadHTMLToKEditorContent(tempHTML);
            this.applyNewSrcToMashup(kEditorContent);
            this.isShowMashup = true;

            this.applyToPreviewTab();
        },

        /**
         * AI에 메시지를 보내기 위해서 사용
         * @param {*} newMessage
         */
        beforeSendMessage(newMessage) {
            if (this.type == 'simulation') {
                this.prevFormOutput = this.dynamicFormHTMLToKeditorContentHTML(this.modelValue);
            } else if (this.$refs.designer) {
                // 프롬프트가 설명하는 형식(row-layout + 바인딩) 그대로 준다.
                // 기본 폼("자유입력")을 그대로 둔 채 요청하면 "새로 만들기"로 보낸다 — 기존 폼이 비면
                // FormDesignGenerator가 Create로 보낸다. 수정으로 보내면 자유입력 행이 남은 채 새 행이 붙었다.
                const current = this.$refs.designer.getAIInput();
                this.prevFormOutput = this.defaultFormCanon && current === this.defaultFormCanon ? '' : current;
            } else {
                this.prevFormOutput = this.$refs.mashup.getKEditorContentHtml();
            }
            newMessage.mentionedUsers = null;
            const beforeHtml = this.$refs.designer ? this.$refs.designer.getFormHtml() : this.modelValue || this.formHTML || '';
            this.aiStopped = false;
            this.aiSkippedEdits = 0;
            this.generator.sendMessageWithPrevFormOutput(newMessage);
            this.startAIProgress(beforeHtml);
        },

        // ---- 진행 말풍선 ---------------------------------------------------
        // 폼 디자이너 AI는 JSON만 답하고, 추론 모델은 첫 토큰까지 수십 초가 걸린다.
        // 그동안 경과 시간을, 토큰이 오면 지금까지 작성된 필드를 말풍선에 실시간으로 보여준다.
        startAIProgress(beforeHtml) {
            this.stopAIProgress();
            this.$nextTick(() => {
                const msg = this.messages[this.messages.length - 1];
                if (!msg || msg.role !== 'system' || !msg.isLoading) return;
                this.aiProgress = {
                    msg,
                    beforeHtml,
                    startedAt: Date.now(),
                    received: '',
                    timer: setInterval(() => this.renderAIProgress(), 1000)
                };
                this.renderAIProgress();
            });
        },
        renderAIProgress() {
            const progress = this.aiProgress;
            if (!progress) return;
            // 오류는 ChatModule.onError가 말풍선에 쓴다. 덮어쓰지 않는다
            if (this.generator.state === 'error') {
                if (this.$refs.designer) this.$refs.designer.cancelPreview();
                return this.stopAIProgress();
            }
            const seconds = Math.round((Date.now() - progress.startedAt) / 1000);
            progress.msg.content = formatFormProgress(describeFormStream(progress.received), seconds);
        },
        /** 받은 데까지의 응답으로 폼을 그린다(0.3초 간격). 확정은 다 받은 뒤 processResponse가 한다 */
        previewAIStream() {
            const progress = this.aiProgress;
            const designer = this.$refs.designer;
            if (!progress || !designer) return;
            const now = Date.now();
            if (progress.lastPreviewAt && now - progress.lastPreviewAt < 300) return;
            progress.lastPreviewAt = now;
            const html = buildStreamingFormHtml(progress.received, this.prevFormOutput);
            if (html && html !== progress.lastPreviewHtml) {
                progress.lastPreviewHtml = html;
                designer.previewAIResult(html);
            }
        },
        stopAIProgress() {
            const progress = this.aiProgress;
            if (!progress) return null;
            clearInterval(progress.timer);
            this.aiProgress = null;
            return { ...progress, seconds: Math.round((Date.now() - progress.startedAt) / 1000) };
        },

        /**
         * 받는 중인 AI 메시지 — 진행 말풍선만 갱신한다. 폼은 다 받은 뒤 한 번만 바꾼다
         * @param {*} response
         */
        async afterModelCreated(response) {
            if (this.aiStopped) return this.restoreStoppedMessage();
            if (this.aiProgress) {
                this.aiProgress.received = typeof response === 'string' ? response : this.generator.modelJson || '';
                this.renderAIProgress();
                this.previewAIStream();
                return;
            }
            this.processResponse(response);
        },

        /**
         * 최종적인 AI 메시지에서 JSON을 추출하기 위해서
         * @param {*} response
         */
        afterGenerationFinished(response) {
            if (this.aiStopped) return this.restoreStoppedMessage();
            const progress = this.stopAIProgress();
            if (progress) {
                // ChatModule은 JSON을 미리 파싱해 객체로 넘기기도 한다. 받은 원문으로 처리한다
                this.processResponse(this.generator.modelJson || (typeof response === 'string' ? response : ''));
                // JSON이 아니었거나 적용하지 못했으면 미리보기를 버리고 원래 폼으로
                if (this.$refs.designer) this.$refs.designer.cancelPreview();
                this.writeAIResult(progress);
            } else {
                this.processResponse(response);
            }
            if (this.type == 'simulation') {
                this.saveFormDefinition('afterGenerationFinished');
            }
        },

        /** 다 받은 뒤 말풍선: 무엇이 바뀌었는지 */
        writeAIResult(progress) {
            const msg = this.messages[this.messages.length - 1];
            if (!msg || !msg.jsonContent) return; // JSON이 아니면(되묻기 등) 받은 말을 그대로 둔다
            try {
                const afterHtml = this.$refs.designer ? this.$refs.designer.getFormHtml() : this.getFormHTML();
                msg.content = formatFormChange(summarizeFormChange(progress.beforeHtml, afterHtml), progress.seconds);
                if (this.aiSkippedEdits) {
                    msg.content += `\n\n⚠️ 수정 명령 ${this.aiSkippedEdits}건은 대상을 찾지 못해 적용하지 않았습니다. 다시 요청해 주세요.`;
                }
            } catch (error) {
                console.warn('[FormDefinition] 변경 요약 실패:', error);
                msg.content = `✅ 폼을 수정했습니다 · ${progress.seconds}초`;
            }
        },

        /**
         * AI의 결과물에서 JSON을 추출하고, 생성된 HTML을 보여주기 위해서
         */
        processResponse(response) {
            try {
                // AI의 응답에서 JSON을 추출하기 위해서
                let messageWriting = this.messages[this.messages.length - 1];
                messageWriting.jsonContent = this.extractLastJSON(response);
                messageWriting.content = messageWriting.content.replace(messageWriting.jsonContent, '');

                // messageWriting.jsonContent에 내용이 있어도, messageWriting.content에 내용이 없으면 메시지가 표시되지 않기때문에 추가함
                if (messageWriting.content.length == 0) messageWriting.content = ' ';

                // 생성된 HTML을 보여주기 위해서
                if (messageWriting.jsonContent && this.$refs.designer) {
                    // 새 편집기: AI 결과를 모델에 다시 읽는다. 실제로 바뀐 행만 새로 쓰인다
                    const designer = this.$refs.designer;
                    if (messageWriting.jsonContent.htmlOutput) {
                        designer.applyAIResult(messageWriting.jsonContent.htmlOutput);
                    } else if (messageWriting.jsonContent.modifications) {
                        // 명령 하나에 요소가 여럿이어도 모두 넣는다(applyFormModifications)
                        const { html, skipped, added } = applyFormModifications(
                            this.prevFormOutput,
                            messageWriting.jsonContent.modifications
                        );
                        if (skipped.length) console.warn('[FormDefinition] 대상을 찾지 못한 수정 명령:', skipped);
                        this.aiSkippedEdits = skipped.length;
                        designer.applyAIResult(html);
                        if (added) this.$emit('addedNewForm');
                        messageWriting.content = '요청하신 폼 수정이 완료되었습니다.';
                    } else console.error('알 수 없는 JSON 결과: ', JSON.stringify(messageWriting.jsonContent));
                    const html = designer.getFormHtml();
                    this.previewHTML = html;
                    this.$emit('update:modelValue', html);
                    this.isAIUpdated = true;
                } else if (messageWriting.jsonContent) {
                    if (messageWriting.jsonContent.htmlOutput) {
                        this.$emit('update:modelValue', messageWriting.jsonContent.htmlOutput);
                        this.applyNewSrcToMashup(this.loadHTMLToKEditorContent(messageWriting.jsonContent.htmlOutput));
                        this.previewHTML = this.keditorContentHTMLToDynamicFormHTML(messageWriting.jsonContent.htmlOutput);
                    } else if (messageWriting.jsonContent.modifications) {
                        const modifiedPrevFormOutput = this.getModifiedPrevFormOutput(messageWriting.jsonContent.modifications);
                        this.applyNewSrcToMashup(this.loadHTMLToKEditorContent(modifiedPrevFormOutput));
                        this.previewHTML = this.keditorContentHTMLToDynamicFormHTML(modifiedPrevFormOutput);
                        // 전체 생성(htmlOutput)과 같이 부모의 편집본도 갱신해야 미리보기·저장에 반영된다
                        this.$emit('update:modelValue', this.previewHTML);
                        messageWriting.content = '요청하신 폼 수정이 완료되었습니다.';
                    } else console.error('알 수 없는 JSON 결과: ', JSON.stringify(messageWriting.jsonContent));
                    this.isAIUpdated = true;
                }
            } catch (error) {
                console.log(error);
                let messageWriting = this.messages[this.messages.length - 1];
                messageWriting.content = '폼 수정중 오류가 발생하였습니다. 잠시 후 다시 시도해주세요.';
            }
        },

        /**
         * 모델 생성을 도중에 멈춰도 결과를 처리가 가능한 경우에는 최대한 처리시키기 위해서
         */
        afterModelStopped(response) {
            // AI 생성을 멈춘 경우, 아무것도 반영시키기 않기 위해서.
            // 멈춘 뒤에도 남은 응답이 onloadend로 들어오므로 그것도 반영하지 않는다
            const progress = this.stopAIProgress();
            if (this.$refs.designer) this.$refs.designer.cancelPreview();
            const msg = this.messages[this.messages.length - 1];
            const content =
                progress && msg && msg.role === 'system' ? `⏹ 생성을 멈췄습니다 · ${progress.seconds}초 — 폼은 바뀌지 않았습니다.` : null;
            if (content) msg.content = content;
            // ChatModule이 남은 조각으로 말풍선을 다시 쓰므로 멈춤 문구를 기억해 두고 되돌린다
            this.aiStopped = { msg, content };
            console.log(response);
        },
        restoreStoppedMessage() {
            const { msg, content } = this.aiStopped || {};
            if (msg && content) msg.content = content;
        },

        /**
         * AI가 생성한 결과물을 KEditor에 적합한 Html 형식으로 변환하기 위해서
         * @param {*} htmlTextToLoad KEditor에 적합하게 변환시킬 로드된 HTML 코드
         */
        loadHTMLToKEditorContent(htmlTextToLoad) {
            if (!htmlTextToLoad) return '';

            const getUUID = () => {
                const s4 = () => {
                    return Math.floor((1 + Math.random()) * 0x10000)
                        .toString(16)
                        .substring(1);
                };

                return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
            };

            // console.log('### 로드시킬 HTML 텍스트 ###');
            // console.log(htmlTextToLoad);

            const dom = new DOMParser().parseFromString(htmlTextToLoad, 'text/html');

            // AI가 생성한 <row-layout>은 name/alias/is_multidata_mode를 자기 자신에 직접 들고 있는데,
            // 아래 section 유효성 검사는 div.row의 부모가 곧바로 section이어야 한다고 가정하고 있어서
            // row-layout이 그대로 남아있으면 항상 '잘못된 구조'로 오인되어 row-layout과 section의 위치가 뒤바뀌는 문제가 있었음.
            // 따라서 KEditor에 넣기 전에 row-layout의 속성을 하위 div.row로 옮기고 row-layout 자체는 풀어버림
            dom.querySelectorAll('row-layout').forEach((rowLayout) => {
                const innerRow = rowLayout.querySelector(':scope > div.row');
                if (innerRow) {
                    innerRow.setAttribute('name', rowLayout.getAttribute('name') ?? '');
                    innerRow.setAttribute('alias', rowLayout.getAttribute('alias') ?? '');
                    innerRow.setAttribute('is_multidata_mode', rowLayout.getAttribute('is_multidata_mode') ?? 'false');
                }
                while (rowLayout.firstChild) {
                    rowLayout.parentNode.insertBefore(rowLayout.firstChild, rowLayout);
                }
                rowLayout.parentNode.removeChild(rowLayout);
            });

            // 만약 AI 생성오류 등으로 row안에 있는 col-sm-{숫자}의 총합이 12가 아니라면 모든 내용을 col-sm-12에 담아버림
            dom.querySelectorAll('div.row').forEach((row) => {
                let totalColSpaceSum = 0;
                $(row)
                    .children('[class^="col-sm-"]')
                    .each(function () {
                        var col = $(this)[0];

                        const colClassMatch = col.className.match(/col-sm-(\d+)/);
                        if (colClassMatch) {
                            const colSize = parseInt(colClassMatch[1], 10);
                            totalColSpaceSum += colSize;
                        }
                    });

                if (totalColSpaceSum !== 12) {
                    const newCol = document.createElement('div');
                    newCol.setAttribute('class', 'col-sm-12');

                    $(row)
                        .children('[class^="col-sm-"]')
                        .each(function () {
                            var col = $(this)[0];
                            Array.from(col.children).forEach((child) => {
                                newCol.appendChild(child);
                            });
                        });

                    row.innerHTML = '';
                    row.appendChild(newCol);
                }
            });

            // 만약, AI가 class='row' 바깥에 section으로 감싸라는 지시를 제대로 따르지 못했을 경우, 적절하게 처리하기 위해서
            let isInvalidSectionParsing = false;
            dom.querySelectorAll('div.row').forEach((row) => {
                if (row.parentElement.tagName.toLowerCase() !== 'section') {
                    isInvalidSectionParsing = true;
                }
            });

            dom.querySelectorAll('section').forEach((section) => {
                if (section.children.length !== 1) {
                    isInvalidSectionParsing = true;
                }
            });

            if (isInvalidSectionParsing) {
                // 특정 컴포넌트 안의 내용을 남겨주고, 그 컴포넌트를 제거 시킴
                const removeParentComponent = (parentComponent) => {
                    const parentSection = parentComponent.parentElement;
                    while (parentComponent.firstChild) {
                        parentSection.insertBefore(parentComponent.firstChild, parentComponent);
                    }
                    parentSection.removeChild(parentComponent);
                };

                const removeParentComponentByQuerySelector = (query) => {
                    dom.querySelectorAll(query).forEach((parentComponent) => {
                        removeParentComponent(parentComponent);
                    });
                };

                removeParentComponentByQuerySelector('section');

                dom.querySelectorAll('div.row').forEach((row) => {
                    const section = document.createElement('section');
                    row.parentElement.insertBefore(section, row);
                    section.appendChild(row);
                });
            }

            // 컨테이너인 경우, data-type 속성을 추가해서 KEditor에서 인식할 수 있도록 만들기 위해서서
            const nodes = dom.querySelectorAll('[class^="col-sm-"]');
            nodes.forEach((node) => {
                node.setAttribute('data-type', 'container-content');
            });

            // 컴포넌트인 경우, `vuemount_${getUUID()}`를 id를 가지는 div로 감싸도록 만들기
            // 해당 div마다 추후에 createApp으로 렌더링의 대상이되고, ref를 통해서 접근할 수 있도록 함
            const components = Array.from(dom.querySelectorAll('*')).filter((el) => el.tagName.toLowerCase().endsWith('-field'));
            components.forEach((component) => {
                // 속성중에서 name인 경우, [가-힣a-zA-Z0-9_\-. ]에 해당하는 문자가 아닌 경우, 전부 제거함
                ['name'].forEach((attr) => {
                    if (component.hasAttribute(attr)) {
                        const validChars = component.getAttribute(attr).match(/[가-힣a-zA-Z0-9_\-. ]/g);
                        const cleanedAttr = validChars ? validChars.join('') : attr;
                        component.setAttribute(attr, cleanedAttr);
                    }
                });

                // 속성중에서 items인 경우, 키와 값 각각이 [가-힣a-zA-Z0-9_\-. ]에 해당하는 문자가 아닌 경우, 전부 제거함
                if (component.hasAttribute('items')) {
                    if (component.getAttribute('items').length == 0) {
                        component.setAttribute('items', '[]');
                    } else if (component.getAttribute('items') !== '[]') {
                        try {
                            // AI가 메뉴얼을 따르지 않고, '[A, B, ..., C]'와 같이 나열 연산자를 사용할 경우, 제거시켜버름
                            let items = JSON.parse(
                                component
                                    .getAttribute('items')
                                    .replace(/'/g, '"')
                                    .replace(/[ ]*,[ ]*\.\.\.[ ]*,[ ]*/, ',')
                            );
                            let newItems = [];

                            items.forEach((item) => {
                                Object.keys(item).forEach((key) => {
                                    const value = item[key];
                                    const validKeyChars = key.match(/[가-힣a-zA-Z0-9_\-. ]/g);
                                    const validValueChars = value.match(/[가-힣a-zA-Z0-9_\-. ]/g);

                                    const cleanedKey = validKeyChars ? validKeyChars.join('') : '';
                                    const cleanedValue = validValueChars ? validValueChars.join('') : '';
                                    newItems.push({ [cleanedKey]: cleanedValue });
                                });
                            });

                            component.setAttribute('items', JSON.stringify(newItems));
                        } catch (error) {
                            console.log(error);
                            component.setAttribute('items', '[]');
                        }
                    }
                }

                const parent = document.createElement('div');
                parent.setAttribute('id', `vuemount_${getUUID()}`);

                if (this.generator.availableComponentTagNames.includes(component.tagName.toLowerCase())) {
                    component.parentNode.insertBefore(parent, component);
                    parent.appendChild(component);
                }

                // 메뉴얼에 없는 태그를 사용할 경우의 AI 예외 처리
                // AI가 메뉴얼을 따르지 않고 다른 태그를 사용했을 경우, 적절한 태그로 생성시켜버리기
                else {
                    // items 속성을 가지고 있는 경우 select-field로 치환
                    if (component.hasAttribute('items')) {
                        const selectField = document.createElement('select-field');
                        selectField.setAttribute('name', component.getAttribute('name') ?? 'name');
                        selectField.setAttribute('alias', component.getAttribute('alias') ?? 'alias');
                        selectField.setAttribute('items', component.getAttribute('items') ?? '[]');

                        component.parentNode.insertBefore(parent, component);
                        parent.appendChild(selectField);
                        component.parentNode.removeChild(component);
                    }
                    // name이나 alias 속성을 가지고 있는 경우 text-field로 치환
                    else if (component.hasAttribute('name') || component.hasAttribute('alias')) {
                        const textField = document.createElement('text-field');
                        textField.setAttribute('name', component.getAttribute('name') ?? 'name');
                        textField.setAttribute('alias', component.getAttribute('alias') ?? 'alias');

                        component.parentNode.insertBefore(parent, component);
                        parent.appendChild(textField);
                        component.parentNode.removeChild(component);
                    }
                    // 처리 방법 없음. 무시
                    else component.parentNode.removeChild(component);
                }
            });

            // Section이 없는 경우, Section으로 감싸서 새로 생성하고, 있는 경우 그대로 사용함
            if (dom.body.querySelectorAll('section').length == 0) {
                const rows = Array.from(dom.body.querySelectorAll('.row'));
                dom.body.innerHTML = rows
                    .map((row) => {
                        const section = document.createElement('section');
                        section.innerHTML = row.outerHTML;
                        return section.outerHTML;
                    })
                    .join('')
                    .replace(/&quot;/g, `'`);
            }

            // KEdtior에서 인식할 수 있도록 클래스 추가하기
            Array.from(dom.body.querySelectorAll('section')).forEach((section) => {
                section.setAttribute('class', 'keditor-container');
            });
            const loadedValidHTML = Array.from(dom.body.children)
                .map((section) => section.outerHTML)
                .join('')
                .replace(/&quot;/g, `'`)
                .replace('<br>', '\n');

            // console.log('### 로드된 유효 HTML 텍스트 ###');
            // console.log(loadedValidHTML);
            return loadedValidHTML;
        },

        /**
         * mashup에 새로운 src를 제공해서 재랜더링하기 위해서
         */
        applyNewSrcToMashup(kEditorInput) {
            this.kEditorInput = kEditorInput;
            this.mashupKey += 1;
        },

        /**
         * 수정 지시사항에 따라서 수정된 HTML 결과물을 반환시킴
         */
        /**
         * @param {boolean} raw true면 DOM 결과를 그대로 돌려준다(새 편집기).
         *   KEditor 경로의 문자열 치환(&quot; → ', 첫 <br> → 줄바꿈)은 손대지 않은 행의
         *   스크립트·items 값까지 바꾸므로 새 편집기에서는 쓰지 않는다.
         */
        getModifiedPrevFormOutput(modifications, raw = false) {
            const dom = new DOMParser().parseFromString(this.prevFormOutput, 'text/html');

            modifications.forEach((modification) => {
                if (modification.action === 'addAsChild') {
                    const parent = dom.querySelector(modification.targetCSSSelector);
                    const domToInsert = new DOMParser().parseFromString(modification.tagValue, 'text/html');
                    parent.appendChild(domToInsert.body.firstChild);
                } else if (modification.action === 'addAfter') {
                    const target = dom.querySelector(modification.targetCSSSelector);
                    const domToInsert = new DOMParser().parseFromString(modification.tagValue, 'text/html');
                    target.parentNode.insertBefore(domToInsert.body.firstChild, target.nextSibling);
                } else if (modification.action == 'replace') {
                    const target = dom.querySelector(modification.targetCSSSelector);
                    const domToReplace = new DOMParser().parseFromString(modification.tagValue, 'text/html');
                    target.parentNode.replaceChild(domToReplace.body.firstChild, target);
                } else if (modification.action === 'delete') {
                    const target = dom.querySelector(modification.targetCSSSelector);
                    target.parentNode.removeChild(target);
                }

                if (modification.action === 'addAsChild' || modification.action === 'addAfter') {
                    this.$emit('addedNewForm');
                }
            });

            if (raw) return dom.body.innerHTML;
            const modifiedPrevFormOutput = dom.body.outerHTML.replace(/&quot;/g, `'`).replace('<br>', '\n');
            console.log('### 수정된 이전 폼 출력 ###');
            console.log(modifiedPrevFormOutput);
            return modifiedPrevFormOutput;
        },

        /**
         * 편집에서 변경된 사항들을 Preview쪽으로 전달시키기 위해서
         */
        applyToPreviewTab() {
            var me = this;
            me.isShowPreview = false;
            me.$try({
                context: me,
                action: async () => {
                    // 편집기가 없는 미리보기에서 getFormHTML()은 DB 저장본을 돌려주므로 쓰지 않는다
                    if (me.$refs.designer) {
                        me.previewHTML = me.$refs.designer.getFormHtml();
                        return;
                    }
                    const sourceHtml = pickPreviewSource({
                        editorHtml: me.$refs.mashup ? me.getFormHTML() : '',
                        draftHtml: me.modelValue,
                        savedHtml: me.formHTML
                    });
                    me.previewHTML = sourceHtml ? me.keditorContentHTMLToDynamicFormHTML(sourceHtml) : '';
                    console.log('### 프리뷰 HTML ###');
                    console.log(me.previewHTML);
                },
                onFail: () => {
                    me.previewHTML = '';
                }
            });
            me.previewFormValues = {};

            me.$nextTick(() => {
                me.isShowPreview = true;
                me.dev.previewFormValues = JSON.stringify(me.previewFormValues);
            });
        }
    },

    beforeUnmount() {
        this.stopAIProgress();
    },

    async beforeRouteLeave(to, from, next) {
        if (this.$refs.designer) {
            if ((this.isAIUpdated || this.$refs.designer.isDirty()) && !window.confirm(this.$t('changePath'))) return next(false);
            return next();
        }
        // 에러로 인해서 로드가 되지 않을 경우, 별도의 검사를 수행하지 않음
        if (!this.$refs.mashup) return next();

        if (this.isAIUpdated || this.$refs.mashup.getKEditorContentHtml() != this.kEditorContent) {
            const answer = window.confirm(this.$t('changePath'));
            if (answer) {
                next();
            } else {
                next(false);
            }
        } else {
            next();
        }
    }
};
</script>

<style scoped>
/* 폼 편집/시뮬레이션: 놓인 칸이 좁으면(태블릿 패널·휴대폰) 채팅을 편집기 아래로 내려 폭을 모두 편집기에 준다.
   채팅 칸의 너비·높이는 인라인 스타일로 박혀 있어 !important 로 덮는다. */
.form-definition-root {
    container: fd-def / inline-size;
}
@container fd-def (max-width: 640px) {
    .form-definition-chat-box {
        flex-direction: column;
        flex-wrap: nowrap;
    }
    .form-definition-chat-box > .v-divider {
        display: none;
    }
    .form-definition-chat-box > .v-col {
        flex: 0 0 auto;
        width: 100%;
        max-width: 100% !important;
    }
    .form-definition-chat-box > .v-col:not(.form-definition-simulation-chat-box) {
        height: auto !important;
        max-height: 70vh;
    }
    .form-definition-chat-box > .form-definition-simulation-chat-box {
        height: 360px !important;
        border-top: 1px solid rgba(0, 0, 0, 0.12);
    }
}
.full-width {
    width: 100%;
}
</style>
