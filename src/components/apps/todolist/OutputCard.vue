<template>
    <!--
        단계 하나의 산출물 카드. 누르면 원본(폼 그대로)을 크게 연다.

        산출물 칸(InstanceOutput)과 인스턴스 대화(ChatThread)가 같은 카드를 쓴다.
        클로드가 만든 파일을 대화 안에도, 문서 단추 뒤의 목록에도 같은 카드로 보여 주듯
        — 어디서 보든 같은 모양이어야 '아까 그것' 인지 알아본다. 전에는 대화 쪽이
        '아래 내용으로 제출했습니다 · 키: 값' 글줄이라 산출물과 같은 것인지 알 수 없었다.
    -->
    <div class="pg-out-card-wrap">
        <!--
            넓은 칸(인스턴스 화면의 「산출물」 탭). 전에는 넓은 카드 귀퉁이에 기울어진 작은 썸네일만 있어
            글자를 읽을 수 없었다(2026-11-11 검토 「폭을 사실 낭비하고 있거든요 … 여기 너무 안 보입니다」).
            항목 이름과 본문 첫 줄들을 보통 글자 크기로 펴고, 전체는 「원본 보기」 로 연다.
            값이 하나도 없으면 빈 상자 대신 「아직 산출물이 없습니다」 라고 말한다.
        -->
        <v-card v-if="wide" elevation="0" class="pg-out-wide" data-testid="output-card" :data-empty="isEmpty ? 'true' : 'false'">
            <div class="pg-out-wide__head">
                <div class="pg-out-wide__name">{{ item.name }}</div>
                <v-spacer></v-spacer>
                <v-btn
                    v-if="item.outputURL"
                    icon
                    variant="text"
                    size="small"
                    :href="item.outputURL"
                    target="_blank"
                    rel="noopener"
                    :aria-label="$t('OutputCard.openLink')"
                    :title="item.outputURL"
                >
                    <v-icon size="18">mdi-link-variant</v-icon>
                </v-btn>
                <v-btn v-if="!isEmpty" variant="tonal" color="primary" size="small" class="pg-out-wide__open" @click="openDetail">
                    <v-icon size="16" class="mr-1">mdi-open-in-new</v-icon>
                    {{ $t('OutputCard.openOriginal') }}
                </v-btn>
            </div>
            <div v-if="wideLines.length" class="pg-out-wide__body">
                <div v-for="(l, i) in wideLines" :key="i" class="pg-out-wide__field">
                    <div class="pg-out-wide__k">{{ l.k }}</div>
                    <a v-if="l.href" class="pg-out-wide__v pg-out-card__v--file" :href="l.href" :download="l.v" @click.stop>
                        <v-icon size="16">mdi-file-download-outline</v-icon>
                        <span>{{ l.v }}</span>
                    </a>
                    <!-- 마크다운 글(에이전트 결과 등)은 목록 · 굵게를 살려 그린다 — 걸러서(DOMPurify) 넣는다. -->
                    <div
                        v-else-if="l.md"
                        class="pg-out-wide__v pg-out-wide__v--md"
                        :class="{ 'pg-out-wide__v--fade': l.long }"
                        v-html="l.md"
                    ></div>
                    <div v-else class="pg-out-wide__v">{{ excerpt(l.v) }}</div>
                </div>
                <div v-if="wideHiddenCount" class="pg-out-wide__more">{{ $t('OutputCard.moreFields', { n: wideHiddenCount }) }}</div>
            </div>
            <div v-else-if="htmlExcerpt" class="pg-out-wide__body">
                <div class="pg-out-wide__v">{{ htmlExcerpt }}</div>
            </div>
            <div v-else class="pg-out-wide__empty" data-testid="output-card-empty">
                <v-icon size="18">mdi-inbox-outline</v-icon>
                <span>{{ $t('OutputCard.empty') }}</span>
            </div>
        </v-card>

    <v-card v-else elevation="0" class="pa-3 pg-out-card" :class="{ 'pg-out-card--collapsed': !full }" data-testid="output-card" @click="openDetail">
        <div class="pg-out-card__name">{{ item.name }}</div>
        <div v-for="(l, i) in cardLines" :key="i" class="pg-out-card__line">
            <span class="pg-out-card__k">{{ l.k }}</span>
            <a v-if="l.href" class="pg-out-card__v pg-out-card__v--file" :href="l.href" :download="l.v" @click.stop>
                <v-icon size="14">mdi-file-download-outline</v-icon>
                <span>{{ l.v }}</span>
            </a>
            <span v-else class="pg-out-card__v" :class="{ 'pg-out-card__v--clamp': full }">{{ preview(l.v) }}</span>
        </div>
        <div v-if="hiddenCount" class="pg-out-card__hidden">외 {{ hiddenCount }}개 항목</div>
        <div v-if="!lines.length" class="pg-out-card__empty">내용 없음</div>
        <div class="pg-out-card__more">{{ full ? '원본 보기' : '자세히 보기' }}</div>
    </v-card>

    <v-dialog v-model="detailDialog" width="92vw" max-width="900px">
        <v-card class="pa-4">
            <v-card-title class="d-flex align-center pa-0 pb-3">
                <span class="text-subtitle-1 font-weight-bold">{{ item.name }}</span>
                <v-spacer></v-spacer>
                <v-btn icon variant="text" aria-label="닫기" @click="detailDialog = false"><v-icon>mdi-close</v-icon></v-btn>
            </v-card-title>
            <v-card-text class="pa-0">
                <DynamicForm v-if="item.type === 'form' && item.html" :formHTML="presentedHtml" v-model="formValues" :readonly="true" class="dynamic-form" />
                <div v-else-if="item.type === 'html'" v-html="item.html"></div>
                <div v-else>
                    <div v-for="(l, i) in lines" :key="i" class="pg-out-card__line">
                        <span class="pg-out-card__k">{{ l.k }}</span>
                        <a v-if="l.href" class="pg-out-card__v pg-out-card__v--file" :href="l.href" :download="l.v">
                            <v-icon size="14">mdi-file-download-outline</v-icon>
                            <span>{{ l.v }}</span>
                        </a>
                        <span v-else class="pg-out-card__v pg-out-card__v--wrap">{{ l.v }}</span>
                    </div>
                </div>
            </v-card-text>
        </v-card>
    </v-dialog>
    </div>
