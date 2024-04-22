<script>
/**
 * formHTML: HTML 폼 데이터를 전달해서 렌더링하기 위해서
 * v-model: 이 값을 세팅해서 입력 요소에 값을 세팅하거나 받을 수 있음
 *    {"name1":"value1", "name2":"key1"} 과 같이 전달되며, "name1"은 해당 태그의 name 속성 값임(name은 고유하다고 가정)
 *    text-field: Read("value1"과 같은 문자열 값) / Write("value1"과 같은 문자열 값) 
 *    select-field: Read("key1"과 같은 유저가 선택한 키 값) / Write("key1"과 같은 선택시킬 값)
 *    checkbox-field: Read(["key1", "key2"]) 와 같이 체크된 항목의 객체 값들을 담은 리스트) / Write(Read와 동일)
 *    radio-field: Read("key1"과 같은 키 값과 같은 선택된 객체의 값) / Write(Read와 동일)
 *    file-field: Read(선택된 파일의 Base64 URL 주소) / Write(지원하지 않음)
 * 
 *    label-field: Read(지원하지 않음) / Write(지원하지 않음)
 */
import { h } from 'vue';
import TextField from '@/components/ui/TextField.vue';
import SelectField from '@/components/ui/SelectField.vue';
import CheckboxField from '@/components/ui/CheckboxField.vue';
import RadioField from '@/components/ui/RadioField.vue';
import FileField from '@/components/ui/FileField.vue';
import LabelField from '@/components/ui/LabelField.vue';

export default {
  props: {
    // 폼 HTML 데이터를 전달시켜서 렌더링시키기 위해서
    formHTML: {
      type: String,
      default: '',
    },
    modelValue: Object
  },

  watch: {
    modelValue: {
      handler() {
        if(JSON.stringify(this.formValues) === JSON.stringify(this.modelValue)) return

        this.formValues = this.modelValue
      },
      deep: true,
      immediate: true
    },

    formValues: {
      handler() {
        if(JSON.stringify(this.formValues) === JSON.stringify(this.modelValue)) return

        this.$emit('update:modelValue', this.formValues)
      },
      deep: true,
      immediate: true
    }
  },

  data() {
    return {
      renderedContent: "",
      formValues: {}
    }
  },

  /**
   * 'console.log(JSON.stringify(this.formValues))'과 같이 this.formValues의 값을 접근해서 로깅하지 말 것
   * Vue의 render 추적 대상에 읽기 동작만으로 포함되기 때문에 예상치 못한 동작이 일어남
   * 로깅을 하고 싶을 경우, updated와 같은 다른 함수에서 할 것
   */
  render() {
    const me = this
    const r = {
      components: {
        TextField,
        SelectField,
        CheckboxField,
        RadioField,
        FileField,
        LabelField
      },
      data() {
        return {
          formValues: me.formValues
        }
      },
      template: me.formHTML
    }
    return h(r);
  },
};
</script>