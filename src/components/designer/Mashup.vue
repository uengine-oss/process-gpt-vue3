<template>
  <div>
    <v-btn @click="saveFormDefinition">
      save
    </v-btn>


    <div id="kEditor1">
    </div>
    
    
    <v-dialog v-model="isOpenSettingDialog">
        <form-definition-panel
          :value="componentSettingValue"
          @save="editFormDefinition"
        >
        </form-definition-panel>
    </v-dialog>
  </div>
</template>

<script>
import { createApp } from 'vue';
import axios from 'axios';
import vuetify from "@/plugins/vuetify";
import ChatModule from "@/components/ChatModule.vue";
import FormDefinitionPanel from '@/components/designer/modeling/FormDefinitionPanel.vue';
import DynamicForm from './DynamicForm.vue';

export default {
  name: 'mash-up',
  mixins: [ChatModule],
  props: {
    modelValue: String
  },

  data: () => ({
    kEditor: null,
    kEditorContent: `<div id="kEditor1"></div>`,
    editing: `<text-field></text-field>`,

    componentSettingValue: {
      id: "",
      type: "",
      name: "",
      alias: "",
      items: "",
      label: ""
    },
    isOpenSettingDialog: false
  }),

  components: {
    DynamicForm,
    FormDefinitionPanel
  },

  watch: {
    '$route'(to, from) {
      window.mashup.removeStylesForKEditor();
      // 경로가 'ui-definitions/'를 포함하는지 확인 후 다시 로드
      if (to.path.includes('ui-definitions/')) {
        window.mashup.loadStylesForKEditor();
      }
    }
  },
  methods: {
    onchangeKEditor(evt, fnNm) {
      const kEditorContent = window.mashup.kEditor[0].children[0].innerHTML
      window.mashup.kEditorContent = (new DOMParser()).parseFromString(kEditorContent, 'text/html').body.innerHTML

      console.log("[*] onchangeKEditor 이벤트 => ", fnNm)
      window.mashup.$emit('change', {
        kEditorContent: kEditorContent, 
        html: window.mashup.kEditorContentToHtml(window.mashup.kEditor[0].children[0].innerHTML, false)
      })
    },


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



    resetStat() {
      window.mashup.kEditor[0].children[0].innerHTML="";
      window.mashup.$emit('value', "");
      window.mashup.$emit('change', "");
    },

    /**
     * 'Save' 버튼을 누를 경우, 최종 결과를 Supabase에 저장하기 위해서
     */
    async saveFormDefinition(){
      var putObj = {
        id: "test1",
        name: "test1",
        alias: "alias1",
        html: window.mashup.kEditorContentToHtml(window.mashup.kEditor[0].children[0].innerHTML)
      }

      await window.mashup.putObject("form_def", putObj);
      alert("저장 완료!")
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
        const componentRef = window.mashup.componentRefs[vueRenderUUID]

        const newElement = document.createElement(componentRef.tagName)
        if(componentRef.localName) newElement.setAttribute('name', componentRef.localName)
        if(componentRef.localAlias) newElement.setAttribute('alias', componentRef.localAlias)
        if(componentRef.localItems) newElement.setAttribute('items', JSON.stringify(componentRef.localItems))
        if(componentRef.localLabel) newElement.setAttribute('label', componentRef.localLabel)

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

    /**
     * 유저가 설정창을 통해서 변경한 값을 컴포넌트에 반영시키기 위해서
     * @param {*} newValue 유저가 새롭게 설정한 값
     */
    editFormDefinition(newValue) {
      const componentRef = window.mashup.componentRefs[newValue.id]
      if(newValue.name) componentRef.localName = newValue.name
      if(newValue.alias) componentRef.localAlias = newValue.alias
      if(newValue.items) componentRef.localItems = newValue.items
      if(newValue.label) componentRef.localLabel = newValue.label

      window.mashup.isOpenSettingDialog = false
    },

    /**
     * KEditor를 완전하게 제거시키기 위해서
     */
    completeClearKEditor() {
      document.body.classList.remove('initialized-click-event-handlers')
      document.body.classList.remove('initialized-snippets-list')
      $('.keditor-content-area').remove()
      $(".keditor-ui").remove()
      $('#kEditor1').data('keditor', null)
    }
  },
  mounted() {
    window.mashup = this
    window.mashup.completeClearKEditor()

    if (window.mashup.$route.path.includes('ui-definitions/')) {
      window.mashup.loadStylesForKEditor();
    }

    window.mashup.kEditor = $('#kEditor1');

    if (window.mashup.modelValue) {
      $(window.mashup.kEditor)[0].innerHTML = window.mashup.modelValue;
    }

    window.mashup.kEditor.keditor({
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
        })
      },
      onReady: function () {
      },
      containerSettingInitFunction: function (form, keditor) {
        $("#resetBtn").on("click", function (e) {
          window.mashup.resetStat();
        })
        console.log("containerSettingInitFunction  : ", form, keditor);
        form.append(
            '<div class="form-horizontal">' +
            '   <h3>Here is Setting Container Panel!</h3>' +
            '</div>'
        );
      },
      onInitComponent: function (comp) {
        window.mashup.onchangeKEditor(comp, 'onInitComponent');
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
            alert("선택된 입력 요소가 없습니다.")
            return
          }

          const vueRenderUUID = vueRenderElement[0].id
          const componentRef = window.mashup.componentRefs[vueRenderUUID]


          if(!componentRef.localName && !componentRef.localAlias && !componentRef.localItems && !componentRef.localLabel)
          {
            alert("해당 입력 요소에 대해서 추가적으로 세팅할 수 있는 항목이 없습니다.")
            return
          }


          const componentSettingValue = {
            id: componentRef.vueRenderUUID, // 추후에 고유값을 통해서 값을 찾기 위해서
            type: componentRef.tagName,
            name: componentRef.localName,
            alias: componentRef.localAlias,
            items: componentRef.localItems,
            label: componentRef.localLabel
          }

          window.mashup.componentSettingValue = { ...componentSettingValue }
          window.mashup.isOpenSettingDialog = true

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
          window.mashup.componentRefs[vueRenderUUID] = app.componentRef;
        }
          
        window.mashup.onchangeKEditor(event, 'onContentChanged');
      },
      onComponentChanged: function (event) {
        window.mashup.onchangeKEditor(event, 'onComponentChanged');
      },
      initContentAreas: function (self, contentAreas) {
        console.log('initContentAreas', self, contentAreas)
      }
    });

    window.mashup.componentRefs = {}
    if (window.mashup.modelValue) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(window.mashup.modelValue, 'text/html');

      doc.querySelectorAll("div[id^='vuemount_']").forEach(vueRenderElement => {
        const vueRenderUUID = vueRenderElement.id
        const app = createApp(DynamicForm, {content:vueRenderElement.innerHTML, vueRenderUUID:vueRenderUUID}).use(vuetify).mount('#'+vueRenderUUID);
        window.mashup.componentRefs[vueRenderUUID] = app.componentRef;
      })
    }
  },

  beforeUnmount() {
    // 컴포넌트가 파괴되기 전에 CSS 제거
    window.mashup.removeStylesForKEditor();
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