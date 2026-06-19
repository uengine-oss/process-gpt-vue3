<template>
    <v-card elevation="10">
        <v-card-text class="pt-4">
            <!-- 헤더 -->
            <div class="kft-header">
                <div>
                    <div class="kft-title">지식 베이스</div>
                    <div class="text-caption text-medium-emphasis mt-1">
                        Google Drive 동기화 파일과 Storage 업로드 파일을 관리합니다.
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
                                <button
                                    class="kft-folder-item"
                                    :class="{ 'is-active': currentFolder === '' }"
                                    @click="currentFolder = ''"
                                >
                                    <span class="kft-folder-caret is-spacer"></span>
                                    <v-icon size="14">mdi-folder-outline</v-icon>
                                    <span class="kft-folder-name">전체</span>
                                    <span class="kft-folder-count">{{ roleScopedUpload.length }}</span>
                                </button>

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

                            <!-- 업로드 드롭존 -->
                            <div
                                class="kft-dropzone"
                                :class="{ 'is-drag-over': isDragOver, 'is-uploading': uploadQueue.length > 0, [`is-role-${uploadTargetRole}`]: true }"
                                @dragover.prevent="isDragOver = true"
                                @dragleave.prevent="isDragOver = false"
                                @drop.prevent="onDrop"
                                @click="$refs.fileInput.click()"
                            >
                                <v-icon size="32" :color="uploadTargetRoleMeta.color">mdi-cloud-upload-outline</v-icon>
                                <div class="kft-dropzone-text">
                                    <strong>{{ currentFolder ? `"${currentFolder}" 폴더에 업로드` : '루트에 업로드' }}</strong>
                                    <div class="text-caption text-medium-emphasis mt-1">
                                        파일을 끌어다 놓거나 클릭하세요 — 자동으로 RAG 인덱싱됩니다
                                    </div>
                                    <v-chip size="x-small" variant="outlined" class="mt-1" :color="uploadTargetRoleMeta.color">
                                        허용 형식: {{ uploadAcceptLabel }}
                                    </v-chip>
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

                            <!-- 업로드 진행 -->
                            <div v-if="uploadQueue.length > 0" class="kft-upload-list">
                                <div v-for="u in uploadQueue" :key="u.id" class="kft-upload-row">
                                    <v-icon size="16" :color="u.status === 'failed' ? 'error' : u.status === 'done' ? 'success' : 'primary'">
                                        {{ u.status === 'failed' ? 'mdi-alert-circle' : u.status === 'done' ? 'mdi-check-circle' : 'mdi-progress-upload' }}
                                    </v-icon>
                                    <span class="kft-upload-name">{{ u.name }}</span>
                                    <v-chip
                                        v-if="u.role"
                                        size="x-small"
                                        :color="roleMeta(u.role).color"
                                        variant="tonal"
                                    >
                                        <v-icon start size="11">{{ roleMeta(u.role).icon }}</v-icon>
                                        {{ roleMeta(u.role).label }}
                                    </v-chip>
                                    <span v-if="u.folder" class="text-caption text-medium-emphasis">→ {{ u.folder || '루트' }}</span>
                                    <v-progress-linear
                                        v-if="u.status === 'uploading'"
                                        indeterminate
                                        color="primary"
                                        height="2"
                                        class="kft-upload-progress"
                                    />
                                    <span v-else-if="u.status === 'failed'" class="text-caption text-error">{{ u.error }}</span>
                                    <span v-else-if="u.status === 'done'" class="text-caption text-success">완료</span>
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
                                </template>
                                <template v-slot:[`item.actions`]="{ item }">
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
        <v-dialog v-model="duplicateDialog" max-width="520">
            <v-card>
                <v-card-title class="text-h6">
                    <v-icon start color="warning">mdi-content-duplicate</v-icon>
                    이미 업로드된 파일입니다
                </v-card-title>
                <v-card-text>
                    <div class="mb-2">
                        <strong>{{ duplicateInfo?.newName }}</strong> 와 동일한 내용의 파일이 이미 지식 베이스에 있습니다.
                    </div>
                    <v-card variant="tonal" color="primary" class="pa-3 mt-3">
                        <div class="text-caption text-medium-emphasis">기존 파일</div>
                        <div class="mt-1">
                            <v-icon size="16" class="mr-1">mdi-file-outline</v-icon>
                            <strong>{{ duplicateInfo?.existing?.file_name }}</strong>
                        </div>
                        <div class="text-caption mt-1">
                            <v-icon size="14" class="mr-1">mdi-folder-outline</v-icon>
                            {{ duplicateInfo?.existing?.folder_path || '(루트)' }}
                            <span class="ml-2" v-if="duplicateInfo?.existing?.source_type === 'drive'">
                                · Google Drive
                            </span>
                        </div>
                    </v-card>
                    <div class="text-caption text-medium-emphasis mt-3">
                        그래도 업로드하시겠습니까? (같은 내용이 두 번 인덱싱될 수 있습니다)
                    </div>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="resolveDuplicate(false)">취소</v-btn>
                    <v-btn color="warning" variant="flat" @click="resolveDuplicate(true)">그래도 업로드</v-btn>
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
    </v-card>
