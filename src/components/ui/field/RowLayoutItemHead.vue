<template>
    <v-sheet class="d-flex justify-space-between" style="background-color: transparent;">
        <span>{{ "#" + (index+1) }}</span>

        <v-btn @click="$emit('on_delete_item', index)" density="compact" icon="mdi-delete" style="background-color: transparent;"></v-btn>
    </v-sheet>
</template>

<script>
export default {
    name: "RowLayout",
    
    props: {
        index: Number
    },

    emits: [
        "on_delete_item"
    ],
}
</script>

<style lang="scss">

</style>
