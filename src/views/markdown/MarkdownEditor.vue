<template>
    <div v-if="readOnly || isPreview">
        <div v-html="htmlContent" :class="isOverflow ? 'editor-preview-overflow' : 'editor-preview'"></div>
    </div>
    <div v-else class="editor-wrapper">
        <v-card flat>
            <v-card-text>
                <BubbleMenu
                    v-if="editor"
                    :editor="editor"
                    :tippy-options="{
                        duration: 100,
                        interactive: true,
                        trigger: 'manual',
                        hideOnClick: true,
                        appendTo: getAppendTarget,
                        popperOptions: {
                            modifiers: [
                                {
                                    name: 'offset',
                                    options: {
                                        offset: [400, -300]
                                    }
                                },
                                {
                                    name: 'preventOverflow',
                                    options: {
                                        boundary: 'viewport',
                                        padding: 8
                                    }
                                }
                            ]
                        }
                    }"
                    class="bubble-ai-menu"
                >
                    <div class="ai-box">
                        <!-- 툴바 기능 추가 -->
                        <div class="bubble-toolbar">
                            <v-btn size="x-small" @click="toggle('bold')" :color="isActive('bold') ? 'primary' : ''">
                                <v-icon>mdi-format-bold</v-icon>
                            </v-btn>
                            <v-btn size="x-small" @click="toggle('italic')" :color="isActive('italic') ? 'primary' : ''">
                                <v-icon>mdi-format-italic</v-icon>
                            </v-btn>
                            <v-btn size="x-small" @click="toggle('underline')" :color="isActive('underline') ? 'primary' : ''">
                                <v-icon>mdi-format-underline</v-icon>
                            </v-btn>
                            <v-btn size="x-small" @click="setAlign('left')">
                                <v-icon>mdi-format-align-left</v-icon>
                            </v-btn>
                            <v-btn size="x-small" @click="setAlign('center')">
                                <v-icon>mdi-format-align-center</v-icon>
                            </v-btn>
                            <v-btn size="x-small" @click="setAlign('right')">
                                <v-icon>mdi-format-align-right</v-icon>
                            </v-btn>
                        </div>

                        <!-- AI 입력 필드 -->
                        <v-text-field
                            v-model="requirements"
                            label="Ask AI anything..."
                            dense
                            hide-details
                            solo
                            flat
                            class="ai-input"
                            :disabled="isGenerating"
                            @keydown.enter="handleAIOption(null)"
                        />

                        <!-- 로딩 or 옵션 목록 -->
                        <div v-if="isGenerating" class="ai-loading">
                            <v-progress-circular indeterminate color="primary" size="24" />
                        </div>

                        <v-list v-else dense class="ai-options">
                            <v-list-item v-for="(item, index) in aiOptions" :key="index" @click="handleAIOption(item)">
                                <div class="ai-option-item">
                                    <v-icon class="mr-2">{{ item.icon }}</v-icon>
                                    <span>{{ item.label }}</span>
                                </div>
                            </v-list-item>
                        </v-list>
                    </div>
                </BubbleMenu>

                <!-- 에디터 본문 -->
                <EditorContent :editor="editor" :class="useDefaultEditorStyle ? 'editor-content editor-border' : 'editor-content'" />
            </v-card-text>
        </v-card>
    </div>
</template>

<script>
import { Editor, EditorContent, BubbleMenu as BubbleMenuComponent } from '@tiptap/vue-3';
import { DOMSerializer, DOMParser as ProseMirrorDOMParser } from 'prosemirror-model';
import { Markdown } from 'tiptap-markdown';
import { marked } from 'marked';

import StarterKit from '@tiptap/starter-kit';
import BubbleMenuExtension from '@tiptap/extension-bubble-menu';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Image } from '@tiptap/extension-image';
import TurndownService from 'turndown';

import MarkdownGenerator from '@/components/ai/MarkdownGenerator.js';

const mode = {
    NONE: 'none',
    CREATE: 'create',
    REPLACE: 'replace',
    INSERT_BELOW: 'insert_below',
    DISCARD: 'discard',
    TRY_AGAIN: 'try_again'
};

