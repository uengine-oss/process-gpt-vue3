<template id="attribute-template">
  <g
    :transform="'translate(' + pos.x + ',' + pos.y + ')'"
    class="attribute"
    :data-util-name="name"
    :data-block-name="blockName"
  >
    <foreignObject
      v-if="func == 'input'"
      x="-10"
      y="-10"
      width="130"
      height="25"
    >
      <body xmlns="http://www.w3.org/1999/xhtml">
        <input type="text" id="textInput" style="width: 100%; height: 100%; padding:5px;" :placeholder=name />
      </body>
    </foreignObject>
  </g>
</template>

<script>
export default {
  props: {
    pos: Object,
    name: String,
    blockName: String,
    func: String,
  },
};
</script>
