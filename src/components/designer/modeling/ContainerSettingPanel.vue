<template>
  <v-card class="mx-auto my-8" elevation="16" max-width="600">
    <v-card-item>
      <v-card-title>
          Edit Container Attribute
      </v-card-title>
      
      <v-btn icon style="position:absolute; right:5px; top:5px;" @click="$emit('onClose')">
          <v-icon>mdi-close</v-icon>
      </v-btn>
    </v-card-item>

    <v-card-text>
      <v-text-field ref="name" label="Name" v-model.trim="localContainerProps.name"
                      @keyup.enter="save" persistent-placeholder></v-text-field>
      
      <v-text-field label="Alias" v-model.trim="localContainerProps.alias"
                      @keyup.enter="save" persistent-placeholder></v-text-field>
        
      <v-checkbox label="MultiDataMode" v-model="localContainerProps.isMultiDataMode"
                  @keyup.enter="save"></v-checkbox>
    </v-card-text>

    <v-btn @click="save">
      Apply
    </v-btn>
  </v-card>
</template>
  
<script>
  export default {
    name: 'container-setting-panel',

    emits: [
      "onClose",
      "onSave"
    ],
    props: {
      sectionId: String,
      containerProps: Object // {name, alias, isMultiDataMode}
    },

    data: () => ({
      localContainerProps: null
    }),

    watch: {
      containerProps: {
        deep: true,
        handler(newVal) {
          this.localContainerProps = {...newVal};
        }
      }
    },

    created() {
      this.localContainerProps = {...this.containerProps};
    },

    methods: {
      save() {
        this.$emit('onSave', this.sectionId, this.localContainerProps)
      }
    },

    mounted() {
      this.$nextTick(() => {
        this.$refs.name.focus()
      });
    }
  }
</script>
  
<style scoped>
.centered-input:deep(input) {
  text-align: center
}
</style>