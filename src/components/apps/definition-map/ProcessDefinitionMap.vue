<template>
    <div>
        <v-card elevation="10" :style="!$globalState.state.isZoomed ? '' : 'height:100vh;'"
            class="is-work-height"
            style="overflow: auto;"
        >
            <div v-if="componentName == 'DefinitionMapList' && !openConsultingDialog" class="pa-4">
                <Chat 
                    :showDetailInfo="true"
                    :definitionMapOnlyInput="true"
                    :disableChat="false"
                    :isMobile="isMobile"
                    @sendMessage="() => {}"
                />
            </div>
            
            <div v-if="componentName != 'SubProcessDetail'" class="pa-0 pl-6 pt-4 pr-6 d-flex align-center"
                style="position: sticky; top: 0; z-index:2; background-color:white"
            >
                <h5 v-if="!globalIsMobile.value" class="text-h5 font-weight-semibold">{{ $t('processDefinitionMap.title') }}</h5>
                <v-row v-else class="ma-0 pa-0">
                    <!-- 수정: public 경로부터 시작하는 favicon 이미지 추가 -->
                    <img src="/process-gpt-favicon.png" alt="Process GPT Favicon" style="height:24px; margin-right:8px;" />
                    <h5 class="text-h5 font-weight-semibold">{{ $t('processDefinitionMap.mobileTitle') }}</h5>
                </v-row>
                <DetailComponent class="ml-2"
                    :title="$t('processDefinitionMap.usageGuide.title')"
                    :details="usageGuideDetails"
                />
                <v-btn v-if="!isExecutionByProject && $route.path !== '/definition-map'" style="margin-left: 3px; margin-top: 1px;" icon variant="text" 
                    size="24" @click="goProcessMap">
                    <Icons :icon="'arrow-go-back'"/>
                </v-btn>
                
                <!-- buttons -->
                <div class="ml-auto d-flex">
                    <!-- View Mode Toggle -->
                    <v-btn-toggle
                        v-if="componentName === 'DefinitionMapList' && mode === 'ProcessGPT'"
                        v-model="viewMode"
                        mandatory
                        density="compact"
                        color="primary"
                        class="mr-4"
                    >
                        <v-btn value="proc_map" size="small">
                            <v-icon start size="16">mdi-view-grid</v-icon>
                            {{ $t('processDefinitionMap.cardView') || '카드' }}
                        </v-btn>
                        <v-btn value="metrics" size="small">
                            <v-icon start size="16">mdi-table</v-icon>
                            {{ $t('processDefinitionMap.matrixView') || '매트릭스' }}
                        </v-btn>
                    </v-btn-toggle>
                    <v-tooltip location="bottom" v-if="useLock && !lock && isAdmin && !isViewMode" >
                        <template v-slot:activator="{ props }">
                            <v-btn v-bind="props" icon variant="text" size="24" class="ml-2 cp-unlock" @click="openAlertDialog">
                                <Icons :icon="'pencil'" :size="18" />
                            </v-btn>
                        </template>
                        <span>{{ $t('processDefinitionMap.unlock') }}</span>
                    </v-tooltip>

                    <v-tooltip location="bottom" v-if="useLock && lock && isAdmin && userName == editUser">
                        <template v-slot:activator="{ props }">
                            <v-btn v-bind="props" icon variant="text" size="24" class="ml-2 cp-lock" @click="openAlertDialog">
                                <Icons :icon="'save'" :size="24" />
                            </v-btn>
                        </template>
                        <span>{{ $t('processDefinitionMap.lock') }}</span>
                    </v-tooltip>

                    <v-tooltip location="bottom" v-if="useLock && lock && isAdmin && userName != editUser">
                        <template v-slot:activator="{ props }">
                            <v-btn v-bind="props" icon variant="text" size="24" class="ml-2" @click="openAlertDialog">
                                <LockIcon width="24" height="24" />
                            </v-btn>
                        </template>
                        <span>{{ $t('processDefinitionMap.unlock') }}</span>
                    </v-tooltip>

                    <v-tooltip location="bottom" v-if="!useLock">
                        <template v-slot:activator="{ props }">
                            <v-btn v-bind="props" icon variant="text" size="24" @click="saveProcess()">
                                <Icons :icon="'save'" />
                            </v-btn>
                        </template>
                        <span>{{ $t('processDefinitionMap.save') }}</span>
                    </v-tooltip>

                    <span v-if="useLock && lock && userName && userName != editUser" class="ml-1">
                        {{ $t('processDefinitionMap.editingUser', {name: editUser}) }}
                    </span>
                    <v-tooltip :text="$t('processDefinitionMap.downloadImage')">
                        <template v-slot:activator="{ props }">
                            <v-btn v-bind="props" icon variant="text" :size="24" class="ml-3" @click="capturePng">
                                <Icons :icon="'image-download'" />
                            </v-btn>
                        </template>
                    </v-tooltip>

                    <v-tooltip v-if="isExecutionByProject" :text="$t('organizationChartDefinition.close')">
                        <template v-slot:activator="{ props }">
                            <v-btn v-bind="props" class="ml-3"
                                @click="closePDM()" icon variant="text" :size="24">
                                <Icons :icon="'close'" :size="20"/>
                            </v-btn>
                        </template>
                    </v-tooltip>

                    <!-- 프로세스 정의 체계도 캔버스 확대 축소 버튼 및 아이콘 -->
                    <!-- <v-tooltip v-if="!isExecutionByProject && componentName != 'SubProcessDetail' && !globalIsMobile.value" :text="$t('processDefinition.zoom')">
                        <template v-slot:activator="{ props }">
                            <v-btn v-bind="props" class="ml-3"
                                @click="$globalState.methods.toggleZoom()" icon variant="text" :size="24">
                                <Icons :icon="!$globalState.state.isZoomed ? 'zoom-out' : 'zoom-in'"/>
                            </v-btn>
                        </template>
                    </v-tooltip> -->
                </div>
            </div>

            <!-- route path 별 컴포넌트 호출 -->
            <div id="processMap">
                <div v-if="componentName == 'ViewProcessDetails'">
                    <ViewProcessDetails class="pa-5" :value="value" :enableEdit="enableEdit" />
                </div>
                <div v-else-if="componentName == 'SubProcessDetail'">
                    <SubProcessDetail :value="value" @capture="capturePng" :enableEdit="enableEdit" :isAdmin="isAdmin" />
                </div>
                <div v-else>
                    <div v-if="viewMode === 'proc_map' && metricsValue.domains && metricsValue.domains.length > 0" 
                        class="px-6 py-3 d-flex align-center glass-tab-container"
                    >
                        <v-tabs
                            v-model="selectedDomain"
                            color="primary"
                            align-tabs="start"
                            hide-slider
                            class="premium-tabs"
                        >
                            <!-- 전체 탭 -->
                            <v-tab
                                :value="null"
                                class="premium-tab all-tab mr-2"
                                rounded="lg"
                                variant="flat"
                            >
                                <div class="d-flex align-center">
                                    <span class="tab-text">{{ $t('processDefinitionMap.allDomains') || '전체' }}</span>
                                    <span
                                        v-if="getTotalProcessCount() > 0"
                                        class="domain-count-badge ml-2"
                                    >
                                        {{ getTotalProcessCount() }}
                                    </span>
                                </div>
                            </v-tab>
                            <v-tab
                                v-for="domain in metricsValue.domains"
                                :key="domain.id"
                                :value="domain.name"
                                class="premium-tab mr-2"
                                :class="{ 'domain-colored-tab': domain.color && selectedDomain === domain.name }"
                                :style="getTabStyle(domain)"
                                rounded="lg"
                                variant="flat"
                            >
                                <div class="d-flex align-center">
                                    <span class="tab-text">{{ domain.name }}</span>
                                    <span
                                        v-if="getDomainProcessCount(domain.id) > 0"
                                        class="domain-count-badge ml-2"
                                    >
                                        {{ getDomainProcessCount(domain.id) }}
                                    </span>
                                    <!-- 편집 모드일 때 수정/삭제 버튼 -->
                                    <div v-if="enableEdit && selectedDomain === domain.name" class="domain-actions ml-2">
                                        <v-btn
                                            icon
                                            variant="text"
                                            size="x-small"
                                            @click.stop="editDomain(domain)"
                                        >
                                            <v-icon size="14">mdi-pencil</v-icon>
                                        </v-btn>
                                        <v-btn
                                            icon
                                            variant="text"
                                            size="x-small"
                                            color="error"
                                            @click.stop="deleteDomain(domain)"
                                        >
                                            <v-icon size="14">mdi-delete</v-icon>
                                        </v-btn>
                                    </div>
                                </div>
                            </v-tab>
                        </v-tabs>
                        <v-btn
                            v-if="enableEdit"
                            icon
                            variant="tonal"
                            size="36"
                            color="primary"
                            class="ml-4 add-domain-btn"
                            @click="openDomainDialog('add')"
                        >
                            <v-icon size="20">mdi-plus</v-icon>
                        </v-btn>
                    </div>
                    <DefinitionMapList v-if="viewMode === 'proc_map'" :value="value" :enableEdit="enableEdit" @clickProcess="clickProcess" :isExecutionByProject="isExecutionByProject" @clickPlayBtn="clickPlayBtn" :domains="metricsValue.domains" :selectedDomain="selectedDomain"/>
                    <MetricsView v-else-if="viewMode === 'metrics'" :value="metricsValue" :enableEdit="enableEdit" @update:value="updateMetricsValue"/>
                </div>
            </div>

            <!-- Domain Add/Edit Dialog -->
            <v-dialog v-model="domainDialog.show" max-width="400">
                <v-card class="pa-4 rounded-lg">
                    <v-card-title class="px-0 pt-0 text-h6 font-weight-bold">
                        {{ domainDialog.mode === 'edit' ? ($t('metricsView.editDomain') || '도메인 수정') : ($t('metricsView.addDomain') || '도메인 추가') }}
                    </v-card-title>
                    <v-text-field
                        v-model="domainDialog.name"
                        :label="$t('metricsView.domainName') || '도메인 명'"
                        variant="outlined"
                        density="comfortable"
                        hide-details
                        class="mt-2"
                        @keyup.enter="saveDomain"
                        autofocus
                    ></v-text-field>

                    <!-- 색상 선택 -->
                    <div class="mt-4">
                        <div class="text-subtitle-2 mb-2">{{ $t('processDefinitionMap.selectColor') || '색상 선택' }}</div>
                        <div class="d-flex flex-wrap" style="gap: 8px;">
                            <div
                                v-for="color in domainColors"
                                :key="color"
                                class="color-option"
                                :class="{ 'color-selected': domainDialog.color === color }"
                                :style="{ backgroundColor: color }"
                                @click="domainDialog.color = color"
                            ></div>
                        </div>
                        <v-btn
                            v-if="domainDialog.color"
                            variant="text"
                            size="small"
                            class="mt-2"
                            @click="domainDialog.color = null"
                        >
                            {{ $t('common.reset') || '초기화' }}
                        </v-btn>
                    </div>

                    <v-card-actions class="px-0 pb-0 mt-4">
                        <v-spacer></v-spacer>
                        <v-btn
                            variant="text"
                            @click="domainDialog.show = false"
                            class="rounded-pill"
                        >
                            {{ $t('common.cancel') || '취소' }}
                        </v-btn>
                        <v-btn
                            color="primary"
                            variant="flat"
                            @click="saveDomain"
                            :disabled="!domainDialog.name.trim()"
                            class="rounded-pill px-6"
                        >
                            {{ $t('common.save') || '저장' }}
                        </v-btn>
                    </v-card-actions>
                </v-card>
            </v-dialog>


            <v-row class="ma-0 pa-0">
                <v-col 
                    v-for="(card, index) in actionCards" 
                    :key="index"
                    v-show="card.show"
                    cols="12" 
                    lg="3" 
                    md="4" 
                    sm="6"
                    class="pa-4"
                >
                    <v-card
                        @click="card.action"
                        class="consulting-card"
                        elevation="3"
                        rounded="lg"
                    >
                        <v-card-item class="pa-5">
                            <div class="d-flex align-center">
                                <v-avatar
                                    color="primary"
                                    size="42"
                                    class="mr-4"
                                >
                                    <Icons :icon="card.icon" :size="24" color="white" />
                                </v-avatar>
                                <div>
                                    <v-card-title class="text-primary font-weight-bold pb-1" style="white-space: normal; line-height: 1.2;">
                                        {{ card.title }}
                                    </v-card-title>
                                    <div class="text-subtitle-2 text-grey-darken-1">
                                        {{ card.description }}
                                    </div>
                                </div>
                            </div>
                        </v-card-item>
                    </v-card>
                </v-col>
            </v-row>
        </v-card>
        <v-dialog v-model="openConsultingDialog"
            :style="ProcessPreviewMode ? (isSimulateMode ? 'max-width: 3px; max-height: 3px;' : '') : 'max-width: 1000px;'"
            :fullscreen="isMobile"
            :scrim="isSimulateMode ? false : true" persistent
            class="process-definition-map-chat-card-dialog"
        >
            <v-card class="process-definition-map-chat-card">
                <v-row class="ma-0 pa-3" style="background-color:rgb(var(--v-theme-primary), 0.2); height:50px;">
                    <v-icon small style="margin-right: 10px;">mdi-auto-fix</v-icon>
                    <div>{{ $t('processDefinitionMap.consultingAI') }}</div>
                    <v-spacer></v-spacer>
                    <v-icon @click="closeConsultingDialog()" small style="margin-right: 5px; float: right;">mdi-close</v-icon>
                </v-row>
                <ProcessDefinitionChat class="process-definition-map-chat"
                    ref="processDefinitionChat"
                    :chatMode="'consulting'"
                    @createdBPMN="createdBPMN"
                    @openProcessPreview="openProcessPreview" 
                    @executeSimulate="executeSimulate"
                    @closeExecuteDialog="closeExecuteDialog"
                    @closeConsultingDialog="closeConsultingDialog"
                />
            </v-card>
        </v-dialog>
        <v-dialog v-model="alertDialog" max-width="500" persistent>
            <v-card class="pa-2" style="border-radius: 16px;">
                <v-card-title class="d-flex align-center pa-2 pb-0">
                    <v-spacer></v-spacer>
                    <v-btn @click="alertDialog = false"
                        variant="text" 
                        density="compact"
                        icon
                    >
                        <v-icon size="20">mdi-close</v-icon>
                    </v-btn>
                </v-card-title>

                <v-card-text class="pa-4 pt-0 text-body-1 alert-message" style="line-height: 1.6;">
                    {{ alertMessage }}
                </v-card-text>

                <v-card-actions class="pa-4 pt-0">
                    <v-spacer></v-spacer>
                    <div v-for="(btn, index) in actionButtons" :key="index">
                        <v-btn v-if="btn.show" 
                            @click="btn.action"
                            :class="btn.class + (index > 0 ? ' ml-2' : '')" 
                            :color="btn.color ? btn.color : 'gray'"
                            rounded 
                            variant="flat"
                            class="px-6"
                        >{{ btn.text }}
                        </v-btn>
                    </div>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <v-dialog v-model="openMarketplaceDialog" 
            persistent
            fullscreen
        >
            <process-definition-market-place @closeMarketplaceDialog="closeMarketplaceDialog" />
        </v-dialog>
    </div>
