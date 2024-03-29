<template>
    <div class="pa-5">
        <draggable v-if="lock"
            class="v-row dragArea list-group" 
            :list="value.mega_proc_list" 
            :animation="200" 
            ghost-class="ghost-card"
            group="megaProcess"
        >
            <transition-group>
                <v-col v-for="item in value.mega_proc_list"
                    :key="item.id" 
                    class="cursor-pointer"
                    cols="12" md="2" sm="6"
                >
                    <MegaProcess 
                        :value="item" 
                        :parent="value" 
                        :storage="storage"
                        :userInfo="userInfo"
                        :lock="lock"
                        @view="viewProcess"
                    />
                </v-col>
            </transition-group>
        </draggable>
        <v-row v-else>
            <v-col v-for="item in value.mega_proc_list"
                :key="item.id" 
                class="cursor-pointer"
                cols="12" md="2" sm="6">
                <MegaProcess 
                    :value="item" 
                    :parent="value" 
                    :storage="storage" 
                    :userInfo="userInfo"
                    :lock="lock"
                    @view="viewProcess"
                    @dblclick="viewProcessDetail(item)"
                />
            </v-col>
        </v-row>
    </div>
</template>

<script>
import MegaProcess from './MegaProcess.vue';

export default {
    components: {
        MegaProcess,
    },
    props: {
        value: Object,
        storage: Object,
        userInfo: Object,
        lock: Boolean,
    },
    data: () => ({
    }),
    methods: {
        viewProcess(process) {
            this.$router.push(`/definition-map/sub/${process.id}`)
        },
        viewProcessDetail(process) {
            this.$router.push(`/definition-map/mega/${process.id}`)
        }
    },
}
</script>