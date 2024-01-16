<script setup lang="ts">
import { ref } from 'vue';
import UiParentCard from '@/components/shared/UiParentCard.vue';
import { BasicDatatables } from '@/_mockApis/components/datatable/dataTable';
// common components
import BaseBreadcrumb from '@/components/shared/BaseBreadcrumb.vue';
// theme breadcrumb
const page = ref({ title: 'Basic Data Table' });
const breadcrumbs = ref([
    {
        text: 'Home',
        disabled: false,
        href: '#'
    },
    {
        text: 'Basic data table',
        disabled: true,
        href: '#'
    }
]);



/*Header Data*/
const headers = ref([
    { title: 'Name', align: 'start', key: 'name' },
    { title: 'Project Name', align: 'start', key: 'project' },
    { title: 'Post', align: 'start', key: 'post' },
    { title: 'Status', align: 'start', key: 'status' },
    { title: 'Budget', align: 'end', key: 'budget' },
])

const expanded = ref();
const headersExpand = ref([
    { title: 'Name', align: 'start', key: 'name', sortable: false, },
    { title: 'Project Name', align: 'start', key: 'project' },
    { title: 'Post', align: 'start', key: 'post' },
    { title: 'Status', align: 'start', key: 'status' },
    { title: 'Budget', align: 'end', key: 'budget' },
    { title: '', key: 'data-table-expand' },
])


/*for status color*/
function getColor(status: string) {
    if (status == 'Active') return '#13DEB9'
    else if (status == 'Cancel') return '#FA896B'
    else if (status == 'Completed') return '#5D87FF'
    else return '#FFAE1F'
}

</script>
<template>
    <BaseBreadcrumb :title="page.title" :breadcrumbs="breadcrumbs"></BaseBreadcrumb>
    <v-row>
        <v-col cols="12">
            <UiParentCard title="Basic Table">
                    <v-data-table items-per-page="5" :headers="headers" :items="BasicDatatables" item-value="name"
                        class="border rounded-md">
                    </v-data-table>
            </UiParentCard>

            <UiParentCard title="Selection" class="mt-6 pb-0">
                <v-data-table items-per-page="5" :headers="headers" :items="BasicDatatables" item-value="name" show-select
                    class="border rounded-md">
                </v-data-table>
            </UiParentCard>

            <UiParentCard title="Density" class="mt-6">
                <v-data-table items-per-page="5" :headers="headers" :items="BasicDatatables" item-value="name"
                    density="compact" class="border rounded-md">
                </v-data-table>
            </UiParentCard>

            <UiParentCard title="Item" class="mt-6">
                <v-data-table items-per-page="5" :headers="headers" :items="BasicDatatables" item-value="name"
                    class="border rounded-md">
                    <template v-slot:item.status="{ item }">
                        <v-chip :color="getColor(item.columns.status)">
                            {{ item.columns.status }}
                        </v-chip>
                    </template>
                </v-data-table>
            </UiParentCard>

            <UiParentCard title="Expandable Rows" class="mt-6">
                <v-data-table v-model:expanded="expanded" :headers="headersExpand" :items="BasicDatatables"
                    item-value="name" show-expand class="border rounded-md">
                    <template v-slot:expanded-row="{ columns, item }">
                        <tr>
                            <td :colspan="columns.length">
                                More info about {{ item.raw.name }}
                            </td>
                        </tr>
                    </template>
                </v-data-table>
            </UiParentCard>
        </v-col>
    </v-row>
</template>

