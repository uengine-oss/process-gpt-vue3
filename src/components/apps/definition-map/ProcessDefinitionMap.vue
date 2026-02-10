<template>
    <div class="definition-map-wrapper">
        <!-- 좌측: 정의체계도 -->
        <v-card 
            elevation="10" :style="[
            !$globalState.state.isZoomed ? '' : 'height:100vh;',
            'width: 100%'
        ]"
            class="is-work-height definition-map-card"
            style="overflow: auto; flex-shrink: 0;"
        >
            <!-- <div v-if="mode !== 'uEngine' && componentName == 'DefinitionMapList' && !openConsultingDialog" class="pa-4">
                <Chat 
                    :showDetailInfo="true"
                    :workAssistantAgentMode="true"
                    :disableChat="false"
                    :isMobile="isMobile"
                    @sendMessage="handleMainChatMessage"
                />
            </div> -->
            <div v-if="mode !== 'uEngine' && componentName == 'DefinitionMapList' && !openConsultingDialog" class="pa-4">
                <MainChatInput 
                    :agentInfo="mainChatAgentInfo"
                    :userId="userInfo.uid || userInfo.id"
                    @submit="handleMainChatSubmit"
                />
            </div>
            
            <!-- 헤더 영역 -->
            <div v-if="componentName != 'SubProcessDetail'" class="header-section"
                style="position: sticky; top: 0; z-index:2; background-color:white; border-bottom: 1px solid rgba(0,0,0,0.08);"
            >
                <div class="d-flex align-center justify-space-between pa-4 pl-6 pr-6" style="gap: 16px;">
                    <!-- 왼쪽: 제목 및 주요 액션 -->
                    <div class="d-flex align-center" style="gap: 12px; flex: 1; min-width: 0;">
                        <h5 v-if="!globalIsMobile.value" class="text-h5 font-weight-semibold ma-0 flex-shrink-0">{{ $t('processDefinitionMap.title') }}</h5>
                    <v-row v-else class="ma-0 pa-0 align-center flex-shrink-0">
                    <img src="/process-gpt-favicon.png" alt="Process GPT Favicon" style="height:24px; margin-right:8px;" />
                        <h5 class="text-h5 font-weight-semibold ma-0">{{ $t('processDefinitionMap.mobileTitle') }}</h5>
                </v-row>
                    <!-- 마켓플레이스 버튼 -->
                <v-btn
                    v-for="(card, index) in actionCards"
                    :key="index"
                    v-show="card.show"
                    @click="card.action"
                    color="primary"
                    variant="flat"
                    density="compact"
                                class="rounded-pill flex-shrink-0"
                >
                    <template v-slot:prepend>
                        <Icons :icon="card.icon" color="white" :size="16" />
                    </template>
                    {{ card.title }}
                </v-btn>
                    
                    <!-- 검색 기능 (Searchbar 스타일 참고) -->
                    <div class="d-flex align-center flex-fill border border-borderColor header-search rounded-pill px-5"
                        style="max-width: 246px; min-width: 160px;"
                    >
                        <Icons :icon="'magnifer-linear'" :size="20" />
                        <v-text-field
                            ref="searchInput"
                            :model-value="searchInputValue"
                            @update:model-value="searchInputValue = $event"
                            variant="plain"
                            density="compact"
                            class="position-relative pt-0 ml-3 custom-placeholer-color"
                            :placeholder="$t('processDefinitionMap.searchProcess') || '정의체계도 검색 (예: 보험, 신청)'"
                            single-line
                            hide-details
                            @keyup.enter="handleSearch"
                        />
                    </div>
                    <DetailComponent
                        class="flex-shrink-0"
                        :title="$t('processDefinitionMap.usageGuide.title')"
                        :details="usageGuideDetails"
                    />
                    
                    <v-btn 
                        v-if="!isExecutionByProject && $route.path !== '/definition-map'" 
                        icon 
                        variant="text" 
                        size="24" 
                        class="flex-shrink-0"
                        @click="goProcessMap"
                    >
                        <Icons :icon="'arrow-go-back'"/>
                    </v-btn>
                </div>
                <!-- 오른쪽: 뷰 모드 토글 + 액션 버튼들 -->
                <div class="d-flex align-center flex-shrink-0" style="gap: 8px;">
                    <!-- 뷰 모드 토글 -->
                    <v-tabs
                        v-if="componentName === 'DefinitionMapList' && mode === 'ProcessGPT'"
                        v-model="viewMode"
                        color="primary"
                        align-tabs="start"
                        hide-slider
                        density="compact"
                    >
                        <v-tab
                            value="proc_map"
                            class="premium-tab mr-2"
                            rounded="lg"
                            variant="flat"
                        >
                            <v-icon start size="16">mdi-view-grid</v-icon>
                            {{ $t('processDefinitionMap.cardView') || '카드' }}
                        </v-tab>
                        <v-tab
                            value="metrics"
                            class="premium-tab mr-2"
                            rounded="lg"
                            variant="flat"
                        >
                            <v-icon start size="16">mdi-table</v-icon>
                            {{ $t('processDefinitionMap.matrixView') || '매트릭스' }}
                        </v-tab>
                    </v-tabs>
                        
                    <!-- 액션 버튼 그룹 -->
                    <div class="d-flex align-center" style="gap: 4px;">
                        <v-tooltip location="bottom" v-if="useLock && !lock && isAdmin && !isViewMode">
                        <template v-slot:activator="{ props }">
                                <v-btn v-bind="props"
                                    @click="openAlertDialog"
                                    class="mr-2"
                                    icon variant="text"
                                    size="32"
                                >
                                <Icons :icon="'pencil'" :size="18" />
                            </v-btn>
                        </template>
                        <span>{{ $t('processDefinitionMap.unlock') }}</span>
                    </v-tooltip>

                    <v-tooltip location="bottom" v-if="useLock && lock && isAdmin && userName == editUser">
                        <template v-slot:activator="{ props }">
                                <v-btn v-bind="props" icon variant="text" size="24" class="cp-lock" @click="openAlertDialog">
                                <Icons :icon="'save'" :size="24" />
                            </v-btn>
                        </template>
                        <span>{{ $t('processDefinitionMap.lock') }}</span>
                    </v-tooltip>

                    <v-tooltip location="bottom" v-if="useLock && lock && isAdmin && userName != editUser">
                        <template v-slot:activator="{ props }">
                                <v-btn v-bind="props" icon variant="text" size="24" @click="openAlertDialog">
                                <LockIcon width="24" height="24" />
                            </v-btn>
                        </template>
                        <span>{{ $t('processDefinitionMap.unlock') }}</span>
                    </v-tooltip>

                    <v-tooltip location="bottom" v-if="!useLock">
                        <template v-slot:activator="{ props }">
                            <v-btn
                                v-bind="props"
                                icon
                                variant="text"
                                size="24"
                                @click="mode === 'uEngine' ? openSaveConfirmDialog() : saveProcess()"
                            >
                                <Icons :icon="'save'" />
                            </v-btn>
                        </template>
                        <span>{{ $t('processDefinitionMap.save') }}</span>
                    </v-tooltip>

                    <v-tooltip :text="$t('processDefinitionMap.downloadImage')">
                        <template v-slot:activator="{ props }">
                                        <v-btn v-bind="props" icon variant="text" size="24" @click="capturePng">
                                <Icons :icon="'image-download'" />
                            </v-btn>
                        </template>
                    </v-tooltip>

                    <v-tooltip v-if="isExecutionByProject" :text="$t('organizationChartDefinition.close')">
                        <template v-slot:activator="{ props }">
                                        <v-btn v-bind="props" icon variant="text" size="24" @click="closePDM()">
                                <Icons :icon="'close'" :size="20"/>
                            </v-btn>
                        </template>
                    </v-tooltip>
                        </div>
                        
                        <!-- 편집 사용자 표시 -->
                        <span v-if="useLock && lock && userName && userName != editUser" class="text-caption text-grey-darken-1 ml-2 flex-shrink-0">
                            {{ $t('processDefinitionMap.editingUser', {name: editUser}) }}
                        </span>
                    </div>
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
                    <!-- 필터 및 탭 영역 -->
                    <div v-if="viewMode === 'proc_map' && metricsValue?.domains && metricsValue.domains.length > 0" 
                        class="filter-tab-section glass-tab-container"
                    >
                        <div class="px-6 py-3 d-flex align-center" style="gap: 16px; flex-wrap: wrap;">
                            <!-- 왼쪽: 조직 필터 + 도메인 탭 -->
                            <div class="d-flex align-center" style="gap: 8px; flex: 1; min-width: 0;">
                                <!-- 조직 필터 -->
                                <div class="d-flex align-center flex-shrink-0">
                                    <v-autocomplete
                                        v-if="organizationOptions.length > 0"
                                        v-model="selectedOrganization"
                                        :items="organizationOptions"
                                        :label="$t('processDefinitionMap.filterByOrganization') || '조직 필터'"
                                        item-title="name"
                                        item-value="id"
                                        return-object
                                        clearable
                                        density="compact"
                                        variant="outlined"
                                        hide-details
                                        class="org-filter-select"
                                        style="min-width: 200px; max-width: 300px; width: auto;"
                                        :loading="loadingOrganizations"
                                    >
                                        <template v-slot:prepend-inner>
                                            <v-icon size="18" color="grey">mdi-account-group</v-icon>
                                        </template>
                                        <template v-slot:item="{ item, props }">
                                            <v-list-item v-bind="props">
                                                <template v-slot:prepend>
                                                    <v-icon :color="item.raw.type === 'group' ? 'primary' : 'grey'" size="18" class="mr-2">
                                                        {{ item.raw.type === 'group' ? 'mdi-account-group' : 'mdi-account-multiple' }}
                                                    </v-icon>
                                                </template>
                                                <template v-slot:append>
                                                    <v-chip size="x-small" :color="item.raw.type === 'group' ? 'primary' : 'grey'" variant="tonal">
                                                        {{ item.raw.type === 'group' ? $t('LanePanel.group') : $t('LanePanel.team') }}
                                                    </v-chip>
                                                </template>
                                            </v-list-item>
                                        </template>
                                    </v-autocomplete>
                                </div>
                                
                                <!-- 도메인 칩 -->
                                <div class="d-flex align-center flex-wrap" style="gap: 6px; flex: 1; min-width: 0; hover: pointer;">
                                    <!-- 전체 칩 -->
                                    <v-chip
                                        :class="selectedDomain === null ? 'domain-chip-selected' : ''"
                                        :variant="selectedDomain === null ? 'flat' : 'outlined'"
                                        size="default"
                                        class="domain-chip"
                                        clickable
                                        @click="selectedDomain = null"
                                    >{{ $t('processDefinitionMap.allDomains') || '전체' }}
                                        <v-chip
                                            v-if="getTotalProcessCount() > 0"
                                            :color="selectedDomain === null ? 'white' : 'default'"
                                            size="x-small"
                                            class="ml-2 count-chip"
                                            :variant="selectedDomain === null ? 'flat' : 'text'"
                                        >{{ getTotalProcessCount() }}
                                        </v-chip>
                                    </v-chip>
                                    
                                    <!-- 도메인 칩 -->
                                    <v-chip
                                        v-for="domain in (metricsValue?.domains ?? [])"
                                        :key="domain.id"
                                        :class="selectedDomain === domain.name ? 'domain-chip-selected' : ''"
                                        :variant="selectedDomain === domain.name ? 'flat' : 'outlined'"
                                        size="default"
                                        class="domain-chip"
                                        clickable
                                        @click="selectedDomain = domain.name"
                                    >
                                        {{ domain.name }}
                                        <v-chip
                                            v-if="getDomainProcessCount(domain.id) > 0"
                                            :color="selectedDomain === domain.name ? 'white' : 'default'"
                                            size="x-small"
                                            class="ml-2 count-chip"
                                            :variant="selectedDomain === domain.name ? 'flat' : 'text'"
                                        >{{ getDomainProcessCount(domain.id) }}
                                        </v-chip>
                                        
                                    <!-- 편집 모드일 때 수정/삭제 버튼 -->
                                        <template v-if="enableEdit && selectedDomain === domain.name">
                                        <v-btn
                                            icon
                                            variant="text"
                                            size="x-small"
                                                class="ml-1"
                                                style="min-width: 20px; width: 20px; height: 20px;"
                                            @click.stop="editDomain(domain)"
                                        >
                                                <v-icon size="12" color="white">mdi-pencil</v-icon>
                                        </v-btn>
                                        <v-btn
                                            icon
                                            variant="text"
                                            size="x-small"
                                                class="ml-1"
                                                style="min-width: 20px; width: 20px; height: 20px;"
                                            @click.stop="deleteDomain(domain)"
                                        >
                                                <v-icon size="12" color="white">mdi-delete</v-icon>
                                        </v-btn>
                                        </template>
                                    </v-chip>
                                    
                                    <!-- 도메인 추가 버튼 -->
                                    <v-btn
                                        v-if="enableEdit"
                                        icon
                                        variant="tonal"
                                                    size="32"
                                        color="primary"
                                                    class="flex-shrink-0"
                                        @click="openDomainDialog('add')"
                                    >
                                        <v-icon size="18">mdi-plus</v-icon>
                                    </v-btn>
                                </div>
                            </div>
                        </div>
                    </div>
                    <DefinitionMapList v-if="viewMode === 'proc_map'" :value="value" :enableEdit="enableEdit" @clickProcess="clickProcess" :isExecutionByProject="isExecutionByProject" @clickPlayBtn="clickPlayBtn" :domains="metricsValue?.domains ?? []" :selectedDomain="selectedDomain" :filteredProcDefIds="filteredProcDefIds" :searchQuery="searchQuery"/>
                    <MetricsView v-else-if="viewMode === 'metrics'" :value="metricsValue ?? { domains: [], mega_processes: [], processes: [] }" :enableEdit="enableEdit" @update:value="updateMetricsValue" :filteredProcDefIds="filteredProcDefIds" :searchQuery="searchQuery"/>
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

            <!-- 기존 하단에 있던 AI 컨설팅 및 마켓플레이스 카드 -->
            <!-- <v-row class="ma-0 pa-0">
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
            </v-row> -->
        </v-card>

         <v-dialog v-if="mode !== 'uEngine'" v-model="openConsultingDialog"
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

        <v-dialog v-model="saveConfirmDialog" max-width="520" persistent>
            <v-card class="pa-0">
                <v-row class="ma-0 pa-4 pb-0 flex-start">
                    <v-card-title class="pa-0 alert-message">
                        {{ saveConfirmMessage }}
                    </v-card-title>
                    <v-spacer></v-spacer>
                    <v-btn @click="closeSaveConfirmDialog()" icon variant="text" density="compact">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-row>
                <v-row class="ma-0 pa-4">
                    <v-spacer></v-spacer>
                    <v-btn
                        :disabled="saveConfirmSaving"
                        rounded
                        variant="flat"
                        color="gray"
                        @click="closeSaveConfirmDialog()"
                    >
                        {{ $t('processDefinitionMap.cancel') }}
                    </v-btn>
                    <v-btn
                        class="ml-2"
                        :loading="saveConfirmSaving"
                        :disabled="saveConfirmSaving"
                        rounded
                        variant="flat"
                        color="primary"
                        @click="confirmSaveProcess()"
                    >
                        {{ $t('processDefinitionMap.save') }}
                    </v-btn>
                </v-row>
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
import MainChatInput from '@/components/MainChatInput.vue';
import AgentChatActions from '@/components/AgentChatActions.vue';
import ChatModule from '@/components/ChatModule.vue';
import WorkAssistantGenerator from '@/components/ai/WorkAssistantGenerator.js';
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();
import { processGptAgent } from '@/constants/processGptAgent';

