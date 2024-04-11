<script>
import { h, ref } from 'vue';
import TextField from '../ui/TextField.vue';
import SelectField from '../ui/SelectField.vue';
import CheckboxField from '../ui/CheckboxField.vue';
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
    vueRenderUUID: {
      type: String,
      default: ''
    }
  },

  setup() {
    const componentRef = ref(null);

    const createComponentWithRef = (component, props) => {
      return h(component, {
        ...props,
        ref: (instance) => {
          if (instance) {
            componentRef.value = instance;
          }
        },
      });
    };

    const parseContentToProps = (content) => {
      const dom = new DOMParser().parseFromString(content, 'text/html');
      const element = dom.body.firstChild;
      const props = {};
      if (element) {
        Array.from(element.attributes).forEach(attr => {
          props[attr.name] = attr.value;
        });
      }
      return props;
    };

    return {
      componentRef,
      createComponentWithRef,
      parseContentToProps
    };
  },

  render() {

    // 각각의 컴포넌트에 대해서 참조 가능한 ref와 그 값과 매칭되는 ref_id를 생성하기 위해서
    // const dom = new DOMParser().parseFromString(this.content, 'text/html')    

    // const components = Array.from(dom.querySelectorAll('*')).filter(el => el.tagName.toLowerCase().endsWith('-field'));
    // components.forEach(component => {

    //   const field = crypto.randomUUID().replaceAll("-", "_")


    //   const parent = document.createElement('div')
    //   parent.setAttribute('name', 'fieldView')
    //   parent.setAttribute('id', refId)

    //   component.parentNode.insertBefore(parent, component)
    //   component.setAttribute('fieldViewId', refId)
    //   parent.appendChild(component)

    // })

    // const modifiedContent = dom.body.innerHTML.replace(/&quot;/g, `'`)


    // const r = {
    //   components: {
    //     TextField,
    //     SelectField,
    //     CheckboxField,
    //     RadioField,
    //     FileField,
    //     LabelField,
    //     SubmitField
    //   },
    //   template: `<div class="content">${modifiedContent || ''}</div>`,
    //   methods: {},
    // };
    // return h(r);

    if(this.content.includes("text-field"))
      return this.createComponentWithRef(TextField, {vueRenderUUID:this.vueRenderUUID, tagName: "text-field", ...this.parseContentToProps(this.content)});
    else if(this.content.includes("select-field"))
      return this.createComponentWithRef(SelectField, {vueRenderUUID:this.vueRenderUUID, tagName: "select-field", ...this.parseContentToProps(this.content)});
    else
      return ""
  },
};
</script>