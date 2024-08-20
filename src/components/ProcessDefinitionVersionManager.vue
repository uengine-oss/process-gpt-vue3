<template>
    <v-dialog v-model="isOpen" max-width="100%" style="height: -webkit-fill-available;" persistent>
        <v-card flat>
            <v-card-title class="d-flex">
                <div>
                    <h5 class="text-h5">버전 관리 [{{ currentVersionName }} ({{ currentVersion }})]</h5>
                    <v-progress-circular v-if="loading" color="primary" :size="25" indeterminate
                        style="margin-left: 5px;"></v-progress-circular>
                    <div v-if="currentVersionMessage" class="text-body-1 mt-1">
                        {{ currentVersionMessage }}
                    </div>
                </div>
                <v-btn icon class="ml-auto" variant="text" @click="close" density="compact">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </v-card-title>

            <div class="d-flex px-5">
                <div class="mx-2">
                    <v-switch v-model="showXML" :label="showXML ? 'XML' : 'BPMN'" density="compact" color="primary" 
                        hide-details></v-switch>
                </div>
                <v-btn @click="downloadXML" variant="text" height="40" class="mx-2">
                    다운로드
                </v-btn>
                <v-btn @click="changeXML" variant="text" color="primary" :disabled="loading" height="40">
                    해당 버전으로 변경
                </v-btn>
            </div>

            <v-card-text style="height: 500px;">
                <div v-if="showXML" style="height: 100%; overflow-y: scroll;">
                    <div class="diff-titles">
                        <div class="diff-title" v-if="currentXML && beforeXML">Previous XML
                            <v-btn size="x-small" @click="copyToClipboard(beforeXML)">
                                <v-icon x-small>mdi-content-copy</v-icon>
                            </v-btn>
                        </div>
                        <div class="diff-title current-xml-title">Current XML
                            <v-btn size="x-small" @click="copyToClipboard(currentXML)">
                                <v-icon x-small>mdi-content-copy</v-icon>
                            </v-btn>
                        </div>
                    </div>
                    <div v-if="currentXML && beforeXML">
                        <vuediff :prev="beforeXML" :current="currentXML" mode="split" theme="light"
                            language="xml" />
                    </div>
                    <div v-else style="margin-top: 15px;">
                        <pre><code class="xml">{{ currentXML }}</code></pre>
                    </div>
                </div>
                <div v-else style="height: 100%;">
                    <process-definition class="process-definition-resize" :bpmn="currentXML" :isViewMode="true"
                        :key="key"></process-definition>
                </div>
            </v-card-text>
            <v-card-actions>
                <v-slider v-model="currentIndex" step="1" min="0" :max="lists.length - 1" show-ticks="always"
                    tick-size="4" @end="handleBeforeChange" :hide-details="true"
                    style="padding: 0; margin-right: 20px; margin-left: 30px;"></v-slider>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script>
import { Icon } from '@iconify/vue';

import ProcessDefinition from '@/components/ProcessDefinition.vue';
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

// import 'vue-diff/dist/index.css';
export default {
    name: 'ProcessDefinitionVersionManager',
    components: {
        Icon,
        ProcessDefinition,
    },
    props: {
        open: Boolean,
        process: Object,
        type: String
    },
    data: () => ({
        basePath: 'proc_def_arcv',
        isOpen: false, // inner var

        // xml
        showXML: false, // xml or bpmn
        key: 0, // update component
        // slider
        currentIndex: 0,
        lists: [],
        loading: false,
    }),
    computed: {
        beforeXML() {
            if (this.lists.length > 0 && this.lists[this.currentIndex - 1]) {
                return this.lists[this.currentIndex - 1].xml
            }
            return null;
        },
        currentXML() {
            if (this.lists.length > 0 && this.lists[this.currentIndex]) {
                return this.lists[this.currentIndex].xml
            }
            return null;
        },
        currentVersionName() {
            if (this.lists.length > 0 && this.lists[this.currentIndex]) {
                return this.lists[this.currentIndex].name
            }
            return null;
        },
        currentVersion() {
            if (this.lists.length > 0 && this.lists[this.currentIndex]) {
                return this.lists[this.currentIndex].version
            }
            return null;
        },
        currentVersionMessage() {
            if (this.lists.length > 0 && this.lists[this.currentIndex]) {
                return this.lists[this.currentIndex].message
            }
            return null;
        },
    },
    watch: {
        "open": function (newVal) {
            if (newVal) {
                this.currentIndex = 0 // init
                this.load();
            } else {
                this.isOpen = false
            }
        },
    },
    created() {
    },
    methods: {
        async load() {
            var me = this
            me.loading = true
            let result = await backend.getDefinitionVersions(me.process.processDefinitionId, {
                key: 'version, message',
                sort: 'asc',
                orderBy: 'timeStamp',
                type: me.type
            });
            me.lists = result.map(item => ({ ...item, xml: null }));
            me.lists[0].xml = await me.loadXMLOfVer(me.lists[0].version)
            me.isOpen = true
            me.loading = false
        },
        async handleBeforeChange(index) {
            var me = this
            me.loading = true
            if (!me.lists[index]) return;
            if (!me.lists[index].xml) me.lists[index].xml = await me.loadXMLOfVer(me.lists[index].version)
            me.loading = false
            me.key++
        },
        changeXML() {
            this.$emit('changeXML', { "id": this.process.processDefinitionId, "name": this.currentVersionName, "xml": this.currentXML })
        },
        downloadXML() {
            var me = this;
            if (me.currentXML) {
                const blob = new Blob([me.currentXML], { type: 'application/xml' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `${me.currentVersionName}-${me.currentVersion}.xml`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                alert('선택된 버전의 XML 데이터가 없습니다.');
            }
        },
        async loadXMLOfVer(version) {
            var me = this
            let result =  await backend.getDefinitionVersions(me.process.processDefinitionId, {
                key: 'snapshot',
                sort: 'asc',
                size: 1,
                type: me.type,
                match: { 'version': version }
            });
            if (result[0]) {
                return result[0].snapshot
            }
            return null
        },
        copyToClipboard(text) {
            if (navigator.clipboard) { // 최신 브라우저 API 지원 여부 확인
                navigator.clipboard.writeText(text).then(() => {
                    alert('클립보드에 복사되었습니다.'); // 성공 메시지
                }, (err) => {
                    console.error('클립보드 복사 실패:', err); // 실패 시 로그
                });
            } else {
                // 브라우저가 clipboard API를 지원하지 않는 경우의 대체 방법
                const textarea = document.createElement('textarea');
                textarea.value = text;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                alert('클립보드에 복사되었습니다.'); // 성공 메시지
            }
        },
        close() {
            this.$emit('close', false)
        },

    }
};
</script>

<style scoped>
.process-definition-resize {
    width: 100%;
    height: 100%;
}

@media only screen and (max-width:1279px) {
    .process-definition-resize {
        width: 100%;
        height: calc(100% - 38px) !important;
    }
}

.diff-titles {
    display: flex;
    justify-content: space-between;
}

.diff-title {
    font-size: 16px;
    font-weight: bold;
}

.current-xml-title {
    text-align: left;
    /* 텍스트를 좌측 정렬 */
    width: 50%;
    /* 부모 요소의 전체 너비를 차지하도록 설정 */
}
</style>
