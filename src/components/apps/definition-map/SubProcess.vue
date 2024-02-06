<template>
    <div class="d-flex align-center bg-lightprimary px-3 py-2 cursor-pointer">
        <h6 class="text-subtitle-2 font-weight-semibold">
            {{ subProcess.name }}
        </h6>
        <v-avatar size="12" class="bg-lightprimary ml-auto"  @click="editProcess">
            <EditIcon size="12" />
        </v-avatar>
        <v-avatar size="12" class="bg-lightprimary ml-1"  @click="deleteProcess">
            <v-icon>mdi-close</v-icon>
        </v-avatar>
    </div>
</template>

<script>
export default {
    props: {
        subProcess: Object,
    },
    data: () => ({
    }),
    methods: {
        editProcess() {
            if (this.subProcess.id) {
                this.$router.push(`/definitions/${this.subProcess.id}`);
            } else {
                this.$router.push("/definitions/chat");
            }
        },
        deleteProcess() {
            //
        },
    },
}
</script>