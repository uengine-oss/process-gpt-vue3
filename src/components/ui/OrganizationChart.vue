<template>
    <div id="tree" ref="tree" class="h-100"></div>
    <!-- <div id="tree"></div> -->
</template>

<script>
import OrgChart from '@balkangraph/orgchart.js'
import ApexTree from 'apextree'

export default {
    props: {
        // nodes: {
        //     type: Array,
        //     default: [],
        // },
        node: {
            type: Object,
            default: [],
        }
    },
    data: () => ({
    }),
    watch: {
        // nodes(newVal) {
        //     this.mytree(this.$refs.tree, newVal);
        // },
        node(newVal) {
            // this.mytree(this.$refs.tree, newVal);
            if (newVal && newVal.id) {
                this.drawTree()
            }
        },
    },
    mounted() {
        // this.mytree(this.$refs.tree, this.nodes);
        if (this.node && this.node.id) {
            this.drawTree()
        }
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
        },
        drawTree() {
            const options = {
                contentKey: 'data',
                width: 800,
                height: 500,
                nodeWidth: 150,
                nodeHeight: 100,
                childrenSpacing: 50,
                siblingSpacing: 20,
                direction: 'top',
                enableExpandCollapse: true,
                nodeTemplate: (content) =>
                `<div style='display: flex;flex-direction: column;gap: 10px;justify-content: center;align-items: center;height: 100%;'>
                <img style='width: 50px;height: 50px;border-radius: 50%;' src='${content.img || '/src/assets/images/chat/chat-icon.png'}' alt='' />
                <div style="font-weight: bold; font-family: Arial; font-size: 14px">${content.name}</div>
                ${content.email ? `<div style="margin-top: -10px; font-family: Arial; font-size: 12px">${content.email}</div>` : ''}
                </div>`,
                // canvasStyle: 'border: 1px solid black;background: #f6f6f6;',
                enableToolbar: true,
            };
            const tree = new ApexTree(document.getElementById('tree'), options);
            tree.render(this.node);
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