<template>
    <v-card
    class="mx-auto my-8"
    elevation="16"
    max-width="600"
    >
        <v-card-item>
        <v-card-title>
            Edit Form Definition
        </v-card-title>
        <v-card-subtitle>
            type: {{ value.type }}
        </v-card-subtitle>
        <v-btn icon style="position:absolute; right:5px; top:5px;" @click="$emit('onClose')">
            <v-icon>mdi-close</v-icon>
        </v-btn>
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
                    <v-sheet class="pb-5">
                      <v-tooltip :text="$t('uiDefinition.cancel')">
                        <template v-slot:activator="{ props }">
                          <v-btn icon flat @click="itemIndexToEdit = -1" v-bind="props">
                            <v-icon style="color: red;">mdi-close</v-icon>
                          </v-btn>
                        </template>
                      </v-tooltip>
                    </v-sheet>

                    <v-sheet class="pb-5">
                      <v-tooltip :text="$t('uiDefinition.edit')">
                        <template v-slot:activator="{ props }">
                          <v-btn icon flat @click="editItem(index)" v-bind="props">
                            <PencilIcon stroke-width="1.5" size="20" class="text-primary" />
                          </v-btn>
                        </template>
                      </v-tooltip>
                    </v-sheet>
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
                    <v-sheet>
                      <v-tooltip :text="$t('uiDefinition.edit')">
                        <template v-slot:activator="{ props }">
                          <v-btn icon flat @click="itemIndexToEdit = index; keyToEdit = key; valueToEdit = val" v-bind="props">
                              <PencilIcon stroke-width="1.5" size="20" class="text-primary" />
                          </v-btn>
                        </template>
                      </v-tooltip>
                    </v-sheet>

                    <v-sheet>
                      <v-tooltip :text="$t('uiDefinition.delete')">
                        <template v-slot:activator="{ props }">
                          <v-btn icon flat @click="deleteItem(index)" v-bind="props">
                              <TrashIcon stroke-width="1.5" size="20" class="text-error" />
                          </v-btn>
                        </template>
                      </v-tooltip>
                    </v-sheet>
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
              <v-col cols="2" class="d-flex align-center justify-center pb-9">
                <v-sheet>
                  <v-tooltip :text="$t('uiDefinition.add')">
                    <template v-slot:activator="{ props }">
                        <v-btn icon flat @click="addItem" v-bind="props">
                          <v-icon style="color: green;" size="40">mdi-plus</v-icon>
                        </v-btn>
                    </template>
                  </v-tooltip>
                </v-sheet>
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
    emits: [
      "onClose",
      "onSave"
    ],
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
        this.$emit('onSave', JSON.parse(JSON.stringify(this.value)))
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