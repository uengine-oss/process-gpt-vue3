<template id = "port-template">
    <g :transform="'translate(' + pos.x + ',' + pos.y + ')'" class="port"
       :data-port-name="name"
       :data-block-name="blockName"
       @mousedown="onmousedown"
       @mouseup="onmouseup">
      <rect v-if="direction == 'in'" x="-10" y="-10" class="background"></rect>
      <rect v-if="direction == 'out'" x="-40" y="-10" class="background"></rect>
  
      <text v-if="direction == 'in' && blockName != 'Source' && blockName != 'Target' " x="8" y="0" style="text-anchor: start">{{ name.replace("in ", "") }}</text>
      <text v-if="direction == 'out' && blockName != 'Source' && blockName != 'Target' " x="-8" y="0" style="text-anchor: end">{{ name }}</text>
  
      <rect x="-5" y="-5" width="10" height="10"></rect>
    </g>
  </template>
  
  <script>
  export default {
    props: {
      pos: Object,
      name: String,
      blockName: String,
      direction: String,
      onmousedown: Function,
      onmouseup: Function,
    },
  };
  </script>
  