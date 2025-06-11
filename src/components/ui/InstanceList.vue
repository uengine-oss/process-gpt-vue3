<template>
    <div>
        <template v-for="item in instanceList" :key="item.title">
            <div v-if="item.isNew" class="d-flex">
                <v-progress-circular indeterminate class="mt-2" color="primary" :size="20"></v-progress-circular>
                <NavItem v-if="!JMS" class="leftPadding pl-2" :item="item" :use-i18n="false" />
            </div>
            <NavItem v-else-if="!JMS && !item.isNew" class="leftPadding pl-2" :item="item" :use-i18n="false" />
        </template>
    </div>
</template>

<script>
import NavItem from '@/layouts/full/vertical-sidebar/NavItem/index.vue';

import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();



export default {
    components: {
        NavItem
    },
    data: () => ({
        instanceList: [],
        
    }),
    async created() {
        await this.init();
    },
    methods: {
        async init() {
            await this.loadInstances();
        },
        async loadInstances() {
            let result = await backend.getInstanceList();
            if (!result) result = [];
            this.instanceList = result.map((item) => {
                const title = item.name;
                item = {
                    // icon: 'ph:cube',
                    title: title,
                    to: `/instance/${item.instId}`,
                    BgColor:'primary'
                };
                return item;
            });
            this.$emit('update:instanceList', this.instanceList);
        },
        
        
    }
};
</script>
