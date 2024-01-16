<script setup lang="ts">
import { ref } from 'vue';
import UiParentCard from '@/components/shared/UiParentCard.vue';
import { BasicDatatables,UppercaseFilter } from '@/_mockApis/components/datatable/dataTable';
// common components
import BaseBreadcrumb from '@/components/shared/BaseBreadcrumb.vue';
// theme breadcrumb
const page = ref({ title: 'Filter Data Table' });
const breadcrumbs = ref([
    {
        text: 'Home',
        disabled: false,
        href: '#'
    },
    {
        text: 'Filter data table',
        disabled: true,
        href: '#'
    }
]);


/*Header Data*/
const search = ref();
const customsearch = ref();
const headers = ref([
    { title: 'Name', align: 'start', key: 'name' },
    { title: 'Project Name', align: 'start', key: 'project' },
    { title: 'Post', align: 'start', key: 'post' },
    { title: 'Status', align: 'start', key: 'status' },
    { title: 'Budget', align: 'end', key: 'budget' },
])


function filterOnlyCapsText(value: { toString: () => string; } | null, query: string | null, item: any) {
    return value != null &&
        query != null &&
        typeof value === 'string' &&
        value.toString().toLocaleUpperCase().indexOf(query) !== -1
}


</script>
<template>
    <BaseBreadcrumb :title="page.title" :breadcrumbs="breadcrumbs"></BaseBreadcrumb>

    <v-row>
        <v-col cols="12">
            <UiParentCard title="Basic Filter">
                <v-text-field v-model="search" append-inner-icon="mdi-magnify" label="Search" single-line hide-details
                    class="mb-5" />
                <v-data-table items-per-page="5" :headers="headers" :items="BasicDatatables" :search="search"
                    class="border rounded-md">
                </v-data-table>
            </UiParentCard>

            <UiParentCard title="Custom Filter" class="mt-6">
                <v-text-field v-model="customsearch" append-inner-icon="mdi-magnify" label="Search (UPPER CASE ONLY)" single-line hide-details
                    class="mb-5" />
                <v-data-table items-per-page="5" :headers="headers" :items="UppercaseFilter" :search="customsearch"
                    :custom-filter="filterOnlyCapsText" class="border rounded-md">
                </v-data-table>
            </UiParentCard>
        </v-col>
    </v-row>
</template>

