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
            <v-text-field v-if="value.name !== undefined" label="Name" v-model="value.name"></v-text-field>
            <v-text-field v-if="value.alias !== undefined" label="Alias" v-model="value.alias"></v-text-field>
            <v-text-field v-if="value.label !== undefined" label="Label" v-model="value.label"></v-text-field>
        </v-card-text>

        <div v-if="value.items">
          <v-container>
            <v-row>
              <v-col cols="5" class="d-flex align-center justify-center">
                KEY
              </v-col>
              <v-col cols="5" class="d-flex align-center justify-center">
                VALUE
              </v-col>
              <v-col cols="2" class="d-flex align-center justify-center">
              </v-col>
            </v-row>
            <v-divider class="my-4"></v-divider>

            <v-row v-for="(item, index) in value.items" :key="index">
              <template v-for="(val, key) in item" :key="key">
                <template v-if="index === itemIndexToEdit">
                  <v-col cols="5" class="d-flex align-center justify-center">
                    <v-text-field v-model="keyToEdit"></v-text-field>
                  </v-col>
                  <v-col cols="5" class="d-flex align-center justify-center">
                    <v-text-field v-model="valueToEdit"></v-text-field>
                  </v-col>
                  <v-col cols="2" class="d-flex align-center justify-center">
                    <v-btn @click="itemIndexToEdit = -1">
                      cancel
                    </v-btn>
                    <v-btn @click="editItem(index)">
                      edit
                    </v-btn>
                  </v-col>
                </template>
                <template v-else>
                  <v-col cols="5" class="d-flex align-center justify-center">
                    {{ key }}
                  </v-col>
                  <v-col cols="5" class="d-flex align-center justify-center">
                    {{ val }}
                  </v-col>
                  <v-col cols="2" class="d-flex align-center justify-center">
                    <v-btn @click="itemIndexToEdit = index; keyToEdit = key; valueToEdit = val">
                      edit
                    </v-btn>
                    <v-btn @click="deleteItem(index)">
                      delete
                    </v-btn>
                  </v-col>
                </template>
              </template>
            </v-row>

            <v-row>
              <v-col cols="5" class="d-flex align-center justify-center">
                <v-text-field v-model="keyToAdd"></v-text-field>
              </v-col>
              <v-col cols="5" class="d-flex align-center justify-center">
                <v-text-field v-model="valueToAdd"></v-text-field>
              </v-col>
              <v-col cols="2" class="d-flex align-center justify-center">
                <v-btn @click="addItem">
                  add
                </v-btn>
              </v-col>
            </v-row>
          </v-container>
        </div>

        <v-btn @click="save">
          save
        </v-btn>
    </v-card>
</template>
  
<script>
  export default {
    name: 'form-definition-panel',
    mixins: [],
    props: {
      value: {
        id: String,
        type: String,
        name: String,
        alias: String,
        items: Array,
        label: String
      }
    },
    data: () => ({
      keyToAdd: "",
      valueToAdd: "",

      itemIndexToEdit: -1,
      keyToEdit: "",
      valueToEdit: ""
    }),
    components: {
    },
    methods: {
      save() {
        this.$emit('save', JSON.parse(JSON.stringify(this.value)))
      },

      addItem() {
        this.value.items.push({ [this.keyToAdd]: this.valueToAdd })
        this.keyToAdd = ""
        this.valueToAdd = ""     
      },

      editItem(itemIndexToEdit) {
        this.value.items.splice(itemIndexToEdit, 1, { [this.keyToEdit]: this.valueToEdit })

        this.itemIndexToEdit = -1
        this.keyToEdit = ""
        this.valueToEdit = ""
      },

      deleteItem(itemIndexToDelete) {
        this.value.items.splice(itemIndexToDelete, 1)
      }
    },
    mounted() {}
  }
</script>
  
<style scoped>
  
</style>