</template>

<script>
import domtoimage from 'dom-to-image';
import DefinitionMapList from './DefinitionMapList.vue';
import ProcessMenu from './ProcessMenu.vue';
import SubProcessDetail from './SubProcessDetail.vue';
import ViewProcessDetails from './ViewProcessDetails.vue';
import ProcessDefinitionChat from '@/components/ProcessDefinitionChat.vue';
import ProcessDefinitionMarketPlace from '@/components/ProcessDefinitionMarketPlace.vue';
import Chat from '@/components/ui/Chat.vue';
import DetailComponent from '@/components/ui-components/details/DetailComponent.vue';
import MetricsView from './MetricsView.vue';

import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

import * as jsondiff from 'jsondiffpatch';
var jsondiffpatch = jsondiff.create({
    objectHash: function (obj, index) {
        return '$$index:' + index;
    }
});

export default {
    components: {
        ProcessMenu,
        ViewProcessDetails,
        SubProcessDetail,
        DefinitionMapList,
        ProcessDefinitionChat,
        ProcessDefinitionMarketPlace,
        Chat,
        DetailComponent,
        MetricsView
    },
    props: {
        componentName: {
            type: String,
            required: true
        },
        isViewMode: {
            type: Boolean,
            default: false
        },
        isExecutionByProject: {
            type: Boolean,
            default: false
        }
    },
    data: () => ({
        value: {
            mega_proc_list: []
        },
        copyValue: null,
        type: 'map',
        enableEdit: false,
        userName: null,
        lock: null,
        editUser: null,
        alertType: '',
        alertDialog: false,
        alertMessage: '',
        isAdmin: false,
        versionHistory: [],
        openConsultingDialog: false,
        ProcessPreviewMode: false,
        openMarketplaceDialog: false,
        isSimulateMode: false,
        windowWidth: window.innerWidth,
        pendingRoute: null,
        viewMode: 'proc_map',
        selectedDomain: null,
        domainDialog: {
            show: false,
            mode: 'add', // 'add' or 'edit'
            name: '',
            color: null,
            editItem: null
        },
        colorPickerDomain: null,
        domainColors: [
            '#E53935', // Red
            '#D81B60', // Pink
            '#8E24AA', // Purple
            '#5E35B1', // Deep Purple
            '#3949AB', // Indigo
            '#1E88E5', // Blue
            '#00ACC1', // Cyan
            '#00897B', // Teal
            '#43A047', // Green
            '#7CB342', // Light Green
            '#FB8C00', // Orange
            '#6D4C41', // Brown
        ],
        metricsValue: {
            domains: [],
            mega_processes: [],
            processes: []
        },
        usageGuideDetails: [
            { 
                icon: 'pencil', 
                title: 'processDefinitionMap.usageGuide.details.0.title' 
            },
            { 
                icon: 'image-download', 
                title: 'processDefinitionMap.usageGuide.details.1.title' 
            },
            { 
                icon: 'magic', 
                title: 'processDefinitionMap.usageGuide.details.2.title' 
            },
            { 
                icon: 'market', 
                title: 'processDefinitionMap.usageGuide.details.3.title' 
            }
        ]
    }),
    computed: {
        useLock() {
            if(window.$mode == "ProcessGPT"){
                return true;
            } else {
                return this.isViewMode;
            }
        },
        isMobile() {
            return window.innerWidth <= 768;
        },
        actionCards() {
            return [
                {
                    show: this.componentName === 'DefinitionMapList' && this.isAdmin,
                    icon: 'magic',
                    title: this.$t('processDefinitionMap.consultingButton'),
                    description: this.$t('processDefinitionMap.analyzeAndImproveProcessWithAI'),
                    action: () => {
                        this.openConsultingDialog = true;
                        this.ProcessPreviewMode = false;
                    }
                },
                {
                    show: this.componentName === 'DefinitionMapList' && this.mode === 'ProcessGPT' && this.isAdmin,
                    icon: 'market',
                    title: this.$t('processDefinitionMap.marketplace'),
                    description: this.$t('processDefinitionMap.marketplaceExplanation'),
                    action: () => {
                        this.openMarketplaceDialog = true;
                    }
                },
                // {
                //     show: this.componentName === 'DefinitionMapList' && this.isAdmin,
                //     icon: 'file-tree',
                //     title: this.$t('processDefinitionMap.treeView'),
                //     description: this.$t('processDefinitionMap.treeViewExplanation'),
                //     action: () => {
                //         this.navigateToTreeView();
                //     }
                // }
            ];
        },
        actionButtons() {
            return [
                {
                    // 취소 후 잠금
                    show: this.alertType === 'checkin' && this.userName && this.userName === this.editUser,
                    text: this.$t('processDefinitionMap.cancelCheckIn'),
                    class: 'cp-check-in',
                    action: async () => {
                        this.checkIn();
                        if (this.pendingRoute) {
                            this.pendingRoute.next();
                            this.pendingRoute = null;
                        } else {
                            await this.getProcessMap();
                        }
                    }
                },
                {
                    show: this.alertType === 'checkout',
                    text: this.$t('processDefinitionMap.confirm'),
                    color: 'primary',
                    class: 'cp-check-out',
                    action: this.checkOut   // 잠금 해제
                },
                {
                    // 저장 후 잠금
                    show: this.alertType === 'checkin' && this.userName && this.userName === this.editUser,
                    text: this.$t('processDefinitionMap.saveCheckIn'),
                    color: 'primary',
                    class: 'cp-check-in',
                    action: () => {
                        this.checkIn();
                        this.saveProcess();
                        if (this.pendingRoute) {
                            this.pendingRoute.next();
                            this.pendingRoute = null;
                        }
                    }
                },
                {
                    show: this.alertType === 'checkin' && this.userName && this.userName !== this.editUser,
                    text: this.$t('processDefinitionMap.confirm'),
                    color: 'primary',
                    class: 'cp-check-in',
                    action: async () => {
                        await this.getProcessMap();
                        this.checkOut();
                    }
                },
                {
                    show: this.alertType === 'download',
                    text: this.$t('processDefinitionMap.download'),
                    color: 'primary',
                    action: this.download
                }
            ];
        },
        mode() {
            return window.$mode;
        }
    },
    watch: {
        enableEdit(newVal, oldVal) {
            if(newVal && newVal !== oldVal) {
                this.copyValue = JSON.parse(JSON.stringify(this.value));
            }
        },
        async viewMode(newVal) {
            if (newVal === 'metrics') {
                await this.syncCardToMetrics();
                await this.getMetricsMap();
            } else if (newVal === 'proc_map') {
                await this.syncMetricsToCard();
                await this.getProcessMap();
            }
        }
    },
    async created() {
        var me = this;
        me.$try({
            action: async () => {
                me.userName = localStorage.getItem("userName");
                const isAdmin = localStorage.getItem("isAdmin");
                if (isAdmin == "true") {
                    me.isAdmin = true;
                }
                await me.getProcessMap();
                await me.getMetricsMap();
                // selectedDomain은 null로 유지하여 "전체" 탭이 기본 선택됨
                if (me.useLock) {
                    await me.checkedLock();
                } else {
                    // uEngine
                    me.editUser = me.userName;
                    me.enableEdit = true;
                }
            },
        });
    },
    mounted() {
        window.addEventListener('localStorageChange', (event) => {
            if (event.detail.key === 'isAdmin') {
                this.isAdmin = event.detail.value === 'true' || event.detail.value === true;
            }
        });
    },
    beforeRouteLeave(to, from, next) {
        if (this.lock && this.enableEdit) {
            this.pendingRoute = { to, from, next };
            this.openAlertDialog();
        } else {
            this.pendingRoute = null;
            next();
        }
    },
    methods: {
        async syncCardToMetrics() {
            if (!this.value || !this.value.mega_proc_list) return;

            // 1. Ensure "Access" domain exists
            let accessDomain = this.metricsValue.domains.find(d => d.name === 'Access');
            if (!accessDomain) {
                const newId = 'access';
                accessDomain = {
                    id: newId,
                    name: 'Access',
                    order: this.metricsValue.domains.length + 1
                };
                this.metricsValue.domains.push(accessDomain);
            }

            // Rebuild mega_processes and processes to handle deletions
            const newMegaProcesses = [];
            const newProcesses = [];

            // 2. Sync Mega Processes
            this.value.mega_proc_list.forEach((mega, megaIndex) => {
                const metricMega = {
                    id: mega.id,
                    name: mega.name,
                    order: megaIndex + 1
                };
                newMegaProcesses.push(metricMega);

                // 3. Sync Major Processes (as Processes in Metric View)
                if (mega.major_proc_list) {
                    mega.major_proc_list.forEach(major => {
                        let targetDomainName = major.domain || 'Access';
                        major.domain = targetDomainName; // Update card data with default domain
                        let targetDomain = this.metricsValue.domains.find(d => d.name === targetDomainName);
                        
                        if (!targetDomain) {
                            const newId = targetDomainName.toLowerCase().replace(/[/.]/g, '_');
                            targetDomain = {
                                id: newId,
                                name: targetDomainName,
                                order: this.metricsValue.domains.length + 1
                            };
                            this.metricsValue.domains.push(targetDomain);
                        }

                        const metricProc = {
                            id: major.id,
                            name: major.name,
                            domain_id: targetDomain.id,
                            mega_process_id: metricMega.id,
                            sub_proc_list: []
                        };

                        // 4. Sync Sub Processes
                        if (major.sub_proc_list) {
                            major.sub_proc_list.forEach(sub => {
                                metricProc.sub_proc_list.push({
                                    id: sub.id,
                                    name: sub.name
                                });
                            });
                        }
                        newProcesses.push(metricProc);
                    });
                }
            });

            this.metricsValue.mega_processes = newMegaProcesses;
            this.metricsValue.processes = newProcesses;

            // Save updated metrics map
            await backend.putMetricsMap(this.metricsValue);
        },
        async syncMetricsToCard() {
            if (!this.metricsValue || !this.metricsValue.mega_processes) return;

            const newMegaProcList = [];

            // 1. Sync Mega Processes
            this.metricsValue.mega_processes.forEach(metricMega => {
                const cardMega = {
                    id: metricMega.id,
                    name: metricMega.name,
                    major_proc_list: []
                };

                // 2. Sync Processes (as Major Processes in Card View)
                const relatedProcesses = this.metricsValue.processes.filter(p => p.mega_process_id === metricMega.id);
                
                relatedProcesses.forEach(metricProc => {
                    // Find domain name for this process
                    const domain = this.metricsValue.domains.find(d => d.id === metricProc.domain_id);
                    const domainName = domain ? domain.name : null;

                    const cardMajor = {
                        id: metricProc.id,
                        name: metricProc.name,
                        domain: domainName,
                        sub_proc_list: metricProc.sub_proc_list || []
                    };
                    cardMega.major_proc_list.push(cardMajor);
                });

                newMegaProcList.push(cardMega);
            });

            this.value.mega_proc_list = newMegaProcList;

            // Save updated process map
            await backend.putProcessDefinitionMap(this.value);
        },
        closePDM(){
            this.$emit('closePDM')
        },
        async closeMarketplaceDialog() {
            await this.getProcessMap();
            this.openMarketplaceDialog = false;
        },
        async addSampleProcess() {
            if (this.mode == "ProcessGPT") {
                await backend.addSampleProcess();
                this.EventBus.emit('definitions-updated');
                await this.getProcessMap();
            }
        },
        openProcessPreview(){
            this.ProcessPreviewMode = true
        },
        executeSimulate(){
            this.isSimulateMode = true
        },
        closeExecuteDialog(){
            this.isSimulateMode = false
        },
        createdBPMN(res){
            const generateUniqueMegaProcessId = () => {
                function s4() {
                    return Math.floor((1 + Math.random()) * 0x10000)
                        .toString(16)
                        .substring(1);
                }

                return s4() + s4() + '-' + s4() + '-' + s4() + s4() + s4();
            };

            const addSubProcess = async (majorProc) => {
                majorProc.sub_proc_list.push({
                    id: res.processDefinitionId,
                    name: res.processDefinitionName,
                    new: true
                });

                await this.saveProcess();
            };

            if (res.megaProcessId === "") {
                let uncategorizedMegaProc = this.value.mega_proc_list.find(megaProc => megaProc.name === this.$t('processDefinitionMap.uncategorized'));
                if (!uncategorizedMegaProc) {
                    uncategorizedMegaProc = {
                        id: generateUniqueMegaProcessId(),
                        name: this.$t('processDefinitionMap.uncategorized'),
                        major_proc_list: [{
                            id: "0",
                            name: this.$t('processDefinitionMap.uncategorized'),
                            sub_proc_list: []
                        }]
                    };
                    this.value.mega_proc_list.push(uncategorizedMegaProc);
                }

                addSubProcess(uncategorizedMegaProc.major_proc_list[0]);
                return;
            }

            if (!this.value || !this.value.mega_proc_list) {
                this.value = {
                    mega_proc_list: []
                };
            }

            let megaProc = null
            if (this.value.mega_proc_list.length == 0) {
                megaProc = {
                    id: res.megaProcessId,
                    name: res.megaProcessId,
                    major_proc_list: []
                };
                this.value.mega_proc_list.push(megaProc);
            } else {
                megaProc = this.value.mega_proc_list.find(megaProc => megaProc.id === res.megaProcessId);
            }

            if (!megaProc && res.megaProcessId) {
                megaProc = {
                    id: res.megaProcessId,
                    name: res.megaProcessId,
                    major_proc_list: []
                };
                this.value.mega_proc_list.push(megaProc);
            }

            let majorProc = null;
            if (megaProc.major_proc_list.length == 0) {
                majorProc = {
                    id: res.majorProcessId || generateUniqueMegaProcessId(),
                    name: res.majorProcessId || this.$t('processDefinitionMap.uncategorized'),
                    sub_proc_list: []
                };
                megaProc.major_proc_list.push(majorProc);
            } else {
                majorProc = megaProc.major_proc_list.find(majorProc => majorProc.id === res.majorProcessId);
            }

            addSubProcess(majorProc);
        },
        closeConsultingDialog(option) {
            if (option || (this.ProcessPreviewMode && this.$refs.processDefinitionChat && this.$refs.processDefinitionChat.lock)) {
                this.openConsultingDialog = false;
            } else {
                const confirmMessage = this.ProcessPreviewMode ? this.$t('processDefinitionMap.closeConsultingInPreview') : this.$t('processDefinitionMap.closeConsulting');
                const answer = window.confirm(confirmMessage);
                if (answer) {
                    this.ProcessPreviewMode = false
                    this.openConsultingDialog = false
                }
            }
        },
        async checkedLock() {
            if (this.isAdmin) {
                this.enableEdit = false;
                const lockObj = await backend.getLock('process-map');
                if (lockObj && lockObj.id && lockObj.user_id) {
                    this.lock = true;
                    this.editUser = lockObj.user_id;
                    if (this.userName == this.editUser) {
                        this.enableEdit = true;
                    }
                } else {
                    this.lock = false;
                }
            }
        },
        capturePng() {
            var node = document.getElementById('processMap');
            domtoimage.toPng(node, { bgcolor: 'white' })
                .then(function (dataUrl) {
                    const link = document.createElement('a');
                    // Set the link's href to the data URL of the PNG image
                    link.href = dataUrl;
                    // Configure the download attribute of the link
                    link.download = 'process_definition_map.png';
                    // Append the link to the body
                    document.body.appendChild(link);
                    // Trigger the download by simulating a click on the link
                    link.click();
                    // Remove the link from the body
                    document.body.removeChild(link);
                })
                .catch(function (error) {
                    console.error('oops, something went wrong!', error);
                });
        },
        goProcessMap() {
            this.$router.push(`/definition-map`);
        },
        async getProcessMap() {
            this.value = await backend.getProcessDefinitionMap();
        },
        async getMetricsMap() {
            this.metricsValue = await backend.getMetricsMap();
            // selectedDomain은 null로 유지하여 "전체" 탭이 기본 선택됨
        },
        async updateMetricsValue(newValue) {
            this.metricsValue = newValue;
            // selectedDomain은 null로 유지하여 "전체" 탭이 기본 선택됨
            await backend.putMetricsMap(newValue);
        },
        addProcess(newProcess) {
            this.value.mega_proc_list.push({
                id: newProcess.id,
                name: newProcess.name,
                major_proc_list: [],
            });
        },
        openDomainDialog(mode, domain = null) {
            this.domainDialog = {
                show: true,
                mode: mode,
                name: domain ? domain.name : '',
                color: domain ? domain.color || null : null,
                editItem: domain
            };
        },
        editDomain(domain) {
            this.openDomainDialog('edit', domain);
        },
        async deleteDomain(domain) {
            if (!confirm(this.$t('metricsView.confirmDeleteDomain') || '이 도메인을 삭제하시겠습니까?')) {
                return;
            }

            this.metricsValue.domains = this.metricsValue.domains.filter(d => d.id !== domain.id);
            this.metricsValue.processes = this.metricsValue.processes.filter(p => p.domain_id !== domain.id);

            await backend.putMetricsMap(this.metricsValue);
            this.selectedDomain = null;
        },
        async saveDomain() {
            const trimmedName = this.domainDialog.name.trim();
            if (!trimmedName) return;

            if (this.domainDialog.mode === 'add') {
                // Duplicate check
                const isDuplicate = this.metricsValue.domains.some(d => d.name.toLowerCase() === trimmedName.toLowerCase());
                if (isDuplicate) {
                    alert(this.$t('processDefinitionMap.duplicateName') || '동일한 이름이 이미 존재합니다.');
                    return;
                }

                const newId = trimmedName.toLowerCase().replace(/[/.]/g, '_');
                const newOrder = this.metricsValue.domains.length + 1;

                this.metricsValue.domains.push({
                    id: newId,
                    name: trimmedName,
                    color: this.domainDialog.color,
                    order: newOrder
                });

                this.selectedDomain = trimmedName;
            } else {
                // Edit mode
                const domain = this.metricsValue.domains.find(d => d.id === this.domainDialog.editItem.id);
                if (domain) {
                    domain.name = trimmedName;
                    domain.color = this.domainDialog.color;
                    if (this.selectedDomain === this.domainDialog.editItem.name) {
                        this.selectedDomain = trimmedName;
                    }
                }
            }

            await backend.putMetricsMap(this.metricsValue);
            this.domainDialog.show = false;
        },
        getDomainProcessCount(domainId) {
            if (!this.metricsValue || !this.metricsValue.processes) return 0;
            return this.metricsValue.processes
                .filter(p => p.domain_id === domainId)
                .reduce((sum, p) => sum + (p.sub_proc_list ? p.sub_proc_list.length : 0), 0);
        },
        getTotalProcessCount() {
            if (!this.metricsValue || !this.metricsValue.processes) return 0;
            return this.metricsValue.processes
                .reduce((sum, p) => sum + (p.sub_proc_list ? p.sub_proc_list.length : 0), 0);
        },
        getDomainColor(domainName) {
            if (!domainName || !this.metricsValue.domains) return null;
            const domain = this.metricsValue.domains.find(d => d.name === domainName);
            return domain?.color || null;
        },
        getContrastTextColor(hexColor) {
            if (!hexColor) return '#000000';
            // Remove # if present
            const hex = hexColor.replace('#', '');
            const r = parseInt(hex.substr(0, 2), 16);
            const g = parseInt(hex.substr(2, 2), 16);
            const b = parseInt(hex.substr(4, 2), 16);
            // Calculate relative luminance
            const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            return luminance > 0.5 ? '#000000' : '#FFFFFF';
        },
        async updateDomainColor(domain, color) {
            domain.color = color;
            this.colorPickerDomain = null;
            await backend.putMetricsMap(this.metricsValue);
        },
        getTabStyle(domain) {
            if (!domain || !domain.color) return {};
            // 활성화된 탭만 도메인 색상 적용
            const isSelected = this.selectedDomain === domain.name;
            if (!isSelected) return {};

            const textColor = this.getContrastTextColor(domain.color);
            return {
                '--domain-color': domain.color,
                '--domain-text-color': textColor,
                '--badge-bg': textColor === '#FFFFFF' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.3)'
            };
        },
        getBadgeStyle(domain) {
            // 도메인 색상이 있으면 그에 맞는 대비색
            if (domain?.color) {
                const textColor = this.getContrastTextColor(domain.color);
                return {
                    backgroundColor: textColor === '#FFFFFF' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.3)',
                    color: textColor
                };
            }
            // 색상 없는 도메인: 어두운 텍스트
            return {
                backgroundColor: 'rgba(0,0,0,0.1)',
                color: '#555'
            };
        },
        updatePermissionsFromDiff(diff) {
            var me = this;
            async function extractIds(obj, path = "") {
                if (typeof obj === 'object' && !Array.isArray(obj)) {
                    for (const key in obj) {
                        if (key.startsWith("_")) {
                            // 삭제된 요소
                            if (Array.isArray(obj[key]) && obj[key].length > 0 && typeof obj[key][0] === 'object') {
                                const process = obj[key][0];
                                const permissions = await me.checkPermissions(process);
                                if (permissions) {
                                    const perUsers = permissions.map(permission => permission.user_id);
                                    perUsers.forEach(async (user) => {
                                        await me.deletePermissions(process, user);
                                    });
                                }
                                // console.log(`삭제된 ID: ${process.id}`, process);
                            }
                        } else {
                            // 추가되거나 수정된 요소
                            if (Array.isArray(obj[key]) && obj[key].length > 0 && typeof obj[key][0] === 'object') {
                                const process = obj[key][0];
                                const permissions = await me.checkPermissions(process);
                                if (permissions && permissions.length > 0) {
                                    permissions.forEach(async (permission) => {
                                        const perUsers = permission.user_id;
                                        const processList = permission.proc_def_ids;
                                        await me.putPermissions(process, perUsers, processList);
                                    });
                                    // console.log(`수정된 ID: ${process.id}`, process)
                                } else {
                                    const uid = localStorage.getItem('uid');
                                    await me.putPermissions(process, uid, process);
                                    // console.log(`추가된 ID: ${process.id}`, process);
                                }
                            }
                            extractIds(obj[key], path + `/${key}`);
                        }
                    }
                } else if (Array.isArray(obj)) {
                    obj.forEach((item, index) => {
                        extractIds(item, path + `/${index}`);
                    });
                }
            }
            extractIds(diff);
        },
        async checkPermissions(process) {
            if (Array.isArray(process)) {
                process.forEach(async (item) => {
                    const permissions = await backend.getUserPermissions({ proc_def_id: item.id });
                    if (permissions && permissions.length > 0) {
                        return permissions;
                    }
                });
            } else {
                const permissions = await backend.getUserPermissions({ proc_def_id: process.id });
                if (permissions && permissions.length > 0) {
                    return permissions;
                }
            }
            return null;
        },
        async putPermissions(process, userId, processList) {
            const permission = {
                user_id: userId,
                proc_def_id: process.id,
                proc_def_ids: processList,
                writable: true,
                readable: true,
            }
            await backend.putUserPermission(permission);
        },
        async deletePermissions(process, userId) {
            await backend.deleteUserPermission({ user_id: userId, proc_def_id: process.id });
        },
        async saveProcess() {
            if (this.viewMode === 'metrics') {
                await this.syncMetricsToCard();
            } else {
                await this.syncCardToMetrics();
            }
            await backend.putProcessDefinitionMap(this.value);
            await this.getProcessMap();
            this.closeAlertDialog();
        },
        async checkIn() {
            const isConnected = await backend.checkDBConnection();
            if (!isConnected) {
                this.alertDialog = true;
                this.alertMessage = this.$t('processDefinitionMap.checkInDBError');
                this.alertType = 'download';
            } else {
                this.lock = false;
                this.enableEdit = false;
                if (this.useLock) {
                    await backend.deleteLock('process-map');
                }
                this.closeAlertDialog();
            }
        },
        async checkOut() {
            const isConnected = await backend.checkDBConnection();
            if (!isConnected) {
                alert(this.$t('processDefinitionMap.checkOutDBError'));
            } else {
                this.lock = true;
                this.enableEdit = true;
                if (this.useLock && this.userName && this.userName != undefined) {
                    this.editUser = this.userName;
                    let lockObj = {
                        id: 'process-map',
                        user_id: this.editUser,
                    }
                    await backend.setLock(lockObj);
                }
            }
            this.closeAlertDialog();
        },
        download() {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.value));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "process-map.json");
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            this.closeAlertDialog();
        },
        async openAlertDialog() {
            var me = this
            me.$try({
                context: me,
                action: async () => {
                    if(me.useLock){
                        // GPT 모드인 경우
                        const lockObj = await backend.getLock('process-map');
                        if (lockObj && lockObj.id && lockObj.user_id) {
                            me.lock = true;
                            me.editUser = lockObj.user_id;
                            if (me.editUser == me.userName) {
                                me.alertDialog = true;
                                me.alertMessage = this.$t('processDefinitionMap.checkInMessage');
                            } else {
                                me.alertDialog = true;
                                me.alertMessage = this.$t('processDefinitionMap.forcedCheckOutMessage', {name: me.editUser});
                                me.enableEdit = false;
                            }
                            me.alertType = 'checkin';
                        } else {
                            me.lock = false;
                            me.enableEdit = false;
                            me.alertDialog = true;
                            me.alertMessage = this.$t('processDefinitionMap.checkOutMessage');
                            me.alertType = 'checkout';
                        }
                    } else {
                        // Uegnine 모드인 경우
                        me.lock = false;
                    }                        
                }
            });
        },
        closeAlertDialog() {
            this.alertDialog = false;
            this.alertType = '';
            this.alertMessage = '';
        },
        clickProcess(id) {
            this.$emit('clickProcess', id);
        },
        clickPlayBtn(value){
            this.$emit('clickPlayBtn', value)
        },
        async navigateToTreeView() {
            // 첫 번째 서브프로세스를 찾아서 해당 경로로 이동
            try {
                const processMap = await backend.getProcessDefinitionMap();
                let firstSubProcessId = null;

                // mega_proc_list를 순회하며 첫 번째 서브프로세스 찾기
                if (processMap && processMap.mega_proc_list) {
                    for (const megaProc of processMap.mega_proc_list) {
                        if (megaProc.major_proc_list && megaProc.major_proc_list.length > 0) {
                            for (const majorProc of megaProc.major_proc_list) {
                                if (majorProc.sub_proc_list && majorProc.sub_proc_list.length > 0) {
                                    firstSubProcessId = majorProc.sub_proc_list[0].id;
                                    break;
                                }
                            }
                        }
                        if (firstSubProcessId) break;
                    }
                }

                // 첫 번째 서브프로세스로 이동, 없으면 chat으로 이동
                // const targetPath = firstSubProcessId 
                //     ? `/definitions-tree/${firstSubProcessId}` 
                //     : '/definitions-tree/chat';
                const targetPath = `/definitions-tree`
                
                this.$router.push(targetPath);
            } catch (error) {
                console.error('TreeView 이동 중 오류:', error);
                // 오류 발생 시 기본 경로로 이동
                this.$router.push('/definitions-tree/chat');
            }
        }
    },
}
</script>

