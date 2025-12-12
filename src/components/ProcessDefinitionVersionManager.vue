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
                :class="viewMode === 'xml' ? '' : 'pb-0'"
            >
                <div class="mx-2">
                    <v-btn-toggle v-model="viewMode" mandatory density="compact" class="mx-2">
                        <v-btn value="xml" size="small">XML</v-btn>
                        <v-btn value="bpmn" size="small">BPMN</v-btn>
                        <v-btn value="flow" size="small">Flow</v-btn>
                    </v-btn-toggle>
                </div>
                <v-btn @click="downloadXML" variant="text" class="mx-2">
                    {{ $t('ProcessDefinitionVersionManager.download') }}
                </v-btn>
                <v-btn @click="changeXML" variant="text" color="primary" :disabled="loading">
                    v{{ leftVersion }} 버전으로 변경
                </v-btn>
            </div>

            <v-card-text :class="viewMode === 'xml' ? 'pa-4 pt-6 pb-0' : 'pa-4 pb-0'"
                :style="viewMode === 'xml' ? 'height: calc(100vh - 280px);' : 'height: calc(100vh - 260px);'"
            >
                <!-- XML 모드 -->
                <div v-if="viewMode === 'xml'" style="height: 100%; position: relative; padding-top: 40px;">
                    <div class="version-manager-version-select" style="left: 0px; top: 0px;">
                        <v-select
                            v-model="leftVersionIndex"
                            :items="leftVersionOptions"
                            density="compact"
                            variant="solo"
                            hide-details
                            :item-props="itemProps"
                        ></v-select>
                    </div>
                    <div class="version-manager-version-select" style="left: 50%; top: 0px;">
                        <v-select
                            v-model="rightVersionIndex"
                            :items="rightVersionOptions"
                            density="compact"
                            variant="solo"
                            hide-details
                            :item-props="itemProps"
                        ></v-select>
                    </div>
                    <vuediff :prev="leftXML || ''" :current="rightXML || ''" mode="split" theme="light"
                        class="version-manager-vuediff-box"
                        language="xml"
                        style="height: 100%;"
                    />
                </div>
                
                <!-- BPMN 모드 -->
                <div v-else-if="viewMode === 'bpmn'" style="height: 100%; display: flex; align-items: center; gap: 8px; position: relative; padding-top: 40px;" :class="{ 'flex-column': isMobile }">
                    <div class="version-manager-version-select" style="left: 0px; top: 0px;">
                        <v-select
                            v-model="leftVersionIndex"
                            :items="leftVersionOptions"
                            density="compact"
                            variant="solo"
                            hide-details
                            :item-props="itemProps"
                        ></v-select>
                    </div>
                    <v-card outlined
                        style="width: 100%; position: relative;"
                        :style="{ height: isMobile ? '50%' : '100%' }"
                        elevation="10"
                    >
                        <BpmnUengine
                            :key="key + '_left'"
                            :bpmn="leftXML"
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
                    <div class="version-manager-version-select" style="left: 50%; top: 0px;">
                        <v-select
                            v-model="rightVersionIndex"
                            :items="rightVersionOptions"
                            density="compact"
                            variant="solo"
                            hide-details
                            :item-props="itemProps"
                        ></v-select>
                    </div>
                    <v-card outlined
                        style="width: 100%; position: relative;"
                        :style="{ height: isMobile ? '50%' : '100%' }"
                        elevation="10"
                    >
                        <BpmnUengine
                            :key="key + '_right'"
                            :bpmn="rightXML"
                            :options="options"
                            :isViewMode="false"
                            :diffActivities="rightDiffActivities"
                            :onLoadStart="() => {}"
                            :onLoadEnd="() => {}"
                            style="height: 100%; width: 100%;"
                        ></BpmnUengine>
                    </v-card>
                </div>
                
                <!-- Flow 모드 -->
                <div v-else-if="viewMode === 'flow'" style="height: 100%; display: flex; align-items: stretch; gap: 8px; overflow: hidden; position: relative; padding-top: 40px;" :class="{ 'flex-column': isMobile }">
                    <div class="version-manager-version-select" style="left: 0px; top: 0px;">
                        <v-select
                            v-model="leftVersionIndex"
                            :items="leftVersionOptions"
                            density="compact"
                            variant="solo"
                            hide-details
                            :item-props="itemProps"
                        ></v-select>
                    </div>
                    <v-card outlined
                        style="width: 100%; position: relative; overflow: hidden;"
                        :style="{ height: isMobile ? '50%' : '100%' }"
                        elevation="10"
                    >
                        <ProcessFlowExample
                            v-if="leftProcessDefinition"
                            :key="key + '_flow_left'"
                            :process-definition="leftProcessDefinition"
                            :diff-activities="leftDiffActivities"
                            :show-legend="false"
                            style="height: 100%; width: 100%;"
                        ></ProcessFlowExample>
                    </v-card>
                    <div style="display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <v-icon :size="isMobile ? '24' : '48'">{{ isMobile ? 'mdi-arrow-down-bold' : 'mdi-arrow-right-bold' }}</v-icon>
                    </div>
                    <div class="version-manager-version-select" style="left: 50%; top: 0px;">
                        <v-select
                            v-model="rightVersionIndex"
                            :items="rightVersionOptions"
                            density="compact"
                            variant="solo"
                            hide-details
                            :item-props="itemProps"
                        ></v-select>
                    </div>
                    <v-card outlined
                        style="width: 100%; position: relative; overflow: hidden;"
                        :style="{ height: isMobile ? '50%' : '100%' }"
                        elevation="10"
                    >
                        <ProcessFlowExample
                            v-if="rightProcessDefinition"
                            :key="key + '_flow_right'"
                            :process-definition="rightProcessDefinition"
                            :diff-activities="rightDiffActivities"
                            :show-legend="false"
                            style="height: 100%; width: 100%;"
                        ></ProcessFlowExample>
                    </v-card>
                </div>
            </v-card-text>
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
import ProcessFlowExample from '@/components/ProcessFlowExample.vue';

