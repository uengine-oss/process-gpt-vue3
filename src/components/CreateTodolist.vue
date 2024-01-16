<template>

    <v-card outlined>
        <v-card-title>
            CreateTodolist
        </v-card-title>

        <v-card-text>
            <String label="ActivityId" v-model="value.activityId" :editMode="editMode"/>
            <String label="ActivityName" v-model="value.activityName" :editMode="editMode"/>
            <Date label="StartDate" v-model="value.startDate" :editMode="editMode"/>
            <Date label="EndDate" v-model="value.endDate" :editMode="editMode"/>
            <Date label="DueDate" v-model="value.dueDate" :editMode="editMode"/>
            <String label="ProcessDefinitionId" v-model="value.processDefinitionId" :editMode="editMode"/>
            <String label="ProcessInstanceId" v-model="value.processInstanceId" :editMode="editMode"/>
            <String label="UserId" v-model="value.userId" :editMode="editMode"/>
        </v-card-text>

        <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn
                    color="deep-purple lighten-2"
                    text
                    @click="createTodolist"
            >
                CreateTodolist
            </v-btn>
            
            <v-btn
                    color="deep-purple lighten-2"
                    text
                    @click="close"
            >
                Close
            </v-btn>
        </v-card-actions>
    </v-card>

</template>

<script>
import String from './primitives/String.vue'
import Date from './primitives/Date.vue'

export default {
    name: 'CreateTodolistCommand',
    components:{
        String,
        Date,
    },
    props: {},
    data: () => ({
        editMode: true,
        value: {},
    }),
    created() {
        this.value.activityId = '';
        this.value.activityName = '';
        this.value.startDate = '2023-12-12';
        this.value.endDate = '2023-12-12';
        this.value.dueDate = '2023-12-12';
        this.value.processDefinitionId = '';
        this.value.processInstanceId = '';
        this.value.userId = '';
    },
    watch: {
    },
    methods: {
        createTodolist() {
            this.$emit('createTodolist', this.value);
        },
        close() {
            this.$emit('closeDialog');
        },
        change() {
            this.$emit("update:modelValue", this.value);
        },
    }
}
</script>

