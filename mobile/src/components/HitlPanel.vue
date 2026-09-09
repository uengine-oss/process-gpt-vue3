<template>
    <section class="hitl">
        <h2 class="hitl__q">{{ panel.question }}</h2>

        <!-- 승인/반려: 그대로 진행할지 묻는다 -->
        <template v-if="panel.kind === 'approve_reject_with_edit'">
            <pre v-if="panel.context" class="hitl__body">{{ panel.context }}</pre>

            <div class="m-field">
                <label for="hitl-note">고칠 점이 있으면 적어 주세요</label>
                <textarea id="hitl-note" v-model="note" rows="3"></textarea>
            </div>

            <div class="hitl__actions">
                <button class="m-btn m-btn--primary" type="button" :disabled="busy" @click="approve">승인</button>
                <button class="m-btn m-btn--danger" type="button" :disabled="busy || !note.trim()" @click="reject">
                    반려
                </button>
            </div>
            <p v-if="!note.trim()" class="m-muted">반려하려면 이유를 적어 주세요.</p>
        </template>

        <!-- 여럿 중 고르기 -->
        <template v-else-if="panel.kind === 'select_items'">
            <label v-for="item in panel.items" :key="item.id" class="hitl__choice">
                <input
                    :type="panel.allowMultiple ? 'checkbox' : 'radio'"
                    name="hitl-item"
                    :checked="picked.includes(item.id)"
                    @change="pick(item.id, checkedOf($event))"
                />
                <span>
                    <strong>{{ item.label }}</strong>
                    <span v-if="item.description" class="m-muted">{{ item.description }}</span>
                </span>
            </label>

            <!--
                직접 적는 칸.
                "역할/담당자를 조정해줘" 처럼 무엇을 어떻게 바꿀지 적어야 뜻이 통하는
                요청은 고르는 것으로 받을 수 없다. 여기에 적게 한다.
            -->
            <label v-if="panel.allowOther" class="hitl__choice">
                <input
                    type="radio"
                    name="hitl-item"
                    :checked="otherPicked"
                    @change="chooseOther"
                />
                <span>
                    <strong>기타 의견</strong>
                    <span class="m-muted">고칠 점을 직접 적어 주세요</span>
                </span>
            </label>
            <textarea
                v-if="panel.allowOther && otherPicked"
                v-model="other"
                class="hitl__other"
                rows="3"
                placeholder="예: 인사팀 승인 단계를 빼줘"
            ></textarea>

            <button class="m-btn m-btn--primary" type="button" :disabled="busy || !canSubmit" @click="submitPicked">
                제출
            </button>
            <p v-if="!canSubmit" class="m-muted">하나를 고르거나 의견을 적어 주세요.</p>
        </template>

        <!-- 여러 프로세스를 한 번에 묻는 경우는 화면이 커서 웹에서 하는 편이 낫다 -->
        <p v-else class="m-note m-note--danger">
            이 질문은 항목이 많아 웹에서 답해 주세요.
        </p>
    </section>
</template>

<script setup lang="ts">
/**
 * 사람에게 묻는 자리.
 *
 * 무엇을 물을지(승인이냐 선택이냐)는 이 파일이 정하지 않는다. @/shared/hitl 이
 * 정하고 여기서는 그리기만 한다. 여기서 다시 판단하면 포털과 갈라지고, 갈라지면
 * 승인해야 할 것이 체크박스로 뜬다.
 */

import { computed, ref } from 'vue';

const props = defineProps<{ panel: any; busy?: boolean }>();
const emit = defineEmits<{ (e: 'answer', text: string): void }>();

const note = ref('');
const other = ref('');
const otherPicked = ref(false);
const picked = ref<string[]>([]);

function checkedOf(event: Event) {
    return (event.target as HTMLInputElement).checked;
}

function pick(id: string, on: boolean) {
    // 항목을 고르면 '기타 의견' 은 풀린다. 둘 다 켜져 있으면 무엇을 보낼지 모른다.
    otherPicked.value = false;

    if (!props.panel.allowMultiple) {
        picked.value = on ? [id] : [];
        return;
    }
    const next = picked.value.filter((v) => v !== id);
    if (on) next.push(id);
    picked.value = next;
}

function approve() {
    // 의견을 함께 적었으면 같이 보낸다 — 승인하면서 단서를 다는 경우가 흔하다.
    emit('answer', note.value.trim() ? `승인합니다. ${note.value.trim()}` : '승인합니다.');
}

function reject() {
    emit('answer', `반려합니다. ${note.value.trim()}`);
}

/**
 * 답이 없으면 보내지 않는다.
 *
 * 예전에는 "아무것도 고르지 않고 진행" 이 있었는데, 그것을 받은 에이전트는
 * 무엇을 하라는 것인지 알 수 없어 같은 질문을 되풀이했다. 고르거나 적어야 한다.
 */
const canSubmit = computed(() => {
    if (otherPicked.value) return Boolean(other.value.trim());
    return picked.value.length > 0;
});

function chooseOther() {
    otherPicked.value = true;
    picked.value = [];
}

function submitPicked() {
    if (!canSubmit.value) return;

    if (otherPicked.value) {
        emit('answer', other.value.trim());
        return;
    }

    const labels = props.panel.items
        .filter((i: any) => picked.value.includes(i.id))
        .map((i: any) => i.label);
    emit('answer', labels.join(', '));
}
</script>

<style scoped>
.hitl {
    background: var(--surface);
    border: 1px solid var(--brand);
    border-radius: var(--radius);
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-self: stretch;
}

.hitl__q {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    line-height: 1.4;
}

.hitl__body {
    margin: 0;
    background: var(--sunk);
    border-radius: var(--radius);
    padding: 12px;
    font-family: inherit;
    font-size: 0.92rem;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 40vh;
    overflow-y: auto;
}

.hitl__actions {
    display: flex;
    gap: 8px;
}

.hitl__actions .m-btn {
    flex: 1;
}

/* 줄 전체가 눌리게 한다 — 작은 동그라미를 손가락으로 맞추기는 어렵다. */
.hitl__other {
    width: 100%;
    margin-top: -4px;
}

.hitl__choice {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    min-height: var(--tap);
    padding: 6px 0;
    cursor: pointer;
}

.hitl__choice input {
    width: 20px;
    height: 20px;
    flex: none;
    margin-top: 2px;
    accent-color: var(--brand);
}

.hitl__choice span {
    display: flex;
    flex-direction: column;
    gap: 2px;
}
</style>
