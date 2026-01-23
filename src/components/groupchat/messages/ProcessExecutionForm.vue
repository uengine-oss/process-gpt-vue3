<template>
    <div class="mt-3 pl-3 pr-3">
      <v-card variant="outlined" class="mb-3">
        <v-card-title class="text-subtitle-1 py-2">
          {{ message.firstActivityForm?.activityName || '초기 정보 입력' }}
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-3">
          <!-- formHtml이 있는 경우 -->
          <div v-if="message.firstActivityForm?.formHtml" class="form-container">
            <DynamicForm
              :formHTML="message.firstActivityForm.formHtml"
              v-model="formValues"
              :readonly="false"
            />
          </div>
  
          <!-- 폼 정보가 없는 경우 -->
          <div v-else class="text-caption text-grey">
            추가 입력 정보가 필요하지 않습니다.
          </div>
        </v-card-text>
      </v-card>
  
      <v-btn
        color="primary"
        variant="elevated"
        size="default"
        @click="executeProcess"
        :loading="executing"
        :disabled="executed"
      >
        <v-icon left class="mr-1">
          {{ executed ? 'mdi-check' : 'mdi-play' }}
        </v-icon>
        {{ executed ? '실행 완료' : '프로세스 실행' }}
      </v-btn>
    </div>
  </template>
  
  <script setup>
  import { ref } from 'vue';
  import DynamicForm from '@/components/designer/DynamicForm.vue';
  
  const props = defineProps({
    message: {
      type: Object,
      required: true
    }
  });
  
  const emit = defineEmits(['execute']);
  
  const formValues = ref(props.message.formValues || {});
  const executing = ref(false);
  const executed = ref(false);
  
  async function executeProcess() {
    executing.value = true;
  
    try {
      await emit('execute', {
        processDefinitionId: props.message.processDefinitionId,
        processDefinitionName: props.message.processDefinitionName,
        formValues: formValues.value,
        processDefinition: props.message.processDefinition,
        firstActivityForm: props.message.firstActivityForm
      });
  
      executed.value = true;
    } catch (error) {
      console.error('프로세스 실행 중 오류:', error);
      alert('프로세스 실행 중 오류가 발생했습니다.');
    } finally {
      executing.value = false;
    }
  }
  </script>