<style scoped>
.glass-tab-container {
    background: #ffffff;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    position: sticky;
    top: 60px; /* Adjust based on header height */
    z-index: 10;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
}

.premium-tabs :deep(.v-slide-group__content) {
    padding: 6px 0;
}

.premium-tab {
    text-transform: none !important;
    font-weight: 600 !important;
    letter-spacing: -0.01em !important;
    color: #555 !important;
    background: rgba(0, 0, 0, 0.04);
    transition: all 0.2s ease !important;
    border: none !important;
    height: 36px !important;
    min-width: auto !important;
    max-width: 200px !important;
    padding: 0 14px !important;
    overflow: hidden !important;
    flex-shrink: 0 !important;
}

.premium-tab .d-flex {
    white-space: nowrap;
    overflow: hidden;
}

.premium-tab .tab-text {
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 120px;
}

.premium-tab:not(.domain-colored-tab):hover {
    background: rgba(0, 0, 0, 0.08) !important;
}

/* 전체 탭 - 활성화 시 그라데이션 */
.premium-tab.all-tab.v-tab--selected {
    background: linear-gradient(135deg, rgb(var(--v-theme-primary)), #6366f1) !important;
    color: white !important;
}

/* 색상 없는 도메인 탭 - 활성화 시 */
.premium-tab.v-tab--selected:not(.domain-colored-tab):not(.all-tab) {
    background: rgb(var(--v-theme-primary)) !important;
    color: white !important;
}

/* 색상 있는 도메인 탭 - CSS 변수로 배경색 적용 */
.premium-tab.domain-colored-tab {
    background: var(--domain-color) !important;
    color: var(--domain-text-color) !important;
}

.premium-tab.domain-colored-tab:hover {
    filter: brightness(0.92);
}

.tab-text {
    font-size: 0.875rem;
}

/* 커스텀 카운트 배지 */
.domain-count-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 600;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 9px;
    color: inherit;
}

