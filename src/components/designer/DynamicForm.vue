<script>
import { getCurrentInstance, h } from 'vue';
import TextField from '../ui/TextField.vue';

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

    let parser = new DOMParser()
    let doc = parser.parseFromString(this.content, 'text/html')
    doc.querySelectorAll("div[name='formDesigner']").forEach((formDesignerNode) => {

      formDesignerNode.children[1].setAttribute('target_section_id', formDesignerNode.parentElement.id)
      formDesignerNode.removeChild(formDesignerNode.children[0])

    })
    
    const r = {
      components: {
        TextField,
        
      },
      template: `<div class="content">${doc.body.innerHTML || ''}</div>`,
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