<template>
  <v-card class="mx-auto my-8 container-setting-box" elevation="16" max-width="600">
    <v-card-item>
      <v-card-title>
          Edit Container Attribute
      </v-card-title>
      
      <v-icon @click="$emit('onClose')" class="form-dialog-close-btn">mdi-close</v-icon>
    </v-card-item>

    <v-card-text>
      <v-text-field ref="name" label="Name" v-model.trim="localContainerProps.name"
                      @keyup.enter="save" persistent-placeholder></v-text-field>
      
      <v-text-field label="Label" v-model.trim="localContainerProps.alias"
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
        if(this.localContainerProps.isMultiDataMode) {
          if(!this.localContainerProps.name || this.localContainerProps.name.length <= 0) {
            alert('Name is required');
            this.$refs.name.focus();
            return;
          }
        }

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
  text-align: center;
  margin-right:5px;
}
</style>