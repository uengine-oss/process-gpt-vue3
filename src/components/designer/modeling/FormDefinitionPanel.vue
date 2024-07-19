<template>
  <v-card class="mx-auto my-8" elevation="16" max-width="600">
    <v-card-item>
      <v-card-title>
          Edit Form Attribute
      </v-card-title>

      <v-card-subtitle>
          type: {{ componentRef.tagName }}
      </v-card-subtitle>
      
      <v-btn icon style="position:absolute; right:5px; top:5px;" @click="$emit('onClose')">
          <v-icon>mdi-close</v-icon>
      </v-btn>
    </v-card-item>

    <v-card-text style="overflow: auto;">
      <template v-for="(settingInfo, index) in componentRef.settingInfos" :key="index">  
        <v-text-field v-if="(settingInfo.settingType === 'text') && isShowCheck(settingInfo)" :ref="settingInfo.dataToUse" 
                      :label="settingInfo.settingLabel" v-model.trim="componentProps[settingInfo.dataToUse]"
                      @keyup.enter="save" persistent-placeholder></v-text-field>
        
        <v-text-field v-else-if="(settingInfo.settingType === 'number') && isShowCheck(settingInfo)" type="number" :ref="settingInfo.dataToUse" 
                      :label="settingInfo.settingLabel" v-model.trim="componentProps[settingInfo.dataToUse]"
                      @keyup.enter="save" persistent-placeholder></v-text-field>
        
        <template v-else-if="(settingInfo.settingType === 'textarea_code') && isShowCheck(settingInfo)">
          <v-label class="text-subtitle-1 font-weight-medium">
            {{ settingInfo.settingLabel }}
            <v-btn icon @click="isHelpDialogOpen = true" style="width: 24px; height: 24px;" class="ml-2">
                <v-icon>mdi-help-circle</v-icon>
            </v-btn>
          </v-label>
          <v-divider class="my-3"/>
          <v-textarea :ref="settingInfo.dataToUse"  v-model.trim="componentProps[settingInfo.dataToUse]"
                      :rows="settingInfo.rows ?? 5" persistent-placeholder></v-textarea>
        </template>

        <v-textarea v-else-if="(settingInfo.settingType === 'textarea') && isShowCheck(settingInfo)" :ref="settingInfo.dataToUse" 
                      :label="settingInfo.settingLabel" v-model.trim="componentProps[settingInfo.dataToUse]"
                      :rows="settingInfo.rows ?? 5" persistent-placeholder></v-textarea>

        <v-select v-else-if="(settingInfo.settingType === 'select') && isShowCheck(settingInfo)" :ref="settingInfo.dataToUse" 
                  :label="settingInfo.settingLabel" v-model="componentProps[settingInfo.dataToUse]"
                  :items="settingInfo.settingValue" @keyup.enter="save" persistent-placeholder></v-select>
        
        <template v-else-if="(settingInfo.settingType === 'items') && isShowCheck(settingInfo)">
          <v-tabs v-model="componentProps['localIsDynamicLoad']" class="text-black" fixed-tabs>
              <v-tab :value="false">Fixed Options</v-tab>
              <v-tab :value="true">Data Binding</v-tab>
          </v-tabs>
          <v-window v-model="componentProps['localIsDynamicLoad']" class="fill-height">
              <v-window-item :value="false" class="fill-height" style="overflow-y: auto">
                <FormDefinitionPanelItemTable v-model="componentProps[settingInfo.dataToUse]"></FormDefinitionPanelItemTable>
              </v-window-item>

              <v-window-item :value="true" class="fill-height pa-5" style="overflow-y: auto">
                <v-text-field label="URL" ref="localDynamicLoadURL" v-model.trim="componentProps['localDynamicLoadURL']" @keyup.enter="save"></v-text-field>
                <v-text-field label="Key JSON Path" ref="localDynamicLoadKeyJsonPath" v-model.trim="componentProps['localDynamicLoadKeyJsonPath']" @keyup.enter="save"></v-text-field>
                <v-text-field label="Value JSON Path" ref="localDynamicLoadValueJsonPath" v-model.trim="componentProps['localDynamicLoadValueJsonPath']" @keyup.enter="save"></v-text-field>
              </v-window-item>
          </v-window>
        </template>
        
        <v-checkbox v-else-if="(settingInfo.settingType === 'checkbox') && isShowCheck(settingInfo)" :ref="settingInfo.dataToUse" 
                    :label="settingInfo.settingLabel" v-model="componentProps[settingInfo.dataToUse]"
                    @keyup.enter="save"></v-checkbox>
      </template>
    </v-card-text>

    <v-btn @click="save">
      Apply
    </v-btn>
  </v-card>

  <v-dialog v-model="isHelpDialogOpen" max-width="600">
        <v-card>
            <v-card-item>
                <v-card-title>
                    {{ 'Code Help' }}
                </v-card-title>
      
                <v-btn icon style="position:absolute; right:5px; top:5px;" @click="isHelpDialogOpen = false">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </v-card-item>

            <v-card-text>
                <h3>- 예제 1: 입력된 폼 내용 출력</h3>
                <p>alert(this.formValues["email"])<br>// "email" Name 속성을 가진 값을 출력</p><br>
                <h3>- 예제 2: 폼 내용을 변경</h3>
                <p>this.formValues["email"] = "new email"<br>// "email" Name 속성을 가진 값을 변경</p><br>
                <h3>- 예제 3: 폼 내용 검사 후 에러메시지 반환</h3>
                <p>if(this.formValues["email"] === "") error = "email is required"<br>
                  // "email" Name 속성을 가진 값이 비어있으면 에러 메시지 반환<br>
                  // "Event Type"이 반드시 "validate"로 설정되어 있어야 함</p><br>
                <h3>- 예제 4: 여러 줄 입력</h3>
                <p>alert("line1");<br>alert("line2");</p>// 여러 줄 입력시 각 라인의 끝에 ";"를 붙여야 함
            </v-card-text>

            <v-card-actions style="justify-content: right;">
                <v-btn @click="isHelpDialogOpen = false" class="w-100" > OK </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>
  
