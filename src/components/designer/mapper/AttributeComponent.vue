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
        <input type="text" id="textInput" style="width: 100%; height: 100%; padding:5px;" :placeholder="name" v-model="value" @input="handleInput($event.target.value)">
      </body>
    </foreignObject>
    <foreignObject
      v-if="func == 'NumberFormatInput'"
      x="-10"
      y="-10"
      width="130"
      height="25" 
    >
      <body xmlns="http://www.w3.org/1999/xhtml">
        <select id="numberFormatSelect" style="width: 100%; height: 100%;" >
          <option value="L">Long</option>
          <option value="D">Double</option>
        </select>
      </body>
    </foreignObject>
    <foreignObject
      v-if="func == 'NumberFormatTo'"
      x="-10"
      y="-10"
      width="130"
      height="25" 
    >
      <body xmlns="http://www.w3.org/1999/xhtml">
        <select id="numberFormatSelect" style="width: 100%; height: 100%;" >
          <option value="I">Integer</option>
          <option value="N">Number</option>
          <option value="C">Currency</option>
          <option value="P">Percent</option>
        </select>
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
    value: String,
    func: String,
  },
  methods : {
    handleInput(value) {
      this.$emit('onChangeAttribute', value, this.blockName, this.name);
    },
    handleFormatChange(value) {
      this.$emit('formatChangeAttribute', value, this.blockName, this.name);
    },
  }
};
</script>
