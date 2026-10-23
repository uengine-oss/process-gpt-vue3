<template>
    <!-- 엔진을 못 알아낸 경우와 "지원하지 않는 엔진" 은 다른 상황이다.
         전자에 "지원하지 않습니다" 라고 말하면 사실이 아니다. -->
    <v-alert v-if="!engine" type="info" variant="tonal" density="comfortable">
        <div class="font-weight-medium mb-1">{{ $t('engineUnsupportedNotice.noRecord.title') }}</div>
        <div class="text-body-2">
            {{ $t('engineUnsupportedNotice.noRecord.body') }}
        </div>
    </v-alert>

    <v-alert v-else type="info" variant="tonal" density="comfortable">
        <div class="font-weight-medium mb-1">
            {{ $t('engineUnsupportedNotice.unsupported.title', { engine }) }}
        </div>
        <div class="text-body-2">
            {{
                $t('engineUnsupportedNotice.unsupported.body', {
                    deepagents: 'deepagents',
                    completion: 'completion'
                })
            }}
        </div>
    </v-alert>
</template>

<script setup lang="ts">
defineProps<{ engine?: string | null }>();
</script>
