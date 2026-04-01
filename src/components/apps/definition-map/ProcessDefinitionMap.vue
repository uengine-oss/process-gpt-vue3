<template>
    <div class="definition-map-wrapper" :class="{ 'definition-map-sub': componentName === 'SubProcessDetail' }">
        <!-- 좌측: 정의체계도 -->
        <v-card
            elevation="10"
            :class="['definition-map-card', componentName === 'SubProcessDetail' ? 'definition-map-card-sub' : 'is-work-height']"
            :style="{
                width: '100%',
                ...(!$globalState.state.isZoomed ? {} : { height: '100vh' }),
                overflow: componentName === 'SubProcessDetail' ? 'hidden' : 'auto',
                flexShrink: 0
            }"
        >
            <div v-if="mode !== 'uEngine' && !gs && componentName == 'DefinitionMapList' && !openConsultingDialog" class="pa-4">
                <MainChatInput :agentInfo="mainChatAgentInfo" :userId="userInfo.uid || userInfo.id" @submit="handleMainChatSubmit" />
            </div>

            <!-- 헤더 영역 -->
            <div
                v-if="componentName != 'SubProcessDetail'"
                class="header-section"
                style="position: sticky; top: 0; z-index: 2; background-color: white; border-bottom: 1px solid rgba(0, 0, 0, 0.08)"
            >
                <div
                    class="d-flex pa-4 pl-6 pr-6"
                    :class="globalIsMobile.value ? 'flex-column' : 'align-center justify-space-between'"
                    :style="{ gap: globalIsMobile.value ? '8px' : '16px' }"
                >
                    <!-- 첫 번째 줄: 타이틀 + 편집 중 표시 + 디테일 + 마켓플레이스 -->
                    <div class="d-flex align-center flex-shrink-0" :style="{ gap: globalIsMobile.value ? '8px' : '12px' }">
                        <h5 v-if="!globalIsMobile.value" class="text-h5 font-weight-semibold ma-0 flex-shrink-0">
                            {{ $t('processDefinitionMap.title') }}
                        </h5>
                        <v-row v-else class="ma-0 pa-0 align-center flex-shrink-0">
                            <img src="/process-gpt-favicon.png" alt="Process GPT Favicon" style="height: 24px; margin-right: 8px" />
                            <h5 class="text-h5 font-weight-semibold ma-0">{{ $t('processDefinitionMap.mobileTitle') }}</h5>
                        </v-row>
                        <!-- 편집 중 표시: 아무도 편집 안 하면 안 보임, 내가 편집 중이면 "편집 중", 다른 사람이면 "○○○ 님이 수정 중" -->
                        <v-chip
                            v-if="useLock && lock && isLockHeldByCurrentUser"
                            size="small"
                            density="comfortable"
                            color="primary"
                            variant="tonal"
                            class="flex-shrink-0"
                        >
                            <Icons :icon="'pencil'" :size="14" class="mr-1" />
                            {{ $t('processDefinitionMap.editingInProgress') }}
                        </v-chip>
                        <v-chip
                            v-else-if="useLock && lock && !isLockHeldByCurrentUser"
                            size="small"
                            density="comfortable"
                            color="primary"
                            variant="tonal"
                            class="flex-shrink-0"
                        >
                            <Icons :icon="'pencil'" :size="14" class="mr-1" />
                            {{ $t('processDefinitionMap.editingUser', { name: editUserDisplayName || editUser }) }}
                        </v-chip>
                        <DetailComponent
                            class="flex-shrink-0"
                            :title="$t('processDefinitionMap.usageGuide.title')"
                            :details="usageGuideDetails"
                        />
                        <!-- 마켓플레이스 버튼 -->
                        <v-btn
                            v-for="(card, index) in actionCards"
                            :key="index"
                            v-show="card.show && !gs"
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
                    </div>
                    <!-- 두 번째 줄: 검색 + 뒤로가기 + 액션 버튼들 -->
                    <div
                        class="d-flex align-center"
                        :class="globalIsMobile.value ? 'justify-end flex-shrink-0' : ''"
                        style="gap: 8px; flex: 1; min-width: 0; justify-content: flex-end"
                    >
                        <!-- 검색 기능: 아이콘 클릭 시 입력 필드 확대 (확대 전에는 아이콘만, 테두리 없음) -->
                        <div
                            v-if="!gs"
                            class="d-flex align-center header-search overflow-hidden"
                            :class="{
                                'header-search-expanded border border-borderColor rounded-pill': isSearchExpanded
                            }"
                        >
                            <div
                                class="header-search-icon-wrap d-flex align-center justify-center flex-shrink-0"
                                @click="toggleSearchExpand"
                            >
                                <Icons :icon="'magnifer-linear'" :size="20" />
                            </div>
                            <v-text-field
                                v-show="isSearchExpanded"
                                ref="searchInput"
                                :model-value="searchInputValue"
                                @update:model-value="searchInputValue = $event"
                                variant="plain"
                                density="compact"
                                class="position-relative pt-0 ml-2 mr-3 custom-placeholer-color header-search-input"
                                :placeholder="$t('processDefinitionMap.searchProcess') || '정의체계도 검색 (예: 보험, 신청)'"
                                single-line
                                hide-details
                                @keyup.enter="handleSearch"
                            />
                        </div>

                        <v-btn
                            v-if="!isExecutionByProject && $route.path !== '/definition-map'"
                            icon
                            variant="text"
                            size="24"
                            class="flex-shrink-0"
                            @click="goProcessMap"
                        >
                            <Icons :icon="'arrow-go-back'" />
                        </v-btn>
                    </div>
                    <!-- 미분류 프로세스 관리 버튼 -->
                    <v-tooltip
                        v-if="enableEdit && orphanProcessCount > 0"
                        :text="$t('processDefinitionMap.manageOrphans') || '미분류 프로세스 관리'"
                    >
                        <template v-slot:activator="{ props }">
                            <v-btn v-bind="props" icon variant="text" :size="24" class="ml-3" @click="openOrphanDialog">
                                <v-badge :content="orphanProcessCount" color="warning" overlap>
                                    <v-icon size="20">mdi-folder-question</v-icon>
                                </v-badge>
                            </v-btn>
                        </template>
                    </v-tooltip>

                    <v-tooltip v-if="isExecutionByProject" :text="$t('organizationChartDefinition.close')">
                        <template v-slot:activator="{ props }">
                            <v-btn v-bind="props" class="ml-3" @click="closePDM()" icon variant="text" :size="24">
                                <Icons :icon="'close'" :size="20" />
                            </v-btn>
                        </template>
                    </v-tooltip>

                    <!-- 보기 모드(미체크아웃): 편집 시작(체크아웃) -->
                    <v-tooltip location="bottom" v-if="useLock && !lock && canManageProcess">
                        <template v-slot:activator="{ props }">
                            <v-btn v-bind="props" icon variant="text" size="24" @click="openAlertDialog">
                                <Icons :icon="'pencil'" :size="18" />
                            </v-btn>
                        </template>
                        <span>{{ $t('processDefinitionMap.checkOut') || $t('chat.unlock') || '편집' }}</span>
                    </v-tooltip>

                    <!-- uEngine: 편집 중 잠금만 / 저장 버튼 분리 (ProcessDefinitionChat과 동일) -->
                    <template v-if="useLock && lock && canManageProcess && isLockHeldByCurrentUser && mode === 'uEngine'">
                        <v-tooltip location="bottom">
                            <template v-slot:activator="{ props }">
                                <v-btn v-bind="props" icon variant="text" size="24" class="cp-lock" @click="lockOnlyMap">
                                    <Icons :icon="'lock'" :size="24" />
                                </v-btn>
                            </template>
                            <span>{{ $t('chat.lockOnly') }}</span>
                        </v-tooltip>
                        <v-tooltip location="bottom">
                            <template v-slot:activator="{ props }">
                                <v-btn v-bind="props" icon variant="text" size="24" @click="openSaveConfirmDialog">
                                    <Icons :icon="'save'" :size="24" />
                                </v-btn>
                            </template>
                            <span>{{ $t('processDefinitionMap.save') }}</span>
                        </v-tooltip>
                    </template>
                    <v-tooltip location="bottom" v-else-if="useLock && lock && canManageProcess && isLockHeldByCurrentUser">
                        <template v-slot:activator="{ props }">
                            <v-btn v-bind="props" icon variant="text" size="24" class="cp-lock" @click="openAlertDialog">
                                <Icons :icon="'save'" :size="24" />
                            </v-btn>
                        </template>
                        <span>{{ $t('processDefinitionMap.lock') }}</span>
                    </v-tooltip>

                    <!-- 다른 사용자 수정 중일 때만 표시 (편집 중이면 isLockHeldByCurrentUser=true라서 숨겨짐), 아이콘은 연필 -->
                    <v-tooltip location="bottom" v-if="useLock && lock && canManageProcess && !isLockHeldByCurrentUser">
                        <template v-slot:activator="{ props }">
                            <v-btn v-bind="props" icon variant="text" size="24" @click="openAlertDialog">
                                <Icons :icon="'pencil'" :size="18" />
                            </v-btn>
                        </template>
                        <span>{{ $t('processDefinitionMap.lockedByOtherMessage', { name: editUserDisplayName || editUser || '' }) }}</span>
                    </v-tooltip>

                    <v-tooltip location="bottom" v-if="!useLock && canManageProcess">
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

                    <v-tooltip v-if="!gs" :text="$t('processDefinitionMap.downloadImage')">
                        <template v-slot:activator="{ props }">
                            <v-btn v-bind="props" icon variant="text" size="24" @click="capturePng">
                                <Icons :icon="'image-download'" />
                            </v-btn>
                        </template>
                    </v-tooltip>

                    <v-tooltip v-if="isExecutionByProject" :text="$t('organizationChartDefinition.close')">
                        <template v-slot:activator="{ props }">
                            <v-btn v-bind="props" icon variant="text" size="24" @click="closePDM()">
                                <Icons :icon="'close'" :size="20" />
                            </v-btn>
                        </template>
                    </v-tooltip>
                </div>
            </div>
            <!-- route path 별 컴포넌트 호출 -->
            <div id="processMap" :class="{ 'process-map-sub': componentName === 'SubProcessDetail' }">
                <div v-if="componentName == 'ViewProcessDetails'">
                    <ViewProcessDetails class="pa-5" :value="value" :enableEdit="enableEdit" />
                </div>
                <div v-else-if="componentName == 'SubProcessDetail'">
                    <SubProcessDetail :value="value" @capture="capturePng" :enableEdit="enableEdit" :isAdmin="canManageProcess" />
                </div>
                <div v-else>
                    <!-- 필터 및 탭 영역 -->
                    <!-- 도메인 및 조직필터: 도메인이 없어도 편집 모드면 도메인 추가 버튼 표시 -->
                    <div
                        v-if="viewMode === 'proc_map' && ((metricsValue?.domains?.length ?? 0) > 0 || enableEdit)"
                        class="filter-tab-section glass-tab-container"
                    >
                        <div class="px-6 py-3 d-flex align-center" style="gap: 16px; flex-wrap: wrap">
                            <!-- 왼쪽: 조직 필터 + 도메인 탭 -->
                            <div class="d-flex align-center" style="gap: 8px; flex: 1; min-width: 0">
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
                                        style="min-width: 200px; max-width: 300px; width: auto"
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
                                                    <v-chip
                                                        size="x-small"
                                                        :color="item.raw.type === 'group' ? 'primary' : 'grey'"
                                                        variant="tonal"
                                                    >
                                                        {{ item.raw.type === 'group' ? $t('LanePanel.group') : $t('LanePanel.team') }}
                                                    </v-chip>
                                                </template>
                                            </v-list-item>
                                        </template>
                                    </v-autocomplete>
                                </div>

                                <!-- 도메인 칩 -->
                                <div class="d-flex align-center flex-wrap" style="gap: 6px; flex: 1; min-width: 0; hover: pointer">
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
                                        v-for="domain in metricsValue?.domains ?? []"
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
                                                style="min-width: 20px; width: 20px; height: 20px"
                                                @click.stop="editDomain(domain)"
                                            >
                                                <v-icon size="12" color="white">mdi-pencil</v-icon>
                                            </v-btn>
                                            <v-btn
                                                icon
                                                variant="text"
                                                size="x-small"
                                                class="ml-1"
                                                style="min-width: 20px; width: 20px; height: 20px"
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
                    <DefinitionMapList
                        v-if="viewMode === 'proc_map'"
                        :value="value"
                        :enableEdit="enableEdit"
                        @clickProcess="clickProcess"
                        :isExecutionByProject="isExecutionByProject"
                        @clickPlayBtn="clickPlayBtn"
                        :domains="metricsValue?.domains ?? []"
                        :selectedDomain="selectedDomain"
                        :filteredProcDefIds="filteredProcDefIds"
                        :searchQuery="searchQuery"
                    />
                    <MetricsView
                        v-else-if="viewMode === 'metrics'"
                        :value="metricsValue ?? { domains: [], mega_processes: [], processes: [] }"
                        :enableEdit="enableEdit"
                        @update:value="updateMetricsValue"
                        :filteredProcDefIds="filteredProcDefIds"
                        :searchQuery="searchQuery"
                    />
                </div>
            </div>

            <!-- Domain Add/Edit Dialog -->
            <v-dialog v-model="domainDialog.show" max-width="400">
                <v-card class="pa-4 rounded-lg">
                    <v-card-title class="px-0 pt-0 text-h6 font-weight-bold">
                        {{
                            domainDialog.mode === 'edit'
                                ? $t('metricsView.editDomain') || '도메인 수정'
                                : $t('metricsView.addDomain') || '도메인 추가'
                        }}
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
                        <div class="d-flex flex-wrap" style="gap: 8px">
                            <div
                                v-for="color in domainColors"
                                :key="color"
                                class="color-option"
                                :class="{ 'color-selected': domainDialog.color === color }"
                                :style="{ backgroundColor: color }"
                                @click="domainDialog.color = color"
                            ></div>
                        </div>
                        <v-btn v-if="domainDialog.color" variant="text" size="small" class="mt-2" @click="domainDialog.color = null">
                            {{ $t('common.reset') || '초기화' }}
                        </v-btn>
                    </div>

                    <v-card-actions class="px-0 pb-0 mt-4">
                        <v-spacer></v-spacer>
                        <v-btn variant="text" @click="domainDialog.show = false" class="rounded-pill">
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

        <v-dialog
            v-if="mode !== 'uEngine'"
            v-model="openConsultingDialog"
            :style="ProcessPreviewMode ? (isSimulateMode ? 'max-width: 3px; max-height: 3px;' : '') : 'max-width: 1000px;'"
            :fullscreen="isMobile"
            :scrim="isSimulateMode ? false : true"
            persistent
            class="process-definition-map-chat-card-dialog"
        >
            <v-card class="process-definition-map-chat-card">
                <v-row class="ma-0 pa-3" style="background-color: rgb(var(--v-theme-primary), 0.2); height: 50px">
                    <v-icon small style="margin-right: 10px">mdi-auto-fix</v-icon>
                    <div>{{ $t('processDefinitionMap.consultingAI') }}</div>
                    <v-spacer></v-spacer>
                    <v-icon @click="closeConsultingDialog()" small style="margin-right: 5px; float: right">mdi-close</v-icon>
                </v-row>
                <ProcessDefinitionChat
                    class="process-definition-map-chat"
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
            <v-card class="pa-2" style="border-radius: 16px">
                <v-card-title class="d-flex align-center pa-2 pb-0">
                    <v-spacer></v-spacer>
                    <v-btn @click="alertDialog = false" variant="text" density="compact" icon>
                        <v-icon size="20">mdi-close</v-icon>
                    </v-btn>
                </v-card-title>

                <v-card-text class="pa-4 pt-0 text-body-1 alert-message" style="line-height: 1.6">
                    {{ alertMessage }}
                </v-card-text>

                <v-card-actions class="pa-4 pt-0">
                    <v-spacer></v-spacer>
                    <div v-for="(btn, index) in actionButtons" :key="index">
                        <v-btn
                            v-if="btn.show"
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
                    <v-btn :disabled="saveConfirmSaving" rounded variant="flat" color="gray" @click="closeSaveConfirmDialog()">
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
        <v-dialog v-model="openMarketplaceDialog" persistent fullscreen>
            <process-definition-market-place @closeMarketplaceDialog="closeMarketplaceDialog" />
        </v-dialog>

        <!-- 미분류 프로세스 관리 다이얼로그 -->
        <v-dialog v-model="orphanDialog.show" max-width="700" scrollable>
            <v-card class="rounded-lg">
                <v-card-title class="d-flex align-center pa-4">
                    <v-icon class="mr-2" color="warning">mdi-folder-question</v-icon>
                    {{ $t('processDefinitionMap.orphanManagement') || '미분류 프로세스 관리' }}
                    <v-chip size="small" color="warning" class="ml-2">{{ orphanProcesses.length }}</v-chip>
                    <v-spacer></v-spacer>
                    <v-btn icon variant="text" size="small" @click="orphanDialog.show = false">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-card-title>

                <v-divider />

                <v-card-text class="pa-0" style="max-height: 400px">
                    <v-list v-if="orphanProcesses.length > 0">
                        <v-list-item v-for="proc in orphanProcesses" :key="proc.id" class="orphan-process-item">
                            <template #prepend>
                                <v-checkbox v-model="orphanDialog.selectedProcesses" :value="proc.id" hide-details density="compact" />
                            </template>

                            <v-list-item-title>{{ proc.name }}</v-list-item-title>
                            <v-list-item-subtitle class="text-caption">ID: {{ proc.id }}</v-list-item-subtitle>

                            <template #append>
                                <v-btn variant="tonal" color="primary" size="small" @click="openAssignDialog(proc)">
                                    {{ $t('processDefinitionMap.assignCategory') || '분류하기' }}
                                </v-btn>
                            </template>
                        </v-list-item>
                    </v-list>
                    <v-alert v-else type="info" variant="tonal" class="ma-4">
                        {{ $t('processDefinitionMap.noOrphans') || '미분류 프로세스가 없습니다.' }}
                    </v-alert>
                </v-card-text>

                <v-divider v-if="orphanProcesses.length > 0" />

                <v-card-actions v-if="orphanProcesses.length > 0" class="pa-4">
                    <v-btn variant="text" size="small" @click="selectAllOrphans">
                        {{ $t('common.selectAll') || '전체 선택' }}
                    </v-btn>
                    <v-spacer></v-spacer>
                    <v-btn
                        variant="flat"
                        color="primary"
                        :disabled="orphanDialog.selectedProcesses.length === 0"
                        @click="openBulkAssignDialog"
                    >
                        {{ $t('processDefinitionMap.assignSelected') || '선택 항목 분류' }}
                        ({{ orphanDialog.selectedProcesses.length }})
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- 분류 이동 다이얼로그 -->
        <v-dialog v-model="assignDialog.show" max-width="500">
            <v-card class="rounded-lg pa-4">
                <v-card-title class="px-0 pt-0">
                    {{ $t('processDefinitionMap.assignToCategory') || '카테고리 지정' }}
                </v-card-title>

                <v-card-text class="px-0">
                    <div class="text-body-2 mb-3">
                        {{
                            assignDialog.processList.length > 1
                                ? `${assignDialog.processList.length}개 프로세스를 분류합니다.`
                                : `"${assignDialog.processList[0]?.name || ''}" 프로세스를 분류합니다.`
                        }}
                    </div>

                    <!-- Mega Process 선택 -->
                    <v-select
                        v-model="assignDialog.selectedMega"
                        :items="megaProcessOptions"
                        :label="$t('processDefinitionMap.selectMega') || 'Mega Process 선택'"
                        item-title="name"
                        item-value="id"
                        return-object
                        variant="outlined"
                        density="comfortable"
                        class="mb-3"
                    >
                        <template #prepend-item>
                            <v-list-item @click="showNewMegaInput = true">
                                <template #prepend>
                                    <v-icon color="primary">mdi-plus</v-icon>
                                </template>
                                <v-list-item-title class="text-primary">
                                    {{ $t('processDefinitionMap.createNewMega') || '새 Mega Process 생성' }}
                                </v-list-item-title>
                            </v-list-item>
                            <v-divider class="my-2" />
                        </template>
                    </v-select>

                    <!-- 새 Mega 입력 -->
                    <v-text-field
                        v-if="showNewMegaInput"
                        v-model="assignDialog.newMegaName"
                        :label="$t('processDefinitionMap.newMegaName') || '새 Mega Process 이름'"
                        variant="outlined"
                        density="comfortable"
                        class="mb-3"
                        @keyup.enter="createNewMega"
                    >
                        <template #append>
                            <v-btn variant="text" color="primary" @click="createNewMega">
                                {{ $t('common.create') || '생성' }}
                            </v-btn>
                        </template>
                    </v-text-field>

                    <!-- Major Process 선택 -->
                    <v-select
                        v-model="assignDialog.selectedMajor"
                        :items="majorProcessOptions"
                        :label="$t('processDefinitionMap.selectMajor') || 'Major Process 선택'"
                        item-title="name"
                        item-value="id"
                        return-object
                        variant="outlined"
                        density="comfortable"
                        :disabled="!assignDialog.selectedMega"
                    >
                        <template #prepend-item>
                            <v-list-item @click="showNewMajorInput = true" :disabled="!assignDialog.selectedMega">
                                <template #prepend>
                                    <v-icon color="primary">mdi-plus</v-icon>
                                </template>
                                <v-list-item-title class="text-primary">
                                    {{ $t('processDefinitionMap.createNewMajor') || '새 Major Process 생성' }}
                                </v-list-item-title>
                            </v-list-item>
                            <v-divider class="my-2" />
                        </template>
                    </v-select>

                    <!-- 새 Major 입력 -->
                    <v-text-field
                        v-if="showNewMajorInput && assignDialog.selectedMega"
                        v-model="assignDialog.newMajorName"
                        :label="$t('processDefinitionMap.newMajorName') || '새 Major Process 이름'"
                        variant="outlined"
                        density="comfortable"
                        class="mt-3"
                        @keyup.enter="createNewMajor"
                    >
                        <template #append>
                            <v-btn variant="text" color="primary" @click="createNewMajor">
                                {{ $t('common.create') || '생성' }}
                            </v-btn>
                        </template>
                    </v-text-field>
                </v-card-text>

                <v-card-actions class="px-0 pb-0">
                    <v-spacer></v-spacer>
                    <v-btn variant="text" @click="assignDialog.show = false">
                        {{ $t('common.cancel') || '취소' }}
                    </v-btn>
                    <v-btn
                        color="primary"
                        variant="flat"
                        :disabled="!assignDialog.selectedMega || !assignDialog.selectedMajor"
                        @click="assignProcessesToCategory"
                    >
                        {{ $t('common.confirm') || '확인' }}
                    </v-btn>
                </v-card-actions>
            </v-card>
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
import { getKeycloakUserDisplayName, getKeycloakUserById } from '@/utils/keycloak';
import { formatKeycloakUserAsNameAndLoginId } from '@/utils/definitionActorDisplay';
import { canManageProcess as hasProcessManagementAccess, canBypassLock } from '@/utils/processManagement';
const backend = BackendFactory.createBackend();
/** 정의체계도 lock 리소스 ID (definition-service /definition/lock API) */
const LOCK_RESOURCE_ID = 'lock/definition_map';
import { processGptAgent } from '@/constants/processGptAgent';

