<template>
    <v-dialog v-model="isOpen" max-width="100%" style="height: -webkit-fill-available;" persistent
        :fullscreen="isMobile"
    >
        <v-card flat>
            <v-card-title class="d-flex pa-4 pb-0">
                 <h5 class="text-h5" :class="{ 'text-truncate': isMobile }" :style="{ maxWidth: isMobile ? '280px' : 'none' }">{{ currentVersionName }}</h5>
                <v-progress-circular v-if="loading" color="primary" :size="25" indeterminate
                    style="margin-left: 5px;"
                ></v-progress-circular>
                <v-btn icon class="ml-auto" variant="text" @click="close" density="compact">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </v-card-title>
            <div class="pa-4 pt-0 pb-0"
                style="height: 10vh;
                overflow: auto;"
            >
                <v-alert density="compact"
                    variant="tonal"
                    color="gray"
                >
                    <template v-slot:title>
                        <span style="color: black;">{{ $t('ProcessDefinitionVersionManager.description') }}</span>
                    </template>
                    <div v-if="currentVersionMessage"
                        class="text-body-1 text-gray mt-1"
                    >{{ currentVersionMessage }}
                    </div>
                </v-alert>
            </div>

            <div class="d-flex pa-4 pt-2 align-center"
                :class="showXML ? '' : 'pb-0'"
            >
                <div class="mx-2">
                    <v-switch v-model="showXML" 
                        class="version-history-switch"
                        :label="showXML ? 'XML' : 'BPMN'"
                        density="compact"
                        color="primary" 
                        hide-details
                    ></v-switch>
                </div>
                <v-btn @click="downloadXML" variant="text" class="mx-2">
                    {{ $t('ProcessDefinitionVersionManager.download') }}
                </v-btn>
                <v-btn @click="changeXML" variant="text" color="primary" :disabled="loading">
                    {{ currentSelectedVersion }} 버전으로 변경
                </v-btn>
            </div>

            <v-card-text :class="showXML ? 'pa-4 pt-6 pb-0' : 'pa-4'"
                :style="showXML ? 'height: calc(100vh - 280px);' : 'height: 100vh;'"
            >
                <div v-if="showXML" style="height: 100%; position: relative;">
                    <div class="version-manager-version-number" style="left: 0px; top: -32px;">버전: {{ currentSelectedVersion }}</div>
                    <div class="version-manager-version-number" style="left: 50%; top: -32px;">버전: {{ latestVersion }}</div>
                    <vuediff :prev="currentSelectedXML || ''" :current="currentXML || ''" mode="split" theme="light"
                        class="version-manager-vuediff-box"
                        language="xml"
                        style="height: 100%;"
                    />
                </div>
                <div v-else style="height: 100%; display: flex; align-items: center; gap: 8px;" :class="{ 'flex-column': isMobile }">
                    <v-card outlined
                        style="width: 100%; position: relative;"
                        :style="{ height: isMobile ? '50%' : '100%' }"
                        elevation="10"
                    >
                        <div class="version-manager-version-number">버전: {{ currentSelectedVersion }}</div>
                        <BpmnUengine
                            :key="key + '_left'"
                            :bpmn="currentSelectedXML"
                            :options="options"
                            :isViewMode="false"
                            :diffActivities="leftDiffActivities"
                            :onLoadStart="() => {}"
                            :onLoadEnd="() => {}"
                            style="height: 100%; width: 100%;"
                        ></BpmnUengine>
                    </v-card>
                    <div style="display: flex; align-items: center; justify-content: center;">
                        <v-icon :size="isMobile ? '24' : '48'">{{ isMobile ? 'mdi-arrow-down-bold' : 'mdi-arrow-right-bold' }}</v-icon>
                    </div>
                    <v-card outlined
                        style="width: 100%; position: relative;"
                        :style="{ height: isMobile ? '50%' : '100%' }"
                        elevation="10"
                    >
                        <div class="version-manager-version-number">버전: {{ latestVersion }}</div>
                        <BpmnUengine
                            :key="key + '_right'"
                            :bpmn="currentXML"
                            :options="options"
                            :isViewMode="false"
                            :diffActivities="rightDiffActivities"
                            :onLoadStart="() => {}"
                            :onLoadEnd="() => {}"
                            style="height: 100%; width: 100%;"
                        ></BpmnUengine>
                    </v-card>
                </div>
            </v-card-text>
            <v-card-actions class="pa-0 pt-2">
                <v-slider v-model="currentIndex" step="1" min="0" :max="lists.length - 1" show-ticks="always"
                    tick-size="4" @end="handleBeforeChange" :hide-details="true"
                    style="padding: 0; margin-right: 16px; margin-left: 16px;"></v-slider>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script>
