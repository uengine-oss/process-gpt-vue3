<template>
    <div class="d-flex align-center bg-lightprimary px-3 py-2 cursor-pointer"
        @click="viewProcess"
    >
        <h6 class="text-subtitle-2 font-weight-semibold">
            {{ value.label }}
        </h6>
        <div class="ml-auto">
            <ProcessMenu
                :size="12"
                :type="'sub'"
                :process="value"
                :storage="storage"
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
    },
    data: () => ({
        definition: null,
    }),
    async created() {
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
            if (this.definition && this.definition.id) {
                this.$router.push(`/definitions/${this.value.id}`);
            } else {
                this.$router.push(`/definitions/chat?id=${this.value.id}&name=${this.value.label}`);
            }
        },
        viewProcess() {
            this.$emit('view', this.value);
        },
    },
}
</script>