import * as jsondiff from 'jsondiffpatch';
var jsondiffpatch = jsondiff.create({
    objectHash: function (obj, index) {
        return '$$index:' + index;
    }
});

export default {
    mixins: [ChatModule],
    components: {
        ProcessMenu,
        ViewProcessDetails,
        SubProcessDetail,
        DefinitionMapList,
        ProcessDefinitionChat,
        ProcessDefinitionMarketPlace,
        Chat,
        DetailComponent,
        MetricsView,
        MainChatInput,
        AgentChatActions,
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
        saveConfirmDialog: false,
        saveConfirmSaving: false,
        saveConfirmMessage: '저장하시겠습니까?',
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
        selectedOrganization: null,
        organizationOptions: [],
        loadingOrganizations: false,
        filteredProcDefIds: null,  // null means no filter, [] means filter active but no matches
        searchQuery: '',  // 실제 필터링에 사용되는 검색어 (엔터키 입력 시 업데이트)
        searchInputValue: '',  // 입력 중인 검색어 (화면 표시용)
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
        messages: [], // ChatModule에서 필요한 메시지 배열
        chatRoomId: 'definition-map-main', // ChatModule에서 필요한 채팅방 ID
        userInfo: {}, // ChatModule에서 필요한 사용자 정보
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
        ],
        generator: null,
        initialConsultingMessage: null,
        mainChatAgentInfo: {
            id: "0e9a546b-9ae0-48ef-1e9e-f0e95d5bc028",
            username: "업무 지원 에이전트",
            profile: "/images/chat-icon.png",
            email: null,
            is_admin: false,
            role: "프로세스 생성과 실행, 질문 의도 분석 및 답변 제공을 통해 지원팀의 업무 효율을 높이는 에이전트",
            tenant_id: "uengine",
            device_token: null,
            goal: "지원팀 내 요청되는 프로세스의 90% 이상을 신속하게 생성 및 실행하고, 질문 의도를 정확히 분석하여 95% 이상의 정확도로 적합한 답변을 제공한다.",
            persona: "꼼꼼하고 친절하며, 팀원들과의 소통을 중시하는 협력적인 성격입니다. 항상 명확하고 이해하기 쉬운 언어로 응답하며, 복잡한 요청도 체계적으로 분석해 해결책을 제시합니다. 신뢰할 수 있는 지원 전문가로서, 긴급 상황에도 침착하게 대응하고 팀원들의 부담을 최소화하는 데 집중합니다. 언제든 피드백을 환영하며 지속적으로 업무 방식 개선을 추구합니다.",
            endpoint: "",
            description: "",
            tools: "work-assistant",
            skills: null,
            is_agent: true,
            model: "anthropic/claude-opus-4-5",
            agent_type: "agent",
            alias: ""
        }
    }),
    computed: {
        useLock() {
            if (window.$pal && window.$mode === 'uEngine') {
                return false;
            }
            if (window.$mode == "ProcessGPT") {
                return true;
            }
            return this.isViewMode;
        },
        isMobile() {
            return window.innerWidth <= 768;
        },
        actionCards() {
            return [
                // {
                //     show: this.componentName === 'DefinitionMapList' && this.isAdmin,
                //     icon: 'magic',
                //     title: this.$t('processDefinitionMap.consultingButton'),
                //     description: this.$t('processDefinitionMap.analyzeAndImproveProcessWithAI'),
                //     action: () => {
                //         this.openConsultingDialog = true;
                //         this.ProcessPreviewMode = false;
                //     }
                // },
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
        ,
        userChatHeaderTitle() {
            const u = this.selectedChatUser;
            return (u && (u.username || u.name || u.email)) ? (u.username || u.name || u.email) : '대화';
        },
        userChatHeaderProfile() {
            const u = this.selectedChatUser;
            if (!u) return null;
            let basePath = window.location.port == '' ? window.location.origin : '';
            if (u.email === 'system@uengine.org') return `${basePath}/images/chat-icon.png`;
            if (u.profile) {
                if (String(u.profile).includes('defaultUser.png')) return `${basePath}/images/defaultUser.png`;
                return u.profile;
            }
            return `${basePath}/images/defaultUser.png`;
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
        },
        async selectedOrganization(newVal) {
            if (!newVal) {
                this.filteredProcDefIds = null;
                return;
            }
            await this.loadFilteredProcDefIds(newVal.id);
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
                await me.loadOrganizationOptions();
                // selectedDomain은 null로 유지하여 "전체" 탭이 기본 선택됨
                if (me.useLock) {
                    await me.checkedLock();
                } else {
                    // uEngine
                    me.editUser = me.userName;
                    me.enableEdit = true;
                }

                // WorkAssistantGenerator 초기화 (ChatModule 스타일)
                me.generator = new WorkAssistantGenerator(me, {
                    isStream: false, // 스트리밍 비활성화 (전체 응답을 받아야 intent 파싱 가능)
                    preferredLanguage: "Korean"
                });

                // ChatModule을 위한 userInfo 설정
                me.userInfo = await backend.getUserInfo();
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
    beforeUnmount() {
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
        uuid() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        },
        normalizeParticipant(p) {
            if (!p) return null;
            return {
                id: p?.id || p?.uid || null,
                email: p?.email || null,
                username: p?.username || p?.name || p?.email || '',
                profile: p?.profile || null,
                agent_type: p?.agent_type || p?.agentType || null,
                is_agent: p?.is_agent ?? p?.isAgent ?? null
            };
        },
        participantMatches(a, b) {
            if (!a || !b) return false;
            if (a.email && b.email && a.email === b.email) return true;
            if (a.id && b.id && a.id === b.id) return true;
            return false;
        },
        async createRoomAndNavigateFromMainChat(message) {
            const userInfo = this.userInfo || await backend.getUserInfo();
            const me = this.normalizeParticipant(userInfo);

            const text = (message?.text || '').toString().trim();
            const hasImages = Array.isArray(message?.images) && message.images.length > 0;
            const hasFile = !!message?.file;

            const roomId = this.uuid();
            const nowIso = new Date().toISOString();
            const roomName = (text ? text.substring(0, 50) : '').trim() || '새 대화';

            const participants = [
                me,
                // 가상 에이전트는 DB에 저장되지 않으며 방 참가자에만 포함
                this.normalizeParticipant(processGptAgent) || processGptAgent
            ].filter(Boolean);

            const room = {
                id: roomId,
                name: roomName,
                // primary_agent_id는 DB에 실제로 존재하는 에이전트가 아닐 수 있어 저장하지 않음
                participants,
                message: { msg: 'NEW', type: 'text', createdAt: nowIso }
            };

            await backend.putObject('db://chat_rooms', room);

            const msgUuid = this.uuid();
            const msg = {
                uuid: msgUuid,
                role: 'user',
                // 첨부만 있을 때 자동 문구를 넣지 않음 (메시지는 첨부 UI로만 표시)
                content: text || '',
                timeStamp: nowIso,
                email: userInfo?.email || null,
                name: userInfo?.username || userInfo?.name || userInfo?.email || '',
                userName: userInfo?.username || userInfo?.name || userInfo?.email || '',
                images: message?.images || [],
                pdfFile: message?.file || null
            };

            await backend.putObject(`db://chats/${msgUuid}`, { uuid: msgUuid, id: roomId, messages: msg });
            // last message preview는 첨부 요약을 사용 (content는 비워둠)
            const fileName = (message?.file?.name || message?.file?.fileName || '').toString();
            const preview =
                (text || '').substring(0, 50) ||
                (hasFile ? fileName.substring(0, 50) : '') ||
                (hasImages ? `이미지 ${((message?.images || []).length || 0)}장` : '');
            room.message = { msg: (preview || '').substring(0, 50), type: 'text', createdAt: nowIso };
            await backend.putObject('db://chat_rooms', room);

            // ChatRoomPage에서 첫 메시지에 대한 에이전트 응답만 kick-off 하도록 sessionStorage에 전달
            try {
                sessionStorage.setItem(`chatKickoff:${roomId}`, JSON.stringify({
                    roomId,
                    msgUuid,
                    text,
                    images: message?.images || [],
                    file: message?.file || null,
                    createdAt: nowIso
                }));
            } catch (e) {}

            // definition-map 패널은 열지 않고 /chat으로 이동
            this.showFullScreenChat = false;
            this.pendingChatMessage = null;
            this.pendingHistoryRoom = null;
            await this.$router.push({ path: '/chat', query: { roomId } });
        },
        getActiveChatPanel() {
            return this.chatPanelMode === 'user' ? this.$refs.userChatRooms : this.$refs.workAssistantChatPanel;
        },
        getCurrentChatRoomName() {
            try {
                const panel = this.getActiveChatPanel();
                const room = panel?.currentChatRoom || panel?.currentRoom || null;
                const name = room?.name || '';
                return name || '새 대화';
            } catch (e) {
                return '새 대화';
            }
        },
        openChatRoomRenameDialog() {
            this.chatRoomRenameDraft = this.getCurrentChatRoomName();
            this.chatRoomSettingsMenu = false;
            this.chatRoomRenameDialog = true;
        },
        async confirmChatRoomRename() {
            const roomId = this.currentChatRoomId;
            const nextName = String(this.chatRoomRenameDraft || '').trim().substring(0, 50);
            if (!roomId || !nextName) {
                this.chatRoomRenameDialog = false;
                return;
            }
            try {
                const panel = this.getActiveChatPanel();
                if (panel && typeof panel.renameRoom === 'function') {
                    await panel.renameRoom(roomId, nextName);
                }
                this.EventBus.emit('chat-rooms-updated');
            } catch (e) {
                // ignore
            } finally {
                this.chatRoomRenameDialog = false;
            }
        },
        openChatRoomParticipantsDialog() {
            this.chatRoomSettingsMenu = false;
            try {
                const panel = this.getActiveChatPanel();
                if (panel && typeof panel.openParticipantsDialog === 'function') {
                    panel.openParticipantsDialog();
                }
            } catch (e) {
                // ignore
            }
        },
        openChatRoomDeleteConfirm() {
            this.chatRoomSettingsMenu = false;
            this.chatRoomDeleteDialog = true;
        },
        async confirmChatRoomDelete() {
            this.chatRoomDeleteDialog = false;
            await this.deleteCurrentChatRoom();
        },
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
        openSaveConfirmDialog() {
            // uEngine 모드에서 저장 버튼 클릭 시 한번 더 확인
            this.saveConfirmMessage = '저장하시겠습니까?';
            this.saveConfirmDialog = true;
        },
        closeSaveConfirmDialog() {
            if (this.saveConfirmSaving) return;
            this.saveConfirmDialog = false;
        },
        async confirmSaveProcess() {
            if (this.saveConfirmSaving) return;
            this.saveConfirmSaving = true;
            try {
                await this.saveProcess();
                this.saveConfirmDialog = false;
            } finally {
                this.saveConfirmSaving = false;
            }
        },
        normalizeProcessMap(processMap) {
            // backend에서 null/undefined 또는 부분 구조로 내려오는 경우에도 UI가 기본 형태로 렌더링되도록 보정
            const base = (processMap && typeof processMap === 'object') ? processMap : {};
            const megaList = Array.isArray(base.mega_proc_list) ? base.mega_proc_list : [];

            return {
                ...base,
                mega_proc_list: megaList.map((megaProc) => {
                    const majorList = Array.isArray(megaProc?.major_proc_list) ? megaProc.major_proc_list : [];
                    return {
                        ...megaProc,
                        major_proc_list: majorList.map((majorProc) => ({
                            ...majorProc,
                            sub_proc_list: Array.isArray(majorProc?.sub_proc_list) ? majorProc.sub_proc_list : []
                        }))
                    };
                })
            };
        },
        // 메인 채팅 입력 처리
        async handleMainChatSubmit(message) {
            console.log('[ProcessDefinitionMap] handleMainChatSubmit 받음:', message);
            // 파일만 있거나 텍스트만 있거나 둘 다 있는 경우 처리
            if (!message || (!message.text && !message.file && !message.images)) return;

            // 메인 채팅 전송 시: process-gpt-agent(가상) + 나 로 방 생성 후 /chat으로 이동
            await this.createRoomAndNavigateFromMainChat(message);
        },

        // 히스토리 항목 열기
        handleOpenHistory(room) {
            this.pendingChatMessage = null;
            this.pendingHistoryRoom = room;
            this.chatPanelMode = 'assistant';
            this.selectedChatUser = null;
            this.pendingUserRoomId = null;
            this.showFullScreenChat = true;
        },

        // 유저 대화 열기 (사이드바 유저 목록)
        handleOpenUserConversation(payload) {
            const user = payload?.user || null;
            const roomId = payload?.roomId || null;
            if (!user) return;
            this.pendingChatMessage = null;
            this.pendingHistoryRoom = null;
            this.chatPanelMode = 'user';
            this.selectedChatUser = user;
            this.pendingUserRoomId = roomId;
            this.showFullScreenChat = true;
        },

        // 채팅 패널 닫기
        closeChatPanel() {
            this.showFullScreenChat = false;
            this.pendingChatMessage = null;
            this.pendingHistoryRoom = null;
            this.chatPanelMode = 'assistant';
            this.selectedChatUser = null;
            this.pendingUserRoomId = null;
            this.currentChatRoomId = null;
        },

        handleChatRoomSelected(roomId) {
            this.currentChatRoomId = roomId || null;
        },
        handleChatRoomUnselected() {
            this.currentChatRoomId = null;
        },

        async deleteCurrentChatRoom() {
            try {
                const roomId = this.currentChatRoomId;
                if (!roomId) return;
                if (this.chatPanelMode === 'user') {
                    const panel = this.$refs.userChatRooms;
                    if (!panel || typeof panel.deleteRoom !== 'function') return;
                    await panel.deleteRoom(roomId);
                    return;
                }
                const panel = this.$refs.workAssistantChatPanel;
                if (!panel || typeof panel.deleteRoom !== 'function') return;
                await panel.deleteRoom(roomId);
            } catch (e) {
                console.error('채팅방 삭제 실패:', e);
            }
        },

        // 의도 분석 결과 처리
        handleIntentDetected(result) {
            console.log('[ProcessDefinitionMap] 의도 분석 결과:', result);
        },

        // 에이전트 응답 처리
        handleAgentResponse(response) {
            console.log('[ProcessDefinitionMap] 에이전트 응답:', response);
            
            if (!response || !response.name) return;
            
            // 파싱된 action이 아니라 toolCalls의 name(예: work-assistant__execute_process) 기준으로 처리
            const toolName = response.name || '';

            switch (true) {
                case toolName.includes('start_process_consulting'):
                    // 프로세스 생성 요청 - WorkAssistantChatPanel에서 직접 컨설팅 모드로 전환됨
                    // 별도 처리 불필요
                    break;
                    
                case toolName.includes('execute_process'):
                    // 프로세스 실행 완료 - 인스턴스 업데이트 알림
                    this.EventBus.emit('instances-updated');
                    break;
                    
                case toolName.includes('get_instance_list'):
                case toolName.includes('get_todolist'):
                    // 조회 결과 - 필요 시 추가 처리
                    break;
                    
                case toolName.includes('get_organization'):
                    // 조직도 정보 - 필요 시 추가 처리
                    break;
                    
                case toolName.includes('error'):
                    // 오류 처리
                    console.error('에이전트 오류:', response.message);
                    break;
                
                default:
                    // 기타 도구는 기본 동작 없음
                    break;
            }
            
            this.$emit('agent-response', response);
        },

        // 채팅 패널 리사이즈
        startResize(e) {
            this.isResizing = true;
            const startX = e.clientX;
            const startWidth = this.chatPanelWidth;

            const onMouseMove = (e) => {
                if (!this.isResizing) return;
                const delta = startX - e.clientX;
                const newWidth = Math.max(350, Math.min(800, startWidth + delta));
                this.chatPanelWidth = newWidth;
            };

            const onMouseUp = () => {
                this.isResizing = false;
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        },

        async handleMainChatMessage(message) {
            const me = this;
            me.$try({
                context: me,
                action: async () => {
                    if (!message || !message.text) return;

                    // 즉시 chats로 이동하면서 사용자 메시지 전달
                    me.$router.push({
                        path: '/chats',
                        query: {
                            mainChatMessage: encodeURIComponent(message.text)
                        }
                    });
                }
            });
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
            const res = await backend.getProcessDefinitionMap();
            this.value = this.normalizeProcessMap(res);
        },
        async getMetricsMap() {
            const raw = await backend.getMetricsMap();
            this.metricsValue = raw ?? { domains: [], mega_processes: [], processes: [] };
        },
        async loadOrganizationOptions() {
            console.log('[ProcessDefinitionMap.loadOrganizationOptions] Starting...');
            this.loadingOrganizations = true;
            const supabase = window.$supabase;
            const tenantId = window.$tenantName || 'default';
            console.log('[ProcessDefinitionMap.loadOrganizationOptions] tenantId:', tenantId);

            try {
                const options = [];

                // 1. Load teams from organization chart
                const { data: orgData, error: orgError } = await supabase
                    .from('configuration')
                    .select('value')
                    .eq('key', 'organization')
                    .eq('tenant_id', tenantId)
                    .single();

                console.log('[ProcessDefinitionMap.loadOrganizationOptions] orgData:', orgData, 'orgError:', orgError);

                if (!orgError && orgData?.value) {
                    const orgValue = typeof orgData.value === 'string' ? JSON.parse(orgData.value) : orgData.value;
                    const chart = orgValue.chart || orgValue;
                    console.log('[ProcessDefinitionMap.loadOrganizationOptions] chart:', chart);
                    const teams = this.extractTeamsFromOrgChart(chart);
                    console.log('[ProcessDefinitionMap.loadOrganizationOptions] extracted teams:', teams);
                    teams.forEach(team => {
                        options.push({
                            id: team.id,
                            name: team.name,
                            type: 'team'
                        });
                    });
                }

                // 2. Load org-chart-groups
                const { data: groupsData, error: groupsError } = await supabase
                    .from('org_chart_groups')
                    .select('id, name')
                    .eq('tenant_id', tenantId);

                console.log('[ProcessDefinitionMap.loadOrganizationOptions] groupsData:', groupsData, 'groupsError:', groupsError);

                if (!groupsError && groupsData) {
                    groupsData.forEach(group => {
                        options.push({
                            id: group.id,
                            name: group.name,
                            type: 'group'
                        });
                    });
                }

                this.organizationOptions = options;
                console.log('[ProcessDefinitionMap.loadOrganizationOptions] Final organizationOptions:', this.organizationOptions);
            } catch (error) {
                console.error('[ProcessDefinitionMap.loadOrganizationOptions] Failed:', error);
            } finally {
                this.loadingOrganizations = false;
            }
        },
        async loadFilteredProcDefIds(organizationId) {
            const supabase = window.$supabase;
            const tenantId = window.$tenantName || 'default';

            try {
                const { data, error } = await supabase
                    .from('process_organizations')
                    .select('proc_def_id')
                    .eq('tenant_id', tenantId)
                    .eq('organization_id', organizationId);

                if (error) {
                    console.error('[loadFilteredProcDefIds] Error:', error);
                    this.filteredProcDefIds = [];
                    return;
                }

                this.filteredProcDefIds = data ? data.map(d => d.proc_def_id) : [];
                console.log('[loadFilteredProcDefIds] Filtered proc_def_ids:', this.filteredProcDefIds);
            } catch (error) {
                console.error('[loadFilteredProcDefIds] Error:', error);
                this.filteredProcDefIds = [];
            }
        },
        extractTeamsFromOrgChart(node) {
            const teams = [];
            const traverse = (n) => {
                if (!n) return;
                if (n.data?.isTeam) {
                    teams.push({
                        id: n.id,
                        name: n.data.name || n.id
                    });
                }
                if (n.children) {
                    n.children.forEach(child => traverse(child));
                }
            };
            traverse(node);
            return teams;
        },
        handleSearch() {
            // 엔터키 입력 시에만 검색 실행
            this.searchQuery = this.searchInputValue || '';
            console.log('[검색] 검색 실행:', this.searchQuery);
        },
        clearSearch() {
            this.searchInputValue = '';
            this.searchQuery = '';
            console.log('[검색] 검색 초기화');
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
            await backend.putProcessDefinitionMap(this.normalizeProcessMap(this.value));
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
    top: 73px; /* Adjust based on header height */
    z-index: 10;
}

.premium-tabs :deep(.v-slide-group__content) {
    padding: 6px 0;
}

.premium-tab {
    text-transform: none !important;
    font-weight: 600 !important;
    letter-spacing: -0.01em !important;
    background: rgba(0, 0, 0, 0.04);
    border: none !important;
    height: 36px !important;
    min-width: auto !important;
    max-width: 200px !important;
    padding: 0 14px !important;
    overflow: hidden !important;
    flex-shrink: 0 !important;
}

/* 선택된 탭 회색 배경 */
.premium-tab.v-tab--selected {
    background-color: #757575 !important;
    color: white !important;
}

/* 선택되지 않은 도메인 칩 기본 색상 */
.domain-chip {
    border-color: #808080 !important;
    color: #808080 !important;
}

/* 선택된 도메인 칩 회색 배경 */
.domain-chip-selected {
    background-color: #757575 !important;
    color: white !important;
}

/* 카운트 칩 스타일 */
.count-chip {
    font-weight: 600;
}

/* 선택되지 않은 카운트 칩 연한 회색 배경 */
.domain-chip .count-chip:not(.v-chip--variant-flat) {
    background-color: rgba(128, 128, 128, 0.15) !important;
    color: #808080 !important;
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
    color: inherit;
}

/* 선택된 탭 배지 스타일 */
.premium-tab.v-tab--selected .domain-count-badge {
    background-color: rgba(255,255,255,0.25);
    color: white;
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
/* 전체 레이아웃 */
.definition-map-wrapper {
    display: flex;
    width: 100%;
    height: 100%;
}

.definition-map-card {
    flex: 1;
    min-width: 0;
}

/* 채팅 리사이저 */
.chat-resizer {
    width: 6px;
    background: #e2e8f0;
    cursor: col-resize;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background 0.2s ease;
}

.chat-resizer:hover {
    background: #cbd5e1;
}

.resizer-handle {
    width: 2px;
    height: 40px;
    background: #94a3b8;
    border-radius: 2px;
}

/* 채팅 패널 */
.chat-panel-card {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.chat-panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: white;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
}

.chat-panel-header .header-left {
    display: flex;
    align-items: center;
}

.chat-panel-header .header-title {
    font-size: 16px;
    font-weight: 600;
    color: #1e293b;
}

.chat-panel-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

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