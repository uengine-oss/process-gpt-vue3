<template>
    <div class="lead-time-input">
        <div class="text-subtitle-2 mb-2">{{ label || 'Lead Time' }}</div>
        <div class="d-flex align-center gap-2">
            <!-- Days -->
            <v-text-field
                v-model.number="days"
                type="number"
                :label="$t('leadTime.days') || 'Days'"
                variant="outlined"
                density="compact"
                hide-details
                style="max-width: 80px;"
                :min="0"
                :disabled="disabled"
                @update:model-value="emitChange"
            />
            <span class="text-caption text-grey">d</span>

            <!-- Hours -->
            <v-text-field
                v-model.number="hours"
                type="number"
                :label="$t('leadTime.hours') || 'Hours'"
                variant="outlined"
                density="compact"
                hide-details
                style="max-width: 80px;"
                :min="0"
                :max="23"
                :disabled="disabled"
                @update:model-value="emitChange"
            />
            <span class="text-caption text-grey">h</span>

            <!-- Minutes -->
            <v-text-field
                v-model.number="minutes"
                type="number"
                :label="$t('leadTime.minutes') || 'Min'"
                variant="outlined"
                density="compact"
                hide-details
                style="max-width: 80px;"
                :min="0"
                :max="59"
                :disabled="disabled"
                @update:model-value="emitChange"
            />
            <span class="text-caption text-grey">m</span>

            <!-- Total display -->
            <div class="total-display ml-2">
                <span class="text-caption text-grey-darken-1">= {{ totalMinutes }} min</span>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: 'LeadTimeInput',
    props: {
        modelValue: {
            type: Number,
            default: 0
        },
        label: {
            type: String,
            default: ''
        },
        disabled: {
            type: Boolean,
            default: false
        }
    },
    emits: ['update:modelValue'],
    data() {
        return {
            days: 0,
            hours: 0,
            minutes: 0
        };
    },
    computed: {
        totalMinutes() {
            return (this.days || 0) * 24 * 60 + (this.hours || 0) * 60 + (this.minutes || 0);
        }
    },
    watch: {
        modelValue: {
            immediate: true,
            handler(newVal) {
                this.parseMinutes(newVal || 0);
            }
        }
    },
    methods: {
        parseMinutes(totalMinutes) {
            const total = Math.max(0, Math.floor(totalMinutes || 0));
            this.days = Math.floor(total / (24 * 60));
            const remaining = total % (24 * 60);
            this.hours = Math.floor(remaining / 60);
            this.minutes = remaining % 60;
        },
        emitChange() {
            this.$emit('update:modelValue', this.totalMinutes);
        }
    }
};
</script>

<style scoped>
.lead-time-input {
    padding: 8px 0;
}

.total-display {
    background: #f5f5f5;
    padding: 4px 8px;
    border-radius: 4px;
}
</style>
