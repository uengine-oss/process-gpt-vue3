<template>
    <div>
        <template v-for="item in instanceList" :key="item.title">
            <NavItem v-if="!JMS" class="leftPadding pl-2" :item="item" :use-i18n="false" />
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
        runningInstances: {
            header: 'runningInstance.title',
        },
        instanceList: [],
    }),
    async created() {
        await this.loadInstances();
    },
    mounted() {
        this.EventBus.on('instances-updated', async () => {
            await this.loadInstances();
        });
    },
    computed: {
        JMS() {
            return window.$jms;
        }
    },
    methods: {
        async loadInstances() {
            let result = await backend.getInstanceList();
            if (!result) result = [];
            this.instanceList = result.map((item) => {
                item = {
                    // icon: 'ph:cube',
                    title: item.instName,
                    to: `/instancelist/${btoa(item.instId)}`,
                    BgColor:'primary'
                };
                return item;
            });
            this.$emit('update:instanceList', this.instanceList);

        }
    }
};
</script>
