<template id="block-template">
  <g
    :transform="'translate(' + pos.x + ',' + pos.y + ')'"
    class="block"
    :data-block-name="name"
  >
    <rect
      :x="-size.width / 2"
      :y="-size.height / 2"
      :width="size.width"
      :height="size.height"
      @mousedown="startDrag"
    >
    </rect>
    <text v-if="name != 'Source' && name != 'Target'">{{ name }}</text>
    <foreignObject
      v-if="name != 'Source' && name != 'Target'"
      :x="size.width / 2 - 24"
      :y="-size.height / 2"
      width="24"
      height="24"
    >
      <button
        xmlns="http://www.w3.org/1999/xhtml"
        @click="onClickDelete"
        class="delete-button"
      >
        <i class="mdi mdi-delete" style="color: #ffffffdd"></i>
      </button>
    </foreignObject>
  </g>
</template>

<script>
export default {
  props: {
    name: String,
    pos: Object,
    size: Object,
    startBlockDrag: Function,
    deleteBlock: Function,
    parentBlock: Object,
  },
  data() {
    return {
      menu: false,
      menu_x: 0,
      menu_y: 0,
      dragOffset: null,
    };
  },
  methods: {
    startDrag(event) {
      this.startBlockDrag(this.pos, {
        x: this.pos.x - event.clientX,
        y: this.pos.y - event.clientY,
      });
    },
    onClickDelete() {
      this.deleteBlock(this.name);
    },
  },
};
</script>
