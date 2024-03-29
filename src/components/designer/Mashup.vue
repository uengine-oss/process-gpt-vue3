<template>
  <div>
    <div id="kEditor1">
    </div>
    <dynamic-form :content="content"></dynamic-form>
    
    <v-dialog v-model="editNameAndValue">
        <v-card
          title="Edit name / value"
          width="400"
        >
          <v-text-field label="Name" v-model="inputName"></v-text-field>
          <v-text-field label="Value" v-model="inputValue"></v-text-field>
          <v-btn @click="setNameAndValue">
            save
          </v-btn>
        </v-card>
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
import { Vue } from 'vue-demi';
export default {
  name: 'mash-up',
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
    editNameAndValue: false,
    inputName: '',
    inputValue: '',
    content: `<div id="kEditor1"></div>`
  }),
  components: {
    DynamicForm,
    TextField
    // "snippets":Snippets,
    // Containers
  },
  methods: {
    onchangeKEditor(evt, fnNm) {
      let me = this;
      // alert(fnNm);
      let newValue = me.kEditor[0].children[0].innerHTML;

      let parser = new DOMParser();
      let doc = parser.parseFromString(newValue, 'text/html');

      if(evt.type === 'dblclick'){
        doc.querySelectorAll('[placeholder]').forEach(el => {
          me.inputName = el.name;
          me.inputValue = el.value;
        });
        me.editNameAndValue = true;
      }

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
    setNameAndValue(){
      let me = this;

      let newValue = me.kEditor[0].children[0].innerHTML;

      let parser = new DOMParser();
      let doc = parser.parseFromString(newValue, 'text/html');

      doc.querySelectorAll('[placeholder]').forEach(el => {
        // Update the name and value of the element with the values from me.inputName and me.inputValue
        el.setAttribute('name', me.inputName);
        el.setAttribute('value', me.inputValue);
        el.textContent = me.inputName;
        el.removeAttribute('placeholder')

        if (el.tagName.toLowerCase() === 'input' && el.nextSibling && el.nextSibling.nodeType === Node.TEXT_NODE) {
          el.nextSibling.nodeValue = me.inputName;
        }
      });

      // Update the innerHTML of kEditor with the modified HTML
      newValue = doc.body.innerHTML;
      me.kEditor[0].children[0].innerHTML = newValue;
      me.editNameAndValue = false;
    }
  },
  mounted() {
    let me = this;
    // let content = localStorage["keditor.editing.content"];
    // console.log("document   ::   ",document.getElementById("keditor-snippets-list"));
    // if (this.value) $('#kEditor1').innerHTML = this.value;
    // if(content) $('#kEditor1').innerHTML(content);
    me.kEditor = $('#kEditor1');
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
  }
}
</script>

<style scoped>


</style>