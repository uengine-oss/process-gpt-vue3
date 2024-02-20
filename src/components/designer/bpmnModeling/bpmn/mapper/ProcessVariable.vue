<template>
    <v-row class="ma-0">
        <v-col cols="12">
            <v-row class="align-center ">
                <v-col cols="12" sm="3" class="pb-sm-3 pb-0">
                    <v-label class=" font-weight-medium" for="hbnm">{{ $t('ProcessVariable.name') }}</v-label>
                </v-col>
                <v-col cols="12" sm="9">
                    <v-text-field v-model="processVariable.name" color="primary" variant="outlined" type="text" id="hbnm"
                        hide-details />
                </v-col>
            </v-row>
            <v-row class="align-center">
                <v-col cols="12" sm="3" class="pb-sm-3 pb-0">
                    <v-label class=" font-weight-medium" for="hcpm">{{ $t('ProcessVariable.type') }}</v-label>
                </v-col>
                <v-col cols="12" sm="9">
                    <v-autocomplete v-model="processVariable.type" :items="types" color="primary" variant="outlined"
                        hide-details></v-autocomplete>
                </v-col>
            </v-row>
            <v-row class="align-center">
                <v-col cols="12" sm="3" class="pb-sm-3 pb-0">
                    <v-label class=" font-weight-medium" for="hem">{{ $t('ProcessVariable.description') }}</v-label>
                </v-col>
                <v-col cols="12" sm="9">
                    <v-text-field v-model="processVariable.description" color="primary" variant="outlined" id="hem"
                        type="text" hide-details />
                </v-col>
            </v-row>
            <v-row class="align-center">
                <v-col cols="12" sm="3" class="pb-sm-3 pb-0">
                    <v-label class=" font-weight-medium" for="hph">{{ $t('ProcessVariable.dataSource') }}</v-label>
                </v-col>
                <v-col cols="12" sm="9">
                    <v-autocomplete v-model="processVariable.datasource.type" :items="datasources" color="primary"
                        variant="outlined" hide-details></v-autocomplete>
                </v-col>
                <v-col cols="12">
                    <v-textarea v-if="processVariable.datasource?.type == 'SQL'"
                        v-model="processVariable.datasource.sql"
                    ></v-textarea>
<v-btn v-if="processVariable.datasource?.type == 'SQL'" variant="outlined" color="primary" rounded="pill"  size="small" @click="generateSql()">generate</v-btn>
                    <v-btn style="margin-left: 5px;" color="success" variant="outlined" rounded="pill" v-if="processVariable.datasource?.type == 'SQL'" size="small" @click="testSql()">test</v-btn>
                    <v-row v-if="processVariable.table" class="my-5">
                        <v-col cols="12">
                            <v-card outlined>
                                <v-card-title>Table Preview</v-card-title>
                                <v-card-text>
                                    <div v-html="processVariable.table" class="table-responsive"></div>
                                </v-card-text>
                                <!-- <v-textarea v-if="processVariable.table != ''" style="margin-top: 10px;"
                                    v-model="processVariable.table"
                                ></v-textarea> -->
                            </v-card>
                        </v-col>
                    </v-row>
                </v-col>
            </v-row>
            <v-row class="ma-0 mt-2">
                <v-spacer></v-spacer>
                <v-btn v-if="mode === 'add'" color="primary" rounded="pill" @click="addVariable">{{ $t('ProcessVariable.add') }}</v-btn>
                <v-btn v-else color="primary" rounded="pill" >{{ $t('ProcessVariable.edit') }}</v-btn>
            </v-row>
        </v-col>
    </v-row>
</template>
<script>
import axios from 'axios';
export default {
    name: 'ProcessVariable',
    props: {
        mode: {
            type: String,
            default: 'add'
        },
        variable: Object
    },
    data() {
        return {
            datasources: ["BPMN", "SQL"],
            types: ["Text", "Number", "Date", "Attachment"],
            processVariable: {
                name: "",
                type: "",
                description: "",
                datasource: {
                    type: "",
                    sql: ""
                },
                // table: '<table><tr><th>Name</th><th>Position</th></tr><tr><td>John Doe</td><td>Developer</td></tr><tr><td>Jane Doe</td><td>Designer</td></tr></table>'
                table: ""
            }
        }
    },
    methods: {
        async generateSql() {
            try {
                const response = await axios.post('http://localhost:8006/process-var-sql/invoke', {
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
                const response = await axios.post('http://localhost:8006/process-data-query/invoke', {
                    input: {
                        var_name: this.processVariable.name
                    }
                });
                this.processVariable.table = response.data.output
            } catch (error) {
                console.error('Error testing SQL:', error);
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
                    type: "BPMN",
                    sql: ""
                }
            }
            this.processVariable = Object.assign({}, this.variable)
        }
    }
}
</script>
<style>
.table-responsive table {
    width: 100%;
    border-collapse: collapse;
}
.table-responsive th,
.table-responsive td {
    border: 1px solid #ddd;
    padding: 8px;
    text-align: left;
}
.table-responsive th {
    background-color: #f2f2f2;
}
.table-responsive tr:nth-child(even) {
    background-color: #f9f9f9;
}
</style>