export default {
    name: 'NotionStyleEditor',
    components: {
        EditorContent,
        BubbleMenu: BubbleMenuComponent
    },
    props: {
        modelValue: {
            type: String,
            default: ''
        },
        useDefaultEditorStyle: {
            type: Boolean,
            default: true
        },
        updateKey: {
            type: String,
            default: null
        },
        readOnly: {
            type: Boolean,
            default: false
        },
        isPreview: {
            type: Boolean,
            default: false
        },
        isOverflow: {
            type: Boolean,
            default: false
        }
    },
    data() {
        return {
            getAppendTarget: () => $('.editor-wrapper').parent()[0],
            editor: null,
            isUpdated: false,
            aiOptions: [
                { label: 'Create Content', icon: 'mdi-file-outline', value: mode.CREATE },
                { label: 'Replace selection', icon: 'mdi-check', value: mode.REPLACE },
                { label: 'Insert below', icon: 'mdi-playlist-plus', value: mode.INSERT_BELOW },
                { label: 'Discard', icon: 'mdi-close', value: mode.DISCARD },
                { label: 'Try again', icon: 'mdi-undo', value: mode.TRY_AGAIN }
            ],
            selectedText: '',
            selectedAIMode: mode.NONE,
            requirements: '',
            selection: null,
            isGenerating: false,
            allText: '',
            supresswatch: false
        };
    },
    mounted() {
        this.initEditor();
        if (this.modelValue) {
            const html = marked(this.modelValue);

            // HTML -> DOM -> ProseMirror Slice
            const dom = new DOMParser().parseFromString(html, 'text/html');
            const slice = ProseMirrorDOMParser.fromSchema(this.editor.schema).parseSlice(dom.body);

            // 에디터에 반영
            this.editor.commands.setContent(slice.content, false); // false = history에 쌓지 않음
        }
    },
    beforeUnmount() {
        if (this.editor) this.editor.destroy();
    },
    computed: {
        htmlContent() {
            if (!this.modelValue) return '';
            
            // marked 옵션 설정으로 테이블과 이미지 지원 강화
            marked.setOptions({
                breaks: true,
                gfm: true, // GitHub Flavored Markdown 활성화 (테이블 지원)
            });
            
            return marked(this.modelValue);
        }
    },
    watch: {
        updateKey: {
            immediate: true,
            handler(newVal) {
                if (this.editor && !this.isUpdated) {
                    // 마크다운 문자열을 HTML로 변환
                    const html = marked(newVal);

                    // HTML -> DOM -> ProseMirror Slice
                    const dom = new DOMParser().parseFromString(html, 'text/html');
                    const slice = ProseMirrorDOMParser.fromSchema(this.editor.schema).parseSlice(dom.body);

                    // 에디터에 반영
                    this.editor.commands.setContent(slice.content, false); // false = history에 쌓지 않음

                    this.isUpdated = true;
                }
            }
        }
    },
    methods: {
        initEditor() {
            this.isUpdated = false;
            this.editor = new Editor({
                content: this.htmlContent || '',
                extensions: [
                    StarterKit,
                    BubbleMenuExtension.configure({
                        element: document.createElement('div')
                    }),
                    TextAlign.configure({ types: ['heading', 'paragraph'] }),
                    Underline,
                    Highlight,
                    Link,
                    Table.configure({
                        resizable: true,
                    }),
                    TableRow,
                    TableHeader,
                    TableCell,
                    Image.configure({
                        inline: true,
                        HTMLAttributes: {
                            class: 'markdown-image',
                        },
                    }),
                    Markdown
                ],
                editorProps: {
                    handlePaste(view, event) {
                        const markdown = event.clipboardData.getData('text/plain');
                        if (!markdown.includes('#') && !markdown.includes('-') && !markdown.includes('```') && !markdown.includes('---')) {
                            return false;
                        }
                        const html = marked(markdown);
                        const dom = new window.DOMParser().parseFromString(html, 'text/html');
                        const slice = ProseMirrorDOMParser.fromSchema(view.state.schema).parseSlice(dom.body);
                        view.dispatch(view.state.tr.replaceSelection(slice));
                        return true;
                    }
                },
                onUpdate: ({ editor }) => {
                    const markdown = this.getMarkdown();
                    console.log('편집된 마크다운:', markdown);
                    this.$emit('update:modelValue', markdown);
                }
            });
        },
        getMarkdown() {
            let markdown = this.editor.storage.markdown.getMarkdown();
            if (markdown) {
                if (markdown.includes('\\--')) {
                    markdown = markdown.replaceAll('\\--', '--');
                }
            }
            return markdown;
        },
        convertHtmlToMarkdown(html) {
            const turndownService = new TurndownService({
                headingStyle: 'atx',
                codeBlockStyle: 'fenced'
            });

            // <hr> → ---
            turndownService.addRule('horizontalRule', {
                filter: function (node) {
                    return node.nodeName === 'HR';
                },
                replacement: function () {
                    return '\n\n---\n\n';
                }
            });

            // 테이블 처리 규칙 추가
            turndownService.addRule('table', {
                filter: 'table',
                replacement: function (content) {
                    return '\n\n' + content + '\n\n';
                }
            });

            turndownService.addRule('tableRow', {
                filter: 'tr',
                replacement: function (content, node) {
                    let borderCells = '';
                    const alignMap = { left: ':--', right: '--:', center: ':-:' };
                    
                    if (node.parentNode.nodeName === 'THEAD') {
                        for (const childNode of node.childNodes) {
                            const align = childNode.getAttribute ? 
                                (childNode.getAttribute('align') || 'left') : 'left';
                            borderCells += '| ' + (alignMap[align] || ':--') + ' ';
                        }
                        borderCells += '|\n';
                    }
                    return '| ' + content + ' |\n' + borderCells;
                }
            });

            turndownService.addRule('tableCell', {
                filter: ['th', 'td'],
                replacement: function (content) {
                    return content + ' |';
                }
            });

            // 이미지 처리 규칙 강화
            turndownService.addRule('image', {
                filter: 'img',
                replacement: function (content, node) {
                    const alt = node.getAttribute('alt') || '';
                    const src = node.getAttribute('src') || '';
                    return '![' + alt + '](' + src + ')';
                }
            });

            // <pre><code> → ```lang\ncode\n```
            turndownService.addRule('codeBlock', {
                filter: function (node) {
                    return node.nodeName === 'PRE' && node.firstChild && node.firstChild.nodeName === 'CODE';
                },
                replacement: function (content, node) {
                    const codeNode = node.firstChild;
                    const highlight = content.match(/^\[.*\]/);
                    const lang = highlight;
                    const code = codeNode.textContent.replace('\n', '').replace(highlight, '');
                    return `\`\`\`${lang}\n${code}\n\`\`\``;
                }
            });

            let result = turndownService.turndown(html);

            // 하이픈 3개 이상 → 정확히 3개로 통일
            result = result.replace(/-{4,}/g, '---');
            // 2. \-- → -- 로 치환
            result = result.replace(/\\--/g, '--');
            // 3. * 리스트 항목에 fragment 주석 자동 추가
            result = result.replace(/^(\s*\* .+?)(\s*)$/gm, (match, item, space) => {
                if (item.includes('<!--')) {
                    return match;
                } else {
                    return `${item} <!-- .element: class="fragment" -->${space}`;
                }
            });

            return result;
        },
        async generate() {
            this.generator = new MarkdownGenerator(this, {
                isStream: true,
                preferredLanguage: 'Korean'
            });
            await this.generator.generate();
        },
        toggle(type) {
            this.editor.chain().focus()[`toggle${type.charAt(0).toUpperCase() + type.slice(1)}`]().run();
        },
        isActive(type) {
            return this.editor.isActive(type);
        },
        setAlign(align) {
            this.editor.chain().focus().setTextAlign(align).run();
        },
        highlight() {
            this.editor.chain().focus().toggleHighlight().run();
        },
        setLink() {
            const url = prompt('링크 주소 입력:');
            if (url) {
                this.editor.chain().focus().setLink({ href: url }).run();
            }
        },
        getSelectedHtml() {
            const { view } = this.editor;
            const { from, to } = view.state.selection;
            const slice = view.state.doc.slice(from, to);
            const fragment = DOMSerializer.fromSchema(view.state.schema).serializeFragment(slice.content);
            const wrapper = document.createElement('div');
            wrapper.appendChild(fragment);
            return wrapper.innerHTML;
        },
        handleAIOption(option) {
            const selectedText = this.getSelectedHtml();
            const { from, to, anchor, head } = this.editor.state.selection;
            this.selection = { from, to, anchor, head };
            this.selectedText = selectedText;
            this.allText = this.editor.options.content;
            this.selectedAIMode = option ? option.value : mode.NONE;
            this.isGenerating = true;
            this.generate();
        },
        extractModeFromText(output) {
            const match = output.match(/^\[mode:\s*(\w+)\]/i);
            return match ? match[1].toLowerCase() : null;
        },
        extractContentWithoutMode(output) {
            return output.replace(/^\[mode:\s*\w+\]\s*/i, '');
        },
        parseMarkdownOrHtmlToSlice(markdownOrHtml) {
            const cleaned = markdownOrHtml.replace(/\\#/g, '#').replace(/\\\*/g, '*').replace(/\\`/g, '`').replace(/\\\\/g, '\\');
            const html = cleaned.includes('<') ? cleaned : marked(cleaned);
            const dom = new DOMParser().parseFromString(html, 'text/html');
            return ProseMirrorDOMParser.fromSchema(this.editor.state.schema).parseSlice(dom.body);
        },
        async onGenerationFinished(response) {
            const selectedMode = this.extractModeFromText(response);
            const content = this.extractContentWithoutMode(response);
            this.requirements = '';
            this.isGenerating = false;

            switch (selectedMode) {
                case mode.CREATE:
                    this.createContent(content);
                    break;
                case mode.REPLACE:
                    this.replaceText(content);
                    break;
                case mode.INSERT_BELOW:
                    this.insertBelow(content);
                    break;
                case mode.DISCARD:
                    this.discardText();
                    break;
                case mode.TRY_AGAIN:
                    this.tryAgain(content);
                    break;
            }

            this.editor.commands.focus();
            this.editor.view.updateState(this.editor.state);
            this.selection = null;
            const selection = this.editor.view.state.selection;
            this.selectedAIMode = mode.NONE;
            this.editor.commands.setTextSelection({ from: selection.to, to: selection.to });
        },
        replaceText(responseHtml) {
            const { from, to } = this.selection;
            const slice = this.parseMarkdownOrHtmlToSlice(responseHtml);
            if (!slice || slice.content.size === 0) return;

            this.editor.commands.command(({ tr, dispatch }) => {
                tr.replaceRange(from, to, slice);
                dispatch(tr);
                this.$nextTick(() => {
                    const markdown = this.getMarkdown();
                    this.$emit('update:modelValue', markdown);
                });
                return true;
            });
        },
        insertBelow(responseHtml) {
            const { to } = this.selection;
            const slice = this.parseMarkdownOrHtmlToSlice(responseHtml);

            this.editor.commands.command(({ tr, dispatch }) => {
                tr.insert(to, slice.content);
                dispatch(tr);
                this.$nextTick(() => {
                    const markdown = this.getMarkdown();
                    this.$emit('update:modelValue', markdown);
                });
                return true;
            });
        },
        discardText() {
            const { from, to } = this.selection;

            this.editor.commands.command(({ tr, dispatch }) => {
                tr.delete(from, to);
                dispatch(tr);
                this.$nextTick(() => {
                    const markdown = this.getMarkdown();
                    this.$emit('update:modelValue', markdown);
                });
                return true;
            });
        },
        tryAgain(responseHtml) {
            this.replaceText(responseHtml);
        },
        createContent(responseHtml) {
            this.replaceText(responseHtml);
        },
        save() {
            const markdown = this.getMarkdown();
            this.$emit('save', markdown);
        }
    }
};
</script>

<style scoped>
.editor-wrapper {
    overflow: visible;
    width: 100%;
    height: 100%;
    margin: 0 auto;
    background-color: #fff;
    border-radius: 12px;
    min-height: 600px;
    font-family: 'Plus Jakarta Sans', sans-serif !important;
}

.editor-preview {
    overflow: hidden;
    width: 100%;
    height: 100%;
    margin: 0 auto;
    background-color: #fff;
    padding: 0;
    font-size: 8px;
    line-height: 1.2;
}

.editor-preview-overflow {
    overflow: auto;
    width: 100%;
    height: 100%;
    margin: 0 auto;
    background-color: #fff;
    padding: 0;
    font-size: 11px;
    line-height: 1.2;
}

.toolbar {
    display: flex;
    flex-wrap: wrap;
    margin-bottom: 16px;
    gap: 6px;
}

.editor-content {
    width: 100%;
    height: 100%;
    font-size: 16px;
    line-height: 1.6;
}

.editor-border {
    border: 1px solid #ccc;
    border-radius: 8px;
}

.ProseMirror {
    outline: none;
    border: 1px solid silver;
    padding: 1em;
    white-space: pre-wrap;
}

::v-deep(.ProseMirror) {
    border: none !important;
    outline: none !important;
    padding: 0 !important;
    box-shadow: none !important;
}

.bubble-menu {
    display: flex;
    gap: 4px;
    background: white;
    border: 1px solid #ddd;
    padding: 6px;
    border-radius: 6px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
    z-index: 10;
    position: absolute;
}

.bubble-ai-menu {
    background: #fff;
    border: 1px solid #ddd;
    padding: 12px;
    border-radius: 8px;
    min-width: 280px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    max-width: calc(100vw - 32px);
    word-break: break-word;
}

.ai-input {
    margin-bottom: 8px;
}

.ai-options .v-list-item {
    cursor: pointer;
    width: 600px;
    padding: 4px 8px;
}

.ai-option-item {
    display: flex;
    align-items: center;
}

.ai-option-item .v-icon {
    margin-right: 8px;
    font-size: 18px;
}

.ai-loading {
    display: flex;
    justify-content: center;
    padding: 12px;
}

.bubble-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 8px;
}

