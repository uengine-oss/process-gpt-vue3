<template>
    <div id="tree" ref="tree" class="h-100"></div>
</template>

<script>
import OrgChart from '@balkangraph/orgchart.js'

export default {
    props: {
        nodes: {
            type: Array,
            default: [],
        }
    },
    data: () => ({
    }),
    watch: {
        nodes(newVal) {
            this.mytree(this.$refs.tree, newVal);
        },
    },
    mounted() {
        this.mytree(this.$refs.tree, this.nodes);
    },
    methods: {
        mytree(domEl, x) {
            this.chart = new OrgChart(domEl, {
                template: 'rony',
                scaleInitial: 0.5,
                nodes: x,
                nodeBinding: {
                    field_0: "name",
                    img_0: "img"
                }
            });
        }
    },
}
</script>

<style scoped>
@media screen and (max-width: 1080px) {
    #tree {
        height: calc(100vh - 200px) !important;
    }
}
</style>