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
                <v-tab v-if="isAdmin" value="drive">
                    <v-icon start size="16">mdi-google-drive</v-icon>
                    Google Drive
                    <v-chip size="x-small" color="primary" variant="tonal" class="ml-2">
                        {{ counts.drive }}
                    </v-chip>
                </v-tab>
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
                    <div class="kft-upload-layout">
                        <!-- 좌측: 폴더 사이드바 -->
                        <div class="kft-folder-sidebar">
                            <div class="kft-folder-header">
                                <span class="text-caption font-weight-medium">폴더</span>
                                <v-btn
                                    icon
                                    variant="text"
                                    size="x-small"
                                    @click="openNewFolderDialog"
                                    title="새 폴더 만들기"
                                >
                                    <v-icon size="16">mdi-folder-plus-outline</v-icon>
                                </v-btn>
                            </div>
                            <div class="kft-folder-list">
                                <button
                                    class="kft-folder-item"
                                    :class="{ 'is-active': currentFolder === '' }"
                                    @click="currentFolder = ''"
                                >
                                    <v-icon size="14">mdi-folder-outline</v-icon>
                                    <span class="kft-folder-name">전체</span>
                                    <span class="kft-folder-count">{{ uploadFiles.length }}</span>
                                </button>
                                <div
                                    v-for="node in folderNodes"
                                    :key="node.path"
                                    class="kft-folder-item"
                                    :class="{ 'is-active': currentFolder === node.path }"
                                    :style="{ paddingLeft: `${8 + node.depth * 12}px` }"
                                    @click="currentFolder = node.path"
                                >
                                    <v-icon size="14" :color="node.isLocal ? '#9e9e9e' : '#ffa726'">
                                        {{ node.isLocal ? 'mdi-folder-outline' : 'mdi-folder' }}
                                    </v-icon>
                                    <span class="kft-folder-name">{{ node.name }}</span>
                                    <span class="kft-folder-count">{{ node.fileCount }}</span>
                                    <span v-if="isAdmin" class="kft-folder-actions" @click.stop>
                                        <v-tooltip text="이름 변경" location="top">
                                            <template v-slot:activator="{ props }">
                                                <v-btn
                                                    v-bind="props"
                                                    icon
                                                    variant="text"
                                                    size="x-small"
                                                    @click.stop="openRenameFolderDialog(node)"
                                                >
                                                    <v-icon size="14">mdi-pencil-outline</v-icon>
                                                </v-btn>
                                            </template>
                                        </v-tooltip>
                                        <v-tooltip text="폴더 삭제" location="top">
                                            <template v-slot:activator="{ props }">
                                                <v-btn
                                                    v-bind="props"
                                                    icon
                                                    variant="text"
                                                    size="x-small"
                                                    color="error"
                                                    @click.stop="openDeleteFolderDialog(node)"
                                                >
                                                    <v-icon size="14">mdi-delete-outline</v-icon>
                                                </v-btn>
                                            </template>
                                        </v-tooltip>
                                    </span>
                                </div>
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
                                :class="{ 'is-drag-over': isDragOver, 'is-uploading': uploadQueue.length > 0 }"
                                @dragover.prevent="isDragOver = true"
                                @dragleave.prevent="isDragOver = false"
                                @drop.prevent="onDrop"
                                @click="$refs.fileInput.click()"
                            >
                                <v-icon size="32" color="primary">mdi-cloud-upload-outline</v-icon>
                                <div class="kft-dropzone-text">
                                    <strong>{{ currentFolder ? `"${currentFolder}" 폴더에 업로드` : '루트에 업로드' }}</strong>
                                    <div class="text-caption text-medium-emphasis mt-1">
                                        파일을 끌어다 놓거나 클릭하세요 — 자동으로 RAG 인덱싱됩니다
                                    </div>
                                </div>
                                <input ref="fileInput" type="file" multiple class="d-none" @change="onFileInput" />
                            </div>

                            <!-- 업로드 진행 -->
                            <div v-if="uploadQueue.length > 0" class="kft-upload-list">
                                <div v-for="u in uploadQueue" :key="u.id" class="kft-upload-row">
                                    <v-icon size="16" :color="u.status === 'failed' ? 'error' : u.status === 'done' ? 'success' : 'primary'">
                                        {{ u.status === 'failed' ? 'mdi-alert-circle' : u.status === 'done' ? 'mdi-check-circle' : 'mdi-progress-upload' }}
                                    </v-icon>
                                    <span class="kft-upload-name">{{ u.name }}</span>
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
                                :headers="uploadHeaders"
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

        <!-- 폴더 이름 변경 다이얼로그 -->
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

        <!-- 새 폴더 다이얼로그 -->
        <v-dialog v-model="newFolderDialog" max-width="420">
            <v-card>
                <v-card-title class="text-h6">새 폴더 만들기</v-card-title>
                <v-card-text>
                    <v-text-field
                        v-model="newFolderName"
                        label="폴더 이름"
                        variant="outlined"
                        density="compact"
                        autofocus
                        hide-details="auto"
                        :rules="folderNameRules"
                        @keyup.enter="createFolder"
                    />
                    <div class="text-caption text-medium-emphasis mt-3">
                        부모 폴더: <strong>{{ currentFolder || '(루트)' }}</strong>
                    </div>
                    <div class="text-caption text-medium-emphasis mt-1">
                        ※ 폴더는 첫 파일 업로드 시점에 실제로 생성됩니다.
                    </div>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="newFolderDialog = false">취소</v-btn>
                    <v-btn color="primary" variant="flat" @click="createFolder" :disabled="!newFolderName.trim()">만들기</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

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
            activeTab: isAdmin ? 'drive' : 'upload',
            driveSearch: '',
            driveStatusFilter: 'all',
            uploadSearch: '',
            uploadStatusFilter: 'all',
            isDragOver: false,
            uploadQueue: [],
            deletingKeys: new Set(),
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
            statusOptions: [
                { value: 'all', label: '모든 상태' },
                { value: 'indexed', label: '인덱싱 완료' },
                { value: 'processing', label: '처리중' },
                { value: 'pending', label: '대기' },
                { value: 'failed', label: '실패' },
                { value: 'excluded', label: '제외' }
            ],
            driveHeaders: [
                { title: '파일명', key: 'file_name', sortable: true },
                { title: '폴더', key: 'folder_path' },
                { title: '소유자', key: 'owner', width: 120 },
                { title: '크기', key: 'size_bytes', width: 90 },
                { title: '수정일', key: 'modified_time', width: 110 },
                { title: '상태', key: 'index_status', width: 110 },
                { title: '', key: 'actions', sortable: false, width: 50 }
            ],
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
            newFolderDialog: false,
            newFolderName: '',
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
        filteredUpload() {
            const list = this.applyFilter(this.uploadFiles, this.uploadSearch, this.uploadStatusFilter);
            // currentFolder 적용 — 빈 문자열이면 전체, 아니면 그 폴더에 직접 속한 파일만 (하위 폴더 제외)
            if (!this.currentFolder) return list;
            return list.filter((f) => (f.folder_path || '') === this.currentFolder);
        },
        // 폴더 노드 (트리, 들여쓰기 정보 포함)
        folderNodes() {
            // 모든 폴더 경로 수집
            const set = new Set();
            for (const f of this.uploadFiles) {
                const p = (f.folder_path || '').trim();
                if (!p) continue;
                // 자기 자신 + 모든 조상 추가
                const segs = p.split('/').filter(Boolean);
                let acc = '';
                for (const s of segs) {
                    acc = acc ? `${acc}/${s}` : s;
                    set.add(acc);
                }
            }
            for (const p of this.emptyFolders) {
                if (!p) continue;
                const segs = p.split('/').filter(Boolean);
                let acc = '';
                for (const s of segs) {
                    acc = acc ? `${acc}/${s}` : s;
                    set.add(acc);
                }
            }
            const paths = [...set].sort();
            const emptyFolderSet = new Set(this.emptyFolders);
            return paths.map((path) => {
                const segs = path.split('/');
                const fileCount = this.uploadFiles.filter((f) => {
                    const p = f.folder_path || '';
                    return p === path || p.startsWith(path + '/');
                }).length;
                return {
                    path,
                    name: segs[segs.length - 1],
                    depth: segs.length - 1,
                    fileCount,
                    isLocal: fileCount === 0 && emptyFolderSet.has(path)
                };
            });
        },
        driveCountsByStatus() {
            return this.countByStatus(this.driveFiles);
        },
        uploadCountsByStatus() {
            return this.countByStatus(this.uploadFiles);
        }
    },
    mounted() {
        this.fetchList();
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
                this.emptyFolders = Array.isArray(foldersRes.data?.folders) ? foldersRes.data.folders : [];
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
        async uploadFiles_(files) {
            const tenantId = window.$tenantName || '';
            if (!tenantId) return;
            const folder = this.currentFolder || '';

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

            const tasks = accepted.map(({ file, hash }) => {
                const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                this.uploadQueue.push({ id, name: file.name, folder, status: 'uploading', error: null });
                return this.uploadOne(id, file, tenantId, folder, hash);
            });
            await Promise.allSettled(tasks);
            // 업로드 성공 시 emptyFolders에서 해당 경로 제거 (실제 파일이 들어왔으니 더 이상 "local only"가 아님)
            if (folder) {
                this.emptyFolders = this.emptyFolders.filter((p) => p !== folder);
            }
            await this.fetchList();
            setTimeout(() => {
                this.uploadQueue = this.uploadQueue.filter((u) => u.status === 'uploading');
            }, 3000);
        },
        async uploadOne(id, file, tenantId, folderPath = '', fileHash = '') {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('tenant_id', tenantId);
            if (folderPath) fd.append('folder_path', folderPath);
            if (fileHash) fd.append('file_hash', fileHash);
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
        openNewFolderDialog() {
            this.newFolderName = '';
            this.newFolderDialog = true;
        },
        async createFolder() {
            const name = (this.newFolderName || '').trim();
            if (!name) return;
            if (/[\\/:*?"<>|]/.test(name)) {
                this.notify('사용할 수 없는 문자가 있습니다', 'error');
                return;
            }
            const fullPath = this.currentFolder ? `${this.currentFolder}/${name}` : name;
            if (this.folderNodes.some((n) => n.path === fullPath)) {
                this.notify('이미 존재하는 폴더입니다', 'error');
                return;
            }
            try {
                const fd = new FormData();
                fd.append('tenant_id', window.$tenantName);
                fd.append('folder_path', fullPath);
                await axios.post('/memento/knowledge/folders', fd, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                if (!this.emptyFolders.includes(fullPath)) this.emptyFolders.push(fullPath);
                this.currentFolder = fullPath;
                this.newFolderDialog = false;
                this.notify('폴더가 생성되었습니다');
            } catch (e) {
                this.notify('폴더 생성 실패', 'error', e?.response?.data?.detail || e?.message);
            }
        },
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
                fd.append('is_admin', this.isAdmin);
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
                    params: { tenant_id: window.$tenantName, folder_path: node.path, is_admin: this.isAdmin }
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
                                requester_uid: this.myUid,
                                is_admin: this.isAdmin
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
            } finally {
                this.bulkDeleting = false;
                this.bulkDeleteDialog = false;
                this.bulkDeleteTargets = [];
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
                        requester_uid: this.myUid,
                        is_admin: this.isAdmin
                    }
                });
                this.files = this.files.filter((f) => this.rowKey(f) !== key);
                this.notify(item.source_type === 'drive' ? '인덱스에서 제거되었습니다' : '파일이 삭제되었습니다');
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

/* upload 탭 좌우 분할 */
.kft-upload-layout {
    display: flex;
    gap: 16px;
    align-items: flex-start;
}

.kft-folder-sidebar {
    flex: 0 0 220px;
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
</style>
