<template>
    <template v-if="is_multidata_mode === 'true'">
        <v-card class="pa-3" variant="outlined" style="border-radius: 0px !important; margin: 5px;">           
            <v-card-title class="mb-3 d-flex justify-space-between">
                <div class="mt-2">{{(alias && alias.length > 0) ? alias : name}}</div>

                <v-btn @click="addItem" style="background-color: transparent; width: 50px; height: 50px;">
                    <v-icon style="color: green;" size="50">mdi-plus</v-icon>
                </v-btn>
            </v-card-title>
            
            <div>
                <slot :modelValue="localModelValue[name]" :deleteItem="deleteItem"></slot>
            </div>
        </v-card>
    </template>
    <template v-else>
        <v-card class="pa-3" variant="outlined" style="border-radius: 0px !important; margin: 5px;">           
            <v-card-title class="mb-3 d-flex justify-space-between">
                <div>{{(alias && alias.length > 0) ? alias : name}}</div>
            </v-card-title>
            
            <div>
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
        is_multidata_mode: String
    },

    data() {
        return {
            localModelValue: {}
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
            this.localModelValue[this.name].push({})
        },

        deleteItem(index) {
            this.localModelValue[this.name].splice(index, 1)
        }
    },

    created() {
        if((this.is_multidata_mode === 'true') && (this.modelValue[this.name] === undefined))
            this.modelValue[this.name] = [{}]

        this.localModelValue = this.modelValue
    }
}
</script>

<style lang="scss">

</style>