import { Icon } from '@iconify/vue';

import BpmnUengine from '@/components/BpmnUengineViewer.vue';
import BackendFactory from '@/components/api/BackendFactory';
import customBpmnModule from '@/components/customBpmn';
const backend = BackendFactory.createBackend();
import ProcessDefinitionModule from '@/components/ProcessDefinitionModule.vue';

// import 'vue-diff/dist/index.css';
export default {
    name: 'ProcessDefinitionVersionManager',
    mixins: [ProcessDefinitionModule],
    components: {
        Icon,
        BpmnUengine,
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
        currentInfo: null,
        currentXML: null,
        options: {
            additionalModules: [customBpmnModule]
        },
        currentVersionName: null,
        currentVersion: null,
        currentVersionMessage: null,

        lastProcessInfo: null,
        leftDiffActivities: {},
        rightDiffActivities: {}
    }),
    computed: {
        beforeXML() {
            if (this.lists.length > 0 && this.lists[this.currentIndex - 1]) {
                return this.lists[this.currentIndex - 1].xml
            }
            return null;
        },
        currentSelectedXML() {
            if (this.lists.length > 0 && this.lists[this.currentIndex]) {
                return this.lists[this.currentIndex].xml
            }
            return null;
        },
        currentXML() {
            if (this.lists.length > 0 && this.lists[this.currentIndex]) {
                return this.lists[this.lists.length - 1].xml
            }
            return null;
        },
        isMobile() {
            return window.innerWidth <= 768;
        },
        beforeVersion() {
            if (this.lists.length > 0 && this.lists[this.currentIndex - 1]) {
                return this.lists[this.currentIndex - 1].version
            }
            return null;
        },
        currentSelectedVersion() {
            if (this.lists.length > 0 && this.lists[this.currentIndex]) {
                return this.lists[this.currentIndex].version
            }
            return null;
        },
        latestVersion() {
            if (this.lists.length > 0) {
                return this.lists[this.lists.length - 1].version
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
            if(result && result.length > 0){
                me.lists = result.map(item => ({ ...item, xml: null }));
                me.currentIndex = me.lists.length - 1;
                me.lists[me.currentIndex].xml = await me.loadXMLOfVer(me.lists[me.currentIndex].version);
                await me.setCurrentInfo(me.lists[me.currentIndex].xml);
                me.isOpen = true;
            } else {
                me.$try({
                    action: async () => {},
                    warningMsg: me.$t('ProcessDefinitionVersionManager.noVersionsAvailable')
                });
            }
            me.loading = false;
        },
        async handleBeforeChange(index) {
            var me = this
            me.loading = true
            if (!me.lists[index]) return;
            if (!me.lists[index].xml) me.lists[index].xml = await me.loadXMLOfVer(me.lists[index].version)
            await me.setCurrentInfo(me.lists[index].xml);
            if(index == me.lists.length - 1){
                me.lastProcessInfo = JSON.parse(JSON.stringify(me.currentInfo))
                me.leftDiffActivities = {};
                me.rightDiffActivities = {};
            } else {    
                if(!me.lists[me.lists.length - 1].xml) me.lists[me.lists.length - 1].xml = await me.loadXMLOfVer(me.lists[me.lists.length - 1].version)
                if(!me.lastProcessInfo) await me.setLastVersionInfo(me.lists[me.lists.length - 1].xml);
                me.calculateDifferences();
            }
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
                alert(me.$t('ProcessDefinitionVersionManager.noXmlData'));
            }
        },
        async setCurrentInfo(xml) {
            let me = this;
            const currentInfo = await me.convertXMLToJSON(xml);
            me.currentVersionName = currentInfo.processDefinitionName;
            me.currentVersion = currentInfo.version;
            if(currentInfo.shortDescription){
                me.currentVersionMessage = currentInfo.shortDescription.text;
            }
            me.currentInfo = currentInfo;
        },
        async setLastVersionInfo(xml) {
            let me = this;
            me.lastProcessInfo = await me.convertXMLToJSON(xml);
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
            let xml = null;
            if(result){
                xml = result[0].snapshot
                me.currentInfo = await me.convertXMLToJSON(xml);
            }
            return xml;
        },
        copyToClipboard(text) {
            if (navigator.clipboard) { // 최신 브라우저 API 지원 여부 확인
                navigator.clipboard.writeText(text).then(() => {
                    alert(me.$t('ProcessDefinitionVersionManager.copiedToClipboard')); // 성공 메시지
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
                alert(me.$t('ProcessDefinitionVersionManager.copiedToClipboard')); // 성공 메시지
            }
        },
        close() {
            this.$emit('close', false)
        },
        calculateDifferences() {
            const me = this;
            me.leftDiffActivities = {};
            me.rightDiffActivities = {};
            
            if (!me.currentInfo || !me.lastProcessInfo) return;
            
            const currentActivities = me.currentInfo.activities || [];
            const lastActivities = me.lastProcessInfo.activities || [];
            const currentSequences = me.currentInfo.sequences || [];
            const lastSequences = me.lastProcessInfo.sequences || [];
            
            // 현재 액티비티 ID 목록
            const currentActivityIds = currentActivities.map(act => act.id);
            // 다음 버전 액티비티 ID 목록
            const lastActivityIds = lastActivities.map(act => act.id);
            
            // 삭제된 액티비티 찾기 (현재에는 있지만 다음에는 없는 것)
            currentActivities.forEach(activity => {
                if (!lastActivityIds.includes(activity.id)) {
                    me.leftDiffActivities[activity.id] = 'deleted';
                }
            });
            
            // 추가된 액티비티 찾기 (다음에는 있지만 현재에는 없는 것)
            lastActivities.forEach(activity => {
                if (!currentActivityIds.includes(activity.id)) {
                    me.rightDiffActivities[activity.id] = 'added';
                }
            });
            
            // 수정된 액티비티 찾기 (양쪽 다 있지만 내용이 변경된 것)
            currentActivities.forEach(currentActivity => {
                const lastActivity = lastActivities.find(act => act.id === currentActivity.id);
                if (lastActivity) {
                    // 속성 비교를 위해 JSON 문자열로 변환하여 비교
                    const currentJson = JSON.stringify(currentActivity);
                    const lastJson = JSON.stringify(lastActivity);
                    
                    if (currentJson !== lastJson) {
                        me.leftDiffActivities[currentActivity.id] = 'modified';
                        me.rightDiffActivities[lastActivity.id] = 'modified';
                    }
                }
            });

            // === 연결선(Sequences) 비교 로직 추가 ===
            
            // 현재 연결선 ID 목록 (source-target 조합으로 고유 식별)
            const currentSequenceKeys = currentSequences.map(seq => `${seq.source}-${seq.target}`);
            const lastSequenceKeys = lastSequences.map(seq => `${seq.source}-${seq.target}`);
            
            // 삭제된 연결선 찾기 (현재에는 있지만 다음에는 없는 것)
            currentSequences.forEach(sequence => {
                const sequenceKey = `${sequence.source}-${sequence.target}`;
                if (!lastSequenceKeys.includes(sequenceKey)) {
                    me.leftDiffActivities[sequence.id] = 'deleted';
                }
            });
            
            // 추가된 연결선 찾기 (다음에는 있지만 현재에는 없는 것)
            lastSequences.forEach(sequence => {
                const sequenceKey = `${sequence.source}-${sequence.target}`;
                if (!currentSequenceKeys.includes(sequenceKey)) {
                    me.rightDiffActivities[sequence.id] = 'added';
                }
            });
            
            // 수정된 연결선 찾기 (양쪽 다 있지만 내용이 변경된 것)
            currentSequences.forEach(currentSequence => {
                const sequenceKey = `${currentSequence.source}-${currentSequence.target}`;
                const lastSequence = lastSequences.find(seq => 
                    `${seq.source}-${seq.target}` === sequenceKey
                );
                if (lastSequence) {
                    // 속성 비교를 위해 JSON 문자열로 변환하여 비교
                    const currentJson = JSON.stringify(currentSequence);
                    const lastJson = JSON.stringify(lastSequence);
                    
                    if (currentJson !== lastJson) {
                        me.leftDiffActivities[currentSequence.id] = 'modified';
                        me.rightDiffActivities[lastSequence.id] = 'modified';
                    }
                }
            });
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

.flex-column {
    flex-direction: column !important;
}

.custom-small-switch {
    transform: scale(0.8);
    transform-origin: left center;
}

.custom-small-switch .v-label {
    font-size: 14px !important;
}

.version-manager-version-number {
    position: absolute;
    left: 16px;
    top: 16px;
    background: rgba(255, 255, 255, 0.9);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: bold;
    z-index: 10;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

/* 모바일에서 더 컴팩트하게 */
@media (max-width: 768px) {
}
</style>
