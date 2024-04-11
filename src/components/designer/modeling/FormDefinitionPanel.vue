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

        <div v-if="value.items">
          <v-container>
            <v-row>
              <v-col cols="6" class="d-flex align-center justify-center">
                KEY
              </v-col>
              <v-col cols="6" class="d-flex align-center justify-center">
                VALUE
              </v-col>
            </v-row>
            <v-divider class="my-4"></v-divider>

            <v-row v-for="(item, index) in value.items" :key="index">
              <template v-for="(val, key) in item" :key="key">
                <v-col cols="6" class="d-flex align-center justify-center">
                  {{ key }}
                </v-col>
                <v-col cols="6" class="d-flex align-center justify-center">
                  {{ val }}
                </v-col>
              </template>
            </v-row>

            <v-row>
              <v-col cols="6" class="d-flex align-center justify-center">
                <v-text-field v-model="addKey"></v-text-field>
              </v-col>
              <v-col cols="6" class="d-flex align-center justify-center">
                <v-text-field v-model="addValue"></v-text-field>
              </v-col>
            </v-row>

            <v-row>
              <v-btn @click="addItem">
                add
              </v-btn>
            </v-row>
          </v-container>
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
        items: Array
      }
    },
    data: () => ({
      addKey: "",
      addValue: "",
    }),
    components: {
    },
    methods: {
      save() {
        this.$emit('save', JSON.parse(JSON.stringify(this.value)))
      },

      addItem() {
        this.value.items.push({ [this.addKey]: this.addValue })
        this.addKey = ""
        this.addValue = ""     
      }
    },
    mounted() {}
  }
</script>
  
<style scoped>
  
</style>