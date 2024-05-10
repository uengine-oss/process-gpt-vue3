<template>
    <v-card elevation="10" style="background-color: rgba(255, 255, 255, 0)">
        <AppBaseCard>
            <template v-slot:leftpart>
                <div class="no-scrollbar">
                    <Chat
                        :chatInfo="chatInfo"
                        :messages="messages"
                        :userInfo="userInfo"
                        type="form"
                        @onClickSaveFormButton="openSaveDialog"
                        @sendMessage="beforeSendMessage"
                        @sendEditedMessage="sendEditedMessage"
                        @stopMessage="stopMessage"
                    ></Chat>
                </div>
            </template>
            <template v-slot:rightpart>
                <v-tabs v-model="currentTabName" style="position: fixed; z-index: 999" class="text-black" fixed-tabs>
                    <v-tab value="edit">편집</v-tab>
                    <v-tab value="preview">미리보기</v-tab>
                </v-tabs>
                <v-window v-model="currentTabName" class="fill-height">
                    <v-window-item value="edit" class="fill-height mt-15" style="overflow-y: auto">
                        <mashup
                            v-if="isShowMashup"
                            ref="mashup"
                            v-model="kEditorInput"
                            :key="mashupKey"
                            @onSaveFormDefinition="saveFormDefinition"
                            @onInitKEditorContent="updateKEditorContentBeforeSave"
                        />
                        <div v-else class="d-flex align-center justify-center fill-height">
                            <v-progress-circular color="primary" indeterminate></v-progress-circular>
                        </div>
                    </v-window-item>

                    <v-window-item value="preview" class="fill-height mt-15 pa-5" style="overflow-y: auto">
                        <template v-if="isShowPreview">
                            <DynamicForm ref="dynamicForm" :formHTML="previewHTML" v-model="previewFormValues"></DynamicForm>

                            <template v-if="dev.isDevMode">
                                <v-textarea label="previewFormValuesToTest" rows="10" v-model="dev.previewFormValues"></v-textarea>
                                <v-btn color="primary" class="full-width my-5" @click="onClickPreviewApplyButton">적용</v-btn>
                            </template>

                            <v-btn color="primary" class="full-width" @click="onClickPreviewSubmitButton">제출</v-btn>
                        </template>
                        <div v-else class="d-flex align-center justify-center fill-height">
                            <v-progress-circular color="primary" indeterminate></v-progress-circular>
                        </div>
                    </v-window-item>
                </v-window>
            </template>

            <template v-slot:mobileLeftContent>
                <Chat
                    :chatInfo="chatInfo"
                    :messages="messages"
                    :userInfo="userInfo"
                    type="form"
                    @onClickSaveFormButton="openSaveDialog"
                    @sendMessage="beforeSendMessage"
                    @sendEditedMessage="sendEditedMessage"
                    @stopMessage="stopMessage"
                ></Chat>
            </template>
        </AppBaseCard>
    </v-card>

    <v-dialog v-model="isOpenSaveDialog">
        <form-design-save-panel @onClose="isOpenSaveDialog = false" @onSave="tryToSaveFormDefinition" :savedId="(loadFormId === 'chat') ? null : loadFormId">
        </form-design-save-panel>
    </v-dialog>
</template>

<script>
import * as jsondiff from 'jsondiffpatch';
import ChatDetail from '@/components/apps/chats/ChatDetail.vue';
import ChatListing from '@/components/apps/chats/ChatListing.vue';
import ChatProfile from '@/components/apps/chats/ChatProfile.vue';
import Mashup from '@/components/designer/Mashup.vue';
import AppBaseCard from '@/components/shared/AppBaseCard.vue';
import FormDesignSavePanel from '@/components/designer/FormDesignSavePanel.vue';
import ChatModule from './ChatModule.vue';
import ChatGenerator from './ai/FormDesignGenerator';
import Chat from './ui/Chat.vue';
import DynamicForm from '@/components/designer/DynamicForm.vue';

var jsondiffpatch = jsondiff.create({
    objectHash: function (obj, index) {
        return '$$index:' + index;
    }
});