<script>
  import FormDefinitionPanelItemTable from '@/components/designer/modeling/FormDefinitionPanelItemTable.vue'

  export default {
    name: 'form-definition-panel',
    components: {
      FormDefinitionPanelItemTable
    },

    emits: [
      "onClose",
      "onSave"
    ],
    props: {
      componentRef: Object
    },

    data: () => ({
      componentProps: {},
      isHelpDialogOpen: false
    }),

    methods: {
      save() {
        for(const info of this.componentRef.settingInfos) {
          if(!info.validCheck) continue

          const errorMessage = info.validCheck(this.componentProps[info.dataToUse], this.componentProps)
          if(errorMessage) {
            alert(errorMessage)
            if(this.$refs[info.dataToUse])
              this.$refs[info.dataToUse][0].focus()
            
            return
          }
        }

        this.componentRef.settingInfos.forEach(settingInfo => {
          if(settingInfo.addOns && settingInfo.addOns.includes("encodedAsBase64"))
            this.componentProps[settingInfo.dataToUse] = btoa(encodeURIComponent(this.componentProps[settingInfo.dataToUse]))
        })

        this.$emit('onSave', this.componentRef, this.componentProps)
      },

      isShowCheck(settingInfo) {
        if(settingInfo.isShowCheck) return settingInfo.isShowCheck(this.componentProps)
        return true
      }
    },

    mounted() {
      this.componentProps = this.componentRef.settingInfos.reduce((acc, cur) => {
          if(cur.settingType === 'items') {
            acc[cur.dataToUse] = JSON.parse(JSON.stringify(this.componentRef[cur.dataToUse]))
          } else if(cur.addOns && cur.addOns.includes("encodedAsBase64")) {
            acc[cur.dataToUse] = decodeURIComponent(atob(this.componentRef[cur.dataToUse]))
          } else {
            acc[cur.dataToUse] = this.componentRef[cur.dataToUse]
          }
          return acc
      }, {})

      this.$nextTick(() => {
          if(Object.keys(this.$refs).length > 0)
            this.$refs[Object.keys(this.$refs)[0]][0].focus()
      });
    }
  }
</script>
  
<style scoped>
.centered-input:deep(input) {
  text-align: center
}
</style>