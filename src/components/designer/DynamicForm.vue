<script>
import { getCurrentInstance, h } from 'vue';
import TextField from '../ui/TextField.vue';
import SelectField from '../ui/SelectField.vue';
import CheckboxField from '../ui/CheckBoxField.vue';
import RadioField from '../ui/RadioField.vue';
import FileField from '../ui/FileField.vue';
import LabelField from '../ui/LabelField.vue';
import SubmitField from '../ui/SubmitField.vue';

export default {
  props: {
    content: {
      type: String,
      default: '',
    },
  },
  setup(){
    const instance = getCurrentInstance();

    if (instance) {
      // 현재 컴포넌트 인스턴스의 components 목록에 접근
      const components = instance.type.components;
      console.log(components); // 선언된 모든 컴포넌트 목록을 콘솔에 출력
    }
  },
  render() {
    const r = {
      components: {
        TextField,
        SelectField,
        CheckboxField,
        RadioField,
        FileField,
        LabelField,
        SubmitField
      },
      template: `<div class="content">${this.content || ''}</div>`,
      methods: {
        hello() {
          // method "hello" is also available here
        },
      },
    };
    return h(r);
  },
};
</script>