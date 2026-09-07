<template>
    <div class="mform">
        <div v-for="field in fields" :key="field.key" class="mform__row">
            <!-- 안내만 하는 항목 -->
            <p v-if="field.type === 'label'" class="m-note">{{ field.label }}</p>

            <!-- 휴대폰에서 입력할 수 없는 항목: 감추지 않고 그렇다고 말한다 -->
            <div v-else-if="!field.supported" class="m-note m-note--danger">
                <strong>{{ field.label || field.key }}</strong>
                <span>{{ unsupportedReason(field) }}</span>
            </div>

            <!-- 값만 보여 주는 항목 -->
            <div v-else-if="field.readonly" class="m-field">
                <label>{{ field.label }}</label>
                <p class="mform__readonly">{{ display(values[field.key]) || '—' }}</p>
            </div>

            <!--
                파일 첨부. 채팅 첨부와 같은 방식으로 고르고 올린다.
                웹으로 미루면 증빙이 필요한 업무를 앱에서 끝낼 수 없다.
            -->
            <div v-else-if="field.type === 'file'" class="m-field">
                <label>{{ field.label }}</label>
                <input
                    :ref="(el) => setFileInput(field.key, el)"
                    type="file"
                    :accept="FILE_ACCEPT"
                    hidden
                    @change="onPickFile(field.key, $event)"
                />
                <button type="button" class="m-btn" :disabled="uploading === field.key" @click="chooseFile(field.key)">
                    {{ uploading === field.key ? '올리는 중…' : '파일 고르기' }}
                </button>
                <p v-if="fileNameOf(values[field.key])" class="m-muted">{{ fileNameOf(values[field.key]) }}</p>
            </div>

            <!-- 담당자 고르기. 조직 구성원 목록에서 고른다. -->
            <div v-else-if="field.type === 'user-select'" class="m-field">
                <label :for="id(field)">{{ field.label }}</label>
                <select :id="id(field)" :value="values[field.key]" @change="set(field.key, valueOf($event))">
                    <option value="">선택하세요</option>
                    <option v-for="u in people" :key="u.id" :value="u.id">{{ u.name }}</option>
                </select>
            </div>

            <!--
                같은 묶음을 여러 번. 줄을 더하고 지울 수 있어야 뜻이 산다.
            -->
            <div v-else-if="field.repeating" class="m-field">
                <label>{{ field.label }}</label>
                <div v-for="(row, i) in rowsOf(field)" :key="i" class="mform__rowset">
                    <div class="mform__rowhead">
                        <span class="m-muted">{{ i + 1 }}번째</span>
                        <button type="button" class="mform__del" @click="removeRow(field, i)">삭제</button>
                    </div>
                    <MobileForm
                        :fields="field.fields"
                        :values="row"
                        @update:values="(next) => updateRow(field, i, next)"
                        @voice-error="(m) => emit('voice-error', m)"
                    />
                </div>
                <button type="button" class="m-btn" @click="addRow(field)">추가</button>
            </div>

            <!-- 예/아니오 -->
            <label v-else-if="field.type === 'boolean'" class="mform__switch">
                <input type="checkbox" :checked="!!values[field.key]" @change="set(field.key, checkedOf($event))" />
                <span>{{ field.label }}</span>
            </label>

            <!-- 여럿 중 하나 -->
            <div v-else-if="field.type === 'select'" class="m-field">
                <label :for="id(field)">{{ field.label }}</label>
                <select :id="id(field)" :value="values[field.key]" @change="set(field.key, valueOf($event))">
                    <option value="">선택하세요</option>
                    <option v-for="opt in field.items" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
            </div>

            <fieldset v-else-if="field.type === 'radio'" class="mform__group">
                <legend>{{ field.label }}</legend>
                <label v-for="opt in field.items" :key="opt.value" class="mform__choice">
                    <input
                        type="radio"
                        :name="field.key"
                        :value="opt.value"
                        :checked="values[field.key] === opt.value"
                        @change="set(field.key, opt.value)"
                    />
                    <span>{{ opt.label }}</span>
                </label>
            </fieldset>

            <!-- 여럿 중 여러 개 -->
            <fieldset v-else-if="field.type === 'checkbox'" class="mform__group">
                <legend>{{ field.label }}</legend>
                <label v-for="opt in field.items" :key="opt.value" class="mform__choice">
                    <input
                        type="checkbox"
                        :value="opt.value"
                        :checked="selected(field.key).includes(opt.value)"
                        @change="toggle(field.key, opt.value, checkedOf($event))"
                    />
                    <span>{{ opt.label }}</span>
                </label>
            </fieldset>

            <!-- 긴 글. 작은 자판으로 길게 적기 어려우니 말로도 넣을 수 있게 한다. -->
            <div v-else-if="field.type === 'textarea'" class="m-field">
                <label :for="id(field)">{{ field.label }}</label>
                <div class="mform__voiced">
                    <textarea
                        :id="id(field)"
                        rows="4"
                        :value="values[field.key]"
                        @input="set(field.key, valueOf($event))"
                    ></textarea>
                    <VoiceButton
                        :model-value="values[field.key]"
                        @update:model-value="set(field.key, $event)"
                        @error="(m) => emit('voice-error', m)"
                    />
                </div>
            </div>

            <!-- 한 줄 -->
            <div v-else class="m-field">
                <label :for="id(field)">{{ field.label }}</label>
                <input
                    :id="id(field)"
                    :type="inputType(field.type)"
                    :inputmode="field.type === 'number' ? 'decimal' : undefined"
                    :value="values[field.key]"
                    @input="set(field.key, valueOf($event))"
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
/**
 * 폼 그리기.
 *
 * 포털의 FormWorkItem.vue(1,444줄)를 쓰지 않는다. 그쪽은 한 줄을 12칸으로 나누는
 * 넓은 화면 배치를 전제로 하고, CKEditor 같은 무거운 편집기를 함께 끌어온다.
 * 여기서는 한 화면에 한 항목씩 세로로만 쌓는다.
 *
 * 그릴 수 없는 항목을 만나면 감추지 않고 그렇다고 말한다. 감추면 사용자는 다
 * 채웠다고 믿고 제출하는데, 빈 값이 넘어가 프로세스가 다음 단계에서 멈춘다.
 */

