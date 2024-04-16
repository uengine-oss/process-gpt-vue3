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
            <v-text-field v-if="value.name !== undefined" ref="inputName" label="Name" v-model.trim="value.name"
                          :rules="[v => !!v || 'Name is required']" required @keyup.enter="save" persistent-placeholder @input="onInputName"></v-text-field>
            <v-text-field v-if="value.alias !== undefined" ref="inputAlias" label="Alias" v-model.trim="value.alias" @keyup.enter="save"
                          :placeholder="placeholder.alias" persistent-placeholder></v-text-field>
            <v-text-field v-if="value.label !== undefined" ref="inputLabel" label="Label" v-model.trim="value.label"
                          :rules="[v => !!v || 'Label is required']" required @keyup.enter="save" persistent-placeholder></v-text-field>
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
                    <v-text-field class="centered-input" label="Key" v-model.trim="keyToEdit"
                                  :rules="[v => !!v || 'Key is required']" required @keyup.enter="editItem(index)"
                                  @input="onInputKeyToEdit" persistent-placeholder></v-text-field>
                  </v-col>
                  <v-col cols="5" class="d-flex align-center justify-center">
                    <v-text-field class="centered-input" label="Value" v-model.trim="valueToEdit" @keyup.enter="editItem(index)"
                                  :placeholder="placeholder.valueToEdit" persistent-placeholder></v-text-field>
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
                          <v-btn icon flat @click="itemIndexToEdit = index; keyToEdit = key; valueToEdit = val; placeholder.valueToEdit = key" v-bind="props">
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
                <v-text-field ref="inputKeyToAddItem" class="centered-input" label="Key" v-model.trim="keyToAdd" @keyup.enter="addItem"
                              @input="onInputKeyToAdd" persistent-placeholder></v-text-field>
              </v-col>
              <v-col cols="5" class="d-flex align-center justify-center">
                <v-text-field class="centered-input" label="Value" v-model.trim="valueToAdd" @keyup.enter="addItem"
                              :placeholder="placeholder.valueToAdd" persistent-placeholder></v-text-field>
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
      /** {
        id: String,
        type: String,
        name: String,
        alias: String,
        items: Array,
        label: String
      }
      */
      value: Object 
    },
    data: () => ({
      keyToAdd: "",
      valueToAdd: "",

      itemIndexToEdit: -1,
      keyToEdit: "",
      valueToEdit: "",

      initialValue: {}, // 초기에 해당 속성을 가지고 있는 경우에만 유효성을 검사시키기 위해서

      regexStr: /^[가-힣a-zA-Z0-9_\-. ]+$/,
      regexErrorMsg: "'{{propName}}'은 한글, 영문, 숫자, 공백, 밑줄(_), 대시(-), 점(.) 만 입력 가능합니다!",

      placeholder: {
        alias: "",
        valueToAdd: "",
        valueToEdit: ""
      }
    }),
    components: {
    },
    methods: {
      save() {
        //#region 유효성 검사
        if(this.initialValue.name && (!(this.value.name) || this.value.name.length <= 0)) {
          alert("Name is required")
          this.$refs.inputName.focus();
          return
        }
        if(this.initialValue.name && !this.regexStr.test(this.value.name)) {
          alert(this.regexErrorMsg.replace("{{propName}}", "Name"))
          this.$refs.inputName.focus();
          return
        }

        if(this.initialValue.label && (!(this.value.label) || this.value.label.length <= 0)) {
          alert("Label is required")
          this.$refs.inputLabel.focus();
          return
        }

        if(this.initialValue.alias && this.value.alias && this.value.alias.length > 0) {
          if(!this.regexStr.test(this.value.alias)) {
            alert(this.regexErrorMsg.replace("{{propName}}", "Alias"))
            this.$refs.inputAlias.focus();
            return
          }
        }
        //#endregion
        //#region 입력값 처리
        if(this.initialValue.alias && (!(this.value.alias) || this.value.alias.length <= 0)) {
            this.value.alias = this.value.name
            this.$refs.inputAlias.focus();
        }
        //#endregion

        this.$emit('onSave', JSON.parse(JSON.stringify(this.value)))
      },

      addItem() {
        //#region 유효성 검사
        if(!(this.keyToAdd) || this.keyToAdd.length <= 0) {
          alert("Key is required")
          return
        }
        if(!this.regexStr.test(this.keyToAdd)) {
            alert(this.regexErrorMsg.replace("{{propName}}", "Key"))
            return
        }
        if(this.value.items.some(item => item.hasOwnProperty(this.keyToAdd))) {
          alert("Key already exists")
          return
        }

        if(this.valueToAdd && this.valueToAdd.length > 0) {
          if(!this.regexStr.test(this.valueToAdd)) {
            alert(this.regexErrorMsg.replace("{{propName}}", "Value"))
            return
          }
        }
        //#endregion
        //#region 입력값 처리
        if(!(this.valueToAdd) || this.valueToAdd.length <= 0) {
            this.valueToAdd = this.keyToAdd
        }
        //#endregion

        this.value.items.push({ [this.keyToAdd]: this.valueToAdd })
        this.keyToAdd = ""
        this.valueToAdd = ""   
        this.placeholder.valueToAdd = ""
        
        this.$nextTick(() => {
            this.$refs.inputKeyToAddItem.focus();
        });
      },

      editItem(itemIndexToEdit) {
        //#region 유효성 검사
        if(!(this.keyToEdit) || this.keyToEdit.length <= 0) {
          alert("Key is required")
          return
        }
        if(!this.regexStr.test(this.keyToEdit)) {
            alert(this.regexErrorMsg.replace("{{propName}}", "Key"))
            return
        }

        // 키가 기존의 값과 달라진 경우에만 중복 여부를 검사하기 위해서
        if(!(this.value.items[itemIndexToEdit].hasOwnProperty(this.keyToEdit))) {
          if(this.value.items.some(item => item.hasOwnProperty(this.keyToEdit))) {
            alert("Key already exists")
            return
          }
        }

        if(this.valueToEdit && this.valueToEdit.length > 0) {
          if(!this.regexStr.test(this.valueToEdit)) {
            alert(this.regexErrorMsg.replace("{{propName}}", "Value"))
            return
          }
        }
        //#endregion
        //#region 입력값 처리
        if(!(this.valueToEdit) || this.valueToEdit.length <= 0) {
            this.valueToEdit = this.keyToEdit
        }
        //#endregion

        this.value.items.splice(itemIndexToEdit, 1, { [this.keyToEdit]: this.valueToEdit })

        this.itemIndexToEdit = -1
        this.keyToEdit = ""
        this.valueToEdit = ""
        this.placeholder.valueToEdit = ""
      },

      deleteItem(itemIndexToDelete) {
        this.value.items.splice(itemIndexToDelete, 1)
      },


      onInputName() {
        if(this.value.name.length > 0)
            this.placeholder.alias = this.value.name
        else
            this.placeholder.alias = this.initialValue.name
      },

      onInputKeyToAdd() {
        this.placeholder.valueToAdd = this.keyToAdd
      },

      onInputKeyToEdit() {
        this.placeholder.valueToEdit = this.keyToEdit
      }
    },
    created() {
      this.initialValue = JSON.parse(JSON.stringify(this.value))

      if(this.initialValue.name)
        this.placeholder.alias = this.initialValue.name
    },
    mounted() {
        this.$nextTick(() => {
            this.$refs.inputName.focus();
        });
    },
  }
</script>
  
<style scoped>
.centered-input:deep(input) {
  text-align: center
}
</style>