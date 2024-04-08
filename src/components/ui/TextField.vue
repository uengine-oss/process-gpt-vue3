<template>
    <div>
        <v-text-field label="simple"></v-text-field>
    </div>
</template>

<script>

export default {
    components: {
       
    },
    mixins: [
        
    ],
    props: {
        target_section_id: {
            type: String,
            default: ''
        }
    },
    data() {
        return {
         
        };
    },
    created() {
        $(`section[id='${this.target_section_id}'] div[class='view']`)[0].innerHTML = `<input type="text" id="id" name="name" value="" data-alias="alias"></input>`
    },
    methods: {
 
    }
};
</script>

<style lang="scss">

</style>
