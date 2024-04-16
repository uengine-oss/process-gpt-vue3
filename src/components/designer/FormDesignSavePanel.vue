<template>
    <v-card
    class="mx-auto my-8"
    elevation="16"
    max-width="400"
    >
        <v-card-title class="ma-0 pa-0" style="padding: 15px 0px 0px 25px !important;">{{ "NewForm" }}</v-card-title>
        <v-btn icon style="position:absolute; right:5px; top:5px;" @click="$emit('onClose')">
            <v-icon>mdi-close</v-icon>
        </v-btn>

        <v-card-text>
            <v-col>
                <v-text-field ref="inputId" v-model.trim="infoToSave.id" label="ID"
                    :rules="[v => !!v || 'ID is required']" required @keyup.enter="save"></v-text-field>
                <v-text-field v-model.trim="infoToSave.name" label="Name" @keyup.enter="save"></v-text-field>
            </v-col>
        </v-card-text>

        <v-card-actions style="justify-content: right;">
            <v-btn @click="save"> SAVE </v-btn>
        </v-card-actions>
    </v-card>
</template>

<script>
export default {
    name: 'FormDesignSavePanel',
    emits: [
        "onClose",
        "onSave"
    ],
    data: () => ({
        infoToSave: {
            id: "",
            name: ""
        },

        regexStr: /^[가-힣a-zA-Z0-9_\-. ]+$/,
        regexErrorMsg: "'{{propName}}'은 한글, 영문, 숫자, 공백, 밑줄(_), 대시(-), 점(.) 만 입력 가능합니다!"
    }),
    methods: {
        save() {
            //#region 유효성 검사
            if(!(this.infoToSave.id) || this.infoToSave.id.length <= 0) {
                alert("ID is required")
                return
            }
            if(!this.regexStr.test(this.infoToSave.id)) {
                alert(this.regexErrorMsg.replace("{{propName}}", "ID"))
                return
            }
            if(this.infoToSave.name && this.infoToSave.name.length > 0) {
                if(!this.regexStr.test(this.infoToSave.name)) {
                    alert(this.regexErrorMsg.replace("{{propName}}", "Name"))
                    return
                }
            }
            //#endregion
            //#region 입력값 처리
            if(!(this.infoToSave.name) || this.infoToSave.name.length <= 0) {
                this.infoToSave.name = this.infoToSave.id
            }
            //#endregion

            this.$emit('onSave', this.infoToSave)
        }
    },
    mounted() {
        this.$nextTick(() => {
            this.$refs.inputId.focus();
        });
    },
};
</script>