const props = defineProps<{
    fields: Array<any>;
    values: Record<string, any>;
}>();

const emit = defineEmits<{
    (e: 'update:values', next: Record<string, any>): void;
    (e: 'voice-error', message: string): void;
}>();

import { onMounted, ref } from 'vue';

import { FILE_ACCEPT, isUsable, toFileInfo } from '../lib/attachments.js';
import { backend } from '../lib/backend.js';
import VoiceButton from './VoiceButton.vue';

/** 담당자 후보. 조직 구성원에서 받는다. */
const people = ref<any[]>([]);
const uploading = ref('');
const fileInputs: Record<string, any> = {};

onMounted(async () => {
    // 담당자 칸이 없으면 부를 이유가 없다.
    if (!(props.fields || []).some((f: any) => f.type === 'user-select')) return;
    try {
        const users = (await backend().getUserList({ size: 200 })) || [];
        people.value = users
            .filter((u: any) => u?.id && u?.is_agent !== true)
            .map((u: any) => ({ id: String(u.id), name: String(u.username || u.email || u.id) }));
    } catch (e) {
        console.warn('[form] 담당자 후보 조회 실패', e);
    }
});

function setFileInput(key: string, el: any) {
    if (el) fileInputs[key] = el;
}

function chooseFile(key: string) {
    const el = fileInputs[key];
    if (!el) return;
    // 같은 파일을 다시 고를 수 있어야 한다.
    el.value = '';
    el.click();
}

/** 고른 파일을 올리고, 값으로는 주소를 남긴다. 주소가 있어야 뒤에서 열 수 있다. */
async function onPickFile(key: string, event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    uploading.value = key;
    try {
        const result = await backend().uploadFileToStorage(file, {});
        const info = toFileInfo(file, result);
        if (!isUsable(info)) throw new Error('주소를 받지 못했습니다.');
        set(key, info);
    } catch (e) {
        emit('voice-error', `${file.name} 을(를) 올리지 못했습니다.`);
        console.error('[form] 파일 업로드 실패', e);
    } finally {
        uploading.value = '';
    }
}

function fileNameOf(value: any) {
    return value?.fileName || value?.name || '';
}

/** 반복 입력의 줄들. 값이 없으면 빈 목록에서 시작한다. */
function rowsOf(field: any) {
    const v = props.values[field.key];
    return Array.isArray(v) ? v : [];
}

