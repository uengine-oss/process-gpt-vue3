<template>
    <template v-if="localIsMultidataMode">
        <v-card class="pa-3" variant="outlined" style="border-radius: 0px !important;">           
            <v-card-title class="mb-3 d-flex justify-space-between">
                <div class="mt-2">{{ alias ?? name }}</div>

                <v-btn @click="addItem" style="background-color: transparent; width: 50px; height: 50px;">
                    <v-icon style="color: green;" size="50">mdi-plus</v-icon>
                </v-btn>
            </v-card-title>
            
            <div class="row">
                <slot :modelValue="localModelValue[localName]" :deleteItem="deleteItem"></slot>
            </div>
        </v-card>
    </template>
    <template v-else>
        <v-card class="pa-3" variant="outlined" style="border-radius: 0px !important;">           
            <v-card-title class="mb-3 d-flex justify-space-between">
                <div class="mt-2">{{ alias ?? name }}</div>
            </v-card-title>
            
            <div class="row">
                <slot :modelValue="localModelValue"></slot>
            </div>
        </v-card>
    </template>
</template>

<script>
export default {
    name: "RowLayout",
    
    props: {
        modelValue: Object,

        name: String,
        alias: String,
        isMultidataMode: String
    },

    data() {
        return {
            localModelValue: this.modelValue,

            localName: this.name,
            localAlias: this.alias,
            localIsMultidataMode: this.isMultidataMode === "true"
        };
    },

    watch: {
        modelValue: {
            handler() {
                this.localModelValue  = this.modelValue
            },
            deep: true,
            immediate: true
        },

        localModelValue: {
            handler() {
                this.$emit('update:modelValue', this.localModelValue)
            },
            deep: true,
            immediate: true
        }
    },

    methods: {
        addItem() {
            this.localModelValue[this.localName].push({})
        },

        deleteItem(index) {
            this.localModelValue[this.localName].splice(index, 1)
        }
    },

    created() {
        this.localModelValue[this.localName] = [{}]
    }
}
</script>

<style lang="scss">

</style>
