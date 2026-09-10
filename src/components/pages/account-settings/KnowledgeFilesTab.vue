<template>
    <v-card elevation="10">
        <v-card-text class="pt-4">
            <!-- 헤더 -->
            <div class="kft-header">
                <div>
                    <div class="kft-title">지식 베이스</div>
                    <div class="text-caption text-medium-emphasis mt-1">
                        업로드한 파일을 관리하고 다운로드합니다.
                    </div>
                </div>
                <v-btn variant="text" size="small" prepend-icon="mdi-refresh" :loading="loading" @click="fetchList">
                    새로고침
                </v-btn>
            </div>

            <!-- 출처 탭 -->
            <v-tabs v-model="activeTab" color="primary" density="compact" class="kft-source-tabs">
                <!-- Google Drive 탭 숨김 (폐쇄망 운영) -->
                <!-- <v-tab v-if="isAdmin" value="drive">
                    <v-icon start size="16">mdi-google-drive</v-icon>
                    Google Drive
                    <v-chip size="x-small" color="primary" variant="tonal" class="ml-2">
                        {{ counts.drive }}
                    </v-chip>
                </v-tab> -->
                <v-tab value="upload">
                    <v-icon start size="16">mdi-cloud-upload-outline</v-icon>
                    Storage
                    <v-chip size="x-small" color="success" variant="tonal" class="ml-2">
                        {{ counts.upload }}
                    </v-chip>
                </v-tab>
            </v-tabs>

            <v-divider />

            <v-window v-model="activeTab" class="mt-4">
                <!-- =============================== -->
                <!-- Drive 탭 -->
                <!-- =============================== -->
                <v-window-item value="drive">
                    <v-alert type="info" variant="tonal" density="compact" class="mb-3">
                        Drive 인덱싱은 <strong>드라이브 설정 탭의 "문서 처리"</strong>에서 시작합니다.
                        여기서는 인덱싱된 파일 목록 확인과 인덱스 제거만 가능합니다.
                    </v-alert>

                    <div class="kft-toolbar">
                        <v-text-field
                            v-model="driveSearch"
                            density="compact"
                            variant="outlined"
                            hide-details
                            placeholder="파일명/폴더 검색"
                            prepend-inner-icon="mdi-magnify"
                            clearable
                            class="flex-grow-1"
                        />
                        <v-select
                            v-model="driveStatusFilter"
                            :items="statusOptions"
                            item-title="label"
                            item-value="value"
                            density="compact"
                            variant="outlined"
                            hide-details
                            style="max-width: 160px"
                        />
                    </div>

                    <div class="kft-stats mt-3">
                        <span><strong>{{ filteredDrive.length }}</strong> / 전체 {{ driveFiles.length }}</span>
                        <span v-for="(c, k) in driveCountsByStatus" :key="k" class="kft-stat-chip" :class="`is-${k}`">
                            {{ statusLabel(k) }} {{ c }}
                        </span>
                        <v-spacer />
                        <div v-if="isAdmin" class="kft-bulk-inline" :class="{ 'is-active': driveSelected.length > 0 }">
                            <span class="kft-bulk-count">
                                <strong>{{ driveSelected.length }}</strong>개 선택됨
                            </span>
                            <v-btn
                                variant="text"
                                size="x-small"
                                :disabled="driveSelected.length === 0"
                                @click="driveSelected = []"
                            >
                                해제
                            </v-btn>
                            <v-btn
                                color="error"
                                variant="tonal"
                                size="small"
                                prepend-icon="mdi-database-remove-outline"
                                :disabled="driveSelected.length === 0"
                                :loading="bulkDeleting"
                                @click="confirmBulkDelete('drive')"
                            >
                                일괄 제거
                            </v-btn>
                        </div>
                    </div>

                    <v-data-table
                        v-model="driveSelected"
                        :headers="driveHeaders"
                        :items="filteredDrive"
                        :loading="loading"
                        density="compact"
                        class="kft-table mt-2"
                        hover
                        items-per-page="20"
                        :show-select="isAdmin"
                        return-object
                        :item-value="rowKey"
                    >
                        <template v-slot:[`item.file_name`]="{ item }">
                            <div class="kft-name-cell">
                                <v-icon size="18" :color="iconOf(item.file_name).color">{{ iconOf(item.file_name).icon }}</v-icon>
                                <span>{{ item.file_name }}</span>
                            </div>
                        </template>
                        <template v-slot:[`item.folder_path`]="{ item }">
                            <span class="text-caption">{{ item.folder_path || '(루트)' }}</span>
                        </template>
                        <template v-slot:[`item.size_bytes`]="{ item }">
                            <span class="text-caption">{{ formatBytes(item.size_bytes) }}</span>
                        </template>
                        <template v-slot:[`item.modified_time`]="{ item }">
                            <span class="text-caption">{{ formatDate(item.modified_time) }}</span>
                        </template>
                        <template v-slot:[`item.owner`]="{ item }">
                            <span class="text-caption">{{ item.owner || '-' }}</span>
                        </template>
                        <template v-slot:[`item.index_status`]="{ item }">
                            <v-chip size="x-small" :color="statusColor(item.index_status)" variant="tonal">
                                {{ statusLabel(item.index_status) }}
                            </v-chip>
                            <v-tooltip v-if="item.index_error" :text="item.index_error" location="top" max-width="320">
                                <template v-slot:activator="{ props }">
                                    <v-icon v-bind="props" size="14" color="error" class="ml-1">mdi-information-outline</v-icon>
                                </template>
                            </v-tooltip>
                        </template>
                        <template v-slot:[`item.actions`]="{ item }">
                            <v-tooltip v-if="isAdmin" text="인덱스에서만 제거 (Drive 원본은 유지)" location="top">
                                <template v-slot:activator="{ props }">
                                    <v-btn
                                        v-bind="props"
                                        icon
                                        variant="text"
                                        size="small"
                                        color="error"
                                        :loading="deletingKeys.has(rowKey(item))"
                                        @click="confirmDelete(item)"
                                    >
                                        <v-icon size="16">mdi-database-remove-outline</v-icon>
                                    </v-btn>
                                </template>
                            </v-tooltip>
                            <v-tooltip v-else text="관리자만 인덱스에서 제거할 수 있습니다" location="top">
                                <template v-slot:activator="{ props }">
                                    <v-icon v-bind="props" size="14" color="grey" class="ml-2">mdi-lock-outline</v-icon>
                                </template>
                            </v-tooltip>
                        </template>
                    </v-data-table>
                </v-window-item>

                <!-- =============================== -->
                <!-- Upload 탭 -->
                <!-- =============================== -->
                <v-window-item value="upload">
                    <!-- 자료 역할(doc_role) sub-tabs -->
                    <div class="kft-role-tabs">
                        <button
                            v-for="r in roleOptions"
                            :key="r.value"
                            class="kft-role-tab"
                            :class="{ 'is-active': currentRole === r.value, [`is-${r.value}`]: true }"
                            @click="currentRole = r.value"
                        >
                            <v-icon size="16" class="mr-1">{{ r.icon }}</v-icon>
                            <span>{{ r.label }}</span>
                            <span class="kft-role-tab-count">{{ roleCounts[r.value] || 0 }}</span>
                        </button>
                    </div>
                    <div class="kft-role-desc">
                        <v-icon size="14" class="mr-1" :color="currentRoleMeta.color">mdi-information-outline</v-icon>
                        <span>{{ currentRoleMeta.desc }}</span>
                    </div>

                    <div class="kft-upload-layout">
                        <!-- 좌측: 폴더 사이드바 -->
                        <div class="kft-folder-sidebar">
                            <div class="kft-folder-header">
                                <span class="text-caption font-weight-medium">폴더</span>
                                <div class="d-flex align-center">
                                    <v-btn
                                        size="x-small"
                                        variant="text"
                                        :color="viewAllMode && currentFolder === '' ? 'primary' : undefined"
                                        prepend-icon="mdi-folder-multiple-outline"
                                        title="모든 폴더의 파일을 한 번에 봅니다 (파일이 많으면 느릴 수 있습니다)"
                                        @click="viewAllFiles"
                                    >
                                        전체 조회
                                    </v-btn>
                                    <v-btn
                                        v-if="folderHasChildrenSet.size > 0"
                                        icon
                                        variant="text"
                                        size="x-small"
                                        :title="allFoldersExpanded ? '모두 접기' : '모두 펴기'"
                                        @click="allFoldersExpanded ? collapseAll() : expandAll()"
                                    >
                                        <v-icon size="16">{{ allFoldersExpanded ? 'mdi-unfold-less-horizontal' : 'mdi-unfold-more-horizontal' }}</v-icon>
                                    </v-btn>
                                    <v-btn
                                        icon
                                        variant="text"
                                        size="x-small"
                                        @click="startInlineCreate('')"
                                        title="새 폴더 만들기"
                                    >
                                        <v-icon size="16">mdi-folder-plus-outline</v-icon>
                                    </v-btn>
                                </div>
                            </div>
                            <div class="kft-folder-list" @contextmenu.prevent="openRootContextMenu($event)">
                                <!-- '전체' 항목은 제거(폴더와 혼동) — 상단 '전체 조회' 버튼으로 대체.
                                     파일은 반드시 특정 폴더에만 업로드(루트 업로드 금지). -->

                                <!-- 루트 인라인 새 폴더 입력 -->
                                <div
                                    v-if="inlineCreate.active && inlineCreate.parent === ''"
                                    class="kft-folder-item kft-folder-input"
                                    style="padding-left: 8px"
                                >
                                    <span class="kft-folder-caret is-spacer"></span>
                                    <v-icon size="14" color="#ffa726">mdi-folder-plus</v-icon>
                                    <input
                                        ref="inlineInputRoot"
                                        v-model="inlineCreate.name"
                                        class="kft-inline-input"
                                        placeholder="새 폴더 이름 (Enter)"
                                        @keyup.enter="commitInlineCreate"
                                        @keyup.esc="cancelInlineCreate"
                                        @blur="commitInlineCreate"
                                    />
                                </div>

                                <template v-for="node in visibleFolderNodes" :key="node.path">
                                    <div
                                        class="kft-folder-item"
                                        :class="{ 'is-active': currentFolder === node.path }"
                                        :style="{ paddingLeft: `${8 + node.depth * 12}px` }"
                                        @click="onFolderRowClick(node)"
                                        @contextmenu.prevent.stop="openFolderContextMenu($event, node)"
                                    >
                                        <span
                                            v-if="folderHasChildren(node.path)"
                                            class="kft-folder-caret"
                                            @click.stop="toggleFolderExpand(node.path)"
                                        >
                                            <v-icon size="16">{{ isFolderExpanded(node.path) ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                                        </span>
                                        <span v-else class="kft-folder-caret is-spacer"></span>

                                        <v-icon size="14" :color="node.isLocal ? '#9e9e9e' : '#ffa726'">
                                            {{ folderHasChildren(node.path) && isFolderExpanded(node.path) ? 'mdi-folder-open' : (node.isLocal ? 'mdi-folder-outline' : 'mdi-folder') }}
                                        </v-icon>
                                        <span class="kft-folder-name" :title="node.path">{{ node.name }}</span>
                                        <span v-if="node.directFileCount > 0" class="kft-folder-count">{{ node.directFileCount }}</span>
                                        <span class="kft-folder-actions" @click.stop>
                                            <v-tooltip text="폴더 작업" location="top">
                                                <template v-slot:activator="{ props }">
                                                    <v-btn
                                                        v-bind="props"
                                                        icon
                                                        variant="text"
                                                        size="x-small"
                                                        @click.stop="openFolderContextMenu($event, node)"
                                                    >
                                                        <v-icon size="16">mdi-dots-horizontal</v-icon>
                                                    </v-btn>
                                                </template>
                                            </v-tooltip>
                                        </span>
                                    </div>

                                    <!-- 이 폴더의 인라인 새 하위폴더 입력 -->
                                    <div
                                        v-if="inlineCreate.active && inlineCreate.parent === node.path"
                                        class="kft-folder-item kft-folder-input"
                                        :style="{ paddingLeft: `${8 + (node.depth + 1) * 12}px` }"
                                    >
                                        <span class="kft-folder-caret is-spacer"></span>
                                        <v-icon size="14" color="#ffa726">mdi-folder-plus</v-icon>
                                        <input
                                            ref="inlineInputNode"
                                            v-model="inlineCreate.name"
                                            class="kft-inline-input"
                                            placeholder="새 폴더 이름 (Enter)"
                                            @keyup.enter="commitInlineCreate"
                                            @keyup.esc="cancelInlineCreate"
                                            @blur="commitInlineCreate"
                                        />
                                    </div>
                                </template>
                            </div>
                        </div>

                        <!-- 우측: 콘텐츠 -->
                        <div class="kft-upload-main">
                            <!-- 현재 위치 표시 -->
                            <div class="kft-breadcrumb">
                                <v-icon size="14">mdi-folder-outline</v-icon>
                                <span class="ml-1">{{ currentFolder || '전체' }}</span>
                                <v-spacer />
                                <span class="text-caption text-medium-emphasis">
                                    이 폴더의 파일 <strong>{{ filteredUpload.length }}</strong>개
                                </span>
                            </div>

                            <!-- 폴더 요약 카드 (선택한 폴더의 LLM 요약 — 파일 요약들을 모아 생성) -->
                            <div v-if="currentFolder" class="kft-folder-card">
                                <div class="kft-folder-card-head">
                                    <v-icon size="15" color="primary">mdi-text-box-multiple-outline</v-icon>
                                    <span class="kft-folder-card-title">폴더 요약</span>
                                    <v-chip
                                        v-if="folderCardState === 'pending' || folderCardState === 'loading'"
                                        size="x-small"
                                        color="grey"
                                        variant="tonal"
                                        class="ml-1"
                                    >
                                        <v-progress-circular indeterminate size="11" width="2" class="mr-1" />
                                        요약 생성 중
                                    </v-chip>
                                </div>
                                <template v-if="folderCard">
                                    <div class="kft-folder-card-summary">{{ folderCard.summary || '요약 내용이 없습니다.' }}</div>
                                    <div v-if="(folderCard.topics || []).length" class="kft-folder-card-topics">
                                        <v-chip v-for="t in folderCard.topics" :key="t" size="x-small" variant="tonal" color="primary">{{ t }}</v-chip>
                                    </div>
                                    <div class="kft-folder-card-meta text-caption text-medium-emphasis">
                                        문서 {{ folderCard.n_docs_total ?? folderCard.n_docs_direct ?? 0 }}개
                                        <span v-if="(folderCard.key_entities || []).length"> · {{ folderCard.key_entities.slice(0, 5).join(', ') }}</span>
                                    </div>
                                </template>
                                <div v-else-if="folderCardState === 'pending' || folderCardState === 'loading'" class="text-caption text-medium-emphasis">
                                    이 폴더 파일들의 요약을 모아 폴더 요약을 생성하는 중입니다… (자동 갱신)
                                </div>
                                <div v-else-if="folderCardState === 'stalled'" class="kft-folder-card-empty">
                                    <span class="text-caption text-medium-emphasis">아직 폴더 요약이 없습니다.</span>
                                    <v-btn size="x-small" variant="tonal" color="primary" prepend-icon="mdi-refresh" @click="generateFolderCard">지금 생성</v-btn>
                                </div>
                                <div v-else class="text-caption text-medium-emphasis">폴더 요약이 없습니다.</div>
                            </div>

                            <!-- 업로드 드롭존 — 루트(폴더 미선택)에는 업로드 불가. 폴더 선택 시에만 활성. -->
                            <div
                                class="kft-dropzone"
                                :class="{ 'is-drag-over': isDragOver && currentFolder, 'is-uploading': uploading, 'is-disabled': !currentFolder, [`is-role-${uploadTargetRole}`]: true }"
                                @dragover.prevent="isDragOver = !!currentFolder"
                                @dragleave.prevent="isDragOver = false"
                                @drop.prevent="onDrop"
                                @click="currentFolder ? $refs.fileInput.click() : null"
                            >
                                <v-icon size="32" :color="currentFolder ? uploadTargetRoleMeta.color : 'grey'">
                                    {{ currentFolder ? 'mdi-cloud-upload-outline' : 'mdi-folder-alert-outline' }}
                                </v-icon>
                                <div class="kft-dropzone-text">
                                    <template v-if="currentFolder">
                                        <strong>{{ `"${currentFolder}" 폴더에 업로드` }}</strong>
                                        <div class="text-caption text-medium-emphasis mt-1">
                                            파일을 끌어다 놓거나 클릭하세요 — 자동으로 RAG 인덱싱됩니다
                                        </div>
                                        <v-chip size="x-small" variant="outlined" class="mt-1" :color="uploadTargetRoleMeta.color">
                                            허용 형식: {{ uploadAcceptLabel }}
                                        </v-chip>
                                    </template>
                                    <template v-else>
                                        <strong>업로드할 폴더를 선택하세요</strong>
                                        <div class="text-caption text-medium-emphasis mt-1">
                                            루트(전체)에는 파일을 올릴 수 없습니다. 왼쪽에서 폴더를 선택하거나 새로 만든 뒤 업로드하세요.
                                        </div>
                                    </template>
                                </div>
                                <v-chip
                                    size="small"
                                    :color="uploadTargetRoleMeta.color"
                                    variant="tonal"
                                    class="kft-dropzone-role"
                                >
                                    <v-icon start size="14">{{ uploadTargetRoleMeta.icon }}</v-icon>
                                    {{ uploadTargetRoleMeta.label }}로 분류
                                </v-chip>
                                <input ref="fileInput" type="file" multiple :accept="uploadAccept" class="d-none" @change="onFileInput" />
                            </div>

                            <!-- 폴더 업로드 (하위 트리 구조 보존) -->
                            <div class="d-flex align-center mt-2" style="gap: 8px; flex-wrap: wrap;">
                                <v-btn
                                    size="small"
                                    variant="tonal"
                                    :color="uploadTargetRoleMeta.color"
                                    prepend-icon="mdi-folder-upload-outline"
                                    @click="$refs.folderInput.click()"
                                >
                                    폴더 업로드
                                </v-btn>
                                <span class="text-caption text-medium-emphasis">
                                    폴더를 통째로 선택하면 하위 폴더 구조를 그대로 만들고 각 파일을 해당 폴더에 업로드합니다.
                                </span>
                                <!-- webkitdirectory: 디렉토리 선택 → 각 file.webkitRelativePath 로 folder_path 도출 -->
                                <input
                                    ref="folderInput"
                                    type="file"
                                    webkitdirectory
                                    directory
                                    multiple
                                    class="d-none"
                                    @change="onFolderInput"
                                />
                            </div>

                            <!-- 업로드 진행 패널 — 전체 행을 렌더하지 않고 진행바 + 처리 중(소량) + 실패만 표시.
                                 전체 목록 열람/검색은 아래 페이지네이션 테이블이 담당. -->
                            <div v-if="uploading || uploadStats.total > 0 || uploadSkipped > 0" class="kft-upload-progress-panel">
                                <!-- 미지원 형식 제외 요약 (한 줄) -->
                                <div v-if="uploadSkipped > 0" class="kft-upload-skipped">
                                    <v-icon size="14" color="warning">mdi-information-outline</v-icon>
                                    <span>지원하지 않는 형식 {{ uploadSkipped }}개 제외됨</span>
                                </div>

                                <!-- 해시/중복 검사 단계 (아직 total 미확정) -->
                                <div v-if="uploading && uploadStats.total === 0" class="text-caption text-medium-emphasis">
                                    파일 확인 중…
                                </div>

                                <!-- 진행바 + 카운트 -->
                                <template v-if="uploadStats.total > 0">
                                    <div class="kft-upload-progress-head">
                                        <span class="text-caption font-weight-medium">
                                            {{ uploadStats.done + uploadStats.failed }} / {{ uploadStats.total }} 처리
                                            <span v-if="uploadStats.failed" class="text-error">· 실패 {{ uploadStats.failed }}</span>
                                        </span>
                                        <span class="text-caption text-medium-emphasis">{{ uploadProgressPct }}%</span>
                                    </div>
                                    <v-progress-linear :model-value="uploadProgressPct" color="primary" height="6" rounded />
                                </template>

                                <!-- 지금 처리 중 (≤ 동시성 N) -->
                                <div v-if="uploadActive.length" class="kft-upload-active">
                                    <div class="kft-upload-active-label">지금 처리 중</div>
                                    <div v-for="u in uploadActive" :key="u.id" class="kft-upload-row">
                                        <v-progress-circular indeterminate size="14" width="2" color="primary" />
                                        <span class="kft-upload-name">{{ u.name }}</span>
                                        <span v-if="u.folder" class="text-caption text-medium-emphasis">→ {{ u.folder }}</span>
                                    </div>
                                </div>

                                <!-- 실패 (접이식 + 스크롤) -->
                                <div v-if="uploadFailed.length" class="kft-upload-failed">
                                    <button type="button" class="kft-upload-failed-toggle" @click="showUploadFailed = !showUploadFailed">
                                        <v-icon size="14" color="error">mdi-alert-circle</v-icon>
                                        <span>실패 {{ uploadFailed.length }}건</span>
                                        <v-icon size="14">{{ showUploadFailed ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
                                    </button>
                                    <div v-if="showUploadFailed" class="kft-upload-failed-list">
                                        <div v-for="u in uploadFailedVisible" :key="u.id" class="kft-upload-row">
                                            <v-icon size="14" color="error">mdi-alert-circle</v-icon>
                                            <span class="kft-upload-name">{{ u.name }}</span>
                                            <span class="text-caption text-error">{{ u.error }}</span>
                                        </div>
                                        <div v-if="uploadFailedOverflow > 0" class="text-caption text-medium-emphasis pa-2">
                                            외 {{ uploadFailedOverflow }}건 — 아래 목록에서 '실패' 필터로 확인하세요
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- 검색/상태필터 -->
                            <div class="kft-toolbar mt-4">
                                <v-text-field
                                    v-model="uploadSearch"
                                    density="compact"
                                    variant="outlined"
                                    hide-details
                                    placeholder="파일명 검색"
                                    prepend-inner-icon="mdi-magnify"
                                    clearable
                                    class="flex-grow-1"
                                />
                                <v-select
                                    v-model="uploadStatusFilter"
                                    :items="statusOptions"
                                    item-title="label"
                                    item-value="value"
                                    density="compact"
                                    variant="outlined"
                                    hide-details
                                    style="max-width: 160px"
                                />
                            </div>

                            <div class="kft-stats mt-3">
                                <span v-for="(c, k) in uploadCountsByStatus" :key="k" class="kft-stat-chip" :class="`is-${k}`">
                                    {{ statusLabel(k) }} {{ c }}
                                </span>
                                <v-btn
                                    v-if="failedRetryable.length > 0"
                                    color="primary"
                                    variant="tonal"
                                    size="small"
                                    prepend-icon="mdi-refresh"
                                    :loading="bulkReindexing"
                                    class="ml-2"
                                    @click="retryAllFailed"
                                >
                                    실패 {{ failedRetryable.length }}개 재시도
                                </v-btn>
                                <v-spacer />
                                <div class="kft-bulk-inline" :class="{ 'is-active': uploadSelected.length > 0 }">
                                    <span class="kft-bulk-count">
                                        <strong>{{ uploadSelected.length }}</strong>개 선택됨
                                    </span>
                                    <v-btn
                                        variant="text"
                                        size="x-small"
                                        :disabled="uploadSelected.length === 0"
                                        @click="uploadSelected = []"
                                    >
                                        해제
                                    </v-btn>
                                    <v-btn
                                        color="error"
                                        variant="tonal"
                                        size="small"
                                        prepend-icon="mdi-delete-outline"
                                        :disabled="uploadSelected.length === 0"
                                        :loading="bulkDeleting"
                                        @click="confirmBulkDelete('upload')"
                                    >
                                        일괄 삭제
                                    </v-btn>
                                </div>
                            </div>

                            <v-data-table
                                v-model="uploadSelected"
                                :headers="visibleUploadHeaders"
                                :items="filteredUpload"
                                :loading="loading"
                                density="compact"
                                class="kft-table mt-2"
                                hover
                                items-per-page="20"
                                show-select
                                return-object
                                :item-value="rowKey"
                            >
                                <template v-slot:[`item.file_name`]="{ item }">
                                    <div class="kft-name-cell">
                                        <v-icon size="18" :color="iconOf(item.file_name).color">{{ iconOf(item.file_name).icon }}</v-icon>
                                        <span>{{ item.file_name }}</span>
                                    </div>
                                </template>
                                <template v-slot:[`item.folder_path`]="{ item }">
                                    <span class="text-caption">{{ item.folder_path || '(루트)' }}</span>
                                </template>
                                <template v-slot:[`item.doc_role`]="{ item }">
                                    <v-chip
                                        size="x-small"
                                        :color="roleMeta(roleOf(item)).color"
                                        variant="tonal"
                                    >
                                        <v-icon start size="12">{{ roleMeta(roleOf(item)).icon }}</v-icon>
                                        {{ roleMeta(roleOf(item)).label }}
                                    </v-chip>
                                </template>
                                <template v-slot:[`item.uploaded_by_name`]="{ item }">
                                    <span class="text-caption">{{ item.uploaded_by_name || '-' }}</span>
                                </template>
                                <template v-slot:[`item.size_bytes`]="{ item }">
                                    <span class="text-caption">{{ formatBytes(item.size_bytes) }}</span>
                                </template>
                                <template v-slot:[`item.modified_time`]="{ item }">
                                    <span class="text-caption">{{ formatDate(item.modified_time) }}</span>
                                </template>
                                <template v-slot:[`item.index_status`]="{ item }">
                                    <v-chip size="x-small" :color="statusColor(item.index_status)" variant="tonal">
                                        {{ statusLabel(item.index_status) }}
                                    </v-chip>
                                    <v-tooltip v-if="item.index_error" :text="item.index_error" location="top" max-width="320">
                                        <template v-slot:activator="{ props }">
                                            <v-icon v-bind="props" size="14" color="error" class="ml-1">mdi-information-outline</v-icon>
                                        </template>
                                    </v-tooltip>
                                    <!-- 요약 상태 (요약=최종 완료의 일부) -->
                                    <v-chip
                                        v-if="summaryMeta(item).show"
                                        size="x-small"
                                        :color="summaryMeta(item).color"
                                        variant="tonal"
                                        class="ml-1"
                                    >
                                        <v-icon start size="11">{{ summaryMeta(item).icon }}</v-icon>
                                        {{ summaryMeta(item).label }}
                                    </v-chip>
                                </template>
                                <template v-slot:[`item.actions`]="{ item }">
                                    <v-tooltip v-if="item.index_status === 'indexed'" text="파싱 결과 미리보기" location="top">
                                        <template v-slot:activator="{ props }">
                                            <v-btn
                                                v-bind="props"
                                                icon
                                                variant="text"
                                                size="small"
                                                :loading="previewingKeys.has(rowKey(item))"
                                                @click="openPreview(item)"
                                            >
                                                <v-icon size="16">mdi-file-search-outline</v-icon>
                                            </v-btn>
                                        </template>
                                    </v-tooltip>
                                    <v-tooltip text="다운로드" location="top">
                                        <template v-slot:activator="{ props }">
                                            <v-btn
                                                v-bind="props"
                                                icon
                                                variant="text"
                                                size="small"
                                                :loading="downloadingKeys.has(rowKey(item))"
                                                @click="downloadFile(item)"
                                            >
                                                <v-icon size="16">mdi-download-outline</v-icon>
                                            </v-btn>
                                        </template>
                                    </v-tooltip>
                                    <v-tooltip v-if="item.index_status === 'failed' && canDelete(item)" text="재인덱싱 다시 시도" location="top">
                                        <template v-slot:activator="{ props }">
                                            <v-btn
                                                v-bind="props"
                                                icon
                                                variant="text"
                                                size="small"
                                                color="primary"
                                                :loading="reindexingKeys.has(rowKey(item))"
                                                @click="reindexFile(item)"
                                            >
                                                <v-icon size="16">mdi-refresh</v-icon>
                                            </v-btn>
                                        </template>
                                    </v-tooltip>
                                    <v-tooltip v-if="item.summary_status === 'failed' && canDelete(item)" text="요약 다시 생성 (재임베딩 없음)" location="top">
                                        <template v-slot:activator="{ props }">
                                            <v-btn
                                                v-bind="props"
                                                icon
                                                variant="text"
                                                size="small"
                                                color="warning"
                                                :loading="resummarizingKeys.has(rowKey(item))"
                                                @click="resummarizeFile(item)"
                                            >
                                                <v-icon size="16">mdi-text-box-search-outline</v-icon>
                                            </v-btn>
                                        </template>
                                    </v-tooltip>
                                    <v-tooltip v-if="canDelete(item)" text="스토리지/인덱스에서 영구 삭제" location="top">
                                        <template v-slot:activator="{ props }">
                                            <v-btn
                                                v-bind="props"
                                                icon
                                                variant="text"
                                                size="small"
                                                color="error"
                                                :loading="deletingKeys.has(rowKey(item))"
                                                @click="confirmDelete(item)"
                                            >
                                                <v-icon size="16">mdi-delete-outline</v-icon>
                                            </v-btn>
                                        </template>
                                    </v-tooltip>
                                    <v-tooltip v-else text="본인이 업로드한 파일만 삭제할 수 있습니다" location="top">
                                        <template v-slot:activator="{ props }">
                                            <v-icon v-bind="props" size="14" color="grey" class="ml-2">mdi-lock-outline</v-icon>
                                        </template>
                                    </v-tooltip>
                                </template>
                            </v-data-table>
                        </div>
                    </div>
                </v-window-item>
            </v-window>
        </v-card-text>

        <!-- 폴더 이름 변경 다이얼로그 (현재 버튼 숨김 — folderRenameEnabled) -->
        <v-dialog v-model="renameFolderDialog" max-width="420">
            <v-card>
                <v-card-title class="text-h6">폴더 이름 변경</v-card-title>
                <v-card-text>
                    <div class="text-caption text-medium-emphasis mb-2">
                        현재: <strong>{{ renameFolderTarget?.path }}</strong>
                    </div>
                    <v-text-field
                        v-model="renameFolderName"
                        label="새 이름"
                        variant="outlined"
                        density="compact"
                        autofocus
                        hide-details="auto"
                        :rules="folderNameRules"
                        @keyup.enter="performRenameFolder"
                    />
                    <div class="text-caption text-medium-emphasis mt-2">
                        ※ 같은 부모 폴더 안에서 이름만 바뀝니다. 하위 폴더 경로도 함께 갱신됩니다.
                    </div>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="renameFolderDialog = false">취소</v-btn>
                    <v-btn
                        color="primary"
                        variant="flat"
                        :loading="renameFolderLoading"
                        :disabled="!renameFolderName.trim()"
                        @click="performRenameFolder"
                    >
                        변경
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- 폴더 삭제 다이얼로그 -->
        <v-dialog v-model="deleteFolderDialog" max-width="440">
            <v-card>
                <v-card-title class="text-h6">폴더 삭제</v-card-title>
                <v-card-text>
                    <strong>{{ deleteFolderTarget?.path }}</strong> 폴더를 삭제하시겠습니까?
                    <div class="text-caption text-medium-emphasis mt-2" v-if="deleteFolderTarget?.fileCount > 0">
                        ⚠ 폴더 안의 <strong class="text-error">{{ deleteFolderTarget.fileCount }}개</strong> 파일이
                        스토리지/인덱스에서 모두 영구 삭제됩니다.
                    </div>
                    <div class="text-caption text-medium-emphasis mt-2" v-else>
                        비어있는 폴더입니다.
                    </div>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="deleteFolderDialog = false">취소</v-btn>
                    <v-btn color="error" variant="flat" :loading="deleteFolderLoading" @click="performDeleteFolder">삭제</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- 폴더 우클릭 컨텍스트 메뉴 (teleport + 고정위치 — 사이드바 overflow 클리핑 회피) -->
        <teleport to="body">
            <template v-if="folderMenu.show">
                <div
                    class="kft-ctx-backdrop"
                    @click="closeFolderMenu"
                    @contextmenu.prevent="closeFolderMenu"
                    @wheel="closeFolderMenu"
                ></div>
                <v-list
                    class="kft-ctx-menu"
                    :style="{ left: folderMenu.x + 'px', top: folderMenu.y + 'px' }"
                    density="compact"
                    elevation="8"
                    rounded="lg"
                >
                    <v-list-item @click="ctxNewSubfolder">
                        <template v-slot:prepend><v-icon size="16">mdi-folder-plus-outline</v-icon></template>
                        <v-list-item-title class="text-body-2">{{ folderMenu.node ? '새 하위폴더' : '새 폴더' }}</v-list-item-title>
                    </v-list-item>
                    <template v-if="folderMenu.node && isAdmin">
                        <!-- 이름 변경: folderRenameEnabled 로 숨김(코드 보존). 켜면 바로 노출. -->
                        <v-list-item v-if="folderRenameEnabled" @click="ctxRename">
                            <template v-slot:prepend><v-icon size="16">mdi-pencil-outline</v-icon></template>
                            <v-list-item-title class="text-body-2">이름 변경</v-list-item-title>
                        </v-list-item>
                        <v-list-item @click="ctxDelete">
                            <template v-slot:prepend><v-icon size="16" color="error">mdi-delete-outline</v-icon></template>
                            <v-list-item-title class="text-body-2 text-error">삭제</v-list-item-title>
                        </v-list-item>
                    </template>
                </v-list>
            </template>
        </teleport>

        <!-- 일괄 삭제 확인 다이얼로그 -->
        <v-dialog v-model="bulkDeleteDialog" max-width="480">
            <v-card>
                <v-card-title class="text-h6">
                    {{ bulkDeleteKind === 'drive' ? '인덱스에서 일괄 제거' : '파일 일괄 삭제' }}
                </v-card-title>
                <v-card-text>
                    <strong>{{ bulkDeleteTargets.length }}개</strong>의
                    {{ bulkDeleteKind === 'drive' ? '파일을 RAG 인덱스에서 제거' : '파일을 영구 삭제' }}하시겠습니까?
                    <div v-if="bulkDeleteKind === 'upload'" class="text-caption text-error mt-2">
                        ⚠ 스토리지의 실물 파일과 RAG 인덱스가 모두 삭제됩니다. 되돌릴 수 없습니다.
                    </div>
                    <div v-else class="text-caption text-medium-emphasis mt-2">
                        Drive의 원본은 그대로 유지됩니다. 다음에 "문서 처리"로 다시 인덱싱될 수 있습니다.
                    </div>
                    <v-list density="compact" max-height="200" class="mt-3 kft-bulk-list">
                        <v-list-item
                            v-for="item in bulkDeleteTargets"
                            :key="rowKey(item)"
                            density="compact"
                        >
                            <template v-slot:prepend>
                                <v-icon size="16" :color="iconOf(item.file_name).color">
                                    {{ iconOf(item.file_name).icon }}
                                </v-icon>
                            </template>
                            <v-list-item-title class="text-caption">{{ item.file_name }}</v-list-item-title>
                            <v-list-item-subtitle class="text-caption">
                                {{ item.folder_path || '(루트)' }}
                            </v-list-item-subtitle>
                        </v-list-item>
                    </v-list>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="bulkDeleteDialog = false" :disabled="bulkDeleting">취소</v-btn>
                    <v-btn
                        :color="bulkDeleteKind === 'drive' ? 'warning' : 'error'"
                        variant="flat"
                        :loading="bulkDeleting"
                        @click="performBulkDelete"
                    >
                        {{ bulkDeleteKind === 'drive' ? '제거' : '삭제' }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- 중복 업로드 확인 다이얼로그 -->
        <v-dialog v-model="duplicateDialog" max-width="540" persistent>
            <v-card>
                <v-card-title class="text-h6">
                    <v-icon start color="warning">mdi-content-duplicate</v-icon>
                    이미 있는 파일 {{ duplicateInfo?.dupCount }}개
                </v-card-title>
                <v-card-text>
                    <div class="mb-1">
                        선택한 파일 중 <strong>{{ duplicateInfo?.dupCount }}개</strong>가 이미 지식 베이스에 있습니다.
                        <span v-if="duplicateInfo?.newCount"> (새 파일 <strong>{{ duplicateInfo?.newCount }}</strong>개)</span>
                    </div>
                    <div class="text-caption text-medium-emphasis mt-2">
                        어떻게 할까요? "모두 업로드"를 고르면 같은 내용이 중복 인덱싱됩니다.
                    </div>
                </v-card-text>
                <v-card-actions>
                    <v-btn variant="text" @click="resolveDuplicate('cancel')">취소</v-btn>
                    <v-spacer />
                    <v-btn variant="text" color="warning" @click="resolveDuplicate('overwrite')">
                        중복 포함 모두 업로드
                    </v-btn>
                    <v-btn color="primary" variant="flat" @click="resolveDuplicate('skip')">
                        <span v-if="duplicateInfo?.newCount">새 파일 {{ duplicateInfo?.newCount }}개만 업로드</span>
                        <span v-else>중복 건너뛰기</span>
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- 삭제 확인 다이얼로그 -->
        <v-dialog v-model="deleteDialog" max-width="440">
            <v-card>
                <v-card-title class="text-h6">
                    {{ deleteTarget?.source_type === 'drive' ? '인덱스에서 제거' : '파일 삭제' }}
                </v-card-title>
                <v-card-text>
                    <strong>{{ deleteTarget?.file_name }}</strong>
                    <template v-if="deleteTarget?.source_type === 'drive'">
                        을(를) RAG 인덱스에서 제거하시겠습니까?
                        <div class="text-caption text-medium-emphasis mt-2">
                            • Drive의 원본은 그대로 유지됩니다.<br />
                            • 다음에 "문서 처리" 버튼을 누르면 다시 인덱싱될 수 있습니다.
                        </div>
                    </template>
                    <template v-else>
                        을(를) 영구 삭제하시겠습니까?
                        <div class="text-caption text-error mt-2">
                            ⚠ 스토리지의 실물 파일과 RAG 인덱스가 모두 삭제됩니다. 되돌릴 수 없습니다.
                        </div>
                    </template>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="deleteDialog = false">취소</v-btn>
                    <v-btn :color="deleteTarget?.source_type === 'drive' ? 'warning' : 'error'" variant="flat" @click="performDelete">
                        {{ deleteTarget?.source_type === 'drive' ? '제거' : '삭제' }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- 파싱 결과 미리보기 — document_pages 에 저장된(=RAG가 읽는) 페이지 본문을 마크다운으로 -->
        <v-dialog v-model="previewDialog" max-width="1000" height="86vh" scrollable>
            <v-card class="preview-card">
                <v-card-title class="d-flex align-center py-2">
                    <v-icon size="18" class="mr-2">mdi-file-search-outline</v-icon>
                    <span class="text-subtitle-1 text-truncate">파싱 결과 미리보기</span>
                    <v-spacer />
                    <v-btn icon variant="text" size="small" @click="previewDialog = false">
                        <v-icon size="18">mdi-close</v-icon>
                    </v-btn>
                </v-card-title>
                <v-divider />
                <ParsedPagesView
                    :pages="previewPages"
                    :file-name="previewFileName"
                    :loading="previewLoading"
                    :error="previewError"
                    class="preview-card__viewer"
                />
            </v-card>
        </v-dialog>
    </v-card>
</template>

<script>
import axios from 'axios';
import { mimeIcon } from '@/utils/fileIcon';
import ParsedPagesView from '@/components/knowledge/ParsedPagesView.vue';

function extToMime(name) {
    const ext = (name || '').split('.').pop()?.toLowerCase() || '';
    const map = {
        pdf: 'application/pdf',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        hwp: 'application/x-hwp',
        hwpx: 'application/vnd.hancom.hwpx',
        md: 'text/markdown',
        txt: 'text/plain'
    };
    return map[ext] || '';
}

export default {
    name: 'KnowledgeFilesTab',
    components: { ParsedPagesView },
    data() {
        const isAdmin = localStorage.getItem('isAdmin') === 'true' || localStorage.getItem('role') === 'superAdmin';
        return {
            isAdmin,
            myUid: localStorage.getItem('uid') || '',
            myName: localStorage.getItem('userName') || localStorage.getItem('email') || '',
            files: [],
            loading: false,
            // Google Drive 탭 숨김: 항상 Storage(upload) 탭으로 시작
            activeTab: 'upload',
            driveSearch: '',
            driveStatusFilter: 'all',
            uploadSearch: '',
            uploadStatusFilter: 'all',
            isDragOver: false,
            // ── 업로드 진행 상태 (대량 폴더 업로드 대비: 전체 행을 들지 않고 카운터 + 소량 배열만) ──
            uploading: false,                 // 진행 중 플래그 (dropzone is-uploading / 진행패널 표시)
            // 백그라운드 인제스트 상태 폴링 (pending/processing 동안 index_status 자동 갱신)
            statusPollTimer: null,
            pollInFlight: false,
            lastTerminalCount: -1,           // 직전 폴링의 (indexed+failed) 수 — 변했을 때만 전체 재조회
            uploadConcurrency: 8,             // 동시 처리 파일 수 상한(워커 풀). 과부하 시 적응형 백오프로 자동 축소.
                                              // 폐쇄망 HTTP/1.1 환경은 브라우저가 origin당 6으로 캡 → 실효 6~8.
            uploadStats: { total: 0, done: 0, failed: 0 },
            uploadActive: [],                 // 지금 처리 중인 파일만 (≤ uploadConcurrency)
            uploadFailed: [],                 // 실패분 (상한 UPLOAD_FAILED_CAP)
            uploadSkipped: 0,                 // 이번 배치에서 미지원 확장자로 제외한 수
            showUploadFailed: false,          // 실패 목록 펼침 토글
            deletingKeys: new Set(),
            reindexingKeys: new Set(), // 재인덱싱 진행 중인 파일 rowKey
            resummarizingKeys: new Set(), // 재요약 진행 중인 파일 rowKey
            downloadingKeys: new Set(), // 다운로드 URL 조회 중인 파일 rowKey
            previewingKeys: new Set(), // 파싱 미리보기 조회 중인 파일 rowKey
            previewDialog: false,
            previewLoading: false,
            previewError: '',
            previewPages: [],
            previewFileName: '',
            deleteDialog: false,
            deleteTarget: null,
            duplicateDialog: false,
            duplicateInfo: null, // { dupCount, newCount } — 배치 중복 안내용
            duplicateResolver: null,
            driveSelected: [],
            uploadSelected: [],
            bulkDeleteDialog: false,
            bulkDeleteKind: 'upload', // 'drive' | 'upload'
            bulkDeleteTargets: [],
            bulkDeleting: false,
            bulkReindexing: false, // 일괄 재인덱싱 진행 중
            statusOptions: [
                { value: 'all', label: '모든 상태' },
                { value: 'indexed', label: '완료' },
                { value: 'processing', label: '처리중' },
                { value: 'pending', label: '대기' },
                { value: 'failed', label: '실패' },
                { value: 'excluded', label: '제외' }
            ],
            // ─── 자료 역할(doc_role) — 각 role 이 독립 작업공간. '전체' 개념 없음. ───
            currentRole: 'content', // 'content' | 'glossary' | 'template' | 'reference' | 'dataset' | 'legal_review'
            roleOptions: [
                { value: 'content',     label: '일반 자료', icon: 'mdi-file-document-outline',   color: 'primary',         desc: '검색·요약 대상이 되는 본문 자료 (기본값)' },
                { value: 'glossary',    label: '용어 사전', icon: 'mdi-book-alphabet',           color: 'deep-purple',     desc: '한↔영 용어 매핑. 답변·번역 시 자동 참조. CSV(영문,한글뜻,약어) 업로드 지원' },
                { value: 'template',    label: '양식',      icon: 'mdi-file-table-outline',      color: 'orange-darken-2', desc: '보고서/계약서 양식. 문서 생성 시 활용 · hwpx/docx만 가능' },
                { value: 'reference',   label: '참조',      icon: 'mdi-bookmark-outline',        color: 'teal',            desc: '법령·규제·표준 등 인용용 참조' },
                { value: 'dataset',     label: '데이터',    icon: 'mdi-table',                   color: 'cyan-darken-2',   desc: '엑셀(xlsx) 정량 데이터. 분석 질문 시 코드 실행으로 처리 · xlsx만 가능' },
                { value: 'legal_review', label: '검토 사례', icon: 'mdi-gavel',                  color: 'red-darken-2',    desc: '변호사 검토 메모가 달린 과거 계약서(NDA/MOU). 사업배경으로 검색돼 검토에 활용 · docx만 가능' }
            ],
            // doc_role(분류)별 업로드 허용 확장자 — 백엔드 정책(knowledge_files.ROLE_ALLOWED_EXTENSIONS)과 동일.
            //   양식: 편집형(hwpx/docx) · 데이터: xlsx · 검토 사례: docx(메모 추출 docx XML 한정)
            roleAllowedExtensions: {
                content: ['pdf', 'hwp', 'hwpx', 'doc', 'docx', 'pptx', 'txt'],
                glossary: ['csv'],
                reference: ['pdf', 'hwp', 'hwpx', 'doc', 'docx', 'pptx', 'txt'],
                template: ['hwpx', 'docx'],
                dataset: ['xlsx'],
                legal_review: ['docx']
            },
            driveHeaders: [
                { title: '파일명', key: 'file_name', sortable: true },
                { title: '폴더', key: 'folder_path' },
                { title: '소유자', key: 'owner', width: 120 },
                { title: '크기', key: 'size_bytes', width: 90 },
                { title: '수정일', key: 'modified_time', width: 110 },
                { title: '상태', key: 'index_status', width: 110 },
                { title: '', key: 'actions', sortable: false, width: 50 }
            ],
            // 역할(doc_role) 컬럼 제거: 항상 현재 role 탭 안이라 모든 행이 동일 → 의미 없음.
            // 폴더(folder_path) 는 visibleUploadHeaders 에서 '전체'일 때만 노출(특정 폴더 선택 시 숨김).
            uploadHeaders: [
                { title: '파일명', key: 'file_name', sortable: true },
                { title: '폴더', key: 'folder_path' },
                { title: '업로더', key: 'uploaded_by_name', width: 130 },
                { title: '크기', key: 'size_bytes', width: 90 },
                { title: '업로드일', key: 'modified_time', width: 110 },
                { title: '상태', key: 'index_status', width: 110 },
                { title: '', key: 'actions', sortable: false, width: 100 }
            ],
            // 폴더 네비게이션
            currentFolder: '',
            viewAllMode: false,   // '전체 조회' opt-in — true 일 때만 폴더 미선택에서 전체 파일 로드
            // 경량 카운트(트리 배지/역할 탭) — 파일 전체를 안 들고도 전역 카운트 표시
            folderCounts: { role_totals: {}, folder_direct: {}, status_totals: {} },
            folderCard: null,                 // 선택 폴더의 요약 카드 (knowledge_folder_cards)
            // none(파일없음/없음) | loading(조회중) | pending(백그라운드 생성중) | done | stalled(폴링후에도없음)
            folderCardState: 'none',
            emptyFolders: [], // knowledge_folders 테이블에서 가져온 빈 폴더 (영속화)
            expandedFolders: {}, // { [folderPath]: true } — 펼쳐진 폴더. localStorage 영속.
            inlineCreate: { active: false, parent: '', name: '' }, // 인라인 새 폴더 입력 상태
            folderMenu: { show: false, x: 0, y: 0, node: null }, // 폴더 우클릭 컨텍스트 메뉴
            // 폴더 이름 변경: 코드는 보존하되 버튼만 숨김(폴더카드/경로 동기화 정리 전까지).
            // 재노출하려면 folderRenameEnabled = true 로.
            folderRenameEnabled: false,
            renameFolderDialog: false,
            renameFolderTarget: null, // { path, name, fileCount }
            renameFolderName: '',
            renameFolderLoading: false,
            deleteFolderDialog: false,
            deleteFolderTarget: null,
            deleteFolderLoading: false,
            folderNameRules: [
                (v) => !!v || '이름을 입력하세요',
                (v) => !/[\\/:*?"<>|]/.test(v || '') || '사용할 수 없는 문자가 있습니다'
            ]
        };
    },
    computed: {
        driveFiles() {
            return this.files.filter((f) => f.source_type === 'drive');
        },
        uploadFiles() {
            return this.files.filter((f) => f.source_type === 'upload');
        },
        counts() {
            return {
                drive: this.driveFiles.length,
                upload: this.uploadFiles.length
            };
        },
        filteredDrive() {
            return this.applyFilter(this.driveFiles, this.driveSearch, this.driveStatusFilter);
        },
        // 역할(doc_role)로 1차 필터링된 upload 자료
        roleScopedUpload() {
            return this.uploadFiles.filter((f) => this.roleOf(f) === this.currentRole);
        },
        // 현재 role 안의 빈 폴더만 (knowledge_folders.doc_role 기준)
        roleScopedEmptyFolders() {
            return this.emptyFolders
                .filter((f) => (f.doc_role || 'content') === this.currentRole)
                .map((f) => f.folder_path);
        },
        filteredUpload() {
            const list = this.applyFilter(this.roleScopedUpload, this.uploadSearch, this.uploadStatusFilter);
            // currentFolder 적용 — 빈 문자열이면 전체, 아니면 그 폴더에 직접 속한 파일만 (하위 폴더 제외)
            if (!this.currentFolder) return list;
            return list.filter((f) => (f.folder_path || '') === this.currentFolder);
        },
        // 업로드 진행률(%) — (완료+실패)/전체.
        uploadProgressPct() {
            const t = this.uploadStats.total || 0;
            if (!t) return 0;
            return Math.round(((this.uploadStats.done + this.uploadStats.failed) / t) * 100);
        },
        // 실패 목록은 상한까지만 렌더(나머지는 카운트). 대량 업로드 시 DOM 폭발 방지.
        uploadFailedVisible() {
            return this.uploadFailed.slice(0, 50);
        },
        uploadFailedOverflow() {
            return Math.max(0, this.uploadFailed.length - 50);
        },
        // 업로드 테이블 표시 컬럼 — 폴더(folder_path) 는 '전체'에서만 노출.
        // 특정 폴더 선택 시엔 모든 행이 같은 폴더라 숨긴다(역할 컬럼은 uploadHeaders 에서 이미 제외됨).
        visibleUploadHeaders() {
            if (this.currentFolder) {
                return this.uploadHeaders.filter((h) => h.key !== 'folder_path');
            }
            return this.uploadHeaders;
        },
        // 역할별 파일 개수 (sub-tab chip 표시용) — lazy: 경량 카운트 엔드포인트의 role_totals 사용(전역 정확)
        roleCounts() {
            return (this.folderCounts && this.folderCounts.role_totals) || {};
        },
        // 현재 선택된 역할 메타 (드롭존·breadcrumb 표시용)
        currentRoleMeta() {
            return this.roleOptions.find((r) => r.value === this.currentRole) || this.roleOptions[0];
        },
        // 업로드 시 부여될 역할 — 항상 현재 role
        uploadTargetRole() {
            return this.currentRole;
        },
        uploadTargetRoleMeta() {
            return this.roleOptions.find((r) => r.value === this.uploadTargetRole) || this.roleOptions[0];
        },
        // 현재 role 의 허용 확장자 배열
        allowedExtsForRole() {
            return this.roleAllowedExtensions[this.uploadTargetRole] || this.roleAllowedExtensions.content;
        },
        // 파일 피커 accept 속성 — 현재 role 허용 확장자로 제한
        uploadAccept() {
            const exts = this.allowedExtsForRole;
            return exts && exts.length ? exts.map((e) => '.' + e).join(',') : undefined;
        },
        // 드롭존 안내 문구용 — "PDF, HWP, …"
        uploadAcceptLabel() {
            return (this.allowedExtsForRole || []).map((e) => e.toUpperCase()).join(', ');
        },
        // 폴더 노드 (트리, 들여쓰기 정보 포함). 현재 역할 scope 기준.
        // lazy 로딩: 파일 전체를 안 들고 있으므로, 트리는 *등록 폴더 목록 + 경량 카운트 엔드포인트*로 만든다.
        //  - 경로: 등록 폴더(roleScopedEmptyFolders) ∪ 파일 있는 폴더(folderCounts) + 각자의 조상
        //  - 직속 카운트: folderCounts.folder_direct[role][path]
        //  - 하위(subtree) 카운트: 직속 카운트를 자기+조상에 합산
        folderNodes() {
            const scopedEmpty = this.roleScopedEmptyFolders;
            const direct = (this.folderCounts.folder_direct && this.folderCounts.folder_direct[this.currentRole]) || {};
            const pathSet = new Set();
            const addWithAncestors = (p) => {
                const segs = (p || '').split('/').filter(Boolean);
                let acc = '';
                for (const s of segs) { acc = acc ? `${acc}/${s}` : s; pathSet.add(acc); }
            };
            for (const p of scopedEmpty) addWithAncestors(p);
            for (const p of Object.keys(direct)) addWithAncestors(p);

            // 직속 카운트를 자기+조상에 합산 → subtree(하위 전체) 카운트
            const subtree = Object.create(null);
            for (const p of Object.keys(direct)) {
                const cnt = direct[p] || 0;
                if (!cnt) continue;
                const segs = p.split('/').filter(Boolean);
                let acc = '';
                for (const s of segs) { acc = acc ? `${acc}/${s}` : s; subtree[acc] = (subtree[acc] || 0) + cnt; }
            }
            const paths = [...pathSet].sort();
            return paths.map((path) => {
                const segs = path.split('/');
                const total = subtree[path] || 0;
                return {
                    path,
                    name: segs[segs.length - 1],
                    depth: segs.length - 1,
                    directFileCount: direct[path] || 0,  // 직접 이 폴더에 든 파일 수 (배지용)
                    fileCount: total,                    // 하위 전체 포함 (삭제 경고용)
                    isLocal: total === 0                 // 하위 통틀어 파일 0 = 빈 폴더
                };
            });
        },
        // 자식(하위폴더)을 가진 폴더 경로 집합 — chevron 표시 여부 판단용
        folderHasChildrenSet() {
            const set = new Set();
            for (const node of this.folderNodes) {
                const p = node.path;
                const parent = p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';
                if (parent) set.add(parent);
            }
            return set;
        },
        // 접힌 조상의 자손은 숨긴 트리 — 조상 경로가 모두 expanded 일 때만 표시
        visibleFolderNodes() {
            const exp = this.expandedFolders;
            return this.folderNodes.filter((node) => {
                const segs = node.path.split('/');
                let acc = '';
                for (let i = 0; i < segs.length - 1; i++) {
                    acc = acc ? `${acc}/${segs[i]}` : segs[i];
                    if (!exp[acc]) return false;
                }
                return true;
            });
        },
        // 자식 있는 폴더가 모두 펼쳐졌는지 (헤더 토글 아이콘용)
        allFoldersExpanded() {
            if (this.folderHasChildrenSet.size === 0) return false;
            for (const p of this.folderHasChildrenSet) {
                if (!this.expandedFolders[p]) return false;
            }
            return true;
        },
        driveCountsByStatus() {
            return this.countByStatus(this.driveFiles);
        },
        uploadCountsByStatus() {
            return this.countByStatus(this.uploadFiles);
        },
        // 현재 보이는 목록 중 재인덱싱 대상(failed + 권한 있음) — 일괄 재시도 버튼용
        failedRetryable() {
            return this.filteredUpload.filter(
                (f) => f.index_status === 'failed' && this.canDelete(f)
            );
        }
    },
    watch: {
        currentRole() {
            // 복원 중(_restoringNav)엔 저장된 폴더를 비우지 않는다 (applyPendingFolder 가 채움)
            if (this._restoringNav) return;
            // 역할 전환 시 폴더 컨텍스트 리셋 (역할별 폴더 트리가 다름)
            this.currentFolder = '';
            this.uploadSelected = [];
            this.persistNavState();
        },
        currentFolder() {
            // 폴더 선택 변경 시마다 저장 ('전체' 버튼 인라인 변경 포함) → 새로고침 유지
            this.persistNavState();
            this.fetchFolderCard();          // 선택 폴더의 요약 카드 갱신
            this.loadCurrentFolderFiles();   // lazy — 선택 폴더 파일만 로드
        }
    },
    mounted() {
        this.restoreNavState(); // currentRole 복원 + 저장된 폴더 stash
        this.loadExpandedState();
        this.fetchList().then(() => {
            this.ensureInitialExpansion();
            this.applyPendingFolder(); // 파일 로드 후 저장된 폴더 검증·복원
            // 진입 시 아직 인덱싱 중인 파일이 있으면(이전 업로드/타 사용자) 상태 폴링 시작
            this.startStatusPolling();
        });
    },
    beforeUnmount() {
        this.stopStatusPolling();
    },
    methods: {
        applyFilter(list, search, status) {
            const q = (search || '').trim().toLowerCase();
            return list.filter((f) => {
                if (status !== 'all' && f.index_status !== status) return false;
                if (!q) return true;
                return (
                    (f.file_name || '').toLowerCase().includes(q) ||
                    (f.folder_path || '').toLowerCase().includes(q)
                );
            });
        },
        countByStatus(list) {
            const c = { indexed: 0, processing: 0, pending: 0, failed: 0, excluded: 0 };
            for (const f of list) if (c[f.index_status] !== undefined) c[f.index_status]++;
            return c;
        },
        rowKey(item) {
            return `${item.source_type}:${item.source_ref}`;
        },
        // ─── 역할(doc_role) helper ───
        roleOf(item) {
            // 백엔드 컬럼 추가 전이라 미지정은 'content' 기본
            return (item && item.doc_role) || 'content';
        },
        roleMeta(role) {
            return this.roleOptions.find((r) => r.value === role) || this.roleOptions[1];
        },
        canDelete(item) {
            if (this.isAdmin) return true;
            if (!item || item.source_type !== 'upload') return false; // drive 인덱스 제거는 관리자만
            return !!item.uploaded_by_uid && String(item.uploaded_by_uid) === String(this.myUid);
        },
        iconOf(name) {
            return mimeIcon(extToMime(name));
        },
        formatBytes(b) {
            if (!b && b !== 0) return '-';
            if (b < 1024) return `${b} B`;
            if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
            if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
            return `${(b / 1024 / 1024 / 1024).toFixed(1)} GB`;
        },
        formatDate(iso) {
            if (!iso) return '-';
            try {
                return new Date(iso).toLocaleDateString('ko-KR');
            } catch {
                return '-';
            }
        },
        statusLabel(s) {
            return {
                indexed: '완료',
                processing: '처리중',
                pending: '대기',
                failed: '실패',
                excluded: '제외'
            }[s] || s;
        },
        statusColor(s) {
            return {
                indexed: 'success',
                processing: 'info',
                pending: 'grey',
                failed: 'error',
                excluded: 'grey-darken-1'
            }[s] || 'grey';
        },
        // 폴더 트리(가벼움)는 항상, 파일은 *선택 폴더만* 로드(lazy) — 수만 건 테넌트에서 전체 조회 회피.
        async fetchList() {
            const tenantId = window.$tenantName || '';
            if (!tenantId) return;
            this.loading = true;
            try {
                const foldersRes = await axios.get('/memento/knowledge/folders', { params: { tenant_id: tenantId } });
                // 백엔드는 [{folder_path, doc_role}, ...] 반환. 문자열 배열도 backward-compat 으로 수용.
                const rawFolders = Array.isArray(foldersRes.data?.folders) ? foldersRes.data.folders : [];
                this.emptyFolders = rawFolders.map((f) =>
                    typeof f === 'string'
                        ? { folder_path: f, doc_role: 'content' }
                        : { folder_path: f?.folder_path || '', doc_role: f?.doc_role || 'content' }
                ).filter((f) => f.folder_path);
                // 트리 배지/역할 탭용 경량 카운트(전역) + 현재 폴더 파일을 병렬 로드.
                await Promise.all([this.loadFolderCounts(), this.loadCurrentFolderFiles()]);
            } catch (e) {
                console.error('[KnowledgeFilesTab] fetch failed', e);
                this.notify('파일 목록 조회 실패', 'error', e?.message);
            } finally {
                this.loading = false;
            }
        },
        // 경량 카운트 엔드포인트 — 파일 전체를 안 들고도 역할별/폴더별 직속 카운트를 얻는다.
        async loadFolderCounts() {
            const tenantId = window.$tenantName || '';
            if (!tenantId) return;
            try {
                const { data } = await axios.get('/memento/knowledge/files/counts', { params: { tenant_id: tenantId } });
                this.folderCounts = {
                    role_totals: data?.role_totals || {},
                    folder_direct: data?.folder_direct || {},
                    status_totals: data?.status_totals || {},
                };
            } catch (e) {
                console.error('[KnowledgeFilesTab] counts fetch failed', e);
            }
        },
        // 현재 선택 폴더의 파일만 조회해 this.files 에 담는다(lazy). 폴더 미선택이면 비우고,
        // '전체 조회'(viewAllMode) 일 때만 테넌트 전체를 로드한다(대량이면 느릴 수 있음 — 명시적 opt-in).
        async loadCurrentFolderFiles() {
            const tenantId = window.$tenantName || '';
            if (!tenantId) { this.files = []; return; }
            const fp = this.currentFolder;
            const params = { tenant_id: tenantId };
            if (fp) {
                params.folder_path = fp;          // 그 폴더의 직속 파일만
            } else if (!this.viewAllMode) {
                this.files = [];                  // 폴더 미선택 + 전체조회 아님 → 비움
                return;
            }
            try {
                const { data } = await axios.get('/memento/documents/list', { params });
                this.files = Array.isArray(data?.file_details) ? data.file_details : [];
            } catch (e) {
                console.error('[KnowledgeFilesTab] folder files fetch failed', e);
                this.files = [];
            }
        },
        notify(msg, color = 'success', detail = null) {
            if (!window.$app_) return;
            window.$app_.snackbarMessage = msg;
            window.$app_.snackbarColor = color;
            window.$app_.snackbar = true;
            window.$app_.snackbarSuccessStatus = color === 'success';
            window.$app_.snackbarMessageDetail = detail;
            window.$app_.clickCount = 0;
        },
        onFileInput(e) {
            const files = Array.from(e.target.files || []);
            if (files.length) this.uploadFiles_(files);
            e.target.value = '';
        },
        onDrop(e) {
            this.isDragOver = false;
            const files = Array.from(e.dataTransfer?.files || []);
            if (files.length) this.uploadFiles_(files);
        },
        onFolderInput(e) {
            const files = Array.from(e.target.files || []);
            if (files.length) this.uploadFolderTree_(files);
            e.target.value = '';
        },
        // 폴더(디렉토리) 업로드 — webkitRelativePath 로 하위 트리 구조를 보존한다.
        // 각 파일의 folder_path = (현재 폴더 prefix) + (상대 디렉토리 경로). 정크/시스템 파일 제외.
        async uploadFolderTree_(files) {
            const SKIP = new Set(['.gitkeep', '.ds_store', 'thumbs.db', 'desktop.ini']);
            const usable = files.filter(
                (f) => f && f.name && !SKIP.has(f.name.toLowerCase()) && (f.size ?? 1) > 0
            );
            if (!usable.length) {
                console.warn('[KnowledgeFilesTab] folder upload: no usable files');
                return;
            }
            const base = this.currentFolder || '';
            const resolver = (file) => {
                // webkitRelativePath 예: "mock-corpus/A_사업/05.계약서/Credit Agreement.pdf"
                const rel = (file.webkitRelativePath || file.name).replace(/\\/g, '/');
                const dir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
                return [base, dir].filter(Boolean).join('/').replace(/^\/+|\/+$/g, '');
            };
            await this.uploadFiles_(usable, resolver);
        },
        async computeSha256(file) {
            const buf = await file.arrayBuffer();
            const digest = await crypto.subtle.digest('SHA-256', buf);
            return Array.from(new Uint8Array(digest))
                .map((b) => b.toString(16).padStart(2, '0'))
                .join('');
        },
        // 배치 중복 안내 — 'skip'(중복 제외) | 'overwrite'(중복 포함 모두) | 'cancel'
        askDuplicateBatch(dupCount, newCount) {
            this.duplicateInfo = { dupCount, newCount };
            this.duplicateDialog = true;
            return new Promise((resolve) => {
                this.duplicateResolver = resolve;
            });
        },
        resolveDuplicate(choice) {
            this.duplicateDialog = false;
            const r = this.duplicateResolver;
            this.duplicateResolver = null;
            this.duplicateInfo = null;
            if (r) r(choice);
        },
        async uploadFiles_(files, folderResolver = null) {
            const tenantId = window.$tenantName || '';
            if (!tenantId) return;
            // 루트 업로드 금지 — 일반 파일 업로드(resolver 없음)는 반드시 특정 폴더가 선택돼 있어야 한다.
            // ('전체' 상태에서 드롭/선택 시 root 로 들어가던 동작 차단. 폴더 업로드는 resolver 가 경로를 만들므로 허용.)
            if (!folderResolver && !this.currentFolder) {
                this.notify('업로드할 폴더를 먼저 선택하세요 (루트에는 올릴 수 없습니다)', 'warning');
                return;
            }
            // 새 배치 시작 — 진행/요약 상태 초기화 후 진행 표시 on.
            this.uploadSkipped = 0;
            this.uploadStats = { total: 0, done: 0, failed: 0 };
            this.uploadActive = [];
            this.uploadFailed = [];
            this.showUploadFailed = false;
            this.uploading = true;
            // 파일별 folder_path 해석기 — 폴더 업로드(트리 보존)면 webkitRelativePath 기반,
            // 평범한 파일 업로드면 현재 폴더(currentFolder) 고정.
            const folderOf = (f) => (folderResolver ? folderResolver(f) : (this.currentFolder || ''));
            const targetRole = this.uploadTargetRole;

            // doc_role(분류)별 허용 확장자 — 비허용 파일 거부. 백엔드도 400 으로 막지만 UX 상 미리 거른다.
            const allowedExts = this.roleAllowedExtensions[targetRole] || this.roleAllowedExtensions.content;
            const extOf = (name) => (name || '').split('.').pop()?.toLowerCase() || '';
            const isAllowed = (f) => allowedExts.includes(extOf(f.name));
            // 미지원 확장자는 *리스트에 노출하지 않고* 카운트만 — 한 줄 요약(인라인 + 스낵바)으로 안내.
            const bad = files.filter((f) => !isAllowed(f));
            if (bad.length) {
                this.uploadSkipped += bad.length;
                files = files.filter(isAllowed);
            }
            if (!files.length) {
                if (this.uploadSkipped) {
                    const label = allowedExts.map((e) => e.toUpperCase()).join(', ');
                    this.notify(`지원하지 않는 형식 ${this.uploadSkipped}개를 제외했습니다 (허용: ${label})`, 'warning');
                }
                this.uploading = false;
                return;
            }

            // 1) 해시 계산 + 중복 분류 — *다이얼로그는 파일마다가 아니라 배치로 1회만*.
            //    (폴더 재업로드처럼 중복이 수십~수백 개일 때 다이얼로그 폭탄 방지)
            //    분류는 제한 동시성으로 병렬 처리해 대기 시간 단축.
            const newItems = [];
            const dupItems = [];
            const classifyOne = async (file) => {
                let hash = '';
                try {
                    hash = await this.computeSha256(file);
                } catch (e) {
                    console.warn('[KnowledgeFilesTab] hash failed', e);
                }
                let exists = false;
                if (hash) {
                    try {
                        const { data } = await axios.get('/memento/knowledge/files/check-hash', {
                            params: { tenant_id: tenantId, file_hash: hash }
                        });
                        exists = !!(data?.exists && data.existing);
                    } catch (e) {
                        // 체크 실패 시 새 파일로 간주(업로드 진행)
                        console.warn('[KnowledgeFilesTab] hash check failed, treat as new', e);
                    }
                }
                (exists ? dupItems : newItems).push({ file, hash });
            };
            const CLASSIFY_CONC = 8;
            let _ci = 0;
            await Promise.all(
                Array.from({ length: Math.min(CLASSIFY_CONC, files.length) }, async () => {
                    while (_ci < files.length) {
                        const f = files[_ci++];
                        await classifyOne(f);
                    }
                })
            );

            // 2) 중복이 있으면 *한 번만* 묻는다: 건너뛰기(권장) / 모두 업로드 / 취소
            let accepted = newItems;
            if (dupItems.length > 0) {
                const choice = await this.askDuplicateBatch(dupItems.length, newItems.length);
                if (choice === 'cancel') { this.uploading = false; return; }
                if (choice === 'overwrite') {
                    accepted = newItems.concat(dupItems);
                } else { // 'skip'
                    accepted = newItems;
                    this.notify(`이미 있는 ${dupItems.length}개는 건너뛰고 ${newItems.length}개를 업로드합니다`, 'success');
                }
            }
            if (!accepted.length) {
                this.uploading = false;
                if (dupItems.length) this.notify('업로드할 새 파일이 없습니다 (모두 중복)', 'warning');
                return;
            }

            const docRole = this.uploadTargetRole;
            const usedFolders = new Set();
            this.uploadStats = { total: accepted.length, done: 0, failed: 0 };

            // 동시성 풀 + 적응형 백오프(AIMD) — 과부하(429/5xx/timeout/인덱싱실패) 시 동시 한도를
            // 곱셈 감소 + 짧은 쿨다운, 성공이 쌓이면 가산 회복. 워커는 N개지만 동적 한도(limit)
            // 이하로만 in-flight 유지 → 서버 과부하를 앱이 자가 제어. (active 집합 정확 추적)
            const FAILED_CAP = 200;
            const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
            const queue = accepted.slice();
            const ctrl = { limit: this.uploadConcurrency, okStreak: 0, cooldownUntil: 0 };
            const onTransient = () => {
                ctrl.limit = Math.max(1, Math.floor(ctrl.limit / 2));
                ctrl.okStreak = 0;
                ctrl.cooldownUntil = Date.now() + 2000;   // 전 워커 공유 쿨다운
            };
            const onSuccess = () => {
                ctrl.okStreak += 1;
                if (ctrl.okStreak >= 3 && ctrl.limit < this.uploadConcurrency) {
                    ctrl.limit += 1;          // 가산 회복
                    ctrl.okStreak = 0;
                }
            };
            const runWorker = async () => {
                while (queue.length) {
                    // 동적 한도 / 쿨다운 게이트 — 초과면 잠깐 대기 후 재확인
                    while (this.uploadActive.length >= ctrl.limit || Date.now() < ctrl.cooldownUntil) {
                        await sleep(150);
                    }
                    if (!queue.length) break;
                    const { file, hash } = queue.shift();
                    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                    const fileFolder = folderOf(file);
                    usedFolders.add(fileFolder);
                    const baseName = (file.name || 'file').replace(/\\/g, '/').split('/').pop() || 'file';
                    this.uploadActive.push({ id, name: baseName, folder: fileFolder });
                    const res = await this.uploadOne(file, tenantId, fileFolder, hash, docRole);
                    this.uploadActive = this.uploadActive.filter((a) => a.id !== id);
                    if (res) {
                        this.uploadStats.failed += 1;
                        if (this.uploadFailed.length < FAILED_CAP) {
                            this.uploadFailed.push({ id, name: baseName, error: res.error });
                        }
                        if (res.transient) onTransient();
                    } else {
                        this.uploadStats.done += 1;
                        onSuccess();
                    }
                }
            };
            const workerCount = Math.min(this.uploadConcurrency, accepted.length);
            await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

            this.uploading = false;
            // 업로드 성공 시 emptyFolders 에서 (사용한 경로 + 해당 role) 제거
            this.emptyFolders = this.emptyFolders.filter(
                (f) => !(usedFolders.has(f.folder_path) && (f.doc_role || 'content') === docRole)
            );
            await this.fetchList();
            // 인덱싱은 백그라운드에서 진행 → 프론트는 상태 폴링으로 배지만 갱신한다.
            // 폴더 요약 카드 재생성은 *서버(memento 인제스트 sweeper)*가 인덱싱 정착 후 자동 수행하므로
            // 프론트에서 트리거하지 않는다(페이지를 안 봐도 서버가 처리 → 방문 의존 제거).
            this.startStatusPolling();
        },
        // 단일 파일 업로드 → 성공 시 null, 실패 시 { error, transient } 반환.
        // transient=true(429/5xx/timeout/네트워크/인덱싱실패)면 워커 풀이 동시 한도를 줄임(백오프).
        async uploadOne(file, tenantId, folderPath = '', fileHash = '', docRole = 'content') {
            const fd = new FormData();
            // 폴더 업로드 시 file.name 이 전체 상대경로일 수 있어(webkitdirectory/Electron),
            // multipart filename 을 basename 으로 명시한다. 폴더 구조는 folder_path 로 별도 전송.
            const _baseName = (file.name || 'file').replace(/\\/g, '/').split('/').pop() || 'file';
            fd.append('file', file, _baseName);
            fd.append('tenant_id', tenantId);
            if (folderPath) fd.append('folder_path', folderPath);
            if (fileHash) fd.append('file_hash', fileHash);
            if (docRole) fd.append('doc_role', docRole);
            if (this.myUid) fd.append('uploaded_by_uid', this.myUid);
            if (this.myName) fd.append('uploaded_by_name', this.myName);
            try {
                await axios.post('/memento/knowledge/files/upload', fd, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                // 백그라운드 인제스트: 2xx = "접수 성공"(스토리지 저장 + pending 등록). 인덱싱은 서버가
                // 백그라운드로 처리하므로 여기선 성공 처리하고, 진행/완료는 상태 폴링(index_status)으로 본다.
                // (예전엔 indexed=false 를 실패로 간주했지만, 이젠 정상 흐름이라 그 로직 제거)
                return null;
            } catch (e) {
                const status = e?.response?.status;
                const transient =
                    !status || status === 429 || status >= 500 ||
                    e?.code === 'ECONNABORTED' || /timeout/i.test(e?.message || '');
                return { error: e?.response?.data?.detail || e?.message || '업로드 실패', transient };
            }
        },
        // 업로드/삭제 *배치 후* 영향받은 폴더 카드만 1회 갱신 (storm 없는 자동 경로).
        // 백엔드가 signature-skip 으로 실제 바뀐 폴더만 LLM 호출. fire-and-forget.
        async refreshFolderCards(folderPaths, docRole) {
            const tenantId = window.$tenantName || '';
            const folders = [...new Set((folderPaths || []).filter(Boolean))];
            if (!tenantId || !folders.length) return;
            try {
                const fd = new FormData();
                fd.append('tenant_id', tenantId);
                folders.forEach((p) => fd.append('folder_paths', p));
                if (docRole) fd.append('doc_role', docRole);
                await axios.post('/memento/knowledge/folders/refresh-cards', fd, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } catch (e) {
                console.warn('[KnowledgeFilesTab] refresh folder cards failed', e);
            }
        },
        // ── 백그라운드 인제스트 상태 폴링 ──
        // 업로드는 즉시 접수(pending)되고 서버가 백그라운드로 인덱싱한다. pending/processing 파일이
        // 남아있는 동안 주기적으로 목록을 다시 받아 상태 배지를 자동 갱신한다(수동 새로고침 불필요).
        hasProcessingFiles() {
            // lazy: 현재 폴더 파일뿐 아니라 전역 상태 카운트도 확인(다른 폴더 처리중 → 폴링 유지)
            const st = (this.folderCounts && this.folderCounts.status_totals) || {};
            if ((st.pending || 0) + (st.processing || 0) > 0) return true;
            return this.files.some(
                (f) => f.index_status === 'pending' || f.index_status === 'processing'
            );
        },
        startStatusPolling() {
            if (this.statusPollTimer) return;
            if (!this.hasProcessingFiles()) return; // 처리중 파일 없으면 폴링 불필요
            this.lastTerminalCount = -1;
            this.statusPollTimer = setInterval(() => this.pollIngestStatus(), 4000);
        },
        // 경량 상태 폴링 — 전체 목록(수천 행)을 매번 받지 않고 상태 카운트만 조회한다.
        // 완료(indexed+failed) 수가 변했을 때만 목록을 1회 재조회해 배지를 갱신 → 백엔드/프론트 부하 최소화.
        async pollIngestStatus() {
            if (this.pollInFlight) return; // 중첩 방지
            this.pollInFlight = true;
            try {
                const tenantId = window.$tenantName || '';
                if (!tenantId) return;
                const { data } = await axios.get('/memento/knowledge/ingest/status', {
                    params: { tenant_id: tenantId }
                });
                const c = (data && data.counts) || {};
                const processing = (c.pending || 0) + (c.processing || 0);
                const terminal = (c.indexed || 0) + (c.failed || 0);
                // 완료 항목이 늘었을 때만 전체 목록 재조회(배지 갱신)
                if (terminal !== this.lastTerminalCount) {
                    this.lastTerminalCount = terminal;
                    await this.fetchList();
                }
                if (processing === 0) this.stopStatusPolling(); // 모두 완료 → 폴링 종료
            } catch (e) {
                // 상태 조회 실패는 조용히(다음 tick 재시도)
            } finally {
                this.pollInFlight = false;
            }
        },
        stopStatusPolling() {
            if (this.statusPollTimer) {
                clearInterval(this.statusPollTimer);
                this.statusPollTimer = null;
            }
        },
        // 선택된 폴더의 요약 카드 조회 + '생성 중' 폴링.
        // 카드가 아직 없고 그 폴더에 파일이 있으면(=백그라운드 생성 예정) 5초 간격으로 자동 폴링.
        async fetchFolderCard() {
            const tenantId = window.$tenantName || '';
            const fp = this.currentFolder;
            const token = (this._folderCardToken = (this._folderCardToken || 0) + 1);
            this.folderCard = null;
            if (!tenantId || !fp) { this.folderCardState = 'none'; return; }
            // 이 폴더(또는 하위)에 파일이 있으면 카드가 곧 생성될 것으로 기대 → 폴링 대상.
            // lazy: 파일 전체가 없으므로 folderNodes 의 하위 포함 카운트(fileCount)로 판정.
            const node = this.folderNodes.find((n) => n.path === fp);
            const expectsCard = !!(node && node.fileCount > 0);
            const stale = () => this.currentFolder !== fp || token !== this._folderCardToken;
            const tryFetch = async () => {
                const { data } = await axios.get('/memento/folders/card', {
                    params: { tenant_id: tenantId, folder_path: fp, doc_role: this.currentRole }
                });
                return data?.card || null;
            };
            this.folderCardState = 'loading';
            try {
                let card = await tryFetch();
                if (stale()) return;
                let attempts = 0;
                while (!card && expectsCard && attempts < 6) {
                    this.folderCardState = 'pending';     // '요약 생성 중'
                    await new Promise((r) => setTimeout(r, 5000));
                    if (stale()) return;
                    card = await tryFetch();
                    if (stale()) return;
                    attempts += 1;
                }
                this.folderCard = card;
                this.folderCardState = card ? 'done' : (expectsCard ? 'stalled' : 'none');
            } catch (e) {
                if (!stale()) { this.folderCard = null; this.folderCardState = 'none'; }
            }
        },
        // 폴더 요약 수동 생성 ('지금 생성' 버튼) — refresh-cards 로 그 폴더 카드 재생성 후 폴링.
        async generateFolderCard() {
            const fp = this.currentFolder;
            if (!fp) return;
            this.folderCardState = 'pending';
            await this.refreshFolderCards([fp], this.currentRole);
            this.fetchFolderCard();   // 생성은 백그라운드 → 폴링으로 가져옴
        },
        // ─── 폴더 트리: 접기/펴기 ───
        loadExpandedState() {
            try {
                const raw = localStorage.getItem('kft_expanded');
                this.expandedFolders = raw ? JSON.parse(raw) || {} : {};
            } catch {
                this.expandedFolders = {};
            }
        },
        persistExpanded() {
            try {
                localStorage.setItem('kft_expanded', JSON.stringify(this.expandedFolders));
            } catch {
                /* localStorage 불가(시크릿 등) 시 무시 */
            }
        },
        // ─── 네비 상태(역할/폴더) 영속 — 새로고침 유지 ───
        persistNavState() {
            try {
                localStorage.setItem('kft_nav', JSON.stringify({ role: this.currentRole, folder: this.currentFolder }));
            } catch {
                /* 무시 */
            }
        },
        // mounted 에서 호출: 저장된 role 복원 + folder 는 stash (파일 로드 후 검증해 적용)
        restoreNavState() {
            this._pendingFolder = null;
            try {
                const raw = localStorage.getItem('kft_nav');
                if (!raw) return;
                const saved = JSON.parse(raw) || {};
                this._pendingFolder = typeof saved.folder === 'string' ? saved.folder : '';
                if (saved.role && this.roleOptions.some((r) => r.value === saved.role)) {
                    this._restoringNav = true; // currentRole watch 가 폴더 비우지 않게
                    this.currentRole = saved.role;
                }
            } catch {
                this._pendingFolder = null;
            }
        },
        // fetchList 이후 호출: 저장된 폴더가 현재 role 트리에 실제 존재할 때만 복원
        applyPendingFolder() {
            const target = this._pendingFolder;
            this._pendingFolder = null;
            if (target && this.folderNodes.some((n) => n.path === target)) {
                this.currentFolder = target;
                this.expandToPath(target); // 조상 펼쳐 화면에 드러냄
            } else {
                this.currentFolder = '';
            }
            this._restoringNav = false;
            this.persistNavState();
        },
        // 최초 진입 시 펼침 상태가 비어 있으면 최상위 폴더만 펼쳐 보여준다.
        ensureInitialExpansion() {
            if (this._expandInit) return;
            this._expandInit = true;
            if (Object.keys(this.expandedFolders).length > 0) return;
            const next = {};
            for (const n of this.folderNodes) {
                if (n.depth === 0 && this.folderHasChildrenSet.has(n.path)) next[n.path] = true;
            }
            this.expandedFolders = next;
            this.persistExpanded();
        },
        isFolderExpanded(path) {
            return !!this.expandedFolders[path];
        },
        folderHasChildren(path) {
            return this.folderHasChildrenSet.has(path);
        },
        toggleFolderExpand(path) {
            const next = { ...this.expandedFolders };
            if (next[path]) delete next[path];
            else next[path] = true;
            this.expandedFolders = next;
            this.persistExpanded();
        },
        // path 의 *부모 사슬*(자기 자신 포함 옵션)을 펼친다 → 깊은 폴더를 화면에 드러냄
        expandToPath(path, includeSelf = false) {
            if (!path) return;
            const next = { ...this.expandedFolders };
            const segs = path.split('/');
            const upto = includeSelf ? segs.length : segs.length - 1;
            let acc = '';
            for (let i = 0; i < upto; i++) {
                acc = acc ? `${acc}/${segs[i]}` : segs[i];
                next[acc] = true;
            }
            this.expandedFolders = next;
            this.persistExpanded();
        },
        expandAll() {
            const next = {};
            for (const p of this.folderHasChildrenSet) next[p] = true;
            this.expandedFolders = next;
            this.persistExpanded();
        },
        collapseAll() {
            this.expandedFolders = {};
            this.persistExpanded();
        },
        // 행 클릭 동작:
        //  - 새 폴더(아직 미선택) 클릭 → 선택 + 펼침(원클릭 드릴인)
        //  - 이미 선택된 폴더 재클릭 → 펼침/접힘 토글
        // (chevron 클릭은 선택과 무관하게 항상 토글)
        onFolderRowClick(node) {
            const alreadyCurrent = this.currentFolder === node.path;
            this.viewAllMode = false;          // 특정 폴더 선택 → 전체조회 해제
            this.currentFolder = node.path;
            if (!this.folderHasChildren(node.path)) return;
            if (alreadyCurrent || !this.isFolderExpanded(node.path)) {
                this.toggleFolderExpand(node.path);
            }
        },
        // '전체 조회' — 폴더 미선택 상태로 테넌트 전체 파일을 로드(opt-in, 대량이면 느릴 수 있음)
        viewAllFiles() {
            this.viewAllMode = true;
            if (this.currentFolder === '') {
                this.loadCurrentFolderFiles();  // watch 안 뜨는 경우(이미 '') 직접 로드
            } else {
                this.currentFolder = '';        // watch 가 loadCurrentFolderFiles 호출
            }
        },
        // ─── 폴더 우클릭 컨텍스트 메뉴 ───
        openFolderMenuAt(clientX, clientY, node) {
            const MENU_W = 190;
            const MENU_H = node ? 200 : 60;
            const x = Math.max(8, Math.min(clientX, window.innerWidth - MENU_W - 8));
            const y = Math.max(8, Math.min(clientY, window.innerHeight - MENU_H - 8));
            // 먼저 닫았다가 다음 틱에 열어 위치/대상 갱신을 확실히 반영
            this.folderMenu = { show: false, x, y, node };
            this.$nextTick(() => {
                this.folderMenu = { show: true, x, y, node };
            });
        },
        openFolderContextMenu(e, node) {
            this.openFolderMenuAt(e.clientX, e.clientY, node);
        },
        openRootContextMenu(e) {
            // 행에서는 .stop 으로 막히므로, 여기 오는 건 빈 영역 우클릭 → 루트 새 폴더
            this.openFolderMenuAt(e.clientX, e.clientY, null);
        },
        closeFolderMenu() {
            this.folderMenu = { ...this.folderMenu, show: false };
        },
        ctxNewSubfolder() {
            const node = this.folderMenu.node;
            this.closeFolderMenu();
            this.startInlineCreate(node ? node.path : '');
        },
        ctxRename() {
            const node = this.folderMenu.node;
            this.closeFolderMenu();
            if (node) this.openRenameFolderDialog(node);
        },
        ctxDelete() {
            const node = this.folderMenu.node;
            this.closeFolderMenu();
            if (node) this.openDeleteFolderDialog(node);
        },
        // ─── 인라인 새 폴더 생성 (VS Code/Finder식) ───
        startInlineCreate(parentPath) {
            this.inlineCreate = { active: true, parent: parentPath || '', name: '' };
            // 부모(및 조상)를 펼쳐 입력칸이 자식 위치에 보이도록
            if (parentPath) this.expandToPath(parentPath, true);
            this.$nextTick(() => {
                const r = this.$refs.inlineInputNode;
                const el = Array.isArray(r) ? r[0] : r;
                (el || this.$refs.inlineInputRoot)?.focus();
            });
        },
        cancelInlineCreate() {
            this.inlineCreate = { active: false, parent: '', name: '' };
        },
        async commitInlineCreate() {
            if (!this.inlineCreate.active) return; // blur/enter 중복 호출 가드
            const name = (this.inlineCreate.name || '').trim();
            const parent = this.inlineCreate.parent || '';
            if (!name) {
                this.cancelInlineCreate();
                return;
            }
            if (/[\\/:*?"<>|]/.test(name)) {
                this.notify('사용할 수 없는 문자가 있습니다', 'error');
                return; // 입력칸 유지 → 사용자가 수정
            }
            const fullPath = parent ? `${parent}/${name}` : name;
            if (this.folderNodes.some((n) => n.path === fullPath)) {
                this.notify('이미 존재하는 폴더입니다', 'error');
                return;
            }
            // 성공 경로 진입 전에 비활성화 → blur 재호출이 중복 생성하지 않게
            this.inlineCreate = { active: false, parent: '', name: '' };
            try {
                const fd = new FormData();
                fd.append('tenant_id', window.$tenantName);
                fd.append('folder_path', fullPath);
                fd.append('doc_role', this.currentRole);
                // 생성자 식별용 (백엔드가 소유자 기록에 사용)
                if (this.myUid) fd.append('requester_uid', this.myUid);
                await axios.post('/memento/knowledge/folders', fd, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                const exists = this.emptyFolders.some(
                    (f) => f.folder_path === fullPath && (f.doc_role || 'content') === this.currentRole
                );
                if (!exists) this.emptyFolders.push({ folder_path: fullPath, doc_role: this.currentRole });
                this.expandToPath(fullPath); // 조상 펼쳐 새 폴더 노출
                this.currentFolder = fullPath;
                this.notify('폴더가 생성되었습니다');
            } catch (e) {
                this.notify('폴더 생성 실패', 'error', e?.response?.data?.detail || e?.message);
            }
        },
        // ─── 폴더 이름 변경 (현재 버튼 숨김 — folderRenameEnabled. 코드 보존) ───
        openRenameFolderDialog(node) {
            this.renameFolderTarget = node;
            this.renameFolderName = node.name;
            this.renameFolderDialog = true;
        },
        async performRenameFolder() {
            const node = this.renameFolderTarget;
            const name = (this.renameFolderName || '').trim();
            if (!node || !name || name === node.name) {
                this.renameFolderDialog = false;
                return;
            }
            if (/[\\/:*?"<>|]/.test(name)) {
                this.notify('사용할 수 없는 문자가 있습니다', 'error');
                return;
            }
            // 같은 부모 아래에서 이름만 바뀜
            const parts = node.path.split('/');
            parts[parts.length - 1] = name;
            const newPath = parts.join('/');

            this.renameFolderLoading = true;
            try {
                const fd = new FormData();
                fd.append('tenant_id', window.$tenantName);
                fd.append('old_path', node.path);
                fd.append('new_path', newPath);
                fd.append('requester_uid', this.myUid);
                fd.append('doc_role', this.currentRole);
                await axios.post('/memento/knowledge/folders/rename', fd, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                if (this.currentFolder === node.path) this.currentFolder = newPath;
                else if (this.currentFolder.startsWith(node.path + '/')) {
                    this.currentFolder = newPath + this.currentFolder.slice(node.path.length);
                }
                await this.fetchList();
                this.notify('폴더 이름을 변경했습니다');
                this.renameFolderDialog = false;
            } catch (e) {
                this.notify('이름 변경 실패', 'error', e?.response?.data?.detail || e?.message);
            } finally {
                this.renameFolderLoading = false;
            }
        },
        openDeleteFolderDialog(node) {
            this.deleteFolderTarget = node;
            this.deleteFolderDialog = true;
        },
        async performDeleteFolder() {
            const node = this.deleteFolderTarget;
            if (!node) return;
            this.deleteFolderLoading = true;
            try {
                const { data } = await axios.delete('/memento/knowledge/folders', {
                    params: {
                        tenant_id: window.$tenantName,
                        folder_path: node.path,
                        requester_uid: this.myUid,
                        doc_role: this.currentRole
                    }
                });
                // 백엔드가 실제 삭제 여부를 ok 로 반환 — 예전엔 실패해도 성공처럼 보였음.
                if (data && data.ok === false) {
                    await this.fetchList();
                    this.notify('폴더 삭제 실패 — 다시 시도해주세요', 'error',
                        `대상 ${data.total ?? '?'}건 중 0건 처리됨`);
                    return;
                }
                if (this.currentFolder === node.path || this.currentFolder.startsWith(node.path + '/')) {
                    this.currentFolder = '';
                }
                await this.fetchList();
                if (data && data.partial) {
                    this.notify('폴더 삭제됨 (일부 색인 아티팩트 정리는 지연될 수 있음)', 'success');
                } else {
                    this.notify('폴더가 삭제되었습니다');
                }
                this.deleteFolderDialog = false;
            } catch (e) {
                this.notify('폴더 삭제 실패', 'error', e?.response?.data?.detail || e?.message);
            } finally {
                this.deleteFolderLoading = false;
            }
        },
        confirmDelete(item) {
            this.deleteTarget = item;
            this.deleteDialog = true;
        },
        confirmBulkDelete(kind) {
            const list = kind === 'drive' ? this.driveSelected : this.uploadSelected;
            if (!list.length) return;
            const deletable = list.filter((it) => this.canDelete(it));
            const skipped = list.length - deletable.length;
            if (!deletable.length) {
                this.notify('삭제 권한이 있는 파일이 없습니다 (본인이 업로드한 파일만 삭제 가능)', 'error');
                return;
            }
            if (skipped > 0) {
                this.notify(`${skipped}개 파일은 권한이 없어 제외됩니다`, 'warning');
            }
            this.bulkDeleteKind = kind;
            this.bulkDeleteTargets = [...deletable];
            this.bulkDeleteDialog = true;
        },
        async performBulkDelete() {
            const targets = this.bulkDeleteTargets;
            const kind = this.bulkDeleteKind;
            if (!targets.length) {
                this.bulkDeleteDialog = false;
                return;
            }
            this.bulkDeleting = true;
            const failed = [];
            const succeededKeys = new Set();
            try {
                const results = await Promise.allSettled(
                    targets.map((item) =>
                        axios.delete('/memento/knowledge/files', {
                            params: {
                                tenant_id: window.$tenantName,
                                source_type: item.source_type,
                                source_ref: item.source_ref,
                                requester_uid: this.myUid
                            }
                        }).then(() => this.rowKey(item))
                    )
                );
                results.forEach((r, i) => {
                    if (r.status === 'fulfilled') {
                        succeededKeys.add(r.value);
                    } else {
                        failed.push(targets[i].file_name);
                    }
                });
                if (succeededKeys.size > 0) {
                    this.files = this.files.filter((f) => !succeededKeys.has(this.rowKey(f)));
                }
                if (kind === 'drive') {
                    this.driveSelected = this.driveSelected.filter((it) => !succeededKeys.has(this.rowKey(it)));
                } else {
                    this.uploadSelected = this.uploadSelected.filter((it) => !succeededKeys.has(this.rowKey(it)));
                }
                if (failed.length === 0) {
                    this.notify(`${succeededKeys.size}개 ${kind === 'drive' ? '인덱스에서 제거' : '삭제'}되었습니다`);
                } else {
                    this.notify(
                        `${succeededKeys.size}개 처리됨, ${failed.length}개 실패`,
                        'error',
                        failed.slice(0, 5).join(', ')
                    );
                }
                // 삭제 배치 끝 → 영향받은 폴더 카드 갱신 (upload 소스만; drive 는 폴더 트리 대상 아님)
                if (kind !== 'drive') {
                    const affected = [...new Set(targets.map((t) => t.folder_path).filter(Boolean))];
                    this.refreshFolderCards(affected, this.currentRole);
                }
            } finally {
                this.bulkDeleting = false;
                this.bulkDeleteDialog = false;
                this.bulkDeleteTargets = [];
            }
        },
        // 인덱싱 실패 파일 1건 재인덱싱 (스토리지 원본 재처리)
        // 파싱 결과 미리보기 — document_pages(저장된 페이지 본문)를 열어 파서가 뽑은 마크다운을 확인.
        async openPreview(item) {
            const tenantId = window.$tenantName || '';
            if (!tenantId || !item?.source_ref) return;
            const key = this.rowKey(item);
            const next = new Set(this.previewingKeys);
            next.add(key);
            this.previewingKeys = next;
            // 다이얼로그 즉시 오픈 + 로딩 표시
            this.previewFileName = item.file_name || '';
            this.previewPages = [];
            this.previewError = '';
            this.previewLoading = true;
            this.previewDialog = true;
            try {
                const { data } = await axios.get('/memento/parse/stored', {
                    params: { tenant_id: tenantId, source_ref: item.source_ref }
                });
                this.previewPages = data?.pages || [];
                if (!this.previewPages.length) {
                    this.previewError = '저장된 페이지 본문이 없습니다. (인덱싱 방식에 따라 페이지 본문이 없을 수 있어요)';
                }
            } catch (e) {
                this.previewError = e?.response?.data?.detail || e?.message || '미리보기를 불러오지 못했습니다';
            } finally {
                this.previewLoading = false;
                const after = new Set(this.previewingKeys);
                after.delete(key);
                this.previewingKeys = after;
            }
        },
        // 파일 다운로드 — memento 가 원본 파일명 Content-Disposition 이 박힌 storage URL 을 돌려준다.
        // (내부망 배포에선 kong:8000 → 외부 host 로 치환된 URL — 백엔드 get_knowledge_file_url 참고)
        async downloadFile(item) {
            const tenantId = window.$tenantName || '';
            if (!tenantId || !item?.source_ref) return;
            const key = this.rowKey(item);
            const next = new Set(this.downloadingKeys);
            next.add(key);
            this.downloadingKeys = next;
            try {
                const { data } = await axios.get('/memento/knowledge/files/url', {
                    params: {
                        tenant_id: tenantId,
                        source_type: item.source_type,
                        source_ref: item.source_ref,
                        file_name: item.file_name || ''
                    }
                });
                if (data?.url) window.open(data.url, '_blank', 'noopener');
                else this.notify('다운로드 URL을 가져오지 못했습니다', 'error');
            } catch (e) {
                this.notify('다운로드 실패', 'error', e?.response?.data?.detail || e?.message);
            } finally {
                const after = new Set(this.downloadingKeys);
                after.delete(key);
                this.downloadingKeys = after;
            }
        },
        async reindexFile(item) {
            if (!item) return;
            const key = this.rowKey(item);
            const next = new Set(this.reindexingKeys);
            next.add(key);
            this.reindexingKeys = next;
            try {
                const fd = new FormData();
                fd.append('tenant_id', window.$tenantName);
                fd.append('source_type', item.source_type);
                fd.append('source_ref', item.source_ref);
                if (this.myUid) fd.append('requester_uid', this.myUid);
                const { data } = await axios.post('/memento/knowledge/files/reindex', fd, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                if (data?.indexed) this.notify('재인덱싱 완료');
                else this.notify('재인덱싱 실패', 'error', data?.error || '인덱싱 실패');
                await this.fetchList();
                // 응답 시점에 아직 processing 일 수 있다 → 폴링을 걸어 배지가 스스로 갱신되게 한다.
                // (안 걸면 사용자가 새로고침할 때까지 '처리중'으로 남는다)
                this.startStatusPolling();
            } catch (e) {
                this.notify('재인덱싱 실패', 'error', e?.response?.data?.detail || e?.message);
            } finally {
                const after = new Set(this.reindexingKeys);
                after.delete(key);
                this.reindexingKeys = after;
            }
        },
        // 파일별 요약 상태 → 칩 메타 (요약=최종 완료의 일부). skipped/없음이면 show=false.
        summaryMeta(item) {
            const s = item?.summary_status;
            if (s === 'done') return { show: true, label: '요약', color: 'success', icon: 'mdi-text-box-check-outline' };
            if (s === 'failed') return { show: true, label: '요약 실패', color: 'error', icon: 'mdi-text-box-remove-outline' };
            if (s === 'pending') return { show: true, label: '요약 중', color: 'grey', icon: 'mdi-text-box-search-outline' };
            return { show: false };   // skipped(해당없음) 또는 미상
        },
        // 요약만 재생성 (재임베딩 없음) — '요약 실패' 파일의 '다시 요약' 버튼.
        async resummarizeFile(item) {
            if (!item) return;
            const key = this.rowKey(item);
            const next = new Set(this.resummarizingKeys);
            next.add(key);
            this.resummarizingKeys = next;
            try {
                const fd = new FormData();
                fd.append('tenant_id', window.$tenantName);
                fd.append('source_type', item.source_type);
                fd.append('source_ref', item.source_ref);
                if (this.myUid) fd.append('requester_uid', this.myUid);
                const { data } = await axios.post('/memento/knowledge/files/resummarize', fd, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                if (data?.summarized) this.notify('요약 재생성 완료');
                else this.notify('요약 재생성 실패', 'error', '잠시 후 다시 시도하세요');
                await this.fetchList();
            } catch (e) {
                this.notify('요약 재생성 실패', 'error', e?.response?.data?.detail || e?.message);
            } finally {
                const after = new Set(this.resummarizingKeys);
                after.delete(key);
                this.resummarizingKeys = after;
            }
        },
        // 현재 목록의 실패 파일들 일괄 재인덱싱
        async retryAllFailed() {
            const targets = [...this.failedRetryable];
            if (!targets.length) return;
            this.bulkReindexing = true;
            let ok = 0;
            try {
                const results = await Promise.allSettled(
                    targets.map((item) => {
                        const fd = new FormData();
                        fd.append('tenant_id', window.$tenantName);
                        fd.append('source_type', item.source_type);
                        fd.append('source_ref', item.source_ref);
                        if (this.myUid) fd.append('requester_uid', this.myUid);
                        return axios.post('/memento/knowledge/files/reindex', fd, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                        });
                    })
                );
                ok = results.filter((r) => r.status === 'fulfilled' && r.value?.data?.indexed).length;
                const failed = targets.length - ok;
                if (failed === 0) this.notify(`${ok}개 재인덱싱 완료`);
                else this.notify(`${ok}개 완료, ${failed}개 실패`, failed === targets.length ? 'error' : 'warning');
                await this.fetchList();
                this.startStatusPolling(); // 아직 processing 인 항목이 있으면 배지 자동 갱신
            } catch (e) {
                this.notify('일괄 재인덱싱 실패', 'error', e?.message);
            } finally {
                this.bulkReindexing = false;
            }
        },
        async performDelete() {
            const item = this.deleteTarget;
            this.deleteDialog = false;
            if (!item) return;
            const key = this.rowKey(item);
            const next = new Set(this.deletingKeys);
            next.add(key);
            this.deletingKeys = next;
            try {
                await axios.delete('/memento/knowledge/files', {
                    params: {
                        tenant_id: window.$tenantName,
                        source_type: item.source_type,
                        source_ref: item.source_ref,
                        requester_uid: this.myUid
                    }
                });
                this.files = this.files.filter((f) => this.rowKey(f) !== key);
                this.notify(item.source_type === 'drive' ? '인덱스에서 제거되었습니다' : '파일이 삭제되었습니다');
                // 파일 삭제 → 그 폴더 카드 갱신 (upload 소스만)
                if (item.source_type === 'upload') {
                    this.refreshFolderCards([item.folder_path], item.doc_role || this.currentRole);
                }
            } catch (e) {
                this.notify('삭제 실패', 'error', e?.response?.data?.detail || e?.message);
            } finally {
                const after = new Set(this.deletingKeys);
                after.delete(key);
                this.deletingKeys = after;
                this.deleteTarget = null;
            }
        }
    }
};
</script>

<style scoped>
.preview-card {
    display: flex;
    flex-direction: column;
    height: 86vh;
    overflow: hidden;
}

.preview-card__viewer {
    flex: 1;
    min-height: 0;
}

.kft-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
}

.kft-title {
    font-size: 18px;
    font-weight: 600;
}

.kft-source-tabs {
    margin-bottom: 0;
}

/* ── 역할(doc_role) sub-tabs ── */
.kft-role-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 4px 0 8px;
    padding: 6px;
    background: rgba(0, 0, 0, 0.025);
    border-radius: 8px;
}

.kft-role-tab {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid transparent;
    background: var(--cds-surface-2);
    cursor: pointer;
    font-size: 13px;
    color: rgba(0, 0, 0, 0.7);
    transition: background 0.12s, border-color 0.12s, color 0.12s;
}

.kft-role-tab:hover {
    background: rgba(0, 0, 0, 0.04);
}

.kft-role-tab-count {
    margin-left: 4px;
    font-size: 11px;
    color: rgba(0, 0, 0, 0.5);
    background: rgba(0, 0, 0, 0.05);
    border-radius: 8px;
    padding: 1px 7px;
    min-width: 22px;
    text-align: center;
}

.kft-role-tab.is-active {
    font-weight: 600;
    border-color: currentColor;
}

.kft-role-tab.is-active.is-all       { color: var(--cds-text-secondary); background: rgba(97, 97, 97, 0.08); }
.kft-role-tab.is-active.is-content   { color: rgb(var(--v-theme-primary)); background: rgba(var(--v-theme-primary), 0.1); }
.kft-role-tab.is-active.is-glossary  { color: #6741d9; background: rgba(103, 65, 217, 0.1); }
.kft-role-tab.is-active.is-template  { color: var(--cds-text-warning); background: rgba(239, 108, 0, 0.1); }
.kft-role-tab.is-active.is-reference { color: #00897b; background: rgba(0, 137, 123, 0.1); }
.kft-role-tab.is-active.is-dataset   { color: #00838f; background: rgba(0, 131, 143, 0.1); }

.kft-role-tab.is-active .kft-role-tab-count {
    background: rgba(255, 255, 255, 0.7);
    color: inherit;
}

.kft-role-desc {
    display: flex;
    align-items: center;
    font-size: 12px;
    color: rgba(0, 0, 0, 0.6);
    padding: 4px 8px 12px;
}

/* 드롭존 역할별 색 hint */
.kft-dropzone-role {
    margin-left: auto;
}

.kft-dropzone.is-role-glossary {
    border-color: rgba(103, 65, 217, 0.4);
    background: rgba(103, 65, 217, 0.04);
}

.kft-dropzone.is-role-template {
    border-color: rgba(239, 108, 0, 0.4);
    background: rgba(239, 108, 0, 0.04);
}

.kft-dropzone.is-role-reference {
    border-color: rgba(0, 137, 123, 0.4);
    background: rgba(0, 137, 123, 0.04);
}

.kft-dropzone.is-role-dataset {
    border-color: rgba(0, 131, 143, 0.4);
    background: rgba(0, 131, 143, 0.04);
}

/* upload 탭 좌우 분할 */
.kft-upload-layout {
    display: flex;
    gap: 16px;
    align-items: flex-start;
}

.kft-folder-sidebar {
    flex: 0 0 240px;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 8px;
    background: var(--cds-bg-neutral);
    max-height: 600px;
    overflow-y: auto;
}

.kft-folder-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px 6px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.kft-folder-list {
    display: flex;
    flex-direction: column;
    padding: 6px 4px;
}

.kft-folder-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border-radius: 5px;
    border: none;
    background: transparent;
    cursor: pointer;
    text-align: left;
    width: 100%;
    color: rgba(0, 0, 0, 0.75);
    font-size: 13px;
}

.kft-folder-item:hover {
    background: rgba(0, 0, 0, 0.04);
}

.kft-folder-item.is-active {
    background: rgba(var(--v-theme-primary), 0.1);
    color: rgb(var(--v-theme-primary));
    font-weight: 500;
}

.kft-folder-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.kft-folder-count {
    font-size: 11px;
    color: rgba(0, 0, 0, 0.45);
    background: rgba(0, 0, 0, 0.04);
    border-radius: 8px;
    padding: 1px 7px;
}

.kft-folder-item.is-active .kft-folder-count {
    background: rgba(var(--v-theme-primary), 0.15);
    color: rgb(var(--v-theme-primary));
}

/* 액션은 absolute 오버레이 — layout shift 없음 */
.kft-folder-actions {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 2px 4px;
    border-radius: 4px;
    background: var(--cds-bg-neutral);
    box-shadow: -4px 0 6px -2px var(--cds-bg-neutral);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.12s ease;
}

.kft-folder-item.is-active .kft-folder-actions,
.kft-folder-item:hover .kft-folder-actions {
    opacity: 1;
    pointer-events: auto;
}

/* 활성/호버 상태에서 actions 배경을 그 행 배경에 맞춤 */
.kft-folder-item:hover .kft-folder-actions {
    background: #efefef;
    box-shadow: -4px 0 6px -2px #efefef;
}

.kft-folder-item.is-active .kft-folder-actions {
    background: rgb(238, 244, 252);
    box-shadow: -4px 0 6px -2px rgb(238, 244, 252);
}

.kft-upload-main {
    flex: 1;
    min-width: 0;
}

.kft-breadcrumb {
    display: flex;
    align-items: center;
    padding: 6px 10px;
    background: rgba(0, 0, 0, 0.03);
    border-radius: 6px;
    font-size: 13px;
    margin-bottom: 12px;
}

.kft-dropzone {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px 24px;
    border: 2px dashed rgba(var(--v-theme-primary), 0.4);
    border-radius: 10px;
    background: rgba(var(--v-theme-primary), 0.04);
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
}

.kft-dropzone:hover {
    background: rgba(var(--v-theme-primary), 0.08);
}

.kft-dropzone.is-drag-over {
    background: rgba(var(--v-theme-primary), 0.12);
    border-color: rgb(var(--v-theme-primary));
}

/* 루트(폴더 미선택) — 업로드 비활성 상태: 클릭 불가 + 흐리게 + 경고 테두리 */
.kft-dropzone.is-disabled,
.kft-dropzone.is-disabled:hover {
    cursor: not-allowed;
    border-color: rgba(0, 0, 0, 0.18);
    background: rgba(0, 0, 0, 0.03);
}

.kft-dropzone-text {
    flex: 1;
    line-height: 1.4;
}

.kft-upload-list {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.kft-upload-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.03);
    font-size: 13px;
}

.kft-upload-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.kft-upload-progress {
    flex: 0 0 80px;
}

/* ── 업로드 진행 패널 (대량 폴더 업로드 대응: 전체 행 미렌더, 진행바 + active + 실패만) ── */
.kft-upload-progress-panel {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.02);
    border: 1px solid rgba(0, 0, 0, 0.06);
}
.kft-upload-skipped {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: rgb(var(--v-theme-warning));
}
.kft-upload-progress-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.kft-upload-active {
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.kft-upload-active-label {
    font-size: 11px;
    color: rgba(0, 0, 0, 0.45);
    margin-top: 2px;
}
.kft-upload-failed-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    padding: 4px 0;
    cursor: pointer;
    font-size: 12px;
    color: rgb(var(--v-theme-error));
}
.kft-upload-failed-list {
    max-height: 200px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-top: 4px;
}

/* ── 폴더 요약 카드 ── */
.kft-folder-card {
    margin: 10px 0;
    padding: 12px 14px;
    border-radius: 8px;
    background: rgba(var(--v-theme-primary), 0.04);
    border: 1px solid rgba(var(--v-theme-primary), 0.15);
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.kft-folder-card-head {
    display: flex;
    align-items: center;
    gap: 6px;
}
.kft-folder-card-title {
    font-size: 12px;
    font-weight: 600;
    color: rgb(var(--v-theme-primary));
}
.kft-folder-card-summary {
    font-size: 13px;
    line-height: 1.5;
    white-space: pre-wrap;
}
.kft-folder-card-topics {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}
.kft-folder-card-empty {
    display: flex;
    align-items: center;
    gap: 10px;
}

.kft-toolbar {
    display: flex;
    gap: 10px;
    align-items: center;
}

.kft-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    font-size: 12px;
    color: rgba(0, 0, 0, 0.7);
}

.kft-stat-chip {
    padding: 2px 10px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.05);
}

.kft-stat-chip.is-indexed {
    background: rgba(76, 175, 80, 0.1);
    color: var(--cds-text-success);
}

.kft-stat-chip.is-processing {
    background: rgba(33, 150, 243, 0.1);
    color: hsl(var(--accent-brand));
}

.kft-stat-chip.is-failed {
    background: rgba(244, 67, 54, 0.1);
    color: var(--cds-text-danger);
}

.kft-table :deep(.v-data-table__td) {
    font-size: 13px;
}

.kft-name-cell {
    display: flex;
    align-items: center;
    gap: 8px;
}

.kft-stats {
    min-height: 32px;
}

.kft-bulk-inline {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s ease;
}

.kft-bulk-inline.is-active {
    opacity: 1;
    pointer-events: auto;
}

.kft-bulk-count {
    font-size: 12px;
    color: rgba(0, 0, 0, 0.7);
    margin-right: 4px;
}

.kft-bulk-list {
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 6px;
    overflow-y: auto;
}

/* ── 폴더 트리: chevron / 인라인 입력 ── */
.kft-folder-caret {
    flex: 0 0 16px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: rgba(0, 0, 0, 0.4);
    border-radius: 3px;
    cursor: pointer;
}

.kft-folder-caret:hover {
    background: rgba(0, 0, 0, 0.1);
    color: rgba(0, 0, 0, 0.7);
}

.kft-folder-caret.is-spacer,
.kft-folder-caret.is-spacer:hover {
    cursor: default;
    background: transparent;
}

.kft-folder-input {
    cursor: default;
}

.kft-inline-input {
    flex: 1;
    min-width: 0;
    border: 1px solid rgb(var(--v-theme-primary));
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 13px;
    line-height: 1.4;
    outline: none;
    background: #fff;
    color: rgba(0, 0, 0, 0.85);
}

/* ── 폴더 우클릭 컨텍스트 메뉴 (teleport to body) ── */
.kft-ctx-backdrop {
    position: fixed;
    inset: 0;
    z-index: 2400;
}

.kft-ctx-menu {
    position: fixed;
    z-index: 2401;
    min-width: 180px;
    padding: 4px;
    background: #fff;
}
</style>