// import 'vue-diff/dist/index.css';
export default {
    name: 'ProcessDefinitionVersionManager',
    mixins: [ProcessDefinitionModule],
    components: {
        Icon,
        BpmnUengine,
        ProcessFlowExample,
    },
    props: {
        open: Boolean,
        process: Object,
        type: String
    },
    data: () => ({
        basePath: 'proc_def_arcv',
        isOpen: false, // inner var

        // view mode
        viewMode: 'bpmn', // xml, bpmn, flow
        key: 0, // update component
        // version selection
        leftVersionIndex: 0,
        rightVersionIndex: 0,
        lists: [],
        loading: false,
        currentInfo: null,
        options: {
            additionalModules: [customBpmnModule]
        },
        currentVersionName: null,
        currentVersion: null,
        currentVersionMessage: null,

        leftProcessInfo: null,
        rightProcessInfo: null,
        leftDiffActivities: {},
        rightDiffActivities: {},
        
        // Flow 모드용 프로세스 정의
        leftProcessDefinition: null,
        rightProcessDefinition: null,
    }),
    computed: {
        leftXML() {
            if (this.lists.length > 0 && this.lists[this.leftVersionIndex]) {
                return this.lists[this.leftVersionIndex].xml
            }
            return null;
        },
        rightXML() {
            if (this.lists.length > 0 && this.lists[this.rightVersionIndex]) {
                return this.lists[this.rightVersionIndex].xml
            }
            return null;
        },
        isMobile() {
            return window.innerWidth <= 768;
        },
        leftVersion() {
            if (this.lists.length > 0 && this.lists[this.leftVersionIndex]) {
                return this.lists[this.leftVersionIndex].version
            }
            return null;
        },
        rightVersion() {
            if (this.lists.length > 0 && this.lists[this.rightVersionIndex]) {
                return this.lists[this.rightVersionIndex].version
            }
            return null;
        },
        versionOptions() {
            return this.lists.map((item, index) => ({
                title: `v${item.version}${item.message ? ' - ' + item.message : ''}`,
                value: index
            }));
        },
        leftVersionOptions() {
            return this.lists.map((item, index) => ({
                title: `v${item.version}${item.message ? ' - ' + item.message : ''}`,
                value: index,
                disabled: index === this.rightVersionIndex
            }));
        },
        rightVersionOptions() {
            return this.lists.map((item, index) => ({
                title: `v${item.version}${item.message ? ' - ' + item.message : ''}`,
                value: index,
                disabled: index === this.leftVersionIndex
            }));
        },
    },
    watch: {
        "open": function (newVal) {
            if (newVal) {
                this.load();
            } else {
                this.isOpen = false
            }
        },
        async leftVersionIndex(newIndex) {
            await this.handleVersionChange('left', newIndex);
        },
        async rightVersionIndex(newIndex) {
            await this.handleVersionChange('right', newIndex);
        },
    },
    created() {
    },
    methods: {
        itemProps(item) {
            return {
                title: item.title,
                value: item.value,
                disabled: item.disabled
            }
        },
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
                
                // 초기 로드 시 우측=최신버전, 좌측=직전버전
                me.rightVersionIndex = me.lists.length - 1;
                me.leftVersionIndex = me.lists.length > 1 ? me.lists.length - 2 : 0;
                
                // 우측(최신) 버전 로드
                me.lists[me.rightVersionIndex].xml = await me.loadXMLOfVer(me.lists[me.rightVersionIndex].version);
                await me.setCurrentInfo(me.lists[me.rightVersionIndex].xml);
                
                // 좌측(직전) 버전 로드
                if (me.leftVersionIndex !== me.rightVersionIndex) {
                    me.lists[me.leftVersionIndex].xml = await me.loadXMLOfVer(me.lists[me.leftVersionIndex].version);
                }
                
                // 프로세스 정의 변환
                me.rightProcessDefinition = await me.convertXMLToJSON(me.lists[me.rightVersionIndex].xml);
                me.rightProcessInfo = JSON.parse(JSON.stringify(me.rightProcessDefinition));
                
                me.leftProcessDefinition = await me.convertXMLToJSON(me.lists[me.leftVersionIndex].xml);
                me.leftProcessInfo = JSON.parse(JSON.stringify(me.leftProcessDefinition));
                
                // diff 계산
                me.calculateDifferences();
                
                me.isOpen = true;
            } else {
                me.$try({
                    action: async () => {},
                    warningMsg: me.$t('ProcessDefinitionVersionManager.noVersionsAvailable')
                });
            }
            me.loading = false;
        },
        async handleVersionChange(side, index) {
            var me = this
            me.loading = true
            if (!me.lists[index]) {
                me.loading = false;
                return;
            }
            
            // XML 로드 (캐시되어 있지 않은 경우)
            if (!me.lists[index].xml) {
                me.lists[index].xml = await me.loadXMLOfVer(me.lists[index].version)
            }
            
            // 프로세스 정의 변환
            const processDefinition = await me.convertXMLToJSON(me.lists[index].xml);
            
            if (side === 'left') {
                me.leftProcessDefinition = processDefinition;
                me.leftProcessInfo = JSON.parse(JSON.stringify(processDefinition));
            } else {
                me.rightProcessDefinition = processDefinition;
                me.rightProcessInfo = JSON.parse(JSON.stringify(processDefinition));
                // 우측이 변경되면 현재 버전 정보 업데이트
                await me.setCurrentInfo(me.lists[index].xml);
            }
            
            // diff 계산
            me.calculateDifferences();
            
            me.loading = false
            me.key++
        },
        changeXML() {
            this.$emit('changeXML', {
                "id": this.process.processDefinitionId,
                "name": this.currentVersionName,
                "xml": this.leftXML
            });
        },
        downloadXML() {
            var me = this;
            if (me.rightXML) {
                const blob = new Blob([me.rightXML], { type: 'application/xml' });
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
            
            if (!me.leftProcessInfo || !me.rightProcessInfo) return;
            
            const leftActivities = me.leftProcessInfo.activities || [];
            const rightActivities = me.rightProcessInfo.activities || [];
            const leftSequences = me.leftProcessInfo.sequences || [];
            const rightSequences = me.rightProcessInfo.sequences || [];
            
            // 좌측 액티비티 ID 목록
            const leftActivityIds = leftActivities.map(act => act.id);
            // 우측 액티비티 ID 목록
            const rightActivityIds = rightActivities.map(act => act.id);
            
            // 삭제된 액티비티 찾기 (좌측에는 있지만 우측에는 없는 것)
            leftActivities.forEach(activity => {
                if (!rightActivityIds.includes(activity.id)) {
                    me.leftDiffActivities[activity.id] = 'deleted';
                }
            });
            
            // 추가된 액티비티 찾기 (우측에는 있지만 좌측에는 없는 것)
            rightActivities.forEach(activity => {
                if (!leftActivityIds.includes(activity.id)) {
                    me.rightDiffActivities[activity.id] = 'added';
                }
            });
            
            // 수정된 액티비티 찾기 (양쪽 다 있지만 내용이 변경된 것)
            leftActivities.forEach(leftActivity => {
                const rightActivity = rightActivities.find(act => act.id === leftActivity.id);
                if (rightActivity) {
                    // 속성 비교를 위해 JSON 문자열로 변환하여 비교
                    const leftJson = JSON.stringify(leftActivity);
                    const rightJson = JSON.stringify(rightActivity);
                    
                    if (leftJson !== rightJson) {
                        me.leftDiffActivities[leftActivity.id] = 'modified';
                        me.rightDiffActivities[rightActivity.id] = 'modified';
                    }
                }
            });

            // === 연결선(Sequences) 비교 로직 ===
            
            // 좌측 연결선 ID 목록 (source-target 조합으로 고유 식별)
            const leftSequenceKeys = leftSequences.map(seq => `${seq.source}-${seq.target}`);
            const rightSequenceKeys = rightSequences.map(seq => `${seq.source}-${seq.target}`);
            
            // 삭제된 연결선 찾기 (좌측에는 있지만 우측에는 없는 것)
            leftSequences.forEach(sequence => {
                const sequenceKey = `${sequence.source}-${sequence.target}`;
                if (!rightSequenceKeys.includes(sequenceKey)) {
                    me.leftDiffActivities[sequence.id] = 'deleted';
                }
            });
            
            // 추가된 연결선 찾기 (우측에는 있지만 좌측에는 없는 것)
            rightSequences.forEach(sequence => {
                const sequenceKey = `${sequence.source}-${sequence.target}`;
                if (!leftSequenceKeys.includes(sequenceKey)) {
                    me.rightDiffActivities[sequence.id] = 'added';
                }
            });
            
            // 수정된 연결선 찾기 (양쪽 다 있지만 내용이 변경된 것)
            leftSequences.forEach(leftSequence => {
                const sequenceKey = `${leftSequence.source}-${leftSequence.target}`;
                const rightSequence = rightSequences.find(seq => 
                    `${seq.source}-${seq.target}` === sequenceKey
                );
                if (rightSequence) {
                    // 속성 비교를 위해 JSON 문자열로 변환하여 비교
                    const leftJson = JSON.stringify(leftSequence);
                    const rightJson = JSON.stringify(rightSequence);
                    
                    if (leftJson !== rightJson) {
                        me.leftDiffActivities[leftSequence.id] = 'modified';
                        me.rightDiffActivities[rightSequence.id] = 'modified';
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

.version-manager-version-select {
    position: absolute;
    z-index: 10;
    width: 100px;
}

.version-manager-version-select :deep(.v-field) {
    background: rgba(255, 255, 255, 0.95);
    border-radius: 6px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
    font-size: 12px;
    min-height: 32px;
}

.version-manager-version-select :deep(.v-field__input) {
    padding: 4px 8px;
    font-size: 12px;
    min-height: 32px;
}

.version-manager-version-select :deep(.v-select__selection-text) {
    font-size: 12px;
}

/* Disabled 항목 스타일 - 매우 명확하게 */
.version-manager-version-select :deep(.v-list-item--disabled) {
    background-color: gray !important;
    opacity: 1 !important;
}

.version-manager-version-select :deep(.v-list-item--disabled .v-list-item-title) {
    color: lightgray !important;
    text-decoration: line-through;
}

.version-manager-version-select :deep(.v-list-item--disabled:hover) {
    background-color: #d5d5d5 !important;
    cursor: not-allowed !important;
}

/* 모바일에서 더 컴팩트하게 */
@media (max-width: 768px) {
}
</style>