/* 테이블 스타일 */
::v-deep(.ProseMirror table) {
    border-collapse: collapse;
    margin: 16px 0;
    overflow: hidden;
    table-layout: fixed;
    width: 100%;
}

::v-deep(.ProseMirror table td),
::v-deep(.ProseMirror table th) {
    border: 1px solid #ddd;
    box-sizing: border-box;
    min-width: 1em;
    padding: 8px;
    position: relative;
    vertical-align: top;
}

::v-deep(.ProseMirror table th) {
    background-color: #f5f5f5;
    font-weight: bold;
    text-align: left;
}

::v-deep(.ProseMirror table .selectedCell:after) {
    background: rgba(200, 200, 255, 0.4);
    content: "";
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
    pointer-events: none;
    position: absolute;
    z-index: 2;
}

/* 이미지 스타일 */
::v-deep(.ProseMirror .markdown-image) {
    max-width: 100%;
    height: auto;
    border-radius: 4px;
    margin: 8px 0;
}

/* 헤딩 태그 스타일 */
::v-deep(.ProseMirror h1),
::v-deep(.ProseMirror h2),
::v-deep(.ProseMirror h3),
::v-deep(.ProseMirror h4),
::v-deep(.ProseMirror h5),
::v-deep(.ProseMirror h6) {
    margin-bottom: 8px !important;
}

