<template>
    <div class="kbu">
        <div
            class="kbu__drop"
            :class="{ 'is-over': dragOver && canUpload, 'is-busy': uploading, 'is-disabled': !canUpload }"
            @dragover.prevent="dragOver = canUpload"
            @dragleave.prevent="dragOver = false"
            @drop.prevent="onDrop"
            @click="uploading ? null : $refs[atRoot ? 'folderInput' : 'fileInput'].click()"
        >
            <v-icon size="22" color="primary">mdi-cloud-upload-outline</v-icon>
            <div class="kbu__text">
                <template v-if="atRoot">
                    <strong>폴더를 통째로 올려 시작하기</strong>
                    <span class="kbu__hint">폴더를 끌어다 놓으면 그 구조 그대로 지도가 만들어집니다 · 낱개 파일은 폴더를 먼저 고르세요</span>
                </template>
                <template v-else>
                    <strong>이 폴더에 문서 추가</strong>
                    <span class="kbu__hint">파일도 폴더도 그대로 끌어다 놓으세요 · 허용 {{ acceptLabel }} · 올리면 페이지를 저장하고 카드를 만듭니다</span>
                </template>
            </div>
            <v-btn
                size="small"
                variant="text"
                color="primary"
                prepend-icon="mdi-folder-upload-outline"
                :disabled="uploading"
                @click.stop="$refs.folderInput.click()"
            >
                폴더째 올리기
            </v-btn>
        </div>
        <!-- 드롭존 *밖*에 둔다 — 안에 두면 folderInput.click() 이 드롭존으로 버블링돼
             드롭존 핸들러가 fileInput 을 열고, 파일 선택창이 폴더 선택창을 덮어쓴다. -->
        <input ref="fileInput" type="file" multiple :accept="accept" class="d-none" @change="onFileInput" />
        <input ref="folderInput" type="file" webkitdirectory directory multiple class="d-none" @change="onFolderInput" />

        <div v-if="uploading || stats.total > 0 || skipped > 0" class="kbu__progress">
            <div v-if="skipped > 0" class="kbu__line text-warning">
                <v-icon size="14" color="warning">mdi-information-outline</v-icon>
                지원하지 않는 형식 {{ skipped }}개 제외
            </div>
            <div v-if="uploading && stats.total === 0" class="kbu__line text-medium-emphasis">파일 확인 중…</div>
            <template v-if="stats.total > 0">
                <div class="kbu__line">
                    <span class="font-weight-medium">{{ stats.done + stats.failed }} / {{ stats.total }} 접수</span>
                    <span v-if="stats.failed" class="text-error ml-2">실패 {{ stats.failed }}</span>
                    <v-spacer />
                    <span class="text-medium-emphasis">{{ pct }}%</span>
                </div>
                <v-progress-linear :model-value="pct" color="primary" height="5" rounded />
            </template>
            <div v-for="u in active" :key="u.id" class="kbu__line text-medium-emphasis">
                <v-progress-circular indeterminate size="12" width="2" color="primary" />
                <span class="kbu__name">{{ u.name }}</span>
                <span v-if="u.folder" class="kbu__hint">→ {{ u.folder }}</span>
            </div>
            <div v-if="failed.length" class="kbu__failed">
                <button type="button" class="kbu__toggle" @click="showFailed = !showFailed">
                    <v-icon size="14" color="error">mdi-alert-circle</v-icon>
                    실패 {{ failed.length }}건
                    <v-icon size="14">{{ showFailed ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
                </button>
                <div v-if="showFailed" class="kbu__failed-list">
                    <div v-for="u in failed.slice(0, 50)" :key="u.id" class="kbu__line">
                        <span class="kbu__name">{{ u.name }}</span>
                        <span class="text-error kbu__hint">{{ u.error }}</span>
                    </div>
                </div>
            </div>
        </div>

        <v-dialog v-model="dup.show" max-width="440" persistent>
            <v-card>
                <v-card-title class="text-subtitle-1">이미 올라간 파일이 있습니다</v-card-title>
                <v-card-text class="text-body-2">
                    같은 내용의 파일 <strong>{{ dup.dupCount }}</strong>개가 이미 지식베이스에 있습니다.
                    새 파일 <strong>{{ dup.newCount }}</strong>개만 올릴까요?
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="resolveDup('cancel')">취소</v-btn>
                    <v-btn variant="text" @click="resolveDup('overwrite')">모두 올리기</v-btn>
                    <v-btn color="primary" variant="flat" @click="resolveDup('skip')">새 파일만</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
import { ALLOWED_EXTENSIONS, ACCEPT_ATTR, ACCEPT_LABEL } from './kbConstants';
import { checkHash, sha256, uploadFile, errorText } from './kbApi';
import { extOf } from './kbFormat';

const SKIP_NAMES = new Set(['.gitkeep', '.ds_store', 'thumbs.db', 'desktop.ini']);
const CONCURRENCY = 8;

// 드롭된 디렉터리를 재귀 순회해 File[] 로. 각 File 에 relPath 를 달아 폴더 구조를 보존한다.
async function readEntry(entry, prefix) {
    if (entry.isFile) {
        const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
        file.relPath = prefix ? `${prefix}/${file.name}` : file.name;
        return [file];
    }
    if (!entry.isDirectory) return [];
    const reader = entry.createReader();
    const dir = prefix ? `${prefix}/${entry.name}` : entry.name;
    let out = [];
    // readEntries 는 한 번에 일부만 준다 — 빈 배열이 올 때까지 반복해야 전부 읽힌다.
    for (;;) {
        const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
        if (!batch.length) break;
        for (const child of batch) out = out.concat(await readEntry(child, dir));
    }
    return out;
}

export default {
    name: 'KbUploadZone',
    props: {
        folderPath: { type: String, default: '' }
    },
    emits: ['uploaded', 'notify'],
    data() {
        return {
            dragOver: false,
            uploading: false,
            stats: { total: 0, done: 0, failed: 0 },
            active: [],
            failed: [],
            skipped: 0,
            showFailed: false,
            dup: { show: false, dupCount: 0, newCount: 0, resolve: null }
        };
    },
    computed: {
        atRoot() {
            return !this.folderPath;
        },
        // 루트에서도 *폴더째* 는 받는다 — 떨군 폴더 이름이 곧 최상위 폴더가 된다.
        // 낱개 파일만 폴더가 필요하다(폴더 없는 문서는 폴더 카드가 없어 지도에 안 잡힌다).
        canUpload() {
            return !this.uploading;
        },
        accept() {
            return ACCEPT_ATTR;
        },
        acceptLabel() {
            return ACCEPT_LABEL;
        },
        pct() {
            const t = this.stats.total || 0;
            return t ? Math.round(((this.stats.done + this.stats.failed) / t) * 100) : 0;
        }
    },
    methods: {
        onFileInput(e) {
            const files = Array.from(e.target.files || []);
            e.target.value = '';
            this.upload(files);
        },
        async onDrop(e) {
            this.dragOver = false;
            if (!this.canUpload) return;
            // dataTransfer.files 는 드롭된 폴더를 확장자 없는 항목 하나로 준다 → 전부 필터에 걸린다.
            // 디렉터리는 entry API 로 훑어야 하위 파일과 경로가 나온다.
            const entries = Array.from(e.dataTransfer?.items || [])
                .map((it) => (it.webkitGetAsEntry ? it.webkitGetAsEntry() : null))
                .filter(Boolean);
            if (entries.some((en) => en.isDirectory)) {
                this.uploading = true;
                let files = [];
                try {
                    for (const en of entries) files = files.concat(await readEntry(en, ''));
                } catch (err) {
                    this.uploading = false;
                    this.$emit('notify', { text: errorText(err, '폴더를 읽지 못했습니다'), color: 'error' });
                    return;
                }
                this.uploading = false;
                this.uploadKeepingTree(files);
                return;
            }
            this.upload(Array.from(e.dataTransfer?.files || []));
        },
        onFolderInput(e) {
            const files = Array.from(e.target.files || []);
            e.target.value = '';
            this.uploadKeepingTree(files);
        },
        // 하위 폴더 구조를 그대로 살려 올린다 (webkitRelativePath 또는 entry 순회가 넣어준 relPath).
        uploadKeepingTree(files) {
            const usable = files.filter((f) => f && f.name && !SKIP_NAMES.has(f.name.toLowerCase()) && (f.size ?? 1) > 0);
            const base = this.folderPath;
            this.upload(usable, (file) => {
                const rel = (file.relPath || file.webkitRelativePath || file.name).replace(/\\/g, '/');
                const dir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
                return [base, dir].filter(Boolean).join('/').replace(/^\/+|\/+$/g, '');
            });
        },
        askDuplicate(dupCount, newCount) {
            return new Promise((resolve) => {
                this.dup = { show: true, dupCount, newCount, resolve };
            });
        },
        resolveDup(choice) {
            const r = this.dup.resolve;
            this.dup = { show: false, dupCount: 0, newCount: 0, resolve: null };
            r && r(choice);
        },
        async upload(files, folderResolver = null) {
            if (!this.folderPath && !folderResolver) {
                this.$emit('notify', { text: '낱개 파일은 폴더를 먼저 고르세요. 폴더째라면 그대로 끌어다 놓으면 됩니다', color: 'warning' });
                return;
            }
            if (!files.length) return;
            this.skipped = 0;
            this.stats = { total: 0, done: 0, failed: 0 };
            this.active = [];
            this.failed = [];
            this.showFailed = false;
            this.uploading = true;

            const allowed = new Set(ALLOWED_EXTENSIONS);
            const bad = files.filter((f) => !allowed.has(extOf(f.name)));
            this.skipped = bad.length;
            files = files.filter((f) => allowed.has(extOf(f.name)));
            if (!files.length) {
                this.uploading = false;
                this.$emit('notify', { text: `지원하지 않는 형식 ${this.skipped}개를 제외했습니다 (허용: ${this.acceptLabel})`, color: 'warning' });
                return;
            }

            // 해시로 중복을 가르고, 다이얼로그는 배치당 한 번만.
            const fresh = [];
            const dups = [];
            let cursor = 0;
            const classify = async () => {
                while (cursor < files.length) {
                    const file = files[cursor++];
                    let hash = '';
                    let exists = false;
                    try {
                        hash = await sha256(file);
                        exists = await checkHash(hash);
                    } catch (e) {
                        exists = false;
                    }
                    (exists ? dups : fresh).push({ file, hash });
                }
            };
            await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, classify));

            let accepted = fresh;
            if (dups.length) {
                const choice = await this.askDuplicate(dups.length, fresh.length);
                if (choice === 'cancel') {
                    this.uploading = false;
                    return;
                }
                if (choice === 'overwrite') accepted = fresh.concat(dups);
            }
            if (!accepted.length) {
                this.uploading = false;
                this.$emit('notify', { text: '올릴 새 파일이 없습니다 (모두 중복)', color: 'warning' });
                return;
            }

            const folderOf = (f) => (folderResolver ? folderResolver(f) : this.folderPath);
            const usedFolders = new Set();
            this.stats = { total: accepted.length, done: 0, failed: 0 };

            // 동시성 풀 + AIMD 백오프 — 429/5xx/timeout 이면 한도를 반으로, 성공이 쌓이면 하나씩 회복.
            const queue = accepted.slice();
            const ctrl = { limit: CONCURRENCY, ok: 0, cooldownUntil: 0 };
            const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
            const worker = async () => {
                while (queue.length) {
                    while (this.active.length >= ctrl.limit || Date.now() < ctrl.cooldownUntil) await sleep(150);
                    if (!queue.length) break;
                    const { file, hash } = queue.shift();
                    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                    const folder = folderOf(file);
                    usedFolders.add(folder);
                    const name = (file.name || 'file').replace(/\\/g, '/').split('/').pop() || 'file';
                    this.active.push({ id, name, folder });
                    try {
                        await uploadFile(file, { folderPath: folder, fileHash: hash });
                        this.stats.done += 1;
                        ctrl.ok += 1;
                        if (ctrl.ok >= 3 && ctrl.limit < CONCURRENCY) {
                            ctrl.limit += 1;
                            ctrl.ok = 0;
                        }
                    } catch (e) {
                        this.stats.failed += 1;
                        if (this.failed.length < 200) this.failed.push({ id, name, error: errorText(e, '업로드 실패') });
                        const status = e?.response?.status;
                        if (!status || status === 429 || status >= 500) {
                            ctrl.limit = Math.max(1, Math.floor(ctrl.limit / 2));
                            ctrl.ok = 0;
                            ctrl.cooldownUntil = Date.now() + 2000;
                        }
                    } finally {
                        this.active = this.active.filter((a) => a.id !== id);
                    }
                }
            };
            await Promise.all(Array.from({ length: Math.min(CONCURRENCY, accepted.length) }, worker));
            this.uploading = false;
            this.$emit('uploaded', { folders: [...usedFolders], done: this.stats.done, failed: this.stats.failed });
        }
    }
};
</script>

