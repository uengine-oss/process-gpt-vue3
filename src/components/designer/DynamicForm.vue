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
    // 폼 HTML 데이터를 전달시켜서 렌더링시키기 위해서
    formHTML: {
      type: String,
      default: '',
    },
    modelValue: Object
  },

  watch: {
    formHTML() {
      this.renderVueComponents()
    },

    modelValue: {
      handler() {
        this.setUserInputedDatas(this.modelValue)
      },
      immediate: true
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

          if(app.componentRef.onChange) {
            app.componentRef.onChange = () => {
              this.$emit('update:modelValue', this.getUserInputedDatas())
            }
          }
        })
      });
    },


    /**
     * 입력 요소에 대해서 유저가 입력한 데이터를 반환시키기 위해서
     * {name1:value1, name2:value2}와 같이 반환됨(name1은 입력 태그의 name 속성이며, 고유한 속성임)
     */
    getUserInputedDatas() {
      let userInputedDatas = {}

      Object.keys(this.componentRefs).forEach(refKey => {
        const component = this.componentRefs[refKey];
        if (component.name && component.inputedValue !== undefined) {
          userInputedDatas[component.name] = component.inputedValue;
        }
      });

      return userInputedDatas
    },

    /**
     * 입력 요소에 자동으로 값을 입력시키기 위해서
     * {name1:value1, name2:value2}와 같이 전달할 것(name1은 입력 태그의 name 속성이며, 고유한 속성임)
     * [!] 만약, 해당 키를 이름으로 가진 속성이 없을 경우, 그 키는 무시됨
     */
    setUserInputedDatas(userInputedDatas) {
      Object.keys(userInputedDatas).forEach(key => {
        Object.keys(this.componentRefs).forEach(refKey => {
          const component = this.componentRefs[refKey];
          if (component.name === key) {
            component.initialValue = userInputedDatas[key];
          }
        });
      });
    }
  },

  created() {
    this.renderVueComponents()
  }
};
</script>

