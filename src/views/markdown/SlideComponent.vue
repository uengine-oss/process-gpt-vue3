<template>
  <div class="reveal-container" :class="{ 'edit-mode': isEditMode }">
    <div class="reveal">
      <div class="slides">
        <section data-markdown data-separator="^\n---\n$" data-separator-vertical="^\n--\n$" data-separator-notes="^Note:">
          <textarea data-template ref="markdownContent"></textarea>
        </section>
      </div>
    </div>
  </div>
</template>

<script>
import Reveal from 'reveal.js'
import RevealMarkdown from 'reveal.js/plugin/markdown/markdown.esm.js'
import RevealHighlight from 'reveal.js/plugin/highlight/highlight.esm.js'
import RevealNotes from 'reveal.js/plugin/notes/notes.esm.js'
import RevealMath from 'reveal.js/plugin/math/math.esm.js'
import 'reveal.js/dist/reveal.css'
import 'reveal.js/dist/theme/white.css'

export default {
  name: 'SlideComponent',
  props: {
    content: { type: String, required: true },
    isEditMode: { type: Boolean, default: false }
  },
  data() {
    return {
      deck: null
    }
  },
  mounted() {
    if (this.$refs.markdownContent) {
      console.log('[Reveal Debug] setting textarea content')
      this.$refs.markdownContent.textContent = this.content

      // DOM 반영 → 렌더링 → Reveal 초기화까지 안전하게 대기
      if (this.$refs.markdownContent) {
        console.log('[Reveal Debug] setting textarea content')
        this.$refs.markdownContent.textContent = this.content

        this.$nextTick(() => {
          requestAnimationFrame(() => {
            this.init()
          })
        })
      }
    }
  },
  watch: {
    content: {
      handler: async function (newContent) {
        if (this.$refs.markdownContent) {
          console.log('[Reveal Debug] updating textarea content')
          this.$refs.markdownContent.textContent = newContent

          await this.$nextTick()
          requestAnimationFrame(() => {
            if (this.deck) {
              this.init();
              console.log('[Reveal Debug] slide count after sync:', this.deck.getSlides().length)
            }
          })
        }
      }
    }
  },
  methods: {
    async init() {
      this.$nextTick(() => {
        requestAnimationFrame(() => {
          this.initReveal()
        })
      })
    },
    async initReveal() {
      const isPrintPdf = /print-pdf/gi.test(window.location.search)
      const showNotes = this.getQueryParam('showNotes')
      const pdfSeparateFragments = this.getQueryParam('pdfSeparateFragments') !== 'false'
      if (this.deck) {
        this.deck.destroy()
        this.deck = null
      }

      this.deck = new Reveal({
        plugins: [RevealMarkdown, RevealHighlight, RevealNotes, RevealMath.KaTeX],
        embedded: true,
        margin: 0.1,
        minScale: 0.2,
        maxScale: 2.0,
        controls: !this.isEditMode,
        progress: !this.isEditMode,
        center: true,
        touch: !this.isEditMode,
        fragmentInURL: false,
        transition: 'slide',
        viewDistance: this.isEditMode ? 0 : 3,
        autoSlide: 0,
        width: this.isEditMode ? 600 : 960,
        height: this.isEditMode ? 400 : 700,
        highlight: {
          highlightOnLoad: true,
          lineNumbers: true 
        },
        markdown: {
          smartypants: true
        },
        pdfSeparateFragments: pdfSeparateFragments,
        pdfMaxPagesPerSlide: 1,
        showNotes: showNotes || false
      })

      await this.deck.initialize()
      // 슬라이드 수 확인 로그
      console.log('[Reveal Debug] slide count:', this.deck.getSlides().length)
    },
    getQueryParam(name) {
      const urlParams = new URLSearchParams(window.location.search)
      return urlParams.get(name)
    }
  }
}
</script>

<style>
.reveal-container {
  width: 100%;
  height: 100%;
  border-radius: 4px;
  overflow: hidden;
  position: relative;
  padding-bottom: 0px !important;
}

.edit-mode .reveal .slides section {
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  transform: none !important;
}

.reveal-container .reveal .controls button {
    color: black !important;
}

.reveal-container .progress {
    color: black !important;
}

.reveal {
  height: 100%;
}

/* Custom theme overrides */
.reveal h1, 
.reveal h2, 
.reveal h3, 
.reveal h4, 
.reveal h5, 
.reveal h6 {
  color: var(--slide-heading);
  margin-bottom: 0.5em;
}

.reveal p {
  margin-bottom: 0.5em;
}

.reveal pre {
  width: 100%;
  margin-bottom: 1em;
}

.reveal code {
  font-family: monospace;
}

.reveal blockquote {
  border-left: 4px solid var(--slide-heading);
  padding-left: 1rem;
  font-style: italic;
}

/* Fragment styles */
.reveal .slides section .fragment.highlight-current-blue.current-fragment {
  color: #61afef;
}

.reveal .slides section .fragment.highlight-red.visible {
  color: #e06c75;
}

.reveal .slides section .fragment.highlight-green.visible {
  color: #98c379;
}

/* Vertical slide indicators */
.reveal .slides > section > section:after {
  content: '';
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 4px;
  background-color: var(--slide-heading);
  opacity: 0.5;
  border-radius: 2px;
}

.reveal-viewport code {
  background: black;
  color: white;
  padding: 1.5rem !important;
  border-radius: 0.75rem !important;
  font-family: monospace, monospace !important;
  line-height: 1.6 !important;
  font-size: 22px;
}

/* PDF Export Specific Styles */
@media print {
  .reveal-container {
    box-shadow: none !important;
    border-radius: 0 !important;
  }
}
</style>