<style scoped>
.kbu__drop {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border: 1px dashed var(--cds-border-strong);
    border-radius: var(--cds-radius, 8px);
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
}
.kbu__drop:hover,
.kbu__drop.is-over {
    background: rgba(var(--v-theme-primary), 0.04);
    border-color: rgb(var(--v-theme-primary));
}
.kbu__drop.is-disabled {
    cursor: not-allowed;
    opacity: 0.7;
}
.kbu__drop.is-busy {
    pointer-events: none;
    opacity: 0.8;
}
.kbu__text {
    flex: 1;
    display: flex;
    flex-direction: column;
    font-size: 13px;
    min-width: 0;
}
.kbu__hint {
    font-size: 11.5px;
    color: var(--cds-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.kbu__progress {
    margin-top: 8px;
    padding: 8px 12px;
    border: 1px solid var(--cds-border);
    border-radius: var(--cds-radius, 8px);
    background: var(--cds-bg-neutral);
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12px;
}
.kbu__line {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
}
.kbu__name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.kbu__toggle {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: none;
    border: 0;
    padding: 0;
    font: inherit;
    color: var(--cds-text-danger);
    cursor: pointer;
}
.kbu__failed-list {
    max-height: 160px;
    overflow: auto;
    margin-top: 4px;
}
</style>