/* 비활성 탭 배지 기본 스타일 */
.premium-tab .domain-count-badge {
    background-color: rgba(0,0,0,0.1);
    color: #555;
}

/* 전체 탭 활성화 시 배지 흰색 */
.premium-tab.all-tab.v-tab--selected .domain-count-badge {
    background-color: rgba(255,255,255,0.25) !important;
    color: #fff !important;
}

/* 색상 없는 도메인 탭 활성화 시 배지 */
.premium-tab.v-tab--selected:not(.domain-colored-tab):not(.all-tab) .domain-count-badge {
    background-color: rgba(255,255,255,0.25) !important;
    color: #fff !important;
}

/* 색상 있는 도메인 탭 배지 - CSS 변수 사용 */
.premium-tab.domain-colored-tab .domain-count-badge {
    background-color: var(--badge-bg) !important;
    color: var(--domain-text-color) !important;
}

.add-domain-btn {
    transition: all 0.3s ease;
    background: rgba(var(--v-theme-primary), 0.08) !important;
}

.add-domain-btn:hover {
    background: rgb(var(--v-theme-primary)) !important;
    color: white !important;
    transform: rotate(90deg) scale(1.1);
}

.border-b {
    border-bottom: 1px solid rgba(0, 0, 0, 0.05) !important;
}

/* Domain color styles */
.domain-color-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1.5px solid;
    flex-shrink: 0;
}

.domain-color-dot:hover {
    transform: scale(1.15);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.color-option {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 2px solid transparent;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.color-option:hover {
    transform: scale(1.1);
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.2);
}

.color-option.color-selected {
    border-color: #333;
    transform: scale(1.05);
    box-shadow: 0 0 0 2px white, 0 0 0 4px #333;
}

.domain-actions {
    display: flex;
    gap: 2px;
}
</style>

<style scoped>
.alert-message {
    white-space: pre-line;
}
.consulting-card {
    cursor: pointer;
    transition: transform 0.2s;
}

.consulting-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}
</style>