export default {
    mixins: [ChatModule],
    name: 'UIDefinitionChat',
    components: {
        Chat,
        AppBaseCard,
        ChatListing,
        ChatDetail,
        ChatProfile,
        Mashup,
        ChatGenerator,
        FormDesignSavePanel,
        DynamicForm
    },
    data: () => ({
        path: 'form_def',
        chatInfo: {
            title: 'uiDefinition.cardTitle',
            text: 'uiDefinition.uiDefinitionExplanation'
        },

        kEditorInput: ``, // Mashup 컴포넌트의 KEditor을 업데이트하기 위해서 전달되는 값
        mashupKey: 0, // kEditorInput가 변경되었을 경우, Mashup 컴포넌트를 다시 렌더링하기 위해서

        prevFormOutput: '', // 폼 디자이너에게 이미 이전에 생성된 HTML 결과물을 전달하기 위해서
        prevMessageFormat: '', // 사용자가 KEditor를 변경할때마다 해당 포맷을 기반으로 System 메세지를 재구축해서 보내기 위해서

        storedFormDefHTML: "",
        isOpenSaveDialog: false,
        currentTabName: '',
        isShowMashup: false,

        previewHTML: '',
        previewFormValues: {},
        isShowPreview: false,

        dev: {
            isDevMode: window.localStorage.getItem('isDevMode') === 'true',
            previewFormValues: ''
        },
        loadFormId: '',

        kEditorContentBeforeSave: "",
        isAIUpdated: false,
        isRoutedWithUnsaved: false
    }),
    async created() {
        this.generator = new ChatGenerator(this, {
            isStream: true,
            preferredLanguage: 'Korean'
        });
        await this.init();
    },
    watch: {
        /**
         * URL에서 폼을 가리키는 ID가 변경되었을 경우, 재업데이트를 위해서
         */
        $route: {
            deep: true,
            handler(newVal, oldVal) {
                if (!newVal.path.startsWith('/ui-definitions')) return;

                if(this.isRoutedWithUnsaved) {
                    this.isRoutedWithUnsaved = false;
                    return;
                }

                if (newVal.path !== oldVal.path) {
                    if(this.$refs.mashup) {
                        if(this.isAIUpdated || (this.$refs.mashup.getKEditorContentHtml() != this.kEditorContentBeforeSave)) {
                            const answer = window.confirm('You have unsaved changes. Are you sure you want to leave?');
                            if (answer)
                                this.loadData();
                            else {
                                this.isRoutedWithUnsaved = true;
                                this.$router.push(oldVal.path);
                            }
                        }
                        else
                            this.loadData();
                    }
                    else
                        this.loadData();
                }
                else this.isShowMashup = true;
            }
        },

        currentTabName: {
            handler() {
                if (this.currentTabName === 'edit') $("div[id^='keditor-content-area-']").css('display', 'block');
                // 미리보기에 KEditor에서 편집한 HTML을 로드시키기 위해서
                else {
                    $("div[id^='keditor-content-area-']").css('display', 'none');
                    this.applyToPreviewTab();
                }
            }
        }
    },
    methods: {
        updateKEditorContentBeforeSave(kEditorContent) {
            this.kEditorContentBeforeSave = kEditorContent;
        },

        openSaveDialog() {
            this.isOpenSaveDialog = true;
        },

        /**
         * ID 정보를 제공하고, 'Save' 버튼을 누를 경우, 최종 결과를 DB에 저장시키기 위해서
         */
        async tryToSaveFormDefinition({ id }) {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    const kEditorContentHTML = me.$refs.mashup.getKEditorContentHtml();
                    const DynamicFormHTML = me.keditorContentHTMLToDynamicFormHTML(kEditorContentHTML);

                    await me.saveFormDefinition({
                        id: id,
                        html: DynamicFormHTML
                    });
                },
                successMsg: '저장되었습니다.'
            });
        },

        /**
         * KEditor에서 추출한 내용을 실제로 DynamicForm 컴포넌트에 적용할 수 있는 형태로 변환시키기 위해서
         */
        keditorContentHTMLToDynamicFormHTML(html) {
            const dom = new DOMParser().parseFromString(html, 'text/html');


            // 이름 중복 여부를 검사하기 위해서
            const nameSet = new Set();
            (dom.querySelectorAll('[name]')).forEach((el) => {
                const name = el.getAttribute('name');
                if(!name || name.length <= 0) return;

                if (nameSet.has(name)) {
                    throw new Error(`'${name}' 이름이 중복되어 있습니다.`);
                }
                nameSet.add(name);
            });


            const rows = dom.querySelectorAll('div.row');

            // rows의 is_multidata_mode가 true인 경우, 그 안에는 code-field가 존재하면 안되며, 그럴경우, 예외 발생
            for(let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const isMultiDataMode = row.getAttribute('is_multidata_mode');
                if (isMultiDataMode === "true") {
                    const codeField = row.querySelector('code-field');
                    if(codeField) throw new Error(`multidataMode가 설정된 레이아웃 안에 code-field가 존재할 수 없습니다.`);
                }
            }
            
            rows.forEach(row => {
                const isMultiDataMode = row.getAttribute('is_multidata_mode');
                if (!isMultiDataMode || (isMultiDataMode === 'false')) {
                    const newRow = document.createElement('row-layout');
                    

                    newRow.setAttribute('name', row.getAttribute('name') ?? "");
                    newRow.setAttribute('alias', row.getAttribute('alias') ?? "");
                    newRow.setAttribute('is_multidata_mode', row.getAttribute('is_multidata_mode') ?? "false");

                    newRow.setAttribute('v-model', 'formValues');
                    newRow.setAttribute('v-slot', 'slotProps');


                    const innerRow = document.createElement('div');
                    innerRow.setAttribute('class', 'row');

                    Array.from(row.childNodes).forEach(child => {
                        innerRow.appendChild(child);
                    });

                    innerRow.querySelectorAll('[name]').forEach(field => {
                        if(field.tagName.toLowerCase() === "code-field") {
                            const name = field.getAttribute('name');
                            field.setAttribute('v-model', `codeInfos['${name}']`);

                            const event_type = field.getAttribute('event_type');
                            if(event_type === "click") {
                                field.setAttribute('v-on:on_click', `executeCode('${name}')`);
                            }
                        } else {
                            const name = field.getAttribute('name');
                            field.setAttribute('v-model', `slotProps.modelValue['${name}']`);
                        }
                    });

                    newRow.appendChild(innerRow);


                    row.parentNode.replaceChild(newRow, row);
                } else {
                    if((!row.getAttribute('name')) || (row.getAttribute('name').length <= 0)) {
                        throw new Error(`multidataMode가 설정된 레이아웃에 'name' 속성이 없습니다.`);
                    }


                    const newRow = document.createElement('row-layout');

                    newRow.setAttribute('name', row.getAttribute('name'));
                    newRow.setAttribute('alias', row.getAttribute('alias') ?? "");
                    newRow.setAttribute('is_multidata_mode', row.getAttribute('is_multidata_mode'));

                    newRow.setAttribute('v-model', 'formValues');
                    newRow.setAttribute('v-slot', 'slotProps');

                    newRow.innerHTML = `<div v-for="(item, index) in slotProps.modelValue" :key="index">
    <row-layout-item-head :index="index" @on_delete_item="slotProps.deleteItem(index)"></row-layout-item-head>
    <div class="row">
    ${row.innerHTML}
    </div>
</div>`


                    newRow.querySelectorAll('[name]').forEach(field => {
                        const name = field.getAttribute('name');
                        field.setAttribute('v-model', `item['${name}']`);
                    });

                    row.parentNode.replaceChild(newRow, row);
                }
            });


            return dom.body.innerHTML;
        },

        /**
         * DB에서 로드된 내용을 KEditor에 적용할 수 있는 형태로 바꾸기 위해서
         */
        dynamicFormHTMLToKeditorContentHTML(html) {
            const dom = new DOMParser().parseFromString(html, 'text/html');


            const rows = dom.querySelectorAll('row-layout');
            rows.forEach(row => {
                const isMultiDataMode = row.getAttribute('is_multidata_mode');
                if (!isMultiDataMode || (isMultiDataMode === 'false')) {
                    const newRow = document.createElement('div');
                    

                    newRow.setAttribute('name', row.getAttribute('name') ?? "");
                    newRow.setAttribute('alias', row.getAttribute('alias') ?? "");
                    newRow.setAttribute('is_multidata_mode', row.getAttribute('is_multidata_mode') ?? "false");

                    newRow.setAttribute('class', 'row');


                    Array.from(row.firstChild.childNodes).forEach(child => {
                        newRow.appendChild(child);
                    });

                    newRow.querySelectorAll('[v-model]').forEach(field => {
                        field.removeAttribute('v-model');
                    });

                    newRow.querySelectorAll('*').forEach(field => {
                        Array.from(field.attributes).forEach(attr => {
                            if (attr.name.startsWith('v-on:')) {
                                field.removeAttribute(attr.name);
                            }
                        });
                    });


                    row.parentNode.replaceChild(newRow, row);
                } else {
                    const newRow = document.createElement('div');
                    

                    newRow.setAttribute('name', row.getAttribute('name') ?? "");
                    newRow.setAttribute('alias', row.getAttribute('alias') ?? "");
                    newRow.setAttribute('is_multidata_mode', row.getAttribute('is_multidata_mode') ?? "false");

                    newRow.setAttribute('class', 'row');


                    row.querySelectorAll('[class^="col-sm-"]').forEach(child => {
                        newRow.appendChild(child);
                    });

                    newRow.querySelectorAll('[v-model]').forEach(field => {
                        field.removeAttribute('v-model');
                    });

                    newRow.querySelectorAll('*').forEach(field => {
                        Array.from(field.attributes).forEach(attr => {
                            if (attr.name.startsWith('v-on:')) {
                                field.removeAttribute(attr.name);
                            }
                        });
                    });


                    row.parentNode.replaceChild(newRow, row);
                }
            });


            return dom.body.innerHTML;
        },

        /**
         * 'Save' 버튼을 누를 경우, 최종 결과를 DB에 저장하기 위해서
         */
        async saveFormDefinition({ id, html }) {
            const isNewSave = this.loadFormId !== id;

            if (isNewSave) {
                try {
                    const isFormAlreadyExist = await this.backend.getRawDefinition(id, { type: 'form' });
                    if (isFormAlreadyExist) {
                        if (!confirm(`'${id}'는 이미 존재하는 폼 디자인 ID 입니다! 그래도 저장하시겠습니까?`)) return;
                    }
                } catch (error) {

                }
            }

            await this.backend.putRawDefinition(html, id, { type: 'form' });
            this.isOpenSaveDialog = false;

            this.kEditorContentBeforeSave = this.$refs.mashup.getKEditorContentHtml();
            this.isAIUpdated = false

            if (isNewSave) {
                await this.$router.push(`/ui-definitions/${id}`);
                window.location.reload();
            }
        },

        onClickPreviewSubmitButton() {
            const error = this.$refs.dynamicForm.validate()
            if (error && error.length > 0) alert(error)

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
            this.loadFormId = this.$route.params.pathMatch.join('/');
            if (this.loadFormId.startsWith('/')) {
                this.loadFormId = this.loadFormId.substring(1);
            } 

            this.isAIUpdated = false;
            this.messages = [];
            if (this.loadFormId && this.loadFormId != 'chat') {
                try {
                    this.storedFormDefHTML = (await this.backend.getRawDefinition(this.loadFormId, { type: 'form' }));
                } catch(error) {
                    alert(`'${this.loadFormId}' ID 를 가지는 폼 디자인 정보가 없습니다! 새 폼 만들기 화면으로 이동됩니다.`);
                    this.$router.push(`/ui-definitions/chat`);
                    this.isShowMashup = true;
                    return;
                }

                const kEditorContentHTML = this.dynamicFormHTMLToKeditorContentHTML(this.storedFormDefHTML);
                const kEditorContent = this.loadHTMLToKEditorContent(kEditorContentHTML);
                this.applyNewSrcToMashup(kEditorContent);

                this.isShowMashup = true;
            } else {
                if(this.$refs.mashup) this.$refs.mashup.clearStat();
                this.isShowMashup = true;
            }
        },

        /**
         * AI에 메세지를 보내기 위해서 사용
         * @param {*} newMessage
         */
        beforeSendMessage(newMessage) {
            this.prevFormOutput = this.$refs.mashup.getKEditorContentHtml();
            newMessage.mentionedUsers = null;
            this.generator.sendMessageWithPrevFormOutput(newMessage);
        },

        /**
         * AI 메세지에서 실시간으로 JSON을 추출하기 위해서
         * @param {*} response
         */
        async afterModelCreated(response) {
            this.processResponse(response);
        },

        /**
         * 최종적인 AI 메세지에서 JSON을 추출하기 위해서
         * @param {*} response
         */
        afterGenerationFinished(response) {
            this.processResponse(response);
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

                // 생성된 HTML을 보여주기 위해서
                if (messageWriting.jsonContent) {
                    if (messageWriting.jsonContent.htmlOutput) {
                        this.applyNewSrcToMashup(this.loadHTMLToKEditorContent(messageWriting.jsonContent.htmlOutput));
                    } else if (messageWriting.jsonContent.modifications) {
                        const modifiedPrevFormOutput = this.getModifiedPrevFormOutput(messageWriting.jsonContent.modifications);
                        this.applyNewSrcToMashup(this.loadHTMLToKEditorContent(modifiedPrevFormOutput));
                    } else console.error('알 수 없는 JSON 결과: ', JSON.stringify(messageWriting.jsonContent));
                    this.isAIUpdated = true;
                }
            } catch (error) {
                console.log(error);
            }
        },

        /**
         * 모델 생성을 도중에 멈춰도 결과를 처리가 가능한 경우에는 최대한 처리시키기 위해서
         */
        afterModelStopped(response) {
            // AI 생성을 멈춘 경우, 아무것도 반영시키기 않기 위해서
            console.log(response);
        },

        /**
         * 마지막 최종 결과 Html이 표시된 JSON을 추출하기 위해서
         */
        extractLastJSON(inputString) {
            const textFragments = inputString.split('```');
            for (let i = textFragments.length - 1; i >= 0; i--) {
                const textFragment = textFragments[i];
                if (!textFragment.includes('{') || !textFragment.includes('}')) continue;
                if (!textFragment.includes('htmlOutput') && !textFragment.includes('modifications')) continue;
                const isFirstCreated = textFragment.includes('htmlOutput');

                let fragmentToParse = '';
                try {
                    const processedFragment = textFragment
                        .match(/\{[\s\S]*\}/)[0]
                        .replaceAll('\n', '')
                        .replaceAll('`', `"`); // JSON에서 유효하지 않은 '\n', '`' 문자 제거

                    // AI가 잘못된 응답을 냈을 경우, 이를 대응하기 위한 수단들

                    // AI 응답이 `"` 문자열을 '\'로 파싱하지 않은 경우, 수동으로 파싱하기 위해서
                    if (isFirstCreated) {
                        const matchedHtmlOutput = processedFragment.match(/"htmlOutput"\s*:\s*"(.*)".*}/)[1];
                        if (matchedHtmlOutput.includes(`\\"`)) fragmentToParse = processedFragment;
                        else fragmentToParse = processedFragment.replace(matchedHtmlOutput, matchedHtmlOutput.replaceAll(`"`, `\\"`));
                    } else {
                        const matchedItems = [...processedFragment.matchAll(/items='\[(.*?)\]'>/g)].map((g) => g[1]);

                        fragmentToParse = processedFragment;
                        if (matchedItems) {
                            for (let j = 0; j < matchedItems.length; j++) {
                                const matchedItem = matchedItems[j];
                                if (!matchedItem.includes(`\\"`))
                                    fragmentToParse = fragmentToParse.replace(matchedItem, matchedItem.replaceAll(`"`, `\\"`));
                            }
                        }
                    }

                    // AI 응답이 items에서 items='[{'남자':'male'},{'여자':'female'}' 와 같이 '안에서 "로 감싸지 않은 경우, 이를 대응하기 위해서
                    const matchedItems = [...fragmentToParse.matchAll(/items='\[(.*?)\]'>/g)].map((g) => g[1]);
                    if (matchedItems) {
                        for (let j = 0; j < matchedItems.length; j++) {
                            const matchedItem = matchedItems[j];
                            if (matchedItem.includes(`'`)) {
                                fragmentToParse = fragmentToParse.replace(matchedItem, matchedItem.replaceAll(`'`, `\\"`));
                            }
                        }
                    }
                } catch (error) {
                    console.log('### 유효 문자열을 JSON에 적합한 문자열로 변환시키는 과정에서 오류 발생! ###');
                    console.log(error);
                    console.log(textFragment);
                    return null;
                }

                try {
                    return JSON.parse(fragmentToParse);
                } catch (error) {
                    console.log('### JSON 문자열을 최종 파싱하는 과정에서 오류 발생! ###');
                    console.log(error);
                    console.log(textFragment);
                    console.log(fragmentToParse);
                    return null;
                }
            }

            return null;
        },

        /**
         * AI가 생성한 결과물을 KEditor에 적합한 Html 형식으로 변환하기 위해서
         * @param {*} htmlTextToLoad KEditor에 적합하게 변환시킬 로드된 HTML 코드
         */
        loadHTMLToKEditorContent(htmlTextToLoad) {
            console.log('### 로드시킬 HTML 텍스트 ###');
            console.log(htmlTextToLoad);

            const dom = new DOMParser().parseFromString(htmlTextToLoad, 'text/html');

            // 컨테이너인 경우, data-type 속성을 추가해서 KEditor에서 인식할 수 있도록 만들기 위해서서
            const nodes = dom.querySelectorAll('[class^="col-sm-"]');
            nodes.forEach((node) => {
                node.setAttribute('data-type', 'container-content');
            });

            // 컴포넌트인 경우, `vuemount_${crypto.randomUUID()}`를 id를 가지는 div로 감싸도록 만들기
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

                const parent = document.createElement('div');
                parent.setAttribute('id', `vuemount_${crypto.randomUUID()}`);

                if (this.generator.avaliableComponentTagNames.includes(component.tagName.toLowerCase())) {
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
            let targetSections = null;
            if(dom.body.querySelectorAll("section").length == 0) {
                const rows = Array.from(dom.body.querySelectorAll('.row'));
                dom.body.innerHTML = rows.map(row => {
                    const section = document.createElement('section');
                    section.innerHTML = row.outerHTML;
                    return section.outerHTML;
                }).join('').replace(/&quot;/g, `'`);
            }
            
            targetSections = Array.from(dom.body.querySelectorAll("section"));
            

            // KEdtior에서 인식할 수 있도록 클래스 추가하기
            targetSections.forEach(section => {
                section.setAttribute('class', 'keditor-ui keditor-container-inner');
            });
            const loadedValidHTML = targetSections.map(section => section.outerHTML).join('').replace(/&quot;/g, `'`)


            console.log('### 로드된 유효 HTML 텍스트 ###');
            console.log(loadedValidHTML);
            return loadedValidHTML;
        },

        /**
         * mashup에 새로운 src를 제공해서 재랜더링하기 위해서
         */
        applyNewSrcToMashup(kEditorInput) {
            this.kEditorInput = kEditorInput;
            this.mashupKey += 1;

            if (this.currentTabName === 'preview')
                this.$nextTick(() => {
                    this.applyToPreviewTab();
                });
        },

        /**
         * 수정 지시사항에 따라서 수정된 HTML 결과물을 반환시킴
         */
        getModifiedPrevFormOutput(modifications) {
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
            });

            const modifiedPrevFormOutput = dom.body.outerHTML.replace(/&quot;/g, `'`);
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
                    me.previewHTML = me.keditorContentHTMLToDynamicFormHTML(me.$refs.mashup.getKEditorContentHtml());
                },
                onFail: () => {
                    me.previewHTML = '';
                }
            });
            me.previewFormValues = {};
            me.isShowPreview = true;

            me.$nextTick(() => {
                me.dev.previewFormValues = JSON.stringify(me.previewFormValues);
            });
        }
    },

    beforeDestroy() {
        this.kEditorInput = null;
    },

    async beforeRouteLeave(to, from, next) {
        if(this.isAIUpdated || (this.$refs.mashup.getKEditorContentHtml() != this.kEditorContentBeforeSave)) {
            const answer = window.confirm('You have unsaved changes. Are you sure you want to leave?');
            if (answer) {
                next();
            } else {
                next(false);
            }
        } else {
            next();
        }
    },
};
</script>

<style scoped>
.full-width {
    width: 100%;
}
</style>
