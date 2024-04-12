<template>
  <div>
    <v-btn @click="saveFormDefinition">
      save
    </v-btn>

    <div id="kEditor1">
    </div>
    
    <v-dialog v-model="openPanel">
        <form-definition-panel
          :value="formValue"
          @save="editFormDefinition"
        >

        </form-definition-panel>
    </v-dialog>
  </div>
</template>

<script>
// import Snippets from '@/components/Snippets';
// import Containers from './Containers';
import ChatModule from "@/components/ChatModule.vue";
import FormDefinitionPanel from '@/components/designer/modeling/FormDefinitionPanel.vue';
import axios from 'axios';
import TextField from '../ui/TextField.vue';
import DynamicForm from './DynamicForm.vue';

import vuetify from "@/plugins/vuetify";
import { createApp } from 'vue';

export default {
  name: 'mash-up',
  mixins: [ChatModule],
  props: {
    modelValue: String
  },
  data: () => ({
    kEditor: null,
    inputName: '',
    inputValue: '',
    content: `<div id="kEditor1"></div>`,
    editing: `<text-field></text-field>`,
    formValue: {
      id: '',
      type: '',
      name: '',
      alias: '',
      html: ''
    },
    openPanel: false
  }),
  components: {
    DynamicForm,
    FormDefinitionPanel,
    TextField
    // "snippets":Snippets,
    // Containers
  },
  watch: {
    // $route 객체를 감시
    '$route'(to, from) {
      this.removeStylesForKEditor();
      // 경로가 'ui-definitions/'를 포함하는지 확인 후 다시 로드
      if (to.path.includes('ui-definitions/')) {
        this.loadStylesForKEditor();
      }
    }
  },
  methods: {
    loadStylesForKEditor() {
      const cssFiles = [
        '/css/keditor.css',
        '/css/keditor-component-text.css'
      ];

      cssFiles.forEach(cssFile => {
        const styleLink = document.createElement('link');
        styleLink.rel = 'stylesheet';
        styleLink.href = cssFile;
        styleLink.classList.add('keditor-stylesheet'); // 고유 클래스 추가
        document.head.appendChild(styleLink);
      });
    },
    removeStylesForKEditor() {
      // 'keditor-style' 클래스를 가진 모든 <link> 태그를 찾아 제거
      document.querySelectorAll('.keditor-stylesheet').forEach(link => {
        document.head.removeChild(link);
      });
    },

    onchangeKEditor(evt, fnNm) {
      let me = this;

      const kEditorContent = me.kEditor[0].children[0].innerHTML
      this.content = (new DOMParser()).parseFromString(kEditorContent, 'text/html').body.innerHTML

      console.log("save중  ->", fnNm)
      this.$emit('change', {
        kEditorContent: kEditorContent, 
        html: this.kEditorContentToHtml(me.kEditor[0].children[0].innerHTML, false)
      })
    },

    resetStat() {
      let me = this;
      me.kEditor[0].children[0].innerHTML="";
      this.$emit('value', "");
      this.$emit('change', "");
    },

    /**
     * 'Save' 버튼을 누를 경우, 최종 결과를 Supabase에 저장하기 위해서
     */
    async saveFormDefinition(){
      let me = this;

      var putObj = {
        id: me.uuid(),
        name: "test1",
        alias: "alias1",
        html: me.kEditorContentToHtml(me.kEditor[0].children[0].innerHTML)
      }

      await me.putObject("form_def", putObj);
    },

    /**
     * KEditor의 Content를 HTML로 변환하기 위해서
     * @param {*} kEditorContent KEditor 내부의 innerHTML
     * @param {*} isWithSection <section> 태그로 결과를 감싸는지 여부
     */
    kEditorContentToHtml(kEditorContent, isWithSection = true) {
      let parser = new DOMParser();
      let doc = parser.parseFromString(kEditorContent, 'text/html');


      // 렌더링된 Vue 컴포넌트를 찾아서 다시 vue 태그로 되돌리기 위해서
      doc.querySelectorAll("div[id^='vuemount_']").forEach(vueRenderElement => {
        const vueRenderUUID = vueRenderElement.id
        const componentRef = window.componentRefs[vueRenderUUID]

        const newElement = document.createElement(componentRef.tagName)
        newElement.setAttribute('name', componentRef.localName)
        newElement.setAttribute('alias', componentRef.localAlias)
        if(componentRef.localItems) newElement.setAttribute('items', JSON.stringify(componentRef.localItems))

        vueRenderElement.innerHTML = newElement.outerHTML
      })

      // 칼럼이 되는 class를 찾아서 불필요한 클래스 및 속성들을 제거시키기 위해서
      doc.querySelectorAll('[class^="col-sm-"]').forEach(node => {
        const components = Array.from(node.querySelectorAll('*')).filter(el => el.tagName.toLowerCase().endsWith('-field'))
        node.innerHTML = components.map(el => el.outerHTML).join('');

        node.setAttribute("class", node.getAttribute("class").split(" ").filter((className) => className.includes("col-sm-")).join(" "))
        node.removeAttribute('id')
        node.removeAttribute('data-type')
      });

      // Row들을 찾아서 조합시키고 section으로 감싸서 최종적인 저장 형태를 생성하기 위해서
      const formContentHTML = Array.from(doc.querySelectorAll('.row')).map(row => row.outerHTML).join('').replace(/&quot;/g, `'`);
      return (isWithSection) ? `<section>${formContentHTML}</section>` : formContentHTML
    },

    editFormDefinition(newValue) {
      const componentRef = window.componentRefs[newValue.id]
      componentRef.localName = newValue.name
      componentRef.localAlias = newValue.alias
      componentRef.localItems = newValue.items

      this.formValue = { ...newValue }
      this.openPanel = false
    },
    uuid() {
      function s4() {
          return Math.floor((1 + Math.random()) * 0x10000)
              .toString(16)
              .substring(1);
      }

      return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
    },
  },
  mounted() {
    let me = this;
    if (this.$route.path.includes('ui-definitions/')) {
      this.loadStylesForKEditor();
    }
    // let content = localStorage["keditor.editing.content"];
    // console.log("document   ::   ",document.getElementById("keditor-snippets-list"));
    // if (this.value) $('#kEditor1').innerHTML = this.value;
    // if(content) $('#kEditor1').innerHTML(content);
    me.kEditor = $('#kEditor1');
    window.mashup = this
    // if (this.value){
    //   let tempDivElement = document.createElement("div");
    //   tempDivElement.innerHTML = this.value;
    //   me.kEditor.keditor(tempDivElement);
    // } else {
    if (this.modelValue) {
      $(me.kEditor)[0].innerHTML = this.modelValue;
    }

    me.kEditor.keditor({
      // iframeMode: true,
      // snippetsUrl:'./Snippets',
      tabContainersText: '<i class="fa fa-th-list"></i>',
      tabComponentsText: '<i class="fa fa-file"></i>',
      extraTabs: {
        setting: {
          text: '<i class="fa fa-cogs"></i>',
          title: 'Settings',
          content: (
              '<div class="form-horizontal">' +
              '   <button class="btn btn-primary btn-lg" style="width:100%" id="resetBtn">Reset</button>' +
              '</div>'
          )
        }
      },
      niceScrollEnabled: false,
      tabTooltipEnabled: false,
      snippetsTooltipEnabled: false,
      containerSettingEnabled: true,
      onInitSidebar: function (self) {
        const headers = {
          'Content-type': 'html; charset=UTF-8',
          'Accept': '*/*'
        }

       
        const baseUrl = "http://localhost:5173"
        axios.get(`${baseUrl}/snippets/default/snippets.html`, {headers}).then(function (resp) {
          console.log("axios result", resp);

          self.renderSnippets(resp.data);
          self.initSnippets();
          self.initTabs();
          self.initTabsSwitcher();
          self.initSettingPanel();

          if (self.options.snippetsFilterEnabled) {
            self.initSnippetsFilter('Container');
            self.initSnippetsFilter('Component');
          }

          if (self.options.snippetsTooltipEnabled || self.options.tabTooltipEnabled) {
            self.body.find('#' + self.options.snippetsListId).find('[data-toggle="tooltip"]').tooltip();
          }

          // if (typeof self.options.onReady === 'function') {
          //   self.options.onReady.call(self);
          // }
        })
      },
      onReady: function () {
      },
      containerSettingInitFunction: function (form, keditor) {
        $("#resetBtn").on("click", function (e) {
          me.resetStat();
        })
        console.log("containerSettingInitFunction  : ", form, keditor);
        form.append(
            '<div class="form-horizontal">' +
            '   <h3>Here is Setting Container Panel!</h3>' +
            '</div>'
        );
      },
      onInitComponent: function (comp) {
        me.onchangeKEditor(comp, 'onInitComponent');
      },
      containerSettingShowFunction: function (form, container, keditor) {
        console.log("containerSettingShowFunction : ", form, container, keditor);
      },
      containerSettingHideFunction: function (form, keditor) {
        console.log("containerSettingHideFunction : ", form, keditor);
      },

      /**
       * 유저가 컴포넌트 세팅 버튼을 누를 경우, 편집과 관련된 다이얼로그를 보여주기 위해서
       * @param {*} container 선택된 영역에 해당하는 keditor-component section 선택자
       */
      componentSettingShowFunction: function (form, container, keditor) {
        console.log("containerSettingShowFunction : ", form, container, keditor)

        try
        {

          const doc = (new DOMParser()).parseFromString(container[0].innerHTML, 'text/html')


          const vueRenderElement = doc.querySelectorAll("div[id^='vuemount_']")
          if(vueRenderElement.length == 0)
          {
            alert("선택된 컴포넌트가 없습니다.")
            return
          }

          const vueRenderUUID = vueRenderElement[0].id
          const componentRef = window.componentRefs[vueRenderUUID]


          const formValue = {
            id: componentRef.vueRenderUUID, // 추후에 고유값을 통해서 값을 찾기 위해서
            type: componentRef.tagName,
            name: componentRef.localName,
            alias: componentRef.localAlias,
            items: componentRef.localItems
          }

          window.mashup.formValue = { ...formValue }
          window.mashup.openPanel = true

        }
        catch(e)
        {
          console.error(e);
        }
      },

      componentSettingHideFunction: function (form, keditor) {
        console.log("containerSettingHideFunction : ", form, keditor);
      },
      onContentChanged: function (event, snippetContent, vueRenderUUID) {  
        if(vueRenderUUID && vueRenderUUID.includes("vuemount_"))
        {
          const app = createApp(DynamicForm, {content:snippetContent, vueRenderUUID:vueRenderUUID}).use(vuetify).mount('#'+vueRenderUUID);
          window.componentRefs[vueRenderUUID] = app.componentRef;
        }
          
        me.onchangeKEditor(event, 'onContentChanged');
      },
      onComponentChanged: function (event) {
        me.onchangeKEditor(event, 'onComponentChanged');
      },
      initContentAreas: function (self, contentAreas) {
        console.log('initContentAreas', self, contentAreas)
      }
    });

    window.componentRefs = {}
    if (this.modelValue) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(this.modelValue, 'text/html');

      doc.querySelectorAll("div[id^='vuemount_']").forEach(vueRenderElement => {
        const vueRenderUUID = vueRenderElement.id
        const app = createApp(DynamicForm, {content:vueRenderElement.innerHTML, vueRenderUUID:vueRenderUUID}).use(vuetify).mount('#'+vueRenderUUID);
        window.componentRefs[vueRenderUUID] = app.componentRef;
      })
    }
  },
  beforeUnmount() {
    // 컴포넌트가 파괴되기 전에 CSS 제거
    this.removeStylesForKEditor();
  }
}
</script>

<style scoped>
.right-panel {
  position: fixed; /* 패널을 화면 우측에 고정 */
  top: 0; /* 상단에서부터 시작 */
  right: 0; /* 우측에서부터 시작 */
  width: 30%; /* 너비는 화면의 30% */
  height: 100vh; /* 높이는 화면 전체 */
  background-color: #f5f5f5; /* 배경색 설정 */
  padding: 20px; /* 내용과 경계 사이의 여백 */
  box-sizing: border-box; /* 패딩을 포함한 너비 계산 */
  overflow-y: auto; /* 내용이 넘칠 경우 스크롤바 표시 */
  z-index: 999999;
}
</style>