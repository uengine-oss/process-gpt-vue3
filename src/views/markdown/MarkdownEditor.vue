<template>
  <div class="editor-wrapper">
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
                    offset: [400, -300],
                  },
                },
                {
                  name: 'preventOverflow',
                  options: {
                    boundary: 'viewport',
                    padding: 8,
                  },
                },
              ],
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
              <v-list-item
                v-for="(item, index) in aiOptions"
                :key="index"
                @click="handleAIOption(item)"
              >
                <div class="ai-option-item">
                  <v-icon class="mr-2">{{ item.icon }}</v-icon>
                  <span>{{ item.label }}</span>
                </div>
              </v-list-item>
            </v-list>
          </div>
        </BubbleMenu>


        <!-- 에디터 본문 -->
         <EditorContent
            :editor="editor"
            :class="useDefaultEditorStyle ? 'editor-content editor-border' : 'editor-content'"
          />

      </v-card-text>
    </v-card>
  </div>
</template>

<script>
import { Editor, EditorContent, BubbleMenu as BubbleMenuComponent } from '@tiptap/vue-3'
import { DOMSerializer, DOMParser as ProseMirrorDOMParser } from 'prosemirror-model'
import { marked } from 'marked'

import StarterKit from '@tiptap/starter-kit'
import BubbleMenuExtension from '@tiptap/extension-bubble-menu'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import TurndownService from 'turndown'

import MarkdownGenerator from "@/components/ai/MarkdownGenerator.js";

const mode = {
  NONE: 'none',
  CREATE: 'create',
  REPLACE: 'replace',
  INSERT_BELOW: 'insert_below',
  DISCARD: 'discard',
  TRY_AGAIN: 'try_again',
}

export default {
  name: 'NotionStyleEditor',
  components: {
    EditorContent,
    BubbleMenu: BubbleMenuComponent,
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
    }
  },
  data() {
    return {
      getAppendTarget: () => $('.editor-wrapper').parent()[0],
      editor: null,
      isUpdated : false,
      aiOptions: [
        { label: 'Create Content', icon: 'mdi-file-outline', value: mode.CREATE },
        { label: 'Replace selection', icon: 'mdi-check', value: mode.REPLACE },
        { label: 'Insert below', icon: 'mdi-playlist-plus', value: mode.INSERT_BELOW },
        { label: 'Discard', icon: 'mdi-close', value: mode.DISCARD },
        { label: 'Try again', icon: 'mdi-undo', value: mode.TRY_AGAIN },
      ],
      selectedText: '',
      selectedAIMode: mode.NONE,
      requirements: '',
      selection: null,
      isGenerating: false,
      allText : '',
      supresswatch: false,
    }
  },
  mounted() {
    this.initEditor();
    if(this.modelValue) {
      const html = marked(this.modelValue)

      // HTML -> DOM -> ProseMirror Slice
      const dom = new DOMParser().parseFromString(html, 'text/html')
      const slice = ProseMirrorDOMParser
        .fromSchema(this.editor.schema)
        .parseSlice(dom.body)

      // 에디터에 반영
      this.editor.commands.setContent(slice.content, false) // false = history에 쌓지 않음
    }
  },
  beforeUnmount() {
    if (this.editor) this.editor.destroy();
  },
  watch: {
    updateKey: {
      immediate: true,
      handler(newVal) {
        if(this.editor && !this.isUpdated) {
          // 마크다운 문자열을 HTML로 변환
          const html = marked(newVal)

          // HTML -> DOM -> ProseMirror Slice
          const dom = new DOMParser().parseFromString(html, 'text/html')
          const slice = ProseMirrorDOMParser
            .fromSchema(this.editor.schema)
            .parseSlice(dom.body)

          // 에디터에 반영
          this.editor.commands.setContent(slice.content, false) // false = history에 쌓지 않음

          this.isUpdated = true;
        }
      }
    },
  },
  methods: {
    initEditor() {
      this.isUpdated = false;
      this.editor = new Editor({
        content: this.htmlContent || '',
        extensions: [
          StarterKit,
          BubbleMenuExtension.configure({
            element: document.createElement('div'),
          }),
          TextAlign.configure({ types: ['heading', 'paragraph'] }),
          Underline,
          Highlight,
          Link,
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
          },
        },
        onUpdate: ({ editor }) => {
          const html = editor.getHTML();
          const markdown = this.convertHtmlToMarkdown(html);
          this.$emit('update:modelValue', markdown);
        }
      });
    },
    convertHtmlToMarkdown(html) {
      const turndownService = new TurndownService();
      turndownService.addRule('horizontalRule', {
        filter: 'hr',
        replacement: function () {
          return '\n---\n';
        }
      });
      return turndownService.turndown(html);
    },
    async generate() {
      this.generator = new MarkdownGenerator(this, {
        isStream: true,
        preferredLanguage: "Korean"
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
      const cleaned = markdownOrHtml
        .replace(/\\#/g, '#')
        .replace(/\\\*/g, '*')
        .replace(/\\`/g, '`')
        .replace(/\\\\/g, '\\');
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
          const html = this.editor.getHTML();
          const markdown = this.convertHtmlToMarkdown(html);
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
          const html = this.editor.getHTML();
          const markdown = this.convertHtmlToMarkdown(html);
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
          const html = this.editor.getHTML();
          const markdown = this.convertHtmlToMarkdown(html);
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
      const html = this.editor.getHTML();
      const markdown = this.convertHtmlToMarkdown(html);
      this.$emit('save', markdown);
    }
  }
}
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

</style>
