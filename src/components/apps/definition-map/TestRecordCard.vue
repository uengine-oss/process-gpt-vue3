<template v-if="testRecord">
    <v-card class="pa-0 mb-2" style="width: 100px; height: 100px; overflow: hidden;" variant="outlined">
        <v-card-title class="text-truncate">{{ testRecord.name }}</v-card-title>
        <v-card-text class="pl-4">
            <v-simple-table>
                <tbody>
                    <tr v-for="(value, key) in testRecord.workItem" :key="key">
                        <td>{{ key }}</td>
                        <td>&nbsp;</td>
                        <td>{{ value }}</td>
                    </tr>
                </tbody>
            </v-simple-table>
        </v-card-text>
    </v-card>
    <v-icon v-if="!isLast" style="align-self: center;">mdi-chevron-right</v-icon>
</template>

<script>
export default {
    props: {
        testRecord: {
            type: Array,
            required: true
        },
        isLast: {
            type: Boolean,
            required: false,
            default: false
        }
    },
    data: () => ({
    }),
    methods: {
    }
};
</script>
