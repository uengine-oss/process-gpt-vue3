<template>
    <div>
        <div class="d-flex">
            <v-btn icon variant="text" :width="size" :height="size">
                <DotsVerticalIcon :size="size" />
                <v-menu activator="parent">
                    <v-list density="compact">
                        <v-list-item value="Add">
                            <v-list-item-title @click="dialog = true">
                                Add New {{ type }} Process
                            </v-list-item-title>
                        </v-list-item>
                        <v-list-item value="Delete">
                            <v-list-item-title @click="deleteProcess">
                                Delete This Process
                            </v-list-item-title>
                        </v-list-item>
                    </v-list>
                </v-menu>
            </v-btn>
        </div>
        
        <v-dialog v-model="dialog" max-width="500">
            <v-card>
                <v-card-title>
                    Add {{ type }} Process
                </v-card-title>
                <v-card-text>
                    <v-text-field
                            v-model="newProcess.id"
                            label="Process Id"
                            autofocus
                    ></v-text-field>
                    <v-text-field
                            v-model="newProcess.name"
                            label="Process Name"
                    ></v-text-field>
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn color="primary" @click="addProcess">Save</v-btn>
                    <v-btn color="error" @click="dialog = false">Close</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
export default {
    props: {
        size: Number,
        type: String,
    },
    data: () => ({
        dialog: false,
        newProcess: {
            id: "",
            name: "",
        }
    }),
    methods: {
        addProcess() {
            if (this.type == "Mega") {
                this.newProcess.majorProcess = [];
            } else if (this.type == "Major") {
                this.newProcess.subProcess = [];
            } else if (this.type == "Sub") {
                this.newProcess.messages = [];
                this.newProcess.model = null;
            }

            this.$emit("add", this.newProcess);

            this.newProcess = {
                id: "",
                name: ""
            };
            this.dialog = false;
        },
        deleteProcess() {
            this.$emit("delete");
        },
    },
}
</script>