<template>

    <v-card outlined>
        <v-card-title>
            DeleteTodolist
        </v-card-title>

        <v-card-text>
            <String label="Id" v-model="value.id" :editMode="editMode"/>
            <String label="ActivityId" v-model="value.activityId" :editMode="editMode"/>
        </v-card-text>

        <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn
                    color="deep-purple lighten-2"
                    text
                    @click="deleteTodolist"
            >
                DeleteTodolist
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

export default {
    name: 'DeleteTodolistCommand',
    components:{
        String,
    },
    props: {},
    data: () => ({
        editMode: true,
        value: {},
    }),
    created() {
        this.value.id = '';
        this.value.activityId = '';
    },
    watch: {
    },
    methods: {
        deleteTodolist() {
            this.$emit('deleteTodolist', this.value);
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