</template>

<script>
import DynamicForm from '@/components/designer/DynamicForm.vue';
import { fileNameOf, isWorkspacePath, workspaceFileUrl } from '@/utils/workspaceFile';
import { fieldLabelForKey, presentFormHtml } from '@/shared/formPresentation/index.js';
import { looksLikeMarkdown, renderMarkdown } from '@/shared/markdownText/index.js';

/** 카드에 보일 항목 수와 값 길이. 넘치는 것은 원본 보기에서 본다. */
const CARD_MAX_FIELDS = 4;
const CARD_MAX_CHARS = 160;
/** 넓은 칸에서는 더 보여 준다 — 값은 줄바꿈을 살려 네 줄까지(CSS), 글자 수는 넉넉히. */
const WIDE_MAX_FIELDS = 6;
const WIDE_MAX_CHARS = 600;
/** 마크다운 글은 이 줄 수까지만 그린다(카드에서는 높이로 한 번 더 자른다). */
const WIDE_MD_LINES = 10;

export default {
    name: 'OutputCard',
    components: { DynamicForm },
    props: {
        /** { name, type: 'form' | 'html' | 'value', html, output } */
        item: { type: Object, required: true },
        /**
         * 값을 줄바꿈해 전부 보여 준다. 끄면 한 줄씩 잘라 요약한다 —
         * 산출물이 여럿 쌓이는 칸에서 카드 하나가 너무 길어지지 않게.
         */
        full: { type: Boolean, default: true },
        /** 넓은 칸(인스턴스 「산출물」 탭)용 모양. 항목 이름 · 본문 첫 줄을 보통 크기로 펴 보인다. */
        wide: { type: Boolean, default: false },
        /** 항목 키 → 폼에 적힌 이름(fieldLabelsOf). 없으면 키를 그대로 쓴다. */
        labels: { type: Object, default: () => ({}) }
    },
    data: () => ({
        detailDialog: false,
        // 원본 폼은 읽기 전용이지만 v-model 로 값을 받는다. 카드가 가진 값을 건드리지 않도록 복사해 둔다.
        formValues: {}
    }),
    computed: {
        lines() {
            return this.summaryLines(this.item);
        },

        /**
         * 카드에 보일 항목. 카드는 무엇이 나왔는지 알아보는 자리이고 전체는 원본 보기에서 본다 —
         * 가이드 문서처럼 긴 값이 대화를 한 화면 넘게 밀어내지 않도록 항목 수와 길이를 자른다.
         */
        cardLines() {
            return this.lines.slice(0, CARD_MAX_FIELDS);
        },

        hiddenCount() {
            return Math.max(0, this.lines.length - CARD_MAX_FIELDS);
        },

        /** 넓은 칸의 항목 — 마크다운 글은 앞 몇 줄만 그려 둔다(전체는 원본 보기). */
        wideLines() {
            return this.lines.slice(0, WIDE_MAX_FIELDS).map((l) => {
                if (l.href || !looksLikeMarkdown(l.v)) return l;
                const src = String(l.v).replace(/\r\n?/g, '\n').split('\n');
                const head = src.slice(0, WIDE_MD_LINES).join('\n');
                return { ...l, md: renderMarkdown(head), long: src.length > 4 || head.length > 240 };
            });
        },

        /** 원본 보기의 폼 — 이름 칸이 빈 옛 폼(text-field-2)도 「텍스트 2」 처럼 보이게(저장된 HTML 은 그대로). */
        presentedHtml() {
            return presentFormHtml(this.item && this.item.html, { translate: this.translate });
        },

        wideHiddenCount() {
            return Math.max(0, this.lines.length - WIDE_MAX_FIELDS);
        },

        /** 값 없이 HTML 만 있는 산출물(A2A 표 등)은 글자만 뽑아 앞부분을 보인다. */
        htmlExcerpt() {
            if (this.item.type !== 'html' || !this.item.html) return '';
            const text = String(this.item.html)
                .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
                .replace(/<[^>]+>/g, ' ')
                .replace(/&nbsp;/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            return text.length > WIDE_MAX_CHARS ? `${text.slice(0, WIDE_MAX_CHARS)}…` : text;
        },

        isEmpty() {
            return !this.lines.length && !this.htmlExcerpt;
        }
    },
    methods: {
        /** 넓은 칸 미리보기 — 줄바꿈은 살리고(문단이 보이게) 마크다운 머리표 · 빈 줄 여럿만 정리한다. */
        excerpt(v) {
            const t = String(v || '')
                .replace(/^#+\s*/gm, '')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
            return t.length > WIDE_MAX_CHARS ? `${t.slice(0, WIDE_MAX_CHARS)}…` : t;
        },

        translate(key) {
            return this.$te && this.$te(key) ? this.$t(key) : null;
        },

        /**
         * 항목 이름 — 폼에 적힌 이름이 있으면 그것. 없으면 업무 화면과 같은 규칙(fieldLabelForKey)으로
         * 편집기가 붙인 자동 이름은 「텍스트 2」 · 「예/아니오 3」(지금 편집기의 boolean_3 도), 기본 자유입력 칸은
         * 「작업 내용」, 직접 지은 키는 밑줄을 띄어 쓴 이름.
         */
        labelOf(k) {
            if (this.labels && this.labels[k]) return this.labels[k];
            const key = String(k);
            const freeInputTitle = this.translate('FormWorkItem.freeInputTitle') || '';
            return fieldLabelForKey(key, { translate: this.translate, freeInputTitle }) || key.replace(/_/g, ' ');
        },

        /** 카드 미리보기 — 줄바꿈 · 마크다운 머리표를 한 줄 글로 접고 길이를 자른다(나머지는 CSS 가 줄 수로 자른다). */
        preview(v) {
            const t = String(v || '')
                .replace(/^#+\s*/gm, '')
                .replace(/\s+/g, ' ')
                .trim();
            return t.length > CARD_MAX_CHARS ? `${t.slice(0, CARD_MAX_CHARS)}…` : t;
        },

        openDetail() {
            const out = this.item && this.item.output;
            this.formValues = out && typeof out === 'object' ? JSON.parse(JSON.stringify(out)) : {};
            this.detailDialog = true;
        },

        /** 산출물 값을 읽을 수 있는 줄로 편다. 폼 아이디로 한 겹 감싸여 오기도 한다. */
        summaryLines(item) {
            const out = item && item.output;
            if (!out || typeof out !== 'object') return [];
            const lines = [];
            const walk = (obj, depth) => {
                if (depth > 2 || lines.length >= 8) return;
                Object.keys(obj).forEach((k) => {
                    if (lines.length >= 8) return;
                    const v = obj[k];
                    const file = this.fileEntry(v);
                    if (file) {
                        lines.push({ k: this.labelOf(k), v: file.name, href: file.href });
                        return;
                    }
                    if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, depth + 1);
                    else if (v !== null && v !== undefined && v !== '') {
                        const raw = Array.isArray(v) ? v.join(', ') : String(v);
                        lines.push({
                            k: this.labelOf(k),
                            v: this.readable(raw),
                            // 작업 공간에 남은 파일은 이름만 보여 주고 끝내는 것이 아니라,
                            // 눌러서 받을 수 있게 해 둔다.
                            href: isWorkspacePath(raw) ? workspaceFileUrl(raw) : ''
                        });
                    }
                });
            };
            walk(out, 0);
            return lines;
        },

        /**
         * 파일 하나를 가리키는 값이면 이름과 받을 주소를 돌려준다.
         * 에이전트가 올린 문서는 {path, name, html_url, ext} 꼴로 남는데,
         * 그대로 펴면 칸 하나에 긴 주소 여러 줄이 쌓인다.
         */
        fileEntry(v) {
            if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
            const path = v.path || v.fullPath || v.file_path || '';
            if (!path) return null;
            const name = v.name || fileNameOf(String(path));
            const href = isWorkspacePath(path) ? workspaceFileUrl(String(path)) : String(path);
            return { name, href: /^https?:[/][/]/.test(href) ? href : '' };
        },

        /**
         * 값을 읽기 좋게.
         * 파일은 작업 공간 경로(/workspace/…)로 오는데, 요약에서 필요한 것은
         * 어떤 파일인지이지 어디에 있는지가 아니다. 이름만 남긴다.
         */
        readable(v) {
            const t = String(v);
            if (isWorkspacePath(t)) return fileNameOf(t);
            if (/^[\/].*[\/]/.test(t) && !t.includes(' ')) return t.split(/[\/]/).pop();
            return t;
        }
    }
};
</script>

<style scoped>
.pg-out-wide {
    height: 100%;
    padding: 16px 18px;
    border: 1px solid var(--cds-border);
    border-radius: 12px;
    background: rgb(var(--v-theme-surface));
    color: var(--cds-text-primary);
}

.pg-out-wide__head {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 32px;
    margin-bottom: 10px;
}

.pg-out-wide__name {
    font-size: 15px;
    font-weight: 600;
    line-height: 1.4;
}

.pg-out-wide__open {
    flex: 0 0 auto;
}

.pg-out-wide__field + .pg-out-wide__field {
    margin-top: 12px;
}

.pg-out-wide__k {
    font-size: 12px;
    font-weight: 500;
    color: var(--cds-text-muted);
    margin-bottom: 2px;
}

/* 본문은 보통 글자 크기로, 줄바꿈을 살려 네 줄까지. 나머지는 원본 보기에서. */
.pg-out-wide__v {
    font-size: 14px;
    line-height: 1.6;
    color: var(--cds-text-primary);
    white-space: pre-line;
    word-break: keep-all;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    overflow: hidden;
}

/* 마크다운 글 — 블록이 여럿이라 줄 수 대신 높이로 자르고, 넘치면 아래를 흐리게. */
.pg-out-wide__v--md {
    display: block;
    white-space: normal;
    max-height: 8em;
    overflow: hidden;
}

.pg-out-wide__v--fade {
    -webkit-mask-image: linear-gradient(to bottom, #000 70%, transparent);
    mask-image: linear-gradient(to bottom, #000 70%, transparent);
}

.pg-out-wide__v--md :deep(p),
.pg-out-wide__v--md :deep(ul),
.pg-out-wide__v--md :deep(ol) {
    margin: 0 0 4px;
}

.pg-out-wide__v--md :deep(ul),
.pg-out-wide__v--md :deep(ol) {
    padding-left: 1.3em;
}

.pg-out-wide__v--md :deep(h1),
.pg-out-wide__v--md :deep(h2),
.pg-out-wide__v--md :deep(h3),
.pg-out-wide__v--md :deep(h4) {
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 4px;
}

a.pg-out-wide__v {
    display: inline-flex;
    align-items: center;
    gap: 4px;
}

.pg-out-wide__more {
    margin-top: 8px;
    font-size: 12px;
    color: var(--cds-text-muted);
}

.pg-out-wide__empty {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 0 2px;
    font-size: 14px;
    color: var(--cds-text-muted);
}

.pg-out-card {
    border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
    border-radius: 12px;
    cursor: pointer;
}

.pg-out-card:hover {
    border-color: rgb(var(--v-theme-primary));
}

.pg-out-card__name {
    font-size: 0.875rem;
    font-weight: 700;
    margin-bottom: 6px;
}

.pg-out-card__line {
    display: flex;
    gap: 8px;
    font-size: 0.75rem;
    line-height: 1.7;
}

.pg-out-card__k {
    flex: 0 0 auto;
    max-width: 34%;
    color: rgba(var(--v-theme-on-surface), 0.5);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.pg-out-card__v {
    flex: 1 1 auto;
    min-width: 0;
    color: rgba(var(--v-theme-on-surface), 0.85);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.pg-out-card__v--file {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: rgb(var(--v-theme-primary));
    text-decoration: none;
}

.pg-out-card__v--file:hover {
    text-decoration: underline;
}

.pg-out-card__v--wrap {
    white-space: normal;
}

/* 카드에서는 값이 길어도 세 줄까지만. */
.pg-out-card__v--clamp {
    white-space: normal;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    overflow: hidden;
}

.pg-out-card__hidden {
    font-size: 0.75rem;
    color: rgba(var(--v-theme-on-surface), 0.45);
}

.pg-out-card__empty {
    font-size: 0.75rem;
    color: rgba(var(--v-theme-on-surface), 0.4);
}

.pg-out-card__more {
    margin-top: 8px;
    font-size: 0.75rem;
    color: rgb(var(--v-theme-primary));
}
</style>
