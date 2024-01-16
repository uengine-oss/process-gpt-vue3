<script setup lang="ts">
import { ref } from 'vue';
import UiParentCard from '@/components/shared/UiParentCard.vue';
import { BasicDatatables } from '@/_mockApis/components/datatable/dataTable';
// common components
import BaseBreadcrumb from '@/components/shared/BaseBreadcrumb.vue';
// theme breadcrumb
const page = ref({ title: 'Header Data Table' });
const breadcrumbs = ref([
    {
        text: 'Home',
        disabled: false,
        href: '#'
    },
    {
        text: 'Header data table',
        disabled: true,
        href: '#'
    }
]);
/*Header Data*/
const headers = ref([
    { title: 'Name', align: 'start', key: 'name', sortable: false, },
    { title: 'Project Name', align: 'start', key: 'project' },
    { title: 'Post', align: 'start', key: 'post' },
    { title: 'Status', align: 'start', key: 'status' },
    { title: 'Budget', align: 'end', key: 'budget' },
])


</script>
<template>
    <BaseBreadcrumb :title="page.title" :breadcrumbs="breadcrumbs"></BaseBreadcrumb>

    <v-row>
        <v-col cols="12">
            <UiParentCard title="Column Slot">
                <v-data-table items-per-page="5" :headers="headers" :items="BasicDatatables" item-value="name"
                    class="border rounded-md">
                    <template v-slot:column.name="{ column }">
                        {{ column.title.toUpperCase() }}
                    </template>
                </v-data-table>
            </UiParentCard>
        </v-col>
    </v-row>
</template>