/* 읽기 모드에서의 헤딩 스타일 */
.editor-preview h1,
.editor-preview h2,
.editor-preview h3,
.editor-preview h4,
.editor-preview h5,
.editor-preview h6,
.editor-preview-overflow h1,
.editor-preview-overflow h2,
.editor-preview-overflow h3,
.editor-preview-overflow h4,
.editor-preview-overflow h5,
.editor-preview-overflow h6 {
    margin-bottom: 8px !important;
}

/* 리스트 스타일 복원 */
::v-deep(.ProseMirror ul),
::v-deep(.ProseMirror ol) {
    padding-left: 24px;
    margin: 12px 0;
}

::v-deep(.ProseMirror ul li) {
    list-style-type: disc;
    margin: 4px 0;
}

::v-deep(.ProseMirror ol li) {
    list-style-type: decimal;
    margin: 4px 0;
}

::v-deep(.ProseMirror ul ul li) {
    list-style-type: circle;
}

::v-deep(.ProseMirror ul ul ul li) {
    list-style-type: square;
}

/* 읽기 모드에서의 리스트 스타일 */
.editor-preview ul,
.editor-preview-overflow ul {
    padding-left: 16px;
    margin: 8px 0;
}

.editor-preview ol,
.editor-preview-overflow ol {
    padding-left: 16px;
    margin: 8px 0;
}

.editor-preview ul li,
.editor-preview-overflow ul li {
    list-style-type: disc;
    margin: 2px 0;
}

.editor-preview ol li,
.editor-preview-overflow ol li {
    list-style-type: decimal;
    margin: 2px 0;
}

.editor-preview ul ul li,
.editor-preview-overflow ul ul li {
    list-style-type: circle;
}

.editor-preview ul ul ul li,
.editor-preview-overflow ul ul ul li {
    list-style-type: square;
}

/* 읽기 모드에서의 테이블과 이미지 스타일 */
.editor-preview table,
.editor-preview-overflow table {
    border-collapse: collapse;
    margin: 16px 0;
    width: 100%;
    font-size: 6px;
}

.editor-preview table td,
.editor-preview table th,
.editor-preview-overflow table td,
.editor-preview-overflow table th {
    border: 1px solid #ddd;
    padding: 4px;
    text-align: left;
}

.editor-preview table th,
.editor-preview-overflow table th {
    background-color: #f5f5f5;
    font-weight: bold;
}

.editor-preview img,
.editor-preview-overflow img {
    max-width: 100%;
    height: auto;
    border-radius: 2px;
    margin: 4px 0;
}
</style>
