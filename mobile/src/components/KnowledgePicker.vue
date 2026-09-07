<template>
    <div class="sheet" @click.self="$emit('close')">
        <div class="sheet__panel" role="dialog" aria-label="지식 베이스">
            <h2 class="sheet__title">지식 베이스</h2>

            <div class="m-field">
                <input v-model="query" type="search" placeholder="파일 또는 폴더 이름" aria-label="검색" />
            </div>

            <p v-if="loading" class="m-muted">불러오는 중…</p>
            <p v-else-if="error" class="m-note m-note--danger">{{ error }}</p>

            <div v-else class="sheet__list">
                <label v-for="doc in shown" :key="doc.key" class="pick">
                    <input type="checkbox" :checked="isPicked(picked, doc)" @change="toggle(doc)" />
                    <span class="pick__body">
                        <strong>{{ doc.name }}</strong>
                        <span v-if="doc.folderPath" class="m-muted">{{ doc.folderPath }}</span>
                    </span>
                </label>
                <p v-if="!shown.length" class="m-muted">해당하는 문서가 없습니다.</p>
            </div>

            <div class="sheet__actions">
                <button type="button" class="m-btn" @click="$emit('close')">취소</button>
                <button type="button" class="m-btn m-btn--primary" @click="$emit('confirm', picked)">
                    {{ picked.length ? `${picked.length}개 선택` : '선택 없이 닫기' }}
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
/**
 * 지식 베이스 고르기.
 *
 * 읽어 오는 곳과 담아 보내는 모양은 포털과 같다(@/lib/knowledge). 화면만 폰에
 * 맞춰 다시 그렸다 — 포털 것은 넓은 화면 대화상자라 손가락으로 쓰기 어렵다.
 */

import { computed, onMounted, ref } from 'vue';
import axios from '@/utils/axios';

import { filterDocs, isPicked, toDocs, togglePick } from '../lib/knowledge.js';

const props = defineProps<{ selected?: any[] }>();
defineEmits<{ (e: 'close'): void; (e: 'confirm', docs: any[]): void }>();

const docs = ref<any[]>([]);
const picked = ref<any[]>([...(props.selected || [])]);
const query = ref('');
const loading = ref(true);
const error = ref('');

const shown = computed(() => filterDocs(docs.value, query.value));

function toggle(doc: any) {
    picked.value = togglePick(picked.value, doc);
}

onMounted(async () => {
    try {
        const { data } = await axios.get('/memento/documents/list', {
            params: { tenant_id: (window as any).$tenantName }
        });
        docs.value = toDocs(data);
    } catch (e: any) {
        error.value = '문서 목록을 불러오지 못했습니다.';
        console.error('[knowledge] 조회 실패', e);
    } finally {
        loading.value = false;
    }
});
</script>

<style scoped>
.sheet {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: flex-end;
    z-index: 60;
}

.sheet__panel {
    width: 100%;
    background: var(--surface);
    border-radius: 16px 16px 0 0;
    padding: 16px 16px calc(16px + var(--safe-bottom));
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: 85vh;
}

.sheet__title {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
}

.sheet__list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
}

/* 줄 전체가 눌리게 한다 — 작은 네모를 손가락으로 맞추기는 어렵다. */
.pick {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    min-height: var(--tap);
    padding: 8px 2px;
    border-bottom: 1px solid var(--rule);
}

.pick input {
    width: 20px;
    height: 20px;
    flex: none;
    margin-top: 2px;
    accent-color: var(--brand);
}

.pick__body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}

.pick__body strong {
    word-break: break-all;
}

.sheet__actions {
    display: flex;
    gap: 8px;
}

.sheet__actions .m-btn {
    flex: 1;
}
</style>