import * as jsondiff from 'jsondiffpatch';
var jsondiffpatch = jsondiff.create({
    objectHash: function (obj, index) {
        return '$$index:' + index;
    }
});

export default {
    mixins: [ChatModule],
    provide() {
        const self = this;
        return {
            /** uEngine: 담당자 저장 시 맵(this.value).proc_def_owners 동기화 — 저장 버튼 누르기 전에 덮어쓰기 방지 */
            updateProcDefOwner(procDefId, owner) {
                if (!self.value) return;
                if (!Array.isArray(self.value.proc_def_owners)) self.value.proc_def_owners = [];
                const idx = self.value.proc_def_owners.findIndex((e) => e && e.proc_def_id === procDefId);
                const payload = { proc_def_id: procDefId, owner: owner || null };
                if (idx >= 0) self.value.proc_def_owners[idx] = payload;
                else self.value.proc_def_owners.push(payload);
            },
            /** uEngine: 권한 저장 시 맵(this.value).user_permissions 동기화 — 정의 체계도 저장 버튼으로 덮어쓰기 방지 */
            updateUserPermission(permission) {
                self.syncUserPermissionToMap(permission);
            },
            /** uEngine: 권한 삭제 시 맵(this.value).user_permissions에서 제거 */
            deleteUserPermissionFromMap(options) {
                self.removeUserPermissionFromMap(options);
            }
        };
    },
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
        AgentChatActions
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
        editUserDisplayName: null,
        lockSubscription: null,
        lockPollingIntervalId: null,
        lastLockData: null,
        isForceCheckoutInProgress: false,
        alertType: '',
        alertDialog: false,
        alertMessage: '',
        saveConfirmDialog: false,
        saveConfirmSaving: false,
        saveConfirmMessage: '저장하시겠습니까?',
        canManageProcess: false,
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
        filteredProcDefIds: null, // null means no filter, [] means filter active but no matches
        searchQuery: '', // 실제 필터링에 사용되는 검색어 (엔터키 입력 시 업데이트)
        searchInputValue: '', // 입력 중인 검색어 (화면 표시용)
        isSearchExpanded: false, // 검색창 확대 여부 (아이콘 클릭 시 토글)
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
            '#6D4C41' // Brown
        ],
        metricsValue: {
            domains: [],
            mega_processes: [],
            processes: []
        },
        messages: [], // ChatModule에서 필요한 메시지 배열
        chatRoomId: 'definition-map-main', // ChatModule에서 필요한 채팅방 ID
        userInfo: {}, // ChatModule에서 필요한 사용자 정보
        generator: null,
        initialConsultingMessage: null,
        mainChatAgentInfo: {
            id: '0e9a546b-9ae0-48ef-1e9e-f0e95d5bc028',
            username: '업무 지원 에이전트',
            profile: '/images/chat-icon.png',
            email: null,
            is_admin: false,
            role: '프로세스 생성과 실행, 질문 의도 분석 및 답변 제공을 통해 지원팀의 업무 효율을 높이는 에이전트',
            tenant_id: 'uengine',
            device_token: null,
            goal: '지원팀 내 요청되는 프로세스의 90% 이상을 신속하게 생성 및 실행하고, 질문 의도를 정확히 분석하여 95% 이상의 정확도로 적합한 답변을 제공한다.',
            persona:
                '꼼꼼하고 친절하며, 팀원들과의 소통을 중시하는 협력적인 성격입니다. 항상 명확하고 이해하기 쉬운 언어로 응답하며, 복잡한 요청도 체계적으로 분석해 해결책을 제시합니다. 신뢰할 수 있는 지원 전문가로서, 긴급 상황에도 침착하게 대응하고 팀원들의 부담을 최소화하는 데 집중합니다. 언제든 피드백을 환영하며 지속적으로 업무 방식 개선을 추구합니다.',
            endpoint: '',
            description: '',
            tools: 'work-assistant',
            skills: null,
            is_agent: true,
            model: 'anthropic/claude-opus-4-5',
            agent_type: 'agent',
            alias: ''
        },
        // 미분류 프로세스 관리 관련
        orphanDialog: {
            show: false,
            selectedProcesses: []
        },
        assignDialog: {
            show: false,
            processList: [],
            selectedMega: null,
            selectedMajor: null,
            newMegaName: '',
            newMajorName: ''
        },
        showNewMegaInput: false,
        showNewMajorInput: false
    }),
    computed: {
        useLock() {
            if (window.$mode == 'ProcessGPT' || window.$mode === 'uEngine') {
                return true;
            }
            return this.isViewMode;
        },
        /** lock 소유자 비교용: uEngine은 uid, ProcessGPT는 userName */
        currentUserIdForLock() {
            return window.$mode === 'uEngine' ? localStorage.getItem('uid') : this.userName;
        },
        /** 현재 사용자가 lock 보유 중인지 (uid 또는 userName 일치 시 true → 편집 중엔 "다른 사용자 수정 중" 버튼 숨김) */
        isLockHeldByCurrentUser() {
            if (!this.editUser) return false;
            const uid = this.currentUserIdForLock;
            return uid === this.editUser || this.userName === this.editUser;
        },
        isMobile() {
            return window.innerWidth <= 768;
        },
        isPal() {
            return typeof window !== 'undefined' && window.$pal;
        },
        // pal 모드에서는 프로세스 컨설팅·마켓플레이스 가이드 제외
        usageGuideDetails() {
            const all = [
                { icon: 'pencil', title: 'processDefinitionMap.usageGuide.details.0.title' },
                { icon: 'image-download', title: 'processDefinitionMap.usageGuide.details.1.title' },
                { icon: 'magic', title: 'processDefinitionMap.usageGuide.details.2.title' },
                { icon: 'market', title: 'processDefinitionMap.usageGuide.details.3.title' }
            ];
            return this.isPal ? all.slice(0, 2) : all;
        },
        // 미분류 프로세스 목록
        orphanProcesses() {
            const uncategorizedNames = ['미분류', 'Uncategorized', this.$t('processDefinitionMap.uncategorized')];
            if (!this.value || !this.value.mega_proc_list) return [];

            // 미분류 Mega에서 sub_proc_list 추출
            const uncategorizedMega = this.value.mega_proc_list.find(
                (mega) => uncategorizedNames.includes(mega.name) || uncategorizedNames.includes(mega.id)
            );

            if (!uncategorizedMega || !uncategorizedMega.major_proc_list) return [];

            const processes = [];
            uncategorizedMega.major_proc_list.forEach((major) => {
                if (major.sub_proc_list) {
                    major.sub_proc_list.forEach((sub) => {
                        processes.push({
                            id: sub.id,
                            name: sub.name
                        });
                    });
                }
            });

            return processes;
        },
        // 미분류 프로세스 수
        orphanProcessCount() {
            return this.orphanProcesses.length;
        },
        // Mega Process 선택 옵션 (미분류 제외)
        megaProcessOptions() {
            const uncategorizedNames = ['미분류', 'Uncategorized', this.$t('processDefinitionMap.uncategorized')];
            if (!this.value || !this.value.mega_proc_list) return [];

            return this.value.mega_proc_list
                .filter((mega) => !uncategorizedNames.includes(mega.name) && !uncategorizedNames.includes(mega.id))
                .map((mega) => ({
                    id: mega.id,
                    name: mega.name
                }));
        },
        // Major Process 선택 옵션 (선택된 Mega 하위)
        majorProcessOptions() {
            if (!this.assignDialog.selectedMega || !this.value || !this.value.mega_proc_list) return [];

            const mega = this.value.mega_proc_list.find((m) => m.id === this.assignDialog.selectedMega.id);
            if (!mega || !mega.major_proc_list) return [];

            return mega.major_proc_list.map((major) => ({
                id: major.id,
                name: major.name
            }));
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
                    show: this.componentName === 'DefinitionMapList' && this.mode === 'ProcessGPT' && this.canManageProcess && !this.isPal,
                    icon: 'market',
                    title: this.$t('processDefinitionMap.marketplace'),
                    description: this.$t('processDefinitionMap.marketplaceExplanation'),
                    action: () => {
                        this.openMarketplaceDialog = true;
                    }
                }
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
                    // 취소 후 잠금 (uEngine: editUser는 uid 기준)
                    show: this.alertType === 'checkin' && (window.$mode === 'uEngine' ? this.currentUserIdForLock === this.editUser : (this.userName && this.userName === this.editUser)),
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
                    action: this.checkOut // 잠금 해제
                },
                {
                    // 저장 후 잠금 (uEngine: editUser는 uid 기준)
                    show: this.alertType === 'checkin' && (window.$mode === 'uEngine' ? this.currentUserIdForLock === this.editUser : (this.userName && this.userName === this.editUser)),
                    text: this.$t('processDefinitionMap.saveCheckIn'),
                    color: 'primary',
                    class: 'cp-check-in',
                    action: async () => {
                        const saved = await this.saveProcess();
                        if (!saved) return;
                        if (this.useLock) await this.checkIn();
                        this.closeAlertDialog();
                        if (this.pendingRoute) {
                            this.pendingRoute.next();
                            this.pendingRoute = null;
                        } else {
                            await this.getProcessMap();
                        }
                    }
                },
                {
                    show: this.alertType === 'lockedByOther' && !canBypassLock(),
                    text: this.$t('processDefinitionMap.close'),
                    color: 'primary',
                    class: 'cp-check-in',
                    action: () => this.closeAlertDialog()
                },
                {
                    show: this.alertType === 'lockedByOther' && canBypassLock(),
                    text: this.$t('processDefinitionMap.forceCheckout') || '강제 체크아웃',
                    color: 'primary',
                    class: 'cp-check-out',
                    action: async () => {
                        try {
                            await backend.deleteLock(LOCK_RESOURCE_ID);
                            await backend.setLock({ id: LOCK_RESOURCE_ID, user_id: this.currentUserIdForLock });
                            this.lock = true;
                            this.editUser = this.currentUserIdForLock;
                            this.enableEdit = true;
                        } catch (e) {
                            console.warn('[forceCheckout] deleteLock/setLock 실패:', e);
                        }
                        this.closeAlertDialog();
                    }
                },
                {
                    show: this.alertType === 'lockedByOther' && canBypassLock(),
                    text: this.$t('processDefinitionMap.close'),
                    variant: 'text',
                    class: 'cp-check-in',
                    action: () => this.closeAlertDialog()
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
        },
        gs() {
            return window.$gs;
        },
        userChatHeaderTitle() {
            const u = this.selectedChatUser;
            return u && (u.username || u.name || u.email) ? u.username || u.name || u.email : '대화';
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
        async editUser(uid) {
            if (window.$mode === 'uEngine' && uid) {
                const holder = await getKeycloakUserById(uid);
                if (holder) {
                    const label = formatKeycloakUserAsNameAndLoginId(holder);
                    if (label) {
                        this.editUserDisplayName = label;
                        return;
                    }
                }
                const nm = (await getKeycloakUserDisplayName(uid)).trim();
                this.editUserDisplayName = nm && nm !== uid ? nm : uid;
            } else {
                this.editUserDisplayName = uid || null;
            }
        },
        enableEdit(newVal, oldVal) {
            if (newVal && newVal !== oldVal) {
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
                me.userName = localStorage.getItem('userName');
                me.canManageProcess = hasProcessManagementAccess();
                await me.getProcessMap();
                await me.getMetricsMap();
                await me.ensureUncategorizedDomainTab(); // '미분류' 탭이 없으면 추가
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
                    preferredLanguage: 'Korean'
                });

                // ChatModule을 위한 userInfo 설정
                me.userInfo = await backend.getUserInfo();
            }
        });
    },
    mounted() {
        window.addEventListener('localStorageChange', (event) => {
            if (['isAdmin', 'role', 'roles'].includes(event.detail.key)) {
                this.canManageProcess = hasProcessManagementAccess();
            }
        });

        // Subscribe to lock table changes for force checkout notifications
        this.subscribeLockChanges();
    },
    beforeUnmount() {
        // Unsubscribe from lock table changes (ProcessGPT: Supabase / uEngine: 폴링)
        if (this.lockSubscription) {
            this.lockSubscription.unsubscribe();
            this.lockSubscription = null;
        }
        if (this.lockPollingIntervalId) {
            clearInterval(this.lockPollingIntervalId);
            this.lockPollingIntervalId = null;
        }
        if (this._onSaveProcessDefinitionMap) {
            this.EventBus.off('saveProcessDefinitionMap', this._onSaveProcessDefinitionMap);
        }
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
        subscribeLockChanges() {
            if (!this.useLock) return;

            // uEngine 모드: Supabase 없음 → 폴링으로 lock 상태 갱신
            if (window.$mode === 'uEngine') {
                this.lastLockData = null;
                this.lockPollingIntervalId = setInterval(async () => {
                    try {
                        const lockObj = await backend.getLock(LOCK_RESOURCE_ID);
                        const prev = this.lastLockData;
                        this.lastLockData = lockObj ? { id: lockObj.id, user_id: lockObj.user_id } : null;
                        if (prev === null && lockObj && lockObj.user_id) {
                            this.handleLockInserted(lockObj);
                        } else if (prev !== null && lockObj === null) {
                            this.handleLockDeleted(prev);
                        } else if (prev && lockObj && prev.user_id !== lockObj.user_id) {
                            this.handleLockInserted(lockObj);
                        }
                    } catch (e) {
                        console.warn('[subscribeLockChanges] uEngine lock 폴링 오류:', e);
                    }
                }, 8000);
                return;
            }

            const supabase = window.$supabase;
            if (!supabase) return;

            // ProcessGPT: Supabase Realtime 구독
            this.lockSubscription = supabase
                .channel('lock-changes')
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'lock',
                        filter: `id=eq.${LOCK_RESOURCE_ID}`
                    },
                    (payload) => {
                        this.handleLockChange(payload.new);
                    }
                )
                .on(
                    'postgres_changes',
                    {
                        event: 'DELETE',
                        schema: 'public',
                        table: 'lock',
                        filter: `id=eq.${LOCK_RESOURCE_ID}`
                    },
                    (payload) => {
                        this.handleLockDeleted(payload.old);
                    }
                )
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'lock',
                        filter: `id=eq.${LOCK_RESOURCE_ID}`
                    },
                    (payload) => {
                        this.handleLockInserted(payload.new);
                    }
                )
                .subscribe();
        },
        async handleLockChange(lockData) {
            // Check if this is a force checkout targeting the current user
            if (
                lockData &&
                lockData.force_checkout_by &&
                lockData.user_id === this.userName &&
                lockData.force_checkout_by !== this.userName &&
                this.enableEdit &&
                !this.isForceCheckoutInProgress
            ) {
                this.isForceCheckoutInProgress = true;
                await this.handleForceCheckout(lockData.force_checkout_by);
            }
        },
        async handleLockDeleted(oldLockData) {
            // 다른 사용자가 수정을 종료했을 때 (체크인)
            // 현재 사용자가 편집 중이 아닌 경우에만 UI 업데이트
            if (!this.enableEdit) {
                this.lock = false;
                this.editUser = null;

                // 알림 표시 (이전 편집자가 있었던 경우) — uEngine은 uid, ProcessGPT는 userName 기준
                const prevEditorWasOther = oldLockData && oldLockData.user_id && (window.$mode === 'uEngine' ? oldLockData.user_id !== this.currentUserIdForLock : oldLockData.user_id !== this.userName);
                if (prevEditorWasOther) {
                    const name = window.$mode === 'uEngine' ? await getKeycloakUserDisplayName(oldLockData.user_id) : oldLockData.user_id;
                    this.$toast.info(
                        this.$t('processDefinitionMap.editingEnded', { name }) || `${name} 님이 수정을 완료했습니다. 이제 수정할 수 있습니다.`
                    );
                }

                // lock 풀렸으므로 map·metrics 다시 조회하여 갱신
                await this.getProcessMap();
                await this.getMetricsMap();
            }
        },
        handleLockInserted(newLockData) {
            // 다른 사용자가 수정을 시작했을 때 (체크아웃)
            // uEngine: user_id는 uid 기준 비교, ProcessGPT: userName 기준
            const isOtherUser = newLockData && newLockData.user_id !== (window.$mode === 'uEngine' ? this.currentUserIdForLock : this.userName);
            if (isOtherUser) {
                this.lock = true;
                this.editUser = newLockData.user_id;
                this.enableEdit = false; // 다른 사용자가 잠금 획득 시 편집 불가
            }
        },
        async handleForceCheckout(forceCheckoutBy) {
            try {
                // 1. Auto-save current work
                if (this.viewMode === 'metrics') {
                    await this.syncMetricsToCard();
                } else {
                    await this.syncCardToMetrics();
                }
                await backend.putProcessDefinitionMap(this.value);

                // 2. Show notification to user (uEngine: Keycloak으로 표시 이름 조회)
                const displayName = window.$mode === 'uEngine' ? await getKeycloakUserDisplayName(forceCheckoutBy) : forceCheckoutBy;
                this.$toast.warning(
                    this.$t('processDefinitionMap.forceCheckoutNotification', { name: displayName || forceCheckoutBy }) ||
                        `${displayName || forceCheckoutBy} 님이 수정을 시작하여, 현재까지 작업 내용이 저장된 후 수정이 종료됩니다.`
                );

                // 3. Exit edit mode
                this.lock = false;
                this.enableEdit = false;

                // 4. uEngine 한정: 본인이 아직 lock 소유자일 때만 deleteLock (다른 사용자가 이미 가져갔으면 호출 안 함)
                if (window.$mode === 'uEngine') {
                    const meId = this.editUser || this.userName || localStorage.getItem('uid');
                    try {
                        const currentLock = await backend.getLock(LOCK_RESOURCE_ID);
                        if (currentLock && currentLock.user_id === meId) {
                            await backend.deleteLock(LOCK_RESOURCE_ID);
                        }
                    } catch (e) {
                        console.warn('[handleForceCheckout] getLock/deleteLock 실패 (무시):', e);
                    }
                } else {
                    await backend.deleteLock(LOCK_RESOURCE_ID);
                }

                // 5. Refresh the page data
                await this.getProcessMap();
                await this.getMetricsMap();
            } catch (error) {
                console.error('Force checkout handling error:', error);
                this.$toast.error(this.$t('processDefinitionMap.forceCheckoutError') || '강제 체크아웃 처리 중 오류가 발생했습니다.');
            } finally {
                this.isForceCheckoutInProgress = false;
            }
        },
        async ensureUncategorizedDomainTab() {
            // '미분류' 도메인 탭이 없으면 추가 (데이터는 수정하지 않음, UI 탭만 추가)
            if (!this.metricsValue || !this.metricsValue.domains) {
                return;
            }

            const uncategorizedName = this.$t('processDefinitionMap.uncategorized');

            let uncategorizedDomain = this.metricsValue.domains.find(
                (d) => d.name === uncategorizedName || d.name === '미분류' || d.name === 'Uncategorized'
            );

            if (!uncategorizedDomain) {
                uncategorizedDomain = {
                    id: 'uncategorized',
                    name: uncategorizedName,
                    order: 0 // 첫 번째로 표시
                };
                this.metricsValue.domains.unshift(uncategorizedDomain);
                try {
                    await backend.putMetricsMap(this.metricsValue);
                } catch (e) {
                    console.warn('Failed to save uncategorized domain tab:', e);
                }
            }
        },
        uuid() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                const r = (Math.random() * 16) | 0;
                const v = c === 'x' ? r : (r & 0x3) | 0x8;
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
            const userInfo = this.userInfo || (await backend.getUserInfo());
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
                (hasImages ? `이미지 ${(message?.images || []).length || 0}장` : '');
            room.message = { msg: (preview || '').substring(0, 50), type: 'text', createdAt: nowIso };
            await backend.putObject('db://chat_rooms', room);

            // ChatRoomPage에서 첫 메시지에 대한 에이전트 응답만 kick-off 하도록 sessionStorage에 전달
            try {
                sessionStorage.setItem(
                    `chatKickoff:${roomId}`,
                    JSON.stringify({
                        roomId,
                        msgUuid,
                        text,
                        images: message?.images || [],
                        file: message?.file || null,
                        createdAt: nowIso
                    })
                );
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
            const nextName = String(this.chatRoomRenameDraft || '')
                .trim()
                .substring(0, 50);
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

            // 미분류 Mega 이름 목록 (동기화에서 제외)
            const uncategorizedNames = ['미분류', 'Uncategorized', this.$t('processDefinitionMap.uncategorized')];

            // 1. Ensure "미분류" (Uncategorized) domain exists as default
            const uncategorizedName = this.$t('processDefinitionMap.uncategorized');
            let uncategorizedDomain = this.metricsValue.domains.find(
                (d) => d.name === uncategorizedName || d.name === '미분류' || d.name === 'Uncategorized'
            );
            if (!uncategorizedDomain) {
                const newId = 'uncategorized';
                uncategorizedDomain = {
                    id: newId,
                    name: uncategorizedName,
                    order: this.metricsValue.domains.length + 1
                };
                this.metricsValue.domains.push(uncategorizedDomain);
            }

            // Rebuild mega_processes and processes to handle deletions
            const newMegaProcesses = [];
            const newProcesses = [];

            // 2. Sync Mega Processes (미분류 Mega 제외)
            this.value.mega_proc_list
                .filter((mega) => !uncategorizedNames.includes(mega.name) && !uncategorizedNames.includes(mega.id))
                .forEach((mega, megaIndex) => {
                    const metricMega = {
                        id: mega.id,
                        name: mega.name,
                        order: megaIndex + 1
                    };
                    newMegaProcesses.push(metricMega);

                    // 3. Sync Major Processes (as Processes in Metric View)
                    if (mega.major_proc_list) {
                        mega.major_proc_list.forEach((major) => {
                            // 도메인이 비어있으면 '미분류' 도메인 사용 (메트릭스 뷰용, 원본 데이터는 수정하지 않음)
                            let targetDomain;
                            if (major.domain && major.domain.trim() !== '') {
                                targetDomain = this.metricsValue.domains.find((d) => d.name === major.domain);
                                if (!targetDomain) {
                                    const newId = major.domain.toLowerCase().replace(/[/.]/g, '_');
                                    targetDomain = {
                                        id: newId,
                                        name: major.domain,
                                        order: this.metricsValue.domains.length + 1
                                    };
                                    this.metricsValue.domains.push(targetDomain);
                                }
                            } else {
                                // 도메인이 없으면 '미분류' 도메인 사용
                                targetDomain = uncategorizedDomain;
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
                                major.sub_proc_list.forEach((sub) => {
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
            this.metricsValue.mega_processes.forEach((metricMega) => {
                const cardMega = {
                    id: metricMega.id,
                    name: metricMega.name,
                    major_proc_list: []
                };

                // 2. Sync Processes (as Major Processes in Card View)
                const relatedProcesses = this.metricsValue.processes.filter((p) => p.mega_process_id === metricMega.id);

                relatedProcesses.forEach((metricProc) => {
                    // Find domain name for this process
                    const domain = this.metricsValue.domains.find((d) => d.id === metricProc.domain_id);
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
                const saved = await this.saveProcess();
                if (!saved) return; // lock으로 저장 불가 시 다이얼로그 유지
                this.saveConfirmDialog = false;
                if (this.useLock) await this.checkIn();
            } finally {
                this.saveConfirmSaving = false;
            }
        },
        normalizeProcessMap(processMap) {
            // backend에서 null/undefined 또는 부분 구조로 내려오는 경우에도 UI가 기본 형태로 렌더링되도록 보정
            const base = processMap && typeof processMap === 'object' ? processMap : {};
            const megaList = Array.isArray(base.mega_proc_list) ? base.mega_proc_list : [];

            return {
                ...base,
                mega_proc_list: megaList.map((megaProc) => {
                    const majorList = Array.isArray(megaProc?.major_proc_list) ? megaProc.major_proc_list : [];
                    return {
                        ...megaProc,
                        major_proc_list: majorList.map((majorProc) => ({
                            ...majorProc,
                            domain: majorProc?.domain ?? '',
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

                    me.$router.push({
                        path: '/chats',
                        query: {
                            mainChatMessage: encodeURIComponent(message.text)
                        }
                    });
                }
            });
        },
        closePDM() {
            this.$emit('closePDM');
        },
        async closeMarketplaceDialog() {
            await this.getProcessMap();
            this.openMarketplaceDialog = false;
        },
        async addSampleProcess() {
            if (this.mode == 'ProcessGPT') {
                await backend.addSampleProcess();
                this.EventBus.emit('definitions-updated');
                await this.getProcessMap();
            }
        },
        openProcessPreview() {
            this.ProcessPreviewMode = true;
        },
        executeSimulate() {
            this.isSimulateMode = true;
        },
        closeExecuteDialog() {
            this.isSimulateMode = false;
        },
        createdBPMN(res) {
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

            if (res.megaProcessId === '') {
                let uncategorizedMegaProc = this.value.mega_proc_list.find(
                    (megaProc) => megaProc.name === this.$t('processDefinitionMap.uncategorized')
                );
                if (!uncategorizedMegaProc) {
                    uncategorizedMegaProc = {
                        id: generateUniqueMegaProcessId(),
                        name: this.$t('processDefinitionMap.uncategorized'),
                        major_proc_list: [
                            {
                                id: '0',
                                name: this.$t('processDefinitionMap.uncategorized'),
                                sub_proc_list: []
                            }
                        ]
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

            let megaProc = null;
            if (this.value.mega_proc_list.length == 0) {
                megaProc = {
                    id: res.megaProcessId,
                    name: res.megaProcessId,
                    major_proc_list: []
                };
                this.value.mega_proc_list.push(megaProc);
            } else {
                megaProc = this.value.mega_proc_list.find((megaProc) => megaProc.id === res.megaProcessId);
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
                majorProc = megaProc.major_proc_list.find((majorProc) => majorProc.id === res.majorProcessId);
            }

            addSubProcess(majorProc);
        },
        closeConsultingDialog(option) {
            if (option || (this.ProcessPreviewMode && this.$refs.processDefinitionChat && this.$refs.processDefinitionChat.lock)) {
                this.openConsultingDialog = false;
            } else {
                const confirmMessage = this.ProcessPreviewMode
                    ? this.$t('processDefinitionMap.closeConsultingInPreview')
                    : this.$t('processDefinitionMap.closeConsulting');
                const answer = window.confirm(confirmMessage);
                if (answer) {
                    this.ProcessPreviewMode = false;
                    this.openConsultingDialog = false;
                }
            }
        },
        async checkedLock() {
            if (this.canManageProcess) {
                this.enableEdit = false;
                let lockObj = null;
                try {
                    lockObj = await backend.getLock(LOCK_RESOURCE_ID);
                } catch (e) {
                    console.warn('[checkedLock] getLock 실패, lock 없음으로 처리:', e);
                }
                if (lockObj && lockObj.id && lockObj.user_id) {
                    // uEngine: user_id는 uid, ProcessGPT: user_id는 userName
                    const isMe = window.$mode === 'uEngine' ? this.currentUserIdForLock === lockObj.user_id : this.userName === lockObj.user_id;
                    if (isMe) {
                        this.lock = true;
                        this.editUser = lockObj.user_id;
                        this.enableEdit = true;
                    } else if (window.$mode === 'uEngine') {
                        // uid로 사용자를 못 찾으면(삭제 등) 잠금 무효 처리 → 수정 가능. admin은 타인 lock도 해제 가능
                        const lockHolder = await getKeycloakUserById(lockObj.user_id);
                        if (lockHolder && !canBypassLock()) {
                            this.lock = true;
                            this.editUser = lockObj.user_id;
                        } else {
                            if (lockHolder && canBypassLock()) {
                                try {
                                    await backend.deleteLock(LOCK_RESOURCE_ID);
                                } catch (e) {
                                    console.warn('[checkedLock] deleteLock 실패 (무시):', e);
                                }
                            }
                            this.lock = false;
                            this.editUser = null;
                        }
                    } else {
                        this.lock = true;
                        this.editUser = lockObj.user_id;
                    }
                } else {
                    this.lock = false;
                }
            }
        },
        capturePng() {
            var node = document.getElementById('processMap');
            domtoimage
                .toPng(node, { bgcolor: 'white' })
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
            let res = await backend.getProcessDefinitionMap();
            // uEngine: 권한 사용 시 읽기 권한 없는 프로세스는 체계도에 표시하지 않음 (process-manager는 전체 조회)
            const isUEngine = typeof window !== 'undefined' && window.$mode === 'uEngine';
            if (isUEngine && typeof backend.checkUsePermissions === 'function' && typeof backend.filterProcDefMap === 'function') {
                try {
                    const usePerm = await backend.checkUsePermissions();
                    if (usePerm && res) {
                        res = await backend.filterProcDefMap(res);
                    }
                } catch (e) {
                    console.warn('[ProcessDefinitionMap] permission filter skip:', e);
                }
            }
            this.value = this.normalizeProcessMap(res);
            // 미분류 프로세스 업데이트 (항상 재계산)
            await this.updateUncategorizedProcesses();
        },
        async getMetricsMap() {
            const raw = await backend.getMetricsMap();
            this.metricsValue = raw ?? { domains: [], mega_processes: [], processes: [] };
        },
        // 체계도에 등록되지 않은 프로세스를 "미분류" Mega에 추가
        async updateUncategorizedProcesses() {
            try {
                // 1. 모든 proc_def 가져오기
                const allProcDefs = await backend.listDefinition();
                if (!allProcDefs || allProcDefs.length === 0) return;

                // 미분류 이름 목록
                const uncategorizedNames = ['미분류', 'Uncategorized', this.$t('processDefinitionMap.uncategorized')];

                // 2. 체계도에 등록된 모든 SubProcess ID 수집 (미분류 Mega 제외!)
                const registeredIds = new Set();
                if (this.value && this.value.mega_proc_list) {
                    this.value.mega_proc_list.forEach((mega) => {
                        // 미분류 Mega는 건너뛰기
                        if (uncategorizedNames.includes(mega.name) || uncategorizedNames.includes(mega.id)) {
                            return;
                        }
                        if (mega.major_proc_list) {
                            mega.major_proc_list.forEach((major) => {
                                if (major.sub_proc_list) {
                                    major.sub_proc_list.forEach((sub) => {
                                        registeredIds.add(sub.id);
                                    });
                                }
                            });
                        }
                    });
                }

                // 3. 미등록 프로세스 찾기 (bpmn 파일만)
                const unregisteredProcesses = allProcDefs
                    .filter((proc) => {
                        const procId = proc.id || (proc.path ? proc.path.replace('.bpmn', '') : null);
                        return procId && !registeredIds.has(procId) && !proc.directory;
                    })
                    .map((proc) => ({
                        id: proc.id || proc.path.replace('.bpmn', ''),
                        name: proc.name || proc.id || proc.path.replace('.bpmn', '')
                    }));

                // 4. "미분류" Mega 프로세스 찾기
                let uncategorizedMega = this.value.mega_proc_list.find(
                    (mega) => uncategorizedNames.includes(mega.name) || uncategorizedNames.includes(mega.id)
                );

                if (unregisteredProcesses.length > 0) {
                    if (!uncategorizedMega) {
                        // 미분류 Mega 생성
                        uncategorizedMega = {
                            id: 'uncategorized',
                            name: this.$t('processDefinitionMap.uncategorized') || '미분류',
                            major_proc_list: [
                                {
                                    id: 'uncategorized_major',
                                    name: this.$t('processDefinitionMap.uncategorized') || '미분류',
                                    domain: this.$t('processDefinitionMap.uncategorized') || '미분류',
                                    sub_proc_list: []
                                }
                            ]
                        };
                        this.value.mega_proc_list.push(uncategorizedMega);
                    }

                    // 미분류 Major 찾기 또는 생성
                    let uncategorizedMajor = uncategorizedMega.major_proc_list.find(
                        (major) => uncategorizedNames.includes(major.name) || uncategorizedNames.includes(major.id)
                    );

                    if (!uncategorizedMajor) {
                        uncategorizedMajor = {
                            id: 'uncategorized_major',
                            name: this.$t('processDefinitionMap.uncategorized') || '미분류',
                            domain: this.$t('processDefinitionMap.uncategorized') || '미분류',
                            sub_proc_list: []
                        };
                        uncategorizedMega.major_proc_list.push(uncategorizedMajor);
                    }

                    // 미등록 프로세스로 sub_proc_list 교체 (이전 데이터 삭제 후 새로 추가)
                    uncategorizedMajor.sub_proc_list = unregisteredProcesses;
                } else {
                    // 미등록 프로세스가 없으면 미분류 Mega 제거
                    if (uncategorizedMega) {
                        this.value.mega_proc_list = this.value.mega_proc_list.filter(
                            (mega) => !uncategorizedNames.includes(mega.name) && !uncategorizedNames.includes(mega.id)
                        );
                    }
                }
            } catch (error) {
                console.error('Error updating uncategorized processes:', error);
            }
        },
        async loadOrganizationOptions() {
            this.loadingOrganizations = true;
            const supabase = window.$supabase;
            const tenantId = window.$tenantName || 'default';

            if (!supabase) {
                this.loadingOrganizations = false;
                this.organizationOptions = [];
                return;
            }

            try {
                const options = [];

                // 1. Load teams from organization chart
                const { data: orgData, error: orgError } = await supabase
                    .from('configuration')
                    .select('value')
                    .eq('key', 'organization')
                    .eq('tenant_id', tenantId)
                    .single();

                if (!orgError && orgData?.value) {
                    const orgValue = typeof orgData.value === 'string' ? JSON.parse(orgData.value) : orgData.value;
                    const chart = orgValue.chart || orgValue;

                    const teams = this.extractTeamsFromOrgChart(chart);

                    teams.forEach((team) => {
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

                if (!groupsError && groupsData) {
                    groupsData.forEach((group) => {
                        options.push({
                            id: group.id,
                            name: group.name,
                            type: 'group'
                        });
                    });
                }

                this.organizationOptions = options;
            } catch (error) {
                console.error('[ProcessDefinitionMap.loadOrganizationOptions] Failed:', error);
            } finally {
                this.loadingOrganizations = false;
            }
        },
        async loadFilteredProcDefIds(organizationId) {
            const supabase = window.$supabase;
            const tenantId = window.$tenantName || 'default';

            if (!supabase) {
                this.filteredProcDefIds = [];
                return;
            }

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

                this.filteredProcDefIds = data ? data.map((d) => d.proc_def_id) : [];
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
                    n.children.forEach((child) => traverse(child));
                }
            };
            traverse(node);
            return teams;
        },
        toggleSearchExpand() {
            this.isSearchExpanded = !this.isSearchExpanded;
            if (this.isSearchExpanded) {
                this.$nextTick(() => {
                    const inputEl = this.$refs.searchInput?.$el?.querySelector('input');
                    if (inputEl) inputEl.focus();
                });
            }
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
                major_proc_list: []
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

            this.metricsValue.domains = this.metricsValue.domains.filter((d) => d.id !== domain.id);
            this.metricsValue.processes = this.metricsValue.processes.filter((p) => p.domain_id !== domain.id);

            await backend.putMetricsMap(this.metricsValue);
            this.selectedDomain = null;
        },
        async saveDomain() {
            const trimmedName = this.domainDialog.name.trim();
            if (!trimmedName) return;

            if (this.domainDialog.mode === 'add') {
                // Duplicate check
                const isDuplicate = this.metricsValue.domains.some((d) => d.name.toLowerCase() === trimmedName.toLowerCase());
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
                const domain = this.metricsValue.domains.find((d) => d.id === this.domainDialog.editItem.id);
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
                .filter((p) => p.domain_id === domainId)
                .reduce((sum, p) => sum + (p.sub_proc_list ? p.sub_proc_list.length : 0), 0);
        },
        getTotalProcessCount() {
            if (!this.metricsValue || !this.metricsValue.processes) return 0;
            return this.metricsValue.processes.reduce((sum, p) => sum + (p.sub_proc_list ? p.sub_proc_list.length : 0), 0);
        },
        getDomainColor(domainName) {
            if (!domainName || !this.metricsValue.domains) return null;
            const domain = this.metricsValue.domains.find((d) => d.name === domainName);
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
            async function extractIds(obj, path = '') {
                if (typeof obj === 'object' && !Array.isArray(obj)) {
                    for (const key in obj) {
                        if (key.startsWith('_')) {
                            // 삭제된 요소
                            if (Array.isArray(obj[key]) && obj[key].length > 0 && typeof obj[key][0] === 'object') {
                                const process = obj[key][0];
                                const permissions = await me.checkPermissions(process);
                                if (permissions) {
                                    const perUsers = permissions.map((permission) => permission.user_id);
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
        /** uEngine: 루트 맵(this.value).user_permissions에 권한 반영 — 정의 체계도 저장 시 덮어쓰기 방지 */
        syncUserPermissionToMap(permission) {
            if (!this.value) return;
            if (!Array.isArray(this.value.user_permissions)) this.value.user_permissions = [];
            let idSuffix = '';
            if (permission.target_type === 'user') idSuffix = permission.user_id;
            else if (permission.target_type === 'organization') idSuffix = permission.organization_id;
            else if (permission.target_type === 'org_group') idSuffix = permission.org_group_id;
            const id = `${permission.proc_def_id}_${idSuffix}`;
            const payload = { ...permission, id, tenant_id: window.$tenantName };
            const idx = this.value.user_permissions.findIndex((p) => p && p.id === id);
            if (idx >= 0) this.value.user_permissions[idx] = payload;
            else this.value.user_permissions.push(payload);
        },
        /** uEngine: 루트 맵(this.value).user_permissions에서 권한 항목 제거 */
        removeUserPermissionFromMap(options) {
            if (!this.value || !Array.isArray(this.value.user_permissions)) return;
            if (options.id) {
                this.value.user_permissions = this.value.user_permissions.filter((p) => p.id !== options.id);
            } else {
                if (options.match && options.match.id) {
                    this.value.user_permissions = this.value.user_permissions.filter((p) => p.id !== options.match.id);
                } else if (options.user_id && options.proc_def_id) {
                    this.value.user_permissions = this.value.user_permissions.filter(
                        (p) => !(p.user_id === options.user_id && p.proc_def_id === options.proc_def_id)
                    );
                }
            }
        },
        async putPermissions(process, userId, processList) {
            const permission = {
                user_id: userId,
                proc_def_id: process.id,
                proc_def_ids: processList,
                writable: true,
                readable: true
            };
            await backend.putUserPermission(permission);
            if (window.$mode === 'uEngine') this.syncUserPermissionToMap(permission);
        },
        async deletePermissions(process, userId) {
            await backend.deleteUserPermission({ user_id: userId, proc_def_id: process.id });
            if (window.$mode === 'uEngine') this.removeUserPermissionFromMap({ user_id: userId, proc_def_id: process.id });
        },
        async saveProcess() {
            if (!this.canManageProcess) return false;
            // 저장 전 lock 확인: admin 이외만 getLock 호출 후 타인이 잡고 있으면 저장 불가
            if (this.useLock && !canBypassLock() && typeof backend.getLock === 'function') {
                let currentLock = null;
                try {
                    currentLock = await backend.getLock(LOCK_RESOURCE_ID);
                } catch (e) {
                    console.warn('[saveProcess] getLock 실패:', e);
                }
                if (currentLock && currentLock.user_id) {
                    const meId = window.$mode === 'uEngine' ? this.currentUserIdForLock : this.userName;
                    const isMe = meId === currentLock.user_id;
                    if (!isMe) {
                        const lockHolder = window.$mode === 'uEngine' ? await getKeycloakUserById(currentLock.user_id) : { id: currentLock.user_id };
                        const name =
                            lockHolder && window.$mode === 'uEngine'
                                ? formatKeycloakUserAsNameAndLoginId(lockHolder) || lockHolder.username || currentLock.user_id
                                : currentLock.user_id || '';
                        this.$toast?.warning?.(this.$t('processDefinitionMap.lockConflict', { name }) || `${name}님이 이미 수정 중입니다. 저장할 수 없습니다.`);
                        return false;
                    }
                }
            }
            // 저장 전에 미분류 Mega 제거 (미분류는 저장하지 않음, 로드 시 항상 재계산)
            const uncategorizedNames = ['미분류', 'Uncategorized', this.$t('processDefinitionMap.uncategorized')];
            this.value.mega_proc_list = this.value.mega_proc_list.filter(
                (mega) => !uncategorizedNames.includes(mega.name) && !uncategorizedNames.includes(mega.id)
            );

            if (this.viewMode === 'metrics') {
                await this.syncMetricsToCard();
            } else {
                await this.syncCardToMetrics();
            }
            await backend.putProcessDefinitionMap(this.normalizeProcessMap(this.value));
            await this.getProcessMap(); // 미분류 재계산 포함
            this.closeAlertDialog();
            return true;
        },
        /** uEngine 전용: 저장 없이 잠금만 수행 (lock 해제 후 읽기 전용으로 전환) */
        async lockOnlyMap() {
            if (!this.canManageProcess) return;
            if (window.$mode !== 'uEngine') return;
            const meId = this.editUser || this.userName || localStorage.getItem('uid');
            try {
                const currentLock = await backend.getLock(LOCK_RESOURCE_ID);
                if (currentLock && currentLock.user_id === meId) {
                    await backend.deleteLock(LOCK_RESOURCE_ID);
                }
            } catch (e) {
                console.warn('[lockOnlyMap] getLock/deleteLock 실패 (무시):', e);
            }
            this.lock = false;
            this.enableEdit = false;
            this.editUser = null;
            await this.getProcessMap();
            await this.getMetricsMap();
        },
        async checkIn() {
            if (!this.canManageProcess) return;
            const isConnected = await backend.checkDBConnection();
            if (!isConnected) {
                this.alertDialog = true;
                this.alertMessage = this.$t('processDefinitionMap.checkInDBError');
                this.alertType = 'download';
            } else {
                if (this.useLock) {
                    // uEngine 한정: 다른 사람이 이미 lock을 풀어놨으면 해제하지 않음
                    if (window.$mode === 'uEngine') {
                        let currentLock = null;
                        try {
                            currentLock = await backend.getLock(LOCK_RESOURCE_ID);
                        } catch (e) {
                            console.warn('[checkIn] getLock 실패:', e);
                        }
                        const meId = this.editUser || this.userName || localStorage.getItem('uid');
                        if (currentLock == null || !currentLock.user_id) {
                            this.$toast?.warning?.(this.$t('processDefinitionMap.lockAlreadyReleased') || '이미 다른 사용자가 잠금을 해제했습니다.');
                            this.lock = false;
                            this.enableEdit = false;
                            this.editUser = null;
                            this.closeAlertDialog();
                            await this.getProcessMap();
                            await this.getMetricsMap();
                            return;
                        }
                        if (currentLock.user_id !== meId) {
                            // id로 검색된 사용자가 있을 경우에만 lock 풀기 막기 (삭제/없는 사용자면 풀기 허용)
                            const lockHolder = window.$mode === 'uEngine' ? await getKeycloakUserById(currentLock.user_id) : { id: currentLock.user_id };
                            if (lockHolder && !canBypassLock()) {
                                const name =
                                    window.$mode === 'uEngine'
                                        ? formatKeycloakUserAsNameAndLoginId(lockHolder) || lockHolder.username || currentLock.user_id
                                        : currentLock.user_id;
                                this.$toast?.warning?.(this.$t('processDefinitionMap.lockHeldByOther', { name }) || `${name}님이 잠금을 보유 중입니다. 해제할 수 없습니다.`);
                                this.lock = true;
                                this.editUser = currentLock.user_id;
                                this.enableEdit = false;
                                this.closeAlertDialog();
                                return;
                            }
                            // admin은 타인 lock 해제 가능, 사용자를 id로 찾지 못한 경우(삭제 등): 막지 않고 deleteLock 진행
                        }
                    }
                    try {
                        await backend.deleteLock(LOCK_RESOURCE_ID);
                    } catch (e) {
                        console.warn('[checkIn] deleteLock 실패 (무시):', e);
                    }
                }
                this.lock = false;
                this.enableEdit = false;
                this.editUser = null;
                this.closeAlertDialog();
                await this.getProcessMap();
                await this.getMetricsMap();
            }
        },
        async checkOut() {
            if (!this.canManageProcess) return;
            const isConnected = await backend.checkDBConnection();
            if (!isConnected) {
                alert(this.$t('processDefinitionMap.checkOutDBError'));
                this.closeAlertDialog();
                return;
            }
            if (this.useLock && (this.userName != null && this.userName !== undefined || (window.$mode === 'uEngine' && this.currentUserIdForLock))) {
                // checkout 버튼 누를 때도 잠금 상태 한 번 확인
                let currentLock = null;
                try {
                    currentLock = await backend.getLock(LOCK_RESOURCE_ID);
                } catch (e) {
                    console.warn('[checkOut] getLock 실패:', e);
                }
                if (currentLock && currentLock.user_id) {
                    const isMe = window.$mode === 'uEngine' ? this.currentUserIdForLock === currentLock.user_id : this.userName === currentLock.user_id;
                    if (!isMe) {
                        if (window.$mode === 'uEngine') {
                            const lockHolder = await getKeycloakUserById(currentLock.user_id);
                            // process-manager는 타인 lock 시 편집 불가. admin은 deleteLock 후 setLock으로 강제 체크아웃 가능
                            if (lockHolder && !canBypassLock()) {
                                const name =
                                    formatKeycloakUserAsNameAndLoginId(lockHolder) || lockHolder.username || currentLock.user_id;
                                this.$toast?.warning?.(this.$t('processDefinitionMap.lockConflict', { name }) || `${name}님이 이미 수정 중입니다. 편집할 수 없습니다.`);
                                this.lock = true;
                                this.editUser = currentLock.user_id;
                                this.enableEdit = false;
                                this.closeAlertDialog();
                                return;
                            }
                            if (canBypassLock() && lockHolder) {
                                try {
                                    await backend.deleteLock(LOCK_RESOURCE_ID);
                                } catch (e) {
                                    console.warn('[checkOut] deleteLock 실패 (무시):', e);
                                }
                            } else if (!lockHolder) {
                                try {
                                    await backend.deleteLock(LOCK_RESOURCE_ID);
                                } catch (e) {
                                    console.warn('[checkOut] deleteLock 실패 (무시):', e);
                                }
                            }
                        } else {
                            this.$toast?.warning?.(this.$t('processDefinitionMap.lockConflict', { name: currentLock.user_id }) || `${currentLock.user_id}님이 이미 수정 중입니다. 편집할 수 없습니다.`);
                            this.lock = true;
                            this.editUser = currentLock.user_id;
                            this.enableEdit = false;
                            this.closeAlertDialog();
                            return;
                        }
                    }
                }
                // uEngine 한정: setLock은 uid 기준, 성공 시에만 편집 모드, 409 시 메시지 표시
                if (window.$mode === 'uEngine') {
                    const uid = this.currentUserIdForLock;
                    if (!uid) {
                        this.$toast?.warning?.(this.$t('processDefinitionMap.lockSetFailed') || '잠금 설정에 실패했습니다. 다시 시도해 주세요.');
                        return;
                    }
                    try {
                        this.editUser = uid;
                        await backend.setLock({ id: LOCK_RESOURCE_ID, user_id: this.editUser });
                        this.lock = true;
                        this.enableEdit = true;
                    } catch (e) {
                        const status = e?.response?.status;
                        const is409 = status === 409;
                        console.warn('[checkOut] setLock 실패:', e);
                        if (is409) {
                            try {
                                const currentLock = await backend.getLock(LOCK_RESOURCE_ID);
                                if (currentLock?.user_id) {
                                    const lockHolder = await getKeycloakUserById(currentLock.user_id);
                                    if (lockHolder) {
                                        const name =
                                            formatKeycloakUserAsNameAndLoginId(lockHolder) || lockHolder.username || currentLock.user_id;
                                        this.$toast?.warning?.(this.$t('processDefinitionMap.lockConflict', { name }) || `${name}님이 이미 수정 중입니다. 편집할 수 없습니다.`);
                                        this.lock = true;
                                        this.editUser = currentLock.user_id;
                                        this.enableEdit = false;
                                    } else {
                                        await backend.deleteLock(LOCK_RESOURCE_ID);
                                        await backend.setLock({ id: LOCK_RESOURCE_ID, user_id: this.editUser });
                                        this.lock = true;
                                        this.enableEdit = true;
                                    }
                                } else {
                                    await backend.setLock({ id: LOCK_RESOURCE_ID, user_id: this.editUser });
                                    this.lock = true;
                                    this.enableEdit = true;
                                }
                            } catch (_) {
                                this.$toast?.warning?.(this.$t('processDefinitionMap.lockConflict', { name: '' }) || '다른 사용자가 이미 수정 중입니다. 편집할 수 없습니다.');
                            }
                        } else {
                            this.$toast?.warning?.(this.$t('processDefinitionMap.lockSetFailed') || '잠금 설정에 실패했습니다. 다시 시도해 주세요.');
                        }
                    }
                } else {
                    this.lock = true;
                    this.enableEdit = true;
                    this.editUser = this.userName;
                    try {
                        await backend.setLock({ id: LOCK_RESOURCE_ID, user_id: this.editUser });
                    } catch (e) {
                        console.warn('[checkOut] setLock 실패:', e);
                        this.$toast?.warning?.(this.$t('processDefinitionMap.lockSetFailed') || '잠금 설정에 실패했습니다. 다시 시도해 주세요.');
                    }
                }
            } else {
                this.lock = true;
                this.enableEdit = true;
            }
            this.closeAlertDialog();
        },
        download() {
            const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(this.value));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute('href', dataStr);
            downloadAnchorNode.setAttribute('download', 'process-map.json');
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            this.closeAlertDialog();
        },
        async openAlertDialog() {
            var me = this;
            if (!me.canManageProcess) return;
            me.$try({
                context: me,
                action: async () => {
                    if (me.useLock) {
                        let lockObj = null;
                        try {
                            lockObj = await backend.getLock(LOCK_RESOURCE_ID);
                        } catch (e) {
                            console.warn('[openAlertDialog] getLock 실패, lock 없음으로 처리:', e);
                        }
                        if (lockObj && lockObj.id && lockObj.user_id) {
                            me.editUser = lockObj.user_id;
                            const isMe = window.$mode === 'uEngine' ? me.currentUserIdForLock === me.editUser : me.editUser === me.userName;
                            if (isMe) {
                                me.lock = true;
                                me.alertDialog = true;
                                me.alertMessage = this.$t('processDefinitionMap.checkInMessage');
                                me.alertType = 'checkin';
                            } else {
                                const lockHolder = window.$mode === 'uEngine' ? await getKeycloakUserById(lockObj.user_id) : { id: lockObj.user_id };
                                if (lockHolder) {
                                    me.lock = true;
                                    me.alertDialog = true;
                                    const displayName =
                                        window.$mode === 'uEngine'
                                            ? formatKeycloakUserAsNameAndLoginId(lockHolder) || lockHolder.username || lockObj.user_id
                                            : lockObj.user_id;
                                    me.alertMessage = this.$t('processDefinitionMap.lockedByOtherMessage', { name: displayName });
                                    me.enableEdit = false;
                                    me.alertType = 'lockedByOther';
                                    // admin은 강제 체크아웃 버튼으로 take over 가능 (actionButtons에서 처리)
                                } else {
                                    try {
                                        await backend.deleteLock(LOCK_RESOURCE_ID);
                                    } catch (e) {
                                        console.warn('[openAlertDialog] deleteLock 실패 (무시):', e);
                                    }
                                    me.lock = false;
                                    me.enableEdit = false;
                                    me.editUser = null;
                                    me.alertDialog = true;
                                    me.alertMessage = this.$t('processDefinitionMap.checkOutMessage');
                                    me.alertType = 'checkout';
                                }
                            }
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
        clickPlayBtn(value) {
            this.$emit('clickPlayBtn', value);
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
                const targetPath = `/definitions-tree`;

                this.$router.push(targetPath);
            } catch (error) {
                console.error('TreeView 이동 중 오류:', error);
                // 오류 발생 시 기본 경로로 이동
                this.$router.push('/definitions-tree/chat');
            }
        },

        // ========== 미분류 프로세스 관리 메서드 ==========

        /**
         * 미분류 프로세스 관리 다이얼로그 열기
         */
        openOrphanDialog() {
            this.orphanDialog.show = true;
            this.orphanDialog.selectedProcesses = [];
        },

        /**
         * 전체 선택
         */
        selectAllOrphans() {
            if (this.orphanDialog.selectedProcesses.length === this.orphanProcesses.length) {
                this.orphanDialog.selectedProcesses = [];
            } else {
                this.orphanDialog.selectedProcesses = this.orphanProcesses.map((p) => p.id);
            }
        },

        /**
         * 단일 프로세스 분류 다이얼로그 열기
         */
        openAssignDialog(process) {
            this.assignDialog.processList = [process];
            this.assignDialog.selectedMega = null;
            this.assignDialog.selectedMajor = null;
            this.assignDialog.newMegaName = '';
            this.assignDialog.newMajorName = '';
            this.showNewMegaInput = false;
            this.showNewMajorInput = false;
            this.assignDialog.show = true;
        },

        /**
         * 일괄 분류 다이얼로그 열기
         */
        openBulkAssignDialog() {
            const selectedProcesses = this.orphanProcesses.filter((p) => this.orphanDialog.selectedProcesses.includes(p.id));
            this.assignDialog.processList = selectedProcesses;
            this.assignDialog.selectedMega = null;
            this.assignDialog.selectedMajor = null;
            this.assignDialog.newMegaName = '';
            this.assignDialog.newMajorName = '';
            this.showNewMegaInput = false;
            this.showNewMajorInput = false;
            this.assignDialog.show = true;
        },

        /**
         * 새 Mega Process 생성
         */
        createNewMega() {
            if (!this.assignDialog.newMegaName.trim()) return;

            const newMega = {
                id: this.assignDialog.newMegaName.toLowerCase().replace(/[/.]/g, '_'),
                name: this.assignDialog.newMegaName.trim(),
                major_proc_list: []
            };

            // 미분류가 아닌 위치에 추가
            const uncategorizedNames = ['미분류', 'Uncategorized', this.$t('processDefinitionMap.uncategorized')];
            const insertIndex = this.value.mega_proc_list.findIndex(
                (mega) => uncategorizedNames.includes(mega.name) || uncategorizedNames.includes(mega.id)
            );

            if (insertIndex > 0) {
                this.value.mega_proc_list.splice(insertIndex, 0, newMega);
            } else {
                this.value.mega_proc_list.push(newMega);
            }

            this.assignDialog.selectedMega = { id: newMega.id, name: newMega.name };
            this.assignDialog.newMegaName = '';
            this.showNewMegaInput = false;
        },

        /**
         * 새 Major Process 생성
         */
        createNewMajor() {
            if (!this.assignDialog.newMajorName.trim() || !this.assignDialog.selectedMega) return;

            const mega = this.value.mega_proc_list.find((m) => m.id === this.assignDialog.selectedMega.id);
            if (!mega) return;

            if (!mega.major_proc_list) {
                mega.major_proc_list = [];
            }

            const newMajor = {
                id: this.assignDialog.newMajorName.toLowerCase().replace(/[/.]/g, '_'),
                name: this.assignDialog.newMajorName.trim(),
                sub_proc_list: []
            };

            mega.major_proc_list.push(newMajor);

            this.assignDialog.selectedMajor = { id: newMajor.id, name: newMajor.name };
            this.assignDialog.newMajorName = '';
            this.showNewMajorInput = false;
        },

        /**
         * 프로세스를 선택한 카테고리로 이동
         */
        async assignProcessesToCategory() {
            if (!this.assignDialog.selectedMega || !this.assignDialog.selectedMajor) return;

            const uncategorizedNames = ['미분류', 'Uncategorized', this.$t('processDefinitionMap.uncategorized')];

            // 1. 선택한 Mega/Major 찾기
            const targetMega = this.value.mega_proc_list.find((m) => m.id === this.assignDialog.selectedMega.id);
            if (!targetMega) return;

            const targetMajor = targetMega.major_proc_list.find((m) => m.id === this.assignDialog.selectedMajor.id);
            if (!targetMajor) return;

            if (!targetMajor.sub_proc_list) {
                targetMajor.sub_proc_list = [];
            }

            // 2. 프로세스를 미분류에서 제거하고 타겟에 추가
            const processIds = this.assignDialog.processList.map((p) => p.id);

            // 미분류 Mega 찾기
            const uncategorizedMega = this.value.mega_proc_list.find(
                (mega) => uncategorizedNames.includes(mega.name) || uncategorizedNames.includes(mega.id)
            );

            if (uncategorizedMega && uncategorizedMega.major_proc_list) {
                uncategorizedMega.major_proc_list.forEach((major) => {
                    if (major.sub_proc_list) {
                        // 이동할 프로세스들 추출
                        const processesToMove = major.sub_proc_list.filter((sub) => processIds.includes(sub.id));

                        // 미분류에서 제거
                        major.sub_proc_list = major.sub_proc_list.filter((sub) => !processIds.includes(sub.id));

                        // 타겟에 추가
                        targetMajor.sub_proc_list.push(...processesToMove);
                    }
                });
            }

            // 3. 저장 (lock으로 저장 불가 시 다이얼로그 유지)
            const saved = await this.saveProcess();
            if (!saved) return;

            // 4. 다이얼로그 닫기
            this.assignDialog.show = false;
            this.orphanDialog.selectedProcesses = this.orphanDialog.selectedProcesses.filter((id) => !processIds.includes(id));

            // 5. 토스트 메시지
            this.$toast.success(
                this.$t('processDefinitionMap.assignSuccess', { count: processIds.length }) ||
                    `${processIds.length}개 프로세스가 분류되었습니다.`
            );
        }
    }
};
</script>

<style scoped>
/* 검색창: 기본은 아이콘만(테두리 없음), 확대 시 테두리+입력 필드 */
.header-search {
    min-width: 44px;
    max-width: 44px;
    padding-left: 10px;
    padding-right: 10px;
    transition: max-width 0.25s ease, min-width 0.25s ease, padding 0.25s ease;
}
.header-search-expanded {
    min-width: 160px;
    max-width: 246px;
    padding-left: 12px;
    padding-right: 12px;
}
.header-search-icon-wrap {
    width: 24px;
    height: 24px;
    cursor: pointer;
}
.header-search-input {
    min-width: 0;
}

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
    background-color: rgba(0, 0, 0, 0.1);
    color: inherit;
}

/* 선택된 탭 배지 스타일 */
.premium-tab.v-tab--selected .domain-count-badge {
    background-color: rgba(255, 255, 255, 0.25);
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

/* 서브 경로(/definition-map/sub): 불필요한 세로 스크롤 방지 */
.definition-map-wrapper.definition-map-sub {
    overflow: hidden;
    min-height: 0;
}

.definition-map-card {
    flex: 1;
    min-width: 0;
}

.definition-map-card.definition-map-card-sub {
    height: 100%;
    min-height: 0;
}

#processMap.process-map-sub {
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

#processMap.process-map-sub > div {
    min-height: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

#processMap.process-map-sub .is-work-height {
    height: 100% !important;
    min-height: 0;
    overflow: hidden;
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

/* 미분류 프로세스 관리 스타일 */
.orphan-process-item {
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    transition: background-color 0.15s ease;
}

.orphan-process-item:hover {
    background-color: rgba(0, 0, 0, 0.02);
}

.orphan-process-item:last-child {
    border-bottom: none;
}
</style>
