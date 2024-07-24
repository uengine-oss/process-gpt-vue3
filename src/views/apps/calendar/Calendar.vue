<script setup lang="ts">
import 'v-calendar/dist/style.css';
import { ref } from 'vue';
import '@fullcalendar/core/vdom'
import UiParentCard from '@/components/shared/UiParentCard.vue';
import FullCalendar from './FullCalender.vue';


</script>
<template>
    <v-row>
        <v-col cols="12" class="pa-0 ma-0">
            <UiParentCard title="Full Calender">
                <FullCalendar />
            </UiParentCard>
        </v-col>
    </v-row>
</template>
