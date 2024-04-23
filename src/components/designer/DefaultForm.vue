<template>
    <div v-if="inputItems" v-for="item in inputItems" class="input-group">
        <v-row>
            <v-col cols="4">
                <v-list-subheader>{{item.name}}</v-list-subheader>
            </v-col>

            <v-col cols="8">
                <v-text-field
                    v-model="item.value"
                ></v-text-field>
            </v-col>
        </v-row>
    </div>
</template>

<script>

export default {
  props:{
      inputItems: {
          type: Array,
          default: function () {
              return []
          },
      }   
  }
}
</script>