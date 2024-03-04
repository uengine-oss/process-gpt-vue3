<template>
    <div @click="myMethod">show</div>
</template>
  
<script>
export default {
    props: ['element'], // props 정의
    methods: {
        myMethod() {
            console.log('Vue method called from overlay with message:', this.element);
        }
    }
}
</script>