<template>
  <div>
    <v-btn @click="saveFormDefinition">
      save
    </v-btn>

    <div id="kEditor1">
    </div>
    <dynamic-form :content="content"></dynamic-form>
    
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
import { createApp } from 'vue';
import TextField from '../ui/TextField.vue';
import axios from 'axios';
import DynamicForm from './DynamicForm.vue';
import ChatModule from "@/components/ChatModule.vue";
import { Vue } from 'vue-demi';
import { diffDates } from '@fullcalendar/vue3';
import FormDefinitionPanel from '@/components/designer/modeling/FormDefinitionPanel.vue';

export default {
  name: 'mash-up',
  mixins: [ChatModule],
  props: {
    // value:String,
    value: {
      required: true,
      type: String,
      default: ''
    }
  },
  data: () => ({
    kEditor: null,
    inputName: '',
    inputValue: '',
    content: `<div id="kEditor1"></div>`,
    formValue: {
      id: '',
      type: '',
      name: '',
      alias: '',
      html: ''
    },
    openPanel: false,
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
      // alert(fnNm);
      let newValue = me.kEditor[0].children[0].innerHTML;

      let parser = new DOMParser();
      let doc = parser.parseFromString(newValue, 'text/html');

      // doc.querySelectorAll('[placeholder]').forEach(el => el.remove());

      this.content = doc.body.innerHTML;

      // this.content = newValue;
      // me.value = newValue
      console.log("save중  ->", fnNm);
      this.$emit('value', newValue);
      this.$emit('change', newValue);
    },
    resetStat() {
      let me = this;
      me.kEditor[0].children[0].innerHTML="";
      this.$emit('value', "");
      this.$emit('change', "");
    },
    async saveFormDefinition(){
      let me = this;

      var formName = "test1";
      var alias = "alias1"

      let formContent = me.kEditor[0].children[0].innerHTML;

      let parser = new DOMParser();
      let doc = parser.parseFromString(formContent, 'text/html');

      var putObj = {}

      putObj.id = me.uuid();
      putObj.name = formName;
      putObj.alias = alias;
      putObj.html = doc.documentElement.outerHTML
      putObj.fields = [];

      // name이 formDesigner인 div 내의 요소 Get
      let formDesignerElements = doc.querySelectorAll('div[name="formDesigner"] > *');
      formDesignerElements.forEach(element => {
        putObj.fields.push({
          id: element.id || '',
          type: element.type || '',
          name: element.name || '',
          alias: element.getAttribute('data-alias') || '',
          html: element.outerHTML || ''
        });
      });


      // var path = `form_def/${putObj.name+"_"+putObj.alias}`;
      var path = 'form_def';
      await me.putObject(path, putObj);
    },
    editFormDefinition(newValue) {
      let domHtml = this.kEditor[0].children[0].innerHTML
    
      // DOMParser를 사용하여 HTML 문자열을 DOM 객체로 변환
      let parser = new DOMParser();
      let doc = parser.parseFromString(domHtml, 'text/html');

      // id가 newValue.id인 section 태그 내의 name이 formDesigner인 div를 찾음
      let formDesignerDiv = doc.querySelector(`section#${newValue.id} div[name="formDesigner"]`);

      if (formDesignerDiv) {
        // formDesignerDiv 내의 요소들을 찾아 name과 alias를 newValue의 값으로 변경
        formDesignerDiv.querySelectorAll('*').forEach(element => {
          if (element.name) {
            element.id = newValue.id
            element.name = newValue.name;
            element.setAttribute('data-alias', newValue.alias); // alias는 표준 속성이 아니므로 setAttribute 사용
          }
        });

        // 변경된 DOM 객체를 다시 HTML 문자열로 변환
        let newDomHtml = doc.body.innerHTML;

        // kEditor의 HTML을 업데이트
        this.kEditor[0].children[0].innerHTML = newDomHtml;
      }

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
    if (this.value) {
      $(me.kEditor)[0].innerHTML = this.value;
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
        // Vue.createApp({
        //     components: {
        //       'text-field': TextField
        //     }
        //   }).mount('#kEditor1')
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
      componentSettingShowFunction: function (form, container, keditor) {
        console.log("containerSettingShowFunction : ", form, container, keditor);

        let formHtml = container[0].innerHTML

        let parser = new DOMParser();
        let doc = parser.parseFromString(formHtml, 'text/html');

        // name이 formDesigner인 div 내의 요소 Get
        let formDesignerElements = doc.querySelectorAll('div[name="formDesigner"] > *');
        
        let formValue = {
          id: doc.querySelector('section.keditor-ui.keditor-component-content').id,
          type: '',
          name: '',
          alias: '',
          html: ''
        }

        if (formDesignerElements) {
          formValue.type = formDesignerElements[0].type
          formValue.name = formDesignerElements[0].name
          formValue.alias = formDesignerElements[0].getAttribute('data-alias')
          formValue.html = formDesignerElements[0].outerHTML
        } 

        window.mashup.formValue = { ...formValue }
        window.mashup.openPanel = true
      },
      componentSettingHideFunction: function (form, keditor) {
        console.log("containerSettingHideFunction : ", form, keditor);
      },
      onContentChanged: function (event) {
        me.onchangeKEditor(event, 'onContentChanged');
      },
      onComponentChanged: function (event) {
        me.onchangeKEditor(event, 'onComponentChanged');
      },
      initContentAreas: function (self, contentAreas) {
        console.log('initContentAreas', self, contentAreas)
      }
    });
    // }
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