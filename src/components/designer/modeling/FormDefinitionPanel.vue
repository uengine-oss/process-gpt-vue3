<template>
    <v-card
    class="mx-auto my-8"
    elevation="16"
    max-width="344"
    >
        <v-card-item>
        <v-card-title>
            Edit Form Definition
        </v-card-title>
        <v-card-subtitle>
            type: {{ value.type }}
        </v-card-subtitle>
        </v-card-item>

        <v-card-text>
            <v-text-field label="Name" v-model="value.name"></v-text-field>
            <v-text-field label="Alias" v-model="value.alias"></v-text-field>
        </v-card-text>

        <div v-if="value.type === 'checkbox' || value.type === 'radio'">
          <v-list :items="items"></v-list>
          <v-text-field v-model="addValue"></v-text-field>
        </div>

        <v-btn @click="save">
          save
        </v-btn>
    </v-card>
</template>
  
<script>
  import { createApp } from 'vue';
  export default {
    name: 'form-definition-panel',
    mixins: [],
    props: {
      value: {
        id: String,
        type: String,
        name: String,
        alias: String,
        html: String
      }
    },
    data: () => ({
      items: ["value1", "value2"],
      addValue: ""
    }),
    components: {
    },
    methods: {
      save() {
        this.$emit('save', JSON.parse(JSON.stringify(this.value)))
      }
    },
    mounted() {}
  }
</script>
  
<style scoped>
  
</style>