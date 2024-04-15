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
    else if(this.content.includes("submit-field"))
      return this.createComponentWithRef(SubmitField, {vueRenderUUID:this.vueRenderUUID, tagName: "submit-field", ...this.parseContentToProps(this.content)});
    else
      return ""
  },
};
</script>