</template>

<script>
import axios from 'axios';
import { mimeIcon } from '@/utils/fileIcon';

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
            uploadQueue: [],
            deletingKeys: new Set(),
            reindexingKeys: new Set(), // 재인덱싱 진행 중인 파일 rowKey
            deleteDialog: false,
            deleteTarget: null,
            duplicateDialog: false,
            duplicateInfo: null, // { newName, existing }
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
                { value: 'indexed', label: '인덱싱 완료' },
                { value: 'processing', label: '처리중' },
                { value: 'pending', label: '대기' },
                { value: 'failed', label: '실패' },
                { value: 'excluded', label: '제외' }
            ],
            // ─── 자료 역할(doc_role) — 각 role 이 독립 작업공간. '전체' 개념 없음. ───
            currentRole: 'content', // 'content' | 'glossary' | 'template' | 'reference' | 'dataset' | 'legal_review'
            roleOptions: [
                { value: 'content',     label: '일반 자료', icon: 'mdi-file-document-outline',   color: 'primary',         desc: '검색·요약 대상이 되는 본문 자료 (기본값)' },
                { value: 'glossary',    label: '용어 사전', icon: 'mdi-book-alphabet',           color: 'deep-purple',     desc: '한↔영 등 용어 매핑. 답변 작성 시 자동 참조' },
                { value: 'template',    label: '양식',      icon: 'mdi-file-table-outline',      color: 'orange-darken-2', desc: '보고서/계약서 양식. 문서 생성 시 활용 · hwpx/docx만 가능' },
                { value: 'reference',   label: '참조',      icon: 'mdi-bookmark-outline',        color: 'teal',            desc: '법령·규제·표준 등 인용용 참조' },
                { value: 'dataset',     label: '데이터',    icon: 'mdi-table',                   color: 'cyan-darken-2',   desc: '엑셀(xlsx) 정량 데이터. 분석 질문 시 코드 실행으로 처리 · xlsx만 가능' },
                { value: 'legal_review', label: '검토 사례', icon: 'mdi-gavel',                  color: 'red-darken-2',    desc: '변호사 검토 메모가 달린 과거 계약서(NDA/MOU). 사업배경으로 검색돼 검토에 활용 · docx만 가능' }
            ],
            // doc_role(분류)별 업로드 허용 확장자 — 백엔드 정책(knowledge_files.ROLE_ALLOWED_EXTENSIONS)과 동일.
            //   양식: 편집형(hwpx/docx) · 데이터: xlsx · 검토 사례: docx(메모 추출 docx XML 한정)
            roleAllowedExtensions: {
                content: ['pdf', 'hwp', 'hwpx', 'doc', 'docx', 'pptx', 'txt'],
                glossary: ['pdf', 'hwp', 'hwpx', 'doc', 'docx', 'pptx', 'txt'],
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
                { title: '', key: 'actions', sortable: false, width: 50 }
            ],
            // 폴더 네비게이션
            currentFolder: '',
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
        // 업로드 테이블 표시 컬럼 — 폴더(folder_path) 는 '전체'에서만 노출.
        // 특정 폴더 선택 시엔 모든 행이 같은 폴더라 숨긴다(역할 컬럼은 uploadHeaders 에서 이미 제외됨).
        visibleUploadHeaders() {
            if (this.currentFolder) {
                return this.uploadHeaders.filter((h) => h.key !== 'folder_path');
            }
            return this.uploadHeaders;
        },
        // 역할별 파일 개수 (sub-tab chip 표시용)
        roleCounts() {
            const c = { content: 0, glossary: 0, template: 0, reference: 0, dataset: 0, legal_review: 0 };
            for (const f of this.uploadFiles) {
                const r = this.roleOf(f);
                if (c[r] !== undefined) c[r]++;
            }
            return c;
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
        folderNodes() {
            const scopedFiles = this.roleScopedUpload; // 역할 필터 적용된 파일
            const scopedEmpty = this.roleScopedEmptyFolders; // 같은 role 의 빈 폴더만
            const set = new Set();
            for (const f of scopedFiles) {
                const p = (f.folder_path || '').trim();
                if (!p) continue;
                const segs = p.split('/').filter(Boolean);
                let acc = '';
                for (const s of segs) {
                    acc = acc ? `${acc}/${s}` : s;
                    set.add(acc);
                }
            }
            for (const p of scopedEmpty) {
                if (!p) continue;
                const segs = p.split('/').filter(Boolean);
                let acc = '';
                for (const s of segs) {
                    acc = acc ? `${acc}/${s}` : s;
                    set.add(acc);
                }
            }
            const paths = [...set].sort();
            const emptyFolderSet = new Set(scopedEmpty);
            return paths.map((path) => {
                const segs = path.split('/');
                // 직접 이 폴더에 든 파일 수 (배지 표시용 — 자식 폴더 파일은 제외)
                const directFileCount = scopedFiles.filter((f) => (f.folder_path || '') === path).length;
                // 하위 전체 포함 파일 수 (삭제 경고 / isLocal 판정용 — 폴더 삭제 시 같이 지워지는 총량)
                const fileCount = scopedFiles.filter((f) => {
                    const p = f.folder_path || '';
                    return p === path || p.startsWith(path + '/');
                }).length;
                return {
                    path,
                    name: segs[segs.length - 1],
                    depth: segs.length - 1,
                    directFileCount,
                    fileCount,
                    isLocal: fileCount === 0 && emptyFolderSet.has(path)
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
        }
    },
    mounted() {
        this.restoreNavState(); // currentRole 복원 + 저장된 폴더 stash
        this.loadExpandedState();
        this.fetchList().then(() => {
            this.ensureInitialExpansion();
            this.applyPendingFolder(); // 파일 로드 후 저장된 폴더 검증·복원
        });
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
                indexed: '인덱싱 완료',
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
        async fetchList() {
            const tenantId = window.$tenantName || '';
            if (!tenantId) return;
            this.loading = true;
            try {
                const [filesRes, foldersRes] = await Promise.all([
                    axios.get('/memento/documents/list', { params: { tenant_id: tenantId } }),
                    axios.get('/memento/knowledge/folders', { params: { tenant_id: tenantId } })
                ]);
                this.files = Array.isArray(filesRes.data?.file_details) ? filesRes.data.file_details : [];
                // 백엔드는 [{folder_path, doc_role}, ...] 반환. 문자열 배열도 backward-compat 으로 수용.
                const rawFolders = Array.isArray(foldersRes.data?.folders) ? foldersRes.data.folders : [];
                this.emptyFolders = rawFolders.map((f) =>
                    typeof f === 'string'
                        ? { folder_path: f, doc_role: 'content' }
                        : { folder_path: f?.folder_path || '', doc_role: f?.doc_role || 'content' }
                ).filter((f) => f.folder_path);
            } catch (e) {
                console.error('[KnowledgeFilesTab] fetch failed', e);
                this.notify('파일 목록 조회 실패', 'error', e?.message);
            } finally {
                this.loading = false;
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
        askDuplicate(newName, existing) {
            this.duplicateInfo = { newName, existing };
            this.duplicateDialog = true;
            return new Promise((resolve) => {
                this.duplicateResolver = resolve;
            });
        },
        resolveDuplicate(proceed) {
            this.duplicateDialog = false;
            const r = this.duplicateResolver;
            this.duplicateResolver = null;
            this.duplicateInfo = null;
            if (r) r(proceed);
        },
        async uploadFiles_(files, folderResolver = null) {
            const tenantId = window.$tenantName || '';
            if (!tenantId) return;
            // 파일별 folder_path 해석기 — 폴더 업로드(트리 보존)면 webkitRelativePath 기반,
            // 평범한 파일 업로드면 현재 폴더(currentFolder) 고정.
            const folderOf = (f) => (folderResolver ? folderResolver(f) : (this.currentFolder || ''));
            const targetRole = this.uploadTargetRole;

            // doc_role(분류)별 허용 확장자 — 비허용 파일 거부. 백엔드도 400 으로 막지만 UX 상 미리 거른다.
            const allowedExts = this.roleAllowedExtensions[targetRole] || this.roleAllowedExtensions.content;
            const extOf = (name) => (name || '').split('.').pop()?.toLowerCase() || '';
            const isAllowed = (f) => allowedExts.includes(extOf(f.name));
            const bad = files.filter((f) => !isAllowed(f));
            if (bad.length) {
                const label = allowedExts.map((e) => e.toUpperCase()).join(', ');
                for (const f of bad) {
                    this.uploadQueue.push({
                        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                        name: f.name, folder: folderOf(f), role: targetRole, status: 'failed',
                        error: `이 분류는 ${label} 형식만 업로드할 수 있습니다`
                    });
                }
                files = files.filter(isAllowed);
                if (!files.length) return;
            }

            // 1) 해시 계산 + 중복 체크 (다이얼로그는 한 파일씩 순차로)
            const accepted = [];
            for (const file of files) {
                let hash = '';
                try {
                    hash = await this.computeSha256(file);
                } catch (e) {
                    console.warn('[KnowledgeFilesTab] hash failed', e);
                }
                if (hash) {
                    try {
                        const { data } = await axios.get('/memento/knowledge/files/check-hash', {
                            params: { tenant_id: tenantId, file_hash: hash }
                        });
                        if (data?.exists && data.existing) {
                            const proceed = await this.askDuplicate(file.name, data.existing);
                            if (!proceed) continue;
                        }
                    } catch (e) {
                        console.warn('[KnowledgeFilesTab] hash check failed, proceeding', e);
                    }
                }
                accepted.push({ file, hash });
            }
            if (!accepted.length) return;

            const docRole = this.uploadTargetRole;
            const usedFolders = new Set();
            const tasks = accepted.map(({ file, hash }) => {
                const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                const fileFolder = folderOf(file);
                usedFolders.add(fileFolder);
                this.uploadQueue.push({ id, name: file.name, folder: fileFolder, role: docRole, status: 'uploading', error: null });
                return this.uploadOne(id, file, tenantId, fileFolder, hash, docRole);
            });
            await Promise.allSettled(tasks);
            // 업로드 성공 시 emptyFolders 에서 (사용한 경로 + 해당 role) 제거
            this.emptyFolders = this.emptyFolders.filter(
                (f) => !(usedFolders.has(f.folder_path) && (f.doc_role || 'content') === docRole)
            );
            await this.fetchList();
            // 업로드 배치 끝 → 영향받은 폴더 카드 1회 갱신 (단일·폴더 업로드 모두 이 경로).
            this.refreshFolderCards([...usedFolders], docRole);
            setTimeout(() => {
                this.uploadQueue = this.uploadQueue.filter((u) => u.status === 'uploading');
            }, 3000);
        },
        async uploadOne(id, file, tenantId, folderPath = '', fileHash = '', docRole = 'content') {
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
                const { data } = await axios.post('/memento/knowledge/files/upload', fd, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                const item = this.uploadQueue.find((u) => u.id === id);
                if (item) {
                    if (data?.indexed) {
                        item.status = 'done';
                    } else {
                        item.status = 'failed';
                        item.error = data?.error || '인덱싱 실패';
                    }
                }
            } catch (e) {
                const item = this.uploadQueue.find((u) => u.id === id);
                if (item) {
                    item.status = 'failed';
                    item.error = e?.response?.data?.detail || e?.message || '업로드 실패';
                }
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
            this.currentFolder = node.path;
            if (!this.folderHasChildren(node.path)) return;
            if (alreadyCurrent || !this.isFolderExpanded(node.path)) {
                this.toggleFolderExpand(node.path);
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
                await axios.delete('/memento/knowledge/folders', {
                    params: {
                        tenant_id: window.$tenantName,
                        folder_path: node.path,
                        requester_uid: this.myUid,
                        doc_role: this.currentRole
                    }
                });
                if (this.currentFolder === node.path || this.currentFolder.startsWith(node.path + '/')) {
                    this.currentFolder = '';
                }
                await this.fetchList();
                this.notify('폴더가 삭제되었습니다');
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
            } catch (e) {
                this.notify('재인덱싱 실패', 'error', e?.response?.data?.detail || e?.message);
            } finally {
                const after = new Set(this.reindexingKeys);
                after.delete(key);
                this.reindexingKeys = after;
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
    background: #fff;
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

.kft-role-tab.is-active.is-all       { color: #616161; background: rgba(97, 97, 97, 0.08); }
.kft-role-tab.is-active.is-content   { color: rgb(var(--v-theme-primary)); background: rgba(var(--v-theme-primary), 0.1); }
.kft-role-tab.is-active.is-glossary  { color: #6741d9; background: rgba(103, 65, 217, 0.1); }
.kft-role-tab.is-active.is-template  { color: #ef6c00; background: rgba(239, 108, 0, 0.1); }
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
    background: #fafafa;
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
    background: #fafafa;
    box-shadow: -4px 0 6px -2px #fafafa;
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
    color: #2e7d32;
}

.kft-stat-chip.is-processing {
    background: rgba(33, 150, 243, 0.1);
    color: #1565c0;
}

.kft-stat-chip.is-failed {
    background: rgba(244, 67, 54, 0.1);
    color: #c62828;
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
