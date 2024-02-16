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
                <v-textarea v-if="processVariable.datasource?.type == 'sql'"
                    v-model="processVariable.datasource.sql"></v-textarea>
                <v-btn style="margin-left: 5px;" color="primary" v-if="processVariable.datasource?.type == 'sql'" size="small" @click="generateSql()">generate</v-btn>
                <v-btn style="margin-left: 5px;" color="success" v-if="processVariable.datasource?.type == 'sql'" size="small" @click="testSql()">test</v-btn>
            </v-row>
            <v-row class="ma-0">
                <v-spacer></v-spacer>
                <v-btn color="primary" rounded="pill" @click="addVariable">Add</v-btn>
            </v-row>
        </v-col>
    </v-row>
</template>
<script>
import axios from 'axios';
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
        async generateSql() {
            try {
                const response = await axios.post('http://localhost:8001/process-var-sql/invoke', {
                    input: {
                        var_name: this.processVariable.name,
                        resolution_rule: this.processVariable.description
                    }
                });
                this.processVariable.datasource.sql = response.data.output;
            } catch (error) {
                console.error('Error generating SQL:', error);
            }
        },
        async testSql() {
            try {
                const response = await axios.post('http://localhost:8001/execute-sql', {
                    sql_query: this.processVariable.datasource.sql
                });
                console.log('SQL Test Response:', response.data);
                alert("Success to SQL Test")
                // this.$emit('sqlTestSuccess', response.data);
            } catch (error) {
                alert("Failed to SQL Test")
                console.error('Error testing SQL:', error);
                // this.$emit('sqlTestError', error);
            }
        },
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