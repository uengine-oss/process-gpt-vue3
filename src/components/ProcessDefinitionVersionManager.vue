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
                    <v-tooltip location="bottom">
                        <template v-slot:activator="{ props }">
                            <v-btn v-bind="props" icon variant="text" type="file" class="text-medium-emphasis" 
                                density="comfortable" @click="showXML = !showXML">
                                <Icons :icon="'code-xml'" :color="showXML ? '#1976D2' : '#666666'"/>
                            </v-btn>
                        </template>
                        <span>{{ showXML ? $t('processDefinition.showModeling') : $t('processDefinition.showXML') }}</span>
                    </v-tooltip>
                </div>
                <v-btn @click="downloadXML"
                    color="gray"
                    variant="flat"
                    class="rounded-pill mr-2"
                >{{ $t('ProcessDefinitionVersionManager.downloadVersionXML', { version: currentSelectedVersion }) }}
                </v-btn>
                <v-btn  @click="changeXML"
                    :disabled="isChangeButtonDisabled"
                    color="primary"
                    variant="flat"
                    class="rounded-pill"
                >{{ $t('ProcessDefinitionVersionManager.changeToSelectedVersion', { version: currentSelectedVersion || '' }) }}
                </v-btn>
            </div>

            <v-card-text :class="showXML ? 'pa-4 pt-6 pb-0' : 'pa-4'"
                :style="showXML ? 'height: calc(100vh - 280px);' : 'height: 100vh;'"
            >
                <div class="version-layout" :class="{ 'version-layout-column': isMobile }">
                    <!-- BPMN / XML 뷰어 (항상 전체 영역 차지, 바 너비만큼 여백 확보) -->
                    <div class="version-main version-main-gutter">
                        <div v-if="showXML" style="height: 100%; position: relative;">
                            <div class="version-manager-version-number" style="left: 0px; top: -32px;">
                                {{ $t('ProcessDefinitionVersionManager.versionWithColon', { version: currentSelectedVersion || '' }) }}
                            </div>
                            <div class="version-manager-version-number" style="left: 50%; top: -32px;">
                                {{ $t('ProcessDefinitionVersionManager.versionWithColon', { version: latestVersion || '' }) }}
                            </div>
                            <vuediff :prev="currentSelectedXML || ''" :current="currentXML || ''" mode="split" theme="light"
                                class="version-manager-vuediff-box"
                                language="xml"
                                style="height: 100%;"
                            />
                        </div>
                        <div v-else style="height: 100%;" :class="{ 'flex-column': isMobile }">
                            <div style="height: 100%; display: flex; align-items: center; gap: 8px;" :class="{ 'flex-column': isMobile }">
                                <v-card outlined
                                    style="width: 100%; position: relative;"
                                    :style="{ height: isMobile ? '50%' : '100%' }"
                                    elevation="10"
                                >
                                    <div class="version-manager-version-number">
                                        {{ $t('ProcessDefinitionVersionManager.versionWithColon', { version: currentSelectedVersion || '' }) }}
                                    </div>
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
                                    <div class="version-manager-version-number">
                                        {{ $t('ProcessDefinitionVersionManager.versionWithColon', { version: latestVersion || '' }) }}
                                    </div>
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
                        </div>
                    </div>

                    <!-- 앞쪽에 겹쳐지는 버전 리스트 오버레이 -->
                    <div v-if="versionListExpanded" class="version-sidebar-overlay">
                        <div class="version-sidebar-wrapper">
                            <div class="version-sidebar">
                                <div class="version-sidebar-header">
                                    <span class="text-body-2 font-weight-medium">
                                        {{ $t('ProcessDefinitionVersionManager.versionList') }} ({{ filteredLists.length }})
                                    </span>
                                </div>
                                <v-list
                                    density="compact"
                                    class="version-list"
                                >
                                    <v-list-item
                                        v-for="(item, index) in filteredLists"
                                        :key="item.version || index"
                                        :active="index === currentIndex"
                                        @click="selectVersion(index)"
                                    >
                                        <v-list-item-title>
                                            {{
                                                $t('ProcessDefinitionVersionManager.versionItemTitle', {
                                                    version: item.version
                                                })
                                            }}
                                        </v-list-item-title>
                                        <v-list-item-subtitle>
                                            <div>
                                                {{ formatVersionTime(item.timeStamp) }}
                                            </div>
                                            <div v-if="item.message" class="version-list-desc-inline">
                                                {{ item.message }}
                                            </div>
                                        </v-list-item-subtitle>
                                    </v-list-item>
                                </v-list>
                            </div>
                            <v-tooltip :text="$t('ProcessDefinitionVersionManager.versionList')" location="right">
                                <template #activator="{ props }">
                                    <div
                                        v-bind="props"
                                        class="version-toggle-bar"
                                        @click="versionListExpanded = false"
                                    >
                                        <!-- 열려 있을 때는 닫힘을 의미하는 '<' 방향 아이콘 표시 -->
                                        <v-icon size="24" class="mb-1">mdi-chevron-left</v-icon>
                                    </div>
                                </template>
                            </v-tooltip>
                        </div>
                    </div>

                    <!-- 접혔을 때 화면 왼쪽에만 얇은 바 형태로 보이는 토글 -->
                    <v-tooltip v-else :text="$t('ProcessDefinitionVersionManager.versionList')" location="right">
                        <template #activator="{ props }">
                            <div
                                v-bind="props"
                                class="version-toggle-bar version-toggle-bar-collapsed"
                                @click="versionListExpanded = true"
                            >
                                <v-icon size="24" class="mb-1">mdi-menu</v-icon>
                                <span class="version-toggle-label">
                                    {{ $t('ProcessDefinitionVersionManager.versionList') }}
                                </span>
                            </div>
                        </template>
                    </v-tooltip>
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
        basePath: 'proc_def_version',
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
        rightDiffActivities: {},

        // 왼쪽 버전 리스트 접기/펼치기
        versionListExpanded: true,
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
            // 최신 버전의 XML 반환
            return this.lists[this.lists.length - 1]?.xml || null;
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
        currentSelectedVersionName() {
            // 별도의 버전 이름 정보가 없으므로 현재 프로세스 정의 이름을 그대로 사용
            return this.currentVersionName;
        },
        isChangeButtonDisabled() {
            // 로딩 중일 때만 비활성화
            return this.loading;
        },
        filteredLists() {
            // 최신 버전을 제외한 리스트 (최신 버전은 오른쪽에 항상 표시되므로 선택 목록에서 제외)
            if (this.lists.length > 1) {
                return this.lists.slice(0, -1);
            }
            return this.lists;
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
                // message 는 백엔드에서 직접 내려오지 않을 수 있으므로
                // 여기서는 기본 메타 정보만 받고, 실제 설명 텍스트는 XML(shortDescription)에서 추출한다.
                key: 'version, timeStamp',
                sort: 'asc',
                orderBy: 'timeStamp',
                type: me.type
            });
            if(result && result.length > 0){
                me.lists = result.map(item => ({ ...item, xml: null, message: null }));
                // 최초 진입 시 바로 이전 버전을 선택 (버전이 1개만 있으면 0)
                me.currentIndex = me.lists.length > 1 ? me.lists.length - 2 : 0;
                me.lists[me.currentIndex].xml = await me.loadXMLOfVer(me.lists[me.currentIndex].version);
                await me.setCurrentInfo(me.lists[me.currentIndex].xml);
                // 최신 버전의 설명을 리스트에도 캐시
                if (me.currentInfo && me.currentInfo.shortDescription && me.currentInfo.shortDescription.text) {
                    me.lists[me.currentIndex].message = me.currentInfo.shortDescription.text;
                }

                // BUGFIX: 다른 버전들도 클릭하지 않아도 설명이 보이도록, XML을 로드해서 message를 미리 채워준다.
                // 최신 버전(오른쪽)도 미리 로드
                for (let i = 0; i < me.lists.length; i++) {
                    if (i === me.currentIndex) continue; // 이미 로드된 현재 선택 버전은 스킵
                    const xml = await me.loadXMLOfVer(me.lists[i].version);
                    me.lists[i].xml = xml;
                    if (me.currentInfo && me.currentInfo.shortDescription && me.currentInfo.shortDescription.text) {
                        me.lists[i].message = me.currentInfo.shortDescription.text;
                    }
                }

                // 최초 진입 시 diff 계산
                if (me.currentIndex !== me.lists.length - 1) {
                    // 선택한 버전이 최신 버전이 아닐 때만 diff 계산
                    // for 루프에서 currentInfo가 덮어씌워졌으므로 선택한 버전의 정보를 다시 설정
                    await me.setCurrentInfo(me.lists[me.currentIndex].xml);
                    await me.setLastVersionInfo(me.lists[me.lists.length - 1].xml);
                    me.calculateDifferences();
                    // BpmnUengineViewer 강제 재렌더링
                    me.key++;
                } else {
                    // 최신 버전을 선택한 경우 diff 초기화
                    me.lastProcessInfo = JSON.parse(JSON.stringify(me.currentInfo));
                    me.leftDiffActivities = {};
                    me.rightDiffActivities = {};
                    me.key++;
                }

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
            // 현재 선택한 버전의 설명을 리스트에도 캐시
            if (me.currentInfo && me.currentInfo.shortDescription && me.currentInfo.shortDescription.text) {
                me.lists[index].message = me.currentInfo.shortDescription.text;
            }
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
        selectVersion(index) {
            // 버전 선택 시 항상 해당 버전으로 전환하고 리스트를 닫음
            this.currentIndex = index;
            this.handleBeforeChange(index);
            this.versionListExpanded = false;
        },
        changeXML() {
            this.$emit('changeXML', {
                "id": this.process.processDefinitionId,
                "name": this.currentSelectedVersionName,
                "xml": this.currentSelectedXML
            });
        },
        downloadXML() {
            var me = this;
            // 선택한 버전의 XML 다운로드
            const xml = me.lists[me.currentIndex]?.xml;
            
            if (xml) {
                const blob = new Blob([xml], { type: 'application/xml' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `${me.currentVersionName}-${me.currentSelectedVersion}.xml`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                alert(me.$t('ProcessDefinitionVersionManager.noXmlData'));
            }
        },
        formatVersionTime(timeStamp) {
            if (!timeStamp) return '';
            
            // timeStamp가 ISO 형식이 아닌 경우 (timestamp without time zone에서 온 경우)
            // UTC로 명시적으로 처리
            let date;
            if (timeStamp.endsWith('Z') || timeStamp.includes('+')) {
                // 이미 시간대 정보가 있는 ISO 형식
                date = new Date(timeStamp);
            } else {
                // 시간대 정보가 없는 경우 UTC로 해석
                date = new Date(timeStamp + 'Z');
            }
            
            if (isNaN(date.getTime())) {
                return timeStamp;
            }

            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            if (diffMs < 0) {
                // 미래 시간이면 그냥 절대 시간으로 표시
                return date.toLocaleString();
            }

            const diffSec = Math.floor(diffMs / 1000);
            const diffMin = Math.floor(diffSec / 60);
            const diffHour = Math.floor(diffMin / 60);

            // 24시간 이내일 때 상대 시간 표시
            if (diffHour < 24) {
                if (diffMin < 1) {
                    // 1분 미만 -> 방금
                    return this.$t('ProcessDefinitionVersionManager.relativeJustNow');
                }
                if (diffHour < 1) {
                    // 1시간 미만 -> ~분 전
                    return this.$t('ProcessDefinitionVersionManager.relativeMinutesAgo', { minutes: diffMin });
                }
                // 24시간 미만 -> ~시간 전
                return this.$t('ProcessDefinitionVersionManager.relativeHoursAgo', { hours: diffHour });
            }

            // 그 외에는 절대 시간
            return date.toLocaleString();
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

.version-list-desc-inline {
    display: block;
    width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.version-layout {
    display: flex;
    gap: 12px;
    height: 100%;
    position: relative;
}

.version-main {
    flex: 1;
    min-width: 0;
    height: 100%;
}

.version-main-gutter {
    margin-left: 24px; /* 토글 바와 동일한 폭만큼 여백 확보 */
}

.version-sidebar-panels {
    height: 100%;
}

.version-list .v-list-item {
    cursor: pointer;
}

.version-sidebar-header {
    padding: 4px 8px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    margin-bottom: 4px;
}

.version-layout-column {
    flex-direction: column;
}

.version-sidebar-wrapper {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    display: flex;
    z-index: 20;
}

.version-sidebar {
    width: 320px;
    max-width: 100%;
    height: 100%;
    overflow-y: auto;
    background-color: #ffffff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.version-toggle-bar {
    width: 24px;
    min-width: 24px;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    background-color: #ffffff; /* 버전 리스트(panel)와 동일한 배경색 */
    border-radius: 0 6px 6px 0;
    /* 오른쪽으로만 그림자 주어 왼쪽(메인 영역 쪽)은 그림자 없음 */
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.2);
    z-index: 25;
}

.version-toggle-bar-collapsed {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    height: auto;
    border-radius: 6px;
    z-index: 25;
}

.version-toggle-label {
    writing-mode: vertical-rl;
    text-orientation: mixed;
    font-size: 14px;
    line-height: 1;
}

/* 모바일에서 더 컴팩트하게 */
@media (max-width: 768px) {
}
</style>
