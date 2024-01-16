<script setup lang="ts">
import { ref } from 'vue';
import UiParentCard from '@/components/shared/UiParentCard.vue';
import { SelectedRow, BasicDatatables } from '@/_mockApis/components/datatable/dataTable';
// common components
import BaseBreadcrumb from '@/components/shared/BaseBreadcrumb.vue';
// theme breadcrumb
const pageb = ref({ title: 'Selection Data Table' });
const breadcrumbs = ref([
    {
        text: 'Home',
        disabled: false,
        href: '#'
    },
    {
        text: 'Selection data table',
        disabled: true,
        href: '#'
    }
]);
const page = ref({ title: 'Data Tables Selection' });
const selected = ref();

/*Header Data*/
const headers = ref([
    { title: 'Name', align: 'start', key: 'name' },
    { title: 'Project Name', align: 'start', key: 'project' },
    { title: 'Post', align: 'start', key: 'post' },
    { title: 'Status', align: 'start', key: 'status' },
    { title: 'Budget', align: 'end', key: 'budget' },
])
</script>
<template>
    <BaseBreadcrumb :title="pageb.title" :breadcrumbs="breadcrumbs"></BaseBreadcrumb>

    <v-row>
        <v-col cols="12">
            <UiParentCard title="Basic Selection" class="">
                <v-data-table items-per-page="5" :headers="headers" :items="BasicDatatables" item-value="name" show-select
                    class="border rounded-md">
                </v-data-table>
            </UiParentCard>
            <UiParentCard title="Selected Values" class="mt-6">
                <v-data-table items-per-page="5" :headers="headers" :items="BasicDatatables" item-value="name"
                    v-model="selected" return-object show-select class="border rounded-md">
                </v-data-table>
                <v-card class="elevation-0 border mt-3 pa-4">
                    <pre>{{ selected }}</pre>
                </v-card>
            </UiParentCard>
            <UiParentCard title="Selectable Rows" class="mt-6">
                <v-data-table items-per-page="5" :headers="headers" :items="SelectedRow" item-value="name"
                    item-selectable="selectable" show-select class="border rounded-md">
                </v-data-table>
            </UiParentCard>
            <UiParentCard title="Select Strategies" class="mt-6">
                <v-data-table items-per-page="5" :headers="headers" :items="BasicDatatables" item-value="name"
                    select-strategy="single" show-select class="border rounded-md">
                </v-data-table>
            </UiParentCard>
        </v-col>
    </v-row>
</template>

