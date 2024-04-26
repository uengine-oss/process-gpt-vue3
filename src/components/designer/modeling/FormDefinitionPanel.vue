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

    <v-card-text>
      <template v-for="(settingInfo, index) in componentRef.settingInfos" :key="index">  
        <v-text-field v-if="settingInfo.settingType === 'text'" :ref="settingInfo.dataToUse" 
                      :label="settingInfo.settingLabel" v-model.trim="componentProps[settingInfo.dataToUse]"
                      @keyup.enter="save" persistent-placeholder></v-text-field>
        
        <v-text-field v-else-if="settingInfo.settingType === 'number'" type="number" :ref="settingInfo.dataToUse" 
                      :label="settingInfo.settingLabel" v-model.trim="componentProps[settingInfo.dataToUse]"
                      @keyup.enter="save" persistent-placeholder></v-text-field>

        <v-select v-else-if="settingInfo.settingType === 'select'" :ref="settingInfo.dataToUse" 
                  :label="settingInfo.settingLabel" v-model="componentProps[settingInfo.dataToUse]"
                  :items="settingInfo.settingValue" @keyup.enter="save" persistent-placeholder></v-select>

        <FormDefinitionPanelItemTable v-else-if="settingInfo.settingType === 'items'"
                                      v-model="componentProps[settingInfo.dataToUse]"></FormDefinitionPanelItemTable>
        
        <v-checkbox v-else-if="settingInfo.settingType === 'checkbox'" :ref="settingInfo.dataToUse" 
                    :label="settingInfo.settingLabel" v-model="componentProps[settingInfo.dataToUse]"
                    @keyup.enter="save"></v-checkbox>
      </template>
    </v-card-text>

    <v-btn @click="save">
      Apply
    </v-btn>
  </v-card>
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
      componentProps: {}
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

        this.$emit('onSave', this.componentRef, this.componentProps)
      }
    },

    mounted() {
      this.componentProps = this.componentRef.settingInfos.reduce((acc, cur) => {
          if(cur.settingType === 'items') {
            acc[cur.dataToUse] = JSON.parse(JSON.stringify(this.componentRef[cur.dataToUse]))
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