<template>
    <v-row class="ma-0">
        <v-col cols="12">
            <v-row class="align-center mb-3">
                <v-col cols="12" sm="3" class="pb-sm-3 pb-0">
                    <v-label class=" font-weight-medium" for="hbnm">Name</v-label>
                </v-col>
                <v-col cols="12" sm="9">
                    <v-text-field v-model="processVariable.name" color="primary" variant="outlined" type="text" id="hbnm"
                        hide-details />
                </v-col>
            </v-row>
            <v-row class="align-center mb-3">
                <v-col cols="12" sm="3" class="pb-sm-3 pb-0">
                    <v-label class=" font-weight-medium" for="hcpm">Type</v-label>
                </v-col>
                <v-col cols="12" sm="9">
                    <v-autocomplete v-model="processVariable.type" :items="types" color="primary" variant="outlined"
                        hide-details></v-autocomplete>
                </v-col>
            </v-row>
            <v-row class="align-center mb-3">
                <v-col cols="12" sm="3" class="pb-sm-3 pb-0">
                    <v-label class=" font-weight-medium" for="hem">Description</v-label>
                </v-col>
                <v-col cols="12" sm="9">
                    <v-text-field v-model="processVariable.description" color="primary" variant="outlined" id="hem"
                        type="text" hide-details />
                </v-col>
            </v-row>
            <v-row class="align-center mb-3">
                <v-col cols="12" sm="3" class="pb-sm-3 pb-0">
                    <v-label class=" font-weight-medium" for="hph">DataSource</v-label>
                </v-col>
                <v-col cols="12" sm="9">
                    <v-autocomplete v-model="processVariable.datasource.type" :items="datasources" color="primary"
                        variant="outlined" hide-details></v-autocomplete>
                </v-col>
                <v-text-field v-if="processVariable.datasource?.type == 'sql'"
                    v-model="processVariable.datasource.sql"></v-text-field>
            </v-row>
            <v-row class="ma-0">
                <v-spacer></v-spacer>
                <v-btn color="primary" rounded="pill" @click="addVariable">Add</v-btn>
            </v-row>
        </v-col>
    </v-row>
</template>
<script>
export default {
    name: 'ProcessVariable',
    props: {
        variable: Object
    },
    data() {
        return {
            datasources: ["bpmn", "sql"],
            types: ["Text", "Number", "Date", "Attachment"],
            processVariable: {
                name: "",
                type: "",
                description: "",
                datasource: {
                    type: "",
                    sql: ""
                }
            }
        }
    },
    methods: {
        addVariable() {
            this.$emit("addVariables", this.processVariable)
            this.$emit("updateVariables", this.processVariable)
        }
    },
    mounted() {
        if (this.variable) {
            if (!this.variable.datasource) {
                this.variable.datasource = {
                    type: "bpmn",
                    sql: ""
                }
            }
            this.processVariable = Object.assign({}, this.variable)
        }
    }

    // components: {

    // },
}
</script>