function addRow(field: any) {
    set(field.key, [...rowsOf(field), {}]);
}

function removeRow(field: any, index: number) {
    set(
        field.key,
        rowsOf(field).filter((_r: any, i: number) => i !== index)
    );
}

function updateRow(field: any, index: number, next: any) {
    const rows = [...rowsOf(field)];
    rows[index] = next;
    set(field.key, rows);
}

/**
 * 웹에서 봐야 하는 항목들.
 *
 * 값을 적는 칸은 모두 여기서 받는다. 남은 것은 넓은 화면에서 보고 편집하는
 * 산출물뿐이다.
 */
const REASONS: Record<string, string> = {
    report: '보고서 본문은 웹에서 확인해 주세요.',
    slide: '슬라이드는 웹에서 확인해 주세요.',
    'bpmn-uengine': '프로세스 도면 편집은 웹에서 해 주세요.'
};

function unsupportedReason(field: any) {
    if (field.repeating) return '이 반복 항목에는 앱에서 다룰 수 없는 칸이 섞여 있습니다.';
    return REASONS[field.type] || '이 항목은 웹에서 확인해 주세요.';
}

/** 브라우저 이벤트에서 값을 꺼낸다. 템플릿에서 바로 꺼내면 타입이 확정되지 않는다. */
function valueOf(event: Event) {
    return (event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
}

function checkedOf(event: Event) {
    return (event.target as HTMLInputElement).checked;
}

function id(field: any) {
    return `f-${field.key}`;
}

function inputType(type: string) {
    if (type === 'number') return 'number';
    if (type === 'date') return 'date';
    return 'text';
}

function display(value: any) {
    if (Array.isArray(value)) return value.join(', ');
    if (value === true) return '예';
    if (value === false) return '아니오';
    return value === null || value === undefined ? '' : String(value);
}

function selected(key: string): string[] {
    const v = props.values[key];
    return Array.isArray(v) ? v : [];
}

function set(key: string, value: any) {
    emit('update:values', { ...props.values, [key]: value });
}

function toggle(key: string, value: string, on: boolean) {
    const next = selected(key).filter((v) => v !== value);
    if (on) next.push(value);
    set(key, next);
}
</script>

<style scoped>
/* 반복 입력의 한 줄. 경계가 있어야 몇 번째인지 눈에 들어온다. */
.mform__rowset {
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    padding: 10px;
    margin-bottom: 8px;
}

.mform__rowhead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
    font-size: 0.8rem;
}

.mform__del {
    color: var(--danger);
    font-size: 0.8rem;
    font-weight: 600;
    min-height: 30px;
    padding: 0 8px;
}

.mform {
    display: flex;
    flex-direction: column;
    gap: 18px;
}

/*
 * 마이크는 입력칸 **안쪽** 오른쪽 아래에 둔다.
 *
 * 밖에 두면 칸과 따로 떠 있는 것처럼 보여 무엇에 대한 버튼인지 알기 어렵고,
 * 좁은 화면에서는 칸을 그만큼 좁힌다. 글이 버튼 아래로 들어가지 않도록
 * 오른쪽 여백을 준다.
 */
.mform__voiced {
    position: relative;
}

.mform__voiced textarea {
    width: 100%;
    padding-right: 48px;
}

.mform__voiced :deep(.voice) {
    position: absolute;
    right: 6px;
    bottom: 6px;
}

.mform__readonly {
    margin: 0;
    padding: 10px 12px;
    background: var(--sunk);
    border-radius: var(--radius);
    min-height: var(--tap);
    display: flex;
    align-items: center;
}

.mform__group {
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    padding: 10px 12px 12px;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.mform__group legend {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--ink-soft);
    padding: 0 4px;
}

/* 선택지는 글자만이 아니라 줄 전체가 눌리게 한다 — 손가락으로 작은 동그라미를
   정확히 맞추기는 어렵다. */
.mform__choice,
.mform__switch {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: var(--tap);
    cursor: pointer;
}

.mform__choice input,
.mform__switch input {
    width: 20px;
    height: 20px;
    flex: none;
    accent-color: var(--brand);
}

.mform__switch {
    background: var(--surface);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    padding: 0 12px;
}

.m-note--danger {
    display: flex;
    flex-direction: column;
    gap: 2px;
}
</style>
