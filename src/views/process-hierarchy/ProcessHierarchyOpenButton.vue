<template>
    <v-tooltip text="새탭에서 프로세스 열기" location="top">
        <template #activator="{ props: tooltipProps }">
            <v-btn
                v-bind="tooltipProps"
                icon="mdi-open-in-new"
                :size="size"
                variant="text"
                :disabled="!id"
                @click.stop="handleClick"
            />
        </template>
    </v-tooltip>
</template>

<script>
import { defineComponent } from 'vue';
import { useRouter } from 'vue-router';
import { navigateToProcessHierarchy, PROCESS_HIERARCHY_ENTRY } from '@/views/process-hierarchy/navigation';

export default defineComponent({
    name: 'ProcessHierarchyOpenButton',
    props: {
        id: { type: [String, Number], default: '' },
        name: { type: String, default: '' },
        entry: { type: String, default: PROCESS_HIERARCHY_ENTRY.ARCHITECTURE },
        size: { type: String, default: 'x-small' },
        openInNewTab: { type: Boolean, default: true }
    },
    setup(props) {
        const router = useRouter();
        const handleClick = () => {
            if (!props.id) return;
            navigateToProcessHierarchy(
                router,
                {
                    id: String(props.id).trim(),
                    name: String(props.name || props.id).trim(),
                    entry: props.entry
                },
                { openInNewTab: props.openInNewTab }
            );
        };
        return { handleClick };
    }
});
</script>
