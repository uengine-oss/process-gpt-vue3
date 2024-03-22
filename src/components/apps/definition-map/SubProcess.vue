<template>
    <div class="d-flex align-center px-3 cursor-pointer sub-process-hover sub-process-style"
        @click="viewProcess"
    >
        <h6 class="text-subtitle-2 font-weight-semibold">
            {{ value.label }}
        </h6>
        <div class="ml-auto">
            <ProcessMenu
                :size="12"
                :type="type"
                :process="value"
                :storage="storage"
                :lock="lock"
                @edit="editProcess"
                @delete="deleteProcess"
                @modeling="editProcessModel"
            />
        </div>
    </div>
</template>

<script>
import ProcessMenu from './ProcessMenu.vue';

export default {
    components: {
        ProcessMenu,
    },
    props: {
        value: Object,
        parent: Object,
        storage: Object,
        lock: Boolean,
    },
    data: () => ({
        type: 'sub',
        definition: null,
    }),
    async created() {
        var me = this;
        if (!me.$app.try) {
            me.$app = me.$app._component.methods;
        }
        this.definition = await this.storage.getObject(`proc_def/${this.value.id}`, {key: 'id'})
    },
    methods: {
        editProcess(process) {
            this.value.id = process.id;
            this.value.label = process.label;
        },
        deleteProcess() {
            this.parent.sub_proc_list = this.parent.sub_proc_list.filter(item => item.id != this.value.id);
        },
        editProcessModel() {
            this.$app.try({
                action: () => {
                    if (this.definition && this.definition.id) {
                        this.$router.push(`/definitions/${this.value.id}`);
                    } else {
                        this.$router.push(`/definitions/chat?id=${this.value.id}&name=${this.value.label}`);
                    }
                },
            });
        },
        viewProcess() {
            this.$emit('view', this.value);
        },
    },
}
</script>

<style scoped>
.sub-process-style {
    background-color: transparent;
    padding:5px;
    border-radius:8px;
}
.sub-process-hover:hover {
    background-color:#E7ECF0 !important;
}
</style>