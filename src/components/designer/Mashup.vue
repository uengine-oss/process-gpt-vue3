<template>
  <div>
    <div id="initGuide">
      <span style="font-size: 18px; font-weight: bold;">
        여기에 레이아웃(Container)을 드래그해서 폼 편집을 시작하십시오.
      </span>
    </div>

    <div id="kEditor1" style="position: relative; top: -135px;">
    </div>
    
    
    <v-dialog v-model="isOpenSettingDialog">
        <form-definition-panel
          :componentRef="componentRefForSetting"
          @onSave="editFormDefinition"
          @onClose="isOpenSettingDialog = false"
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
import DynamicComponent from './DynamicComponent.vue';

export default {
  name: 'mash-up',

  mixins: [ChatModule],
  components: {
    DynamicComponent,
    FormDefinitionPanel
  },
  props: {
    modelValue: String
  },
  emits: [
    "onChangeKEditorContent",
    "onSaveFormDefinition"
  ],
  expose: [
    "getKEditorContentHtml"
  ],

  data: () => ({
    kEditor: null,
    kEditorContent: `<div id="kEditor1"></div>`,

    componentRefForSetting: null,
    isOpenSettingDialog: false
  }),

  methods: {
    /**
     * KEditor에 어떠한 변화가 있을 경우, 이를 부모 컴포넌트에 전달하기 위해서
     * [!] 적제된 컴포넌트를 화살표 버튼으로 위치를 이동시켰을 경우, 발생하는 이벤트는 KEditor에 존재하지 않음에 유의
     *  이경우, 노출된 getKEditorContentHtml 함수를 통해서 직접 최신 HTML을 얻을 것
     */
    onchangeKEditor(evt, fnNm) {
      window.mashup.kEditorContent  = window.mashup.kEditor[0].children[0].innerHTML

      console.log("[*] onchangeKEditor 이벤트 => ", fnNm)
      window.mashup.$emit('onChangeKEditorContent', {
        kEditorContent: window.mashup.kEditorContent, 
        html: window.mashup.kEditorContentToHtml(window.mashup.kEditor[0].children[0].innerHTML, false)
      })
    },

    /**
     * KEditor와 관련된 스타일 파일들을 동적으로 추가시키기 위해서
     */
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

    /**
     * KEditor와 관련된 스타일 파일들을 동적으로 삭제시키기 위해서
     */
    removeStylesForKEditor() {
      document.querySelectorAll('.keditor-stylesheet').forEach(link => {
        document.head.removeChild(link);
      });
    },


    /**
     * KEditor를 조작한 모든 내용을 초기화시키기 위해서
     */
    resetStat() {
      window.mashup.kEditor[0].children[0].innerHTML = ""
      window.mashup.kEditorContent = ""
      
      window.mashup.$emit('onChangeKEditorContent', {
        kEditorContent: "", 
        html: ""
      })
    },


    /**
     * KEditor의 content에 대해서 저장되는 HTML 내용을 얻기 위해서
     */
    getKEditorContentHtml() {
      return window.mashup.kEditorContentToHtml(window.mashup.kEditor[0].children[0].innerHTML)
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
        componentRef.settingInfos.forEach(settingInfo => {
          if(settingInfo.settingType === 'items')
            newElement.setAttribute(settingInfo.htmlAttribute, JSON.stringify(componentRef[settingInfo.dataToUse]))
          else
            newElement.setAttribute(settingInfo.htmlAttribute, componentRef[settingInfo.dataToUse])
        })

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
    editFormDefinition(componentRef, componentProps) {
      componentRef.settingInfos.forEach(settingInfo => {
        componentRef[settingInfo.dataToUse] = componentProps[settingInfo.dataToUse]
      })

      window.mashup.isOpenSettingDialog = false
    },

    /**
     * KEditor를 완전하게 제거시키기 위해서
     */
    completeClearKEditor() {
      $("body").off('click', '.btn-container-setting')
      $("body").off('click', '.btn-container-duplicate')
      $("body").off('click', '.btn-container-delete')

      $("body").off('click', '.btn-component-setting')
      $("body").off('click', '.btn-component-duplicate')
      $("body").off('click', '.btn-component-delete')
      $("body").off('dblclick', '.keditor-component')

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
    if (window.mashup.modelValue) 
      $(window.mashup.kEditor)[0].innerHTML = window.mashup.modelValue;


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

        axios.get(`${window.location.origin}/snippets/default/snippets.html`, {headers}).then(function (resp) {
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


      /**
       * 새롭게 컴포넌트를 드래그해서 추가시에 Vue 컴포넌트인 경우, 렌더링을 시키기 위해서
       */
      onContentChanged: function (event, snippetContent, vueRenderUUID) {
        $("#initGuide").css("opacity", "0")

        if(vueRenderUUID && vueRenderUUID.includes("vuemount_"))
        {
          const nameSeq = Object.values(window.mashup.componentRefs).filter(componentRef => componentRef.localName).length + 1
          const snipptDom = new DOMParser().parseFromString(snippetContent, 'text/html')
          snipptDom.body.querySelectorAll("[name]").forEach(
            (el) => el.setAttribute("name", el.getAttribute("name") + `-${nameSeq}`)
          )
          
          const app = createApp(DynamicComponent, {content:snipptDom.body.innerHTML, vueRenderUUID:vueRenderUUID}).use(vuetify).mount('#'+vueRenderUUID);
          window.mashup.componentRefs[vueRenderUUID] = app.componentRef;
        }
          
        window.mashup.onchangeKEditor(event, 'onContentChanged');
      },

      /**
       * 유저가 컴포넌트 세팅 버튼을 누를 경우, 편집과 관련된 다이얼로그를 보여주기 위해서
       * @param {*} container 선택된 영역에 해당하는 keditor-component section 선택자
       */
      componentSettingShowFunction: function (form, container, keditor) {
        console.log("componentSettingShowFunction : ", form, container, keditor)

        try
        {

          const vueRenderElement = (new DOMParser()).parseFromString(container[0].innerHTML, 'text/html')
                                      .querySelectorAll("div[id^='vuemount_']")
          if(vueRenderElement.length == 0)
          {
            alert("선택된 입력 요소가 없습니다.")
            return
          }


          const componentRef = window.mashup.componentRefs[vueRenderElement[0].id]
          if((!(componentRef.settingInfos)) || (componentRef.settingInfos.length <= 0))
          {
            alert("해당 입력 요소에 대해서 추가적으로 세팅할 수 있는 항목이 없습니다.")
            return
          }


          window.mashup.componentRefForSetting = componentRef
          window.mashup.isOpenSettingDialog = true

        }
        catch(e)
        {
          console.error(e);
        }
      },


      onInitComponent: function (comp) {
        window.mashup.onchangeKEditor(comp, 'onInitComponent');
      },
      onComponentChanged: function (event) {
        window.mashup.onchangeKEditor(event, 'onComponentChanged');
      },

      initContentAreas: function (self, contentAreas) {
        console.log('initContentAreas', self, contentAreas)
      },
      componentSettingHideFunction: function (form, keditor) {
        console.log("componentSettingHideFunction : ", form, keditor);
      },
      containerSettingShowFunction: function (form, container, keditor) {
        console.log("containerSettingShowFunction : ", form, container, keditor);
        alert("미구현입니다.")
      },
      containerSettingHideFunction: function (form, keditor) {
        console.log("containerSettingHideFunction : ", form, keditor);
      },

      onReady: function () {
        // 컴포넌트 설정 버튼 클릭시, 오른쪽 설정 패널이 뜨는 버그 수정
        $("#keditor-setting-panel").remove()
      },
    });

    // 처음 로드시에 Vue 컴포넌트들을 각각 별도의 createApp으로 렌더링시키고, 참조자 딕셔너리를 구성하기 위해서
    window.mashup.componentRefs = {}
    if (window.mashup.modelValue) {
      $("#initGuide").css("opacity", "0")
      const parser = new DOMParser();
      const doc = parser.parseFromString(window.mashup.modelValue, 'text/html');

      doc.querySelectorAll("div[id^='vuemount_']").forEach(vueRenderElement => {
        const vueRenderUUID = vueRenderElement.id
        const app = createApp(DynamicComponent, {content:vueRenderElement.innerHTML, vueRenderUUID:vueRenderUUID}).use(vuetify).mount('#'+vueRenderUUID);
        window.mashup.componentRefs[vueRenderUUID] = app.componentRef;
      })
    }
  },

  beforeUnmount() {
    window.mashup.removeStylesForKEditor();
    window.mashup.completeClearKEditor();
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

#initGuide {
  width:100%;
  height: 70px;
  width:100%;
  background-color: whitesmoke;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>