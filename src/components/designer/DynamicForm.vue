<template>
  <div v-html="renderedContent">

  </div>
</template>

<script>
import { createApp } from 'vue';
import vuetify from "@/plugins/vuetify";
import DynamicComponent from './DynamicComponent.vue';

export default {
  props: {
    formHTML: {
      type: String,
      default: '',
    }
  },

  watch: {
    formHTML() {
      this.renderVueComponents()
    }
  },

  data() {
    return {
      renderedContent: "",
      componentRefs: {}
    }
  },

  methods: {
    /**
     * 전달된 formHTML의 Vue 컴포넌트 요소들을 렌더링시키기 위해서
     */
    renderVueComponents() {
      if(!this.formHTML) return

      // "-field"가 포함된 컴포넌트들을 렌더링을 위해서 vuemount div로 감싸고, renderedContent에 저장시켜서 렌더링 준비하기
      const formHTMLDom = new DOMParser().parseFromString(this.formHTML, 'text/html')
      const components = Array.from(formHTMLDom.querySelectorAll('*')).filter(el => el.tagName.toLowerCase().endsWith('-field'));
      components.forEach(component => {
        const parent = document.createElement('div')
        parent.setAttribute('id', `vuemount_${crypto.randomUUID()}`)
        component.parentNode.insertBefore(parent, component)
        parent.appendChild(component)
      })
      this.renderedContent = formHTMLDom.body.innerHTML

      this.$nextTick(() => {
        // renderedContent에서 "-field"가 있는 태그들을 Vue 컴포넌트로 렌더링시켜서 참조 가능하도록 넣어두기
        const parser = new DOMParser();
        const renderedDom = parser.parseFromString(this.renderedContent, 'text/html');

        renderedDom.querySelectorAll("div[id^='vuemount_']").forEach(vueRenderElement => {
          const vueRenderUUID = vueRenderElement.id
          const app = createApp(DynamicComponent, {content:vueRenderElement.innerHTML, vueRenderUUID:vueRenderUUID}).use(vuetify).mount('#'+vueRenderUUID);
          this.componentRefs[vueRenderUUID] = app.componentRef;
        })
      });
    }
  },

  created() {
    this.renderVueComponents()
  }
};
</script>

