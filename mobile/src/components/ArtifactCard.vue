<template>
    <div class="art">
        <div class="art__head">
            <Icon :name="icon" :size="18" />
            <span class="art__label">{{ artifact.label }}</span>
        </div>
        <strong class="art__title">{{ artifact.title }}</strong>

        <!-- 슬라이드는 글로 왔으니 그대로 보여 준다. -->
        <div v-if="open && artifact.kind === 'slide'" class="art__body md" v-html="rendered"></div>

        <!-- 그림·PDF 는 앱 안에서 바로 볼 수 있다. -->
        <img v-else-if="open && isImage" class="art__image" :src="artifact.url" :alt="artifact.title" />
        <iframe v-else-if="open && isPdf" class="art__frame" :src="artifact.url" :title="artifact.title"></iframe>

        <div class="art__actions">
            <button v-if="previewable" type="button" class="m-btn" @click="open = !open">
                {{ open ? '접기' : '미리보기' }}
            </button>
            <button v-if="artifact.url" type="button" class="m-btn" @click="$emit('save', artifact)">
                내려받기
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
/**
 * 만들어진 산출물 한 개.
 *
 * 내려받기만 있으면 무엇이 만들어졌는지 보려고 매번 앱 밖으로 나가야 한다.
 * 앱 안에서 볼 수 있는 것(슬라이드 글·그림·PDF)은 여기서 바로 펼친다.
 * 한글·워드처럼 앱이 그릴 수 없는 것은 내려받기만 준다 — 열리지 않는 버튼을
 * 두면 눌러 보고 나서야 안 된다는 걸 알게 된다.
 */

import { computed, ref } from 'vue';

import { canPreview } from '@/shared/artifacts/index.js';
import { render as renderMarkdown } from '../lib/markdown.js';
import Icon from './Icon.vue';

const props = defineProps<{ artifact: any }>();
defineEmits<{ (e: 'save', artifact: any): void }>();

const open = ref(false);

const ICONS: Record<string, string> = { slide: 'image', hwpx: 'paperclip', docx: 'paperclip', file: 'paperclip' };
const icon = computed(() => ICONS[props.artifact?.kind] || 'paperclip');

const previewable = computed(() => canPreview(props.artifact));
const isImage = computed(() => /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(props.artifact?.url || ''));
const isPdf = computed(() => /\.pdf(\?|$)/i.test(props.artifact?.url || ''));
const rendered = computed(() => renderMarkdown(props.artifact?.markdown || ''));
</script>

<style scoped>
.art {
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    background: var(--surface);
}

.art__head {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--ink-faint);
}

.art__label {
    font-size: 0.74rem;
    font-weight: 700;
    letter-spacing: 0.02em;
}

.art__title {
    font-size: 0.95rem;
    line-height: 1.4;
    word-break: break-all;
}

.art__body {
    max-height: 320px;
    overflow-y: auto;
    border-top: 1px solid var(--rule);
    padding-top: 8px;
}

.art__image {
    max-width: 100%;
    border-radius: 8px;
}

/* 좁은 화면에서 문서를 읽을 만한 최소 높이. */
.art__frame {
    width: 100%;
    height: 420px;
    border: 1px solid var(--rule);
    border-radius: 8px;
}

.art__actions {
    display: flex;
    gap: 8px;
    margin-top: 2px;
}

.art__actions .m-btn {
    flex: 1;
    min-height: 36px;
}
</style>
