<script>
import { h, ref } from 'vue';
import TextField from '@/components/ui/field/TextField.vue';
import SelectField from '@/components/ui/field/SelectField.vue';
import CheckboxField from '@/components/ui/field/CheckboxField.vue';
import RadioField from '@/components/ui/field/RadioField.vue';
import FileField from '@/components/ui/field/FileField.vue';
import LabelField from '@/components/ui/field/LabelField.vue';
import BooleanField from '@/components/ui/field/BooleanField.vue';

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
    if(this.content.includes("text-field"))
      return this.createComponentWithRef(TextField, {vueRenderUUID:this.vueRenderUUID, tagName: "text-field", ...this.parseContentToProps(this.content)});
    else if(this.content.includes("select-field"))
      return this.createComponentWithRef(SelectField, {vueRenderUUID:this.vueRenderUUID, tagName: "select-field", ...this.parseContentToProps(this.content)});
    else if(this.content.includes("checkbox-field"))
      return this.createComponentWithRef(CheckboxField, {vueRenderUUID:this.vueRenderUUID, tagName: "checkbox-field", ...this.parseContentToProps(this.content)});
    else if(this.content.includes("radio-field"))
      return this.createComponentWithRef(RadioField, {vueRenderUUID:this.vueRenderUUID, tagName: "radio-field", ...this.parseContentToProps(this.content)});
    else if(this.content.includes("file-field"))
      return this.createComponentWithRef(FileField, {vueRenderUUID:this.vueRenderUUID, tagName: "file-field", ...this.parseContentToProps(this.content)});
    else if(this.content.includes("label-field"))
      return this.createComponentWithRef(LabelField, {vueRenderUUID:this.vueRenderUUID, tagName: "label-field", ...this.parseContentToProps(this.content)});
    else if(this.content.includes("boolean-field"))
      return this.createComponentWithRef(BooleanField, {vueRenderUUID:this.vueRenderUUID, tagName: "boolean-field", ...this.parseContentToProps(this.content)});
    else {
      console.error("유효하지 않은 렌더링 content:", this.content)
      return "" 
    }
  },
};
</script>