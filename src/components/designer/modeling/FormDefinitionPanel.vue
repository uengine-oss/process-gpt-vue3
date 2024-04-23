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

    <!-- 'text' 유형의 값들을 입력받기 위해서 -->
    <v-card-text>
      <v-text-field v-for="(settingInfo, index) in componentRef.settingInfos.filter(info => info.settingType === 'text')" :key="index"
                    :ref="settingInfo.dataToUse" :label="settingInfo.settingLabel" v-model.trim="componentProps[settingInfo.dataToUse]"
                    @keyup.enter="save" persistent-placeholder></v-text-field>
    </v-card-text>

    <!-- 'items' 유형의 값들을 입력받기 위해서 -->
    <v-card-text>
      <FormDefinitionPanelItemTable v-for="(settingInfo, index) in componentRef.settingInfos.filter(info => info.settingType === 'items')" :key="index"
                                    v-model="componentProps[settingInfo.dataToUse]"></FormDefinitionPanelItemTable>
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
      componentProps: {},

      testItems: []
    }),

    methods: {
      save() {
        for(const info of this.componentRef.settingInfos) {
          if(!info.validCheck) continue

          const errorMessage = info.validCheck(this.componentProps[info.dataToUse])
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
          acc[cur.dataToUse] = this.componentRef[cur.dataToUse]
          return acc
      }, {})

      this.$nextTick(() => {
          if(Object.keys(this.$refs).length > 0)
            this.$refs[Object.keys(this.$refs)[0]][0].focus()
      });
    },
  }
</script>
  
<style scoped>
.centered-input:deep(input) {
  text-align: center
}
</style>