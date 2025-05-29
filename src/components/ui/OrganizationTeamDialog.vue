<template>
    <v-card>
        <v-card-title>
            <span class="text-h6">{{ dialogTitle }}</span>
        </v-card-title>

        <v-card-text>
            <!-- add team -->
            <div v-if="dialogType == 'add'">
                <v-text-field 
                    v-model="newTeam.id" 
                    :label="$t('organizationChartDefinition.teamId')"
                    :rules="idRules"
                    class="mb-2"
                ></v-text-field>
                <v-text-field 
                    v-model="newTeam.name" 
                    :label="$t('organizationChartDefinition.teamName')"
                    :rules="nameRules"
                    class="mb-2"
                ></v-text-field>
            </div>

            <!-- edit team -->
            <div v-else-if="dialogType == 'edit'">
                <!-- team icon -->                
                <v-dialog width="650" v-model="teamIconDialog">
                    <template v-slot:activator="{ props }">
                        <div class="text-center mb-6">
                            <v-avatar size="64" v-bind="props" class="cursor-pointer">
                                <v-img :src="editNode.data.img"></v-img>
                            </v-avatar>
                        </div>
                    </template>
                    <v-card style="padding:30px;">
                        <v-row>
                            <v-col>
                                <v-row>
                                    <img v-for="(icon, index) in iconList" :key="index"
                                        :src="icon"
                                        @click="() => iconChange(icon)" 
                                        class="change-team-icon"
                                        width="100" height="100" />
                                </v-row>
                            </v-col>
                        </v-row>
                    </v-card>
                </v-dialog>
                
                <v-text-field 
                    v-model="editNode.data.name" 
                    :label="$t('organizationChartDefinition.teamName')"
                    :rules="nameRules"
                    class="mb-2"
                ></v-text-field>
            </div>

            <!-- delete team -->
            <div v-else-if="dialogType == 'delete'">
                <div>'{{ editNode.data.name }}' {{ $t('organizationChartDefinition.deleteMessage') }}</div>
            </div>
        </v-card-text>

        <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn color="primary" @click="update" :disabled="!isValid">{{ buttonText }}</v-btn>
            <v-btn color="error" @click="closeDialog">{{ $t('organizationChartDefinition.close') }}</v-btn>
        </v-card-actions>
    </v-card>
</template>

<script>
export default {
    props: {
        dialogType: {
            type: String,
            default: '',
        },
        editNode: {
            type: Object,
            default: {},
        },
    },
    data: () => ({
        newTeam: {
            id: '',
            name: '',
            isTeam: true,
            img: '/images/chat-icon.png',
        },

        // team icon
        teamIconDialog: false,
        iconList: [
            '/images/chat-icon.png',
            '/images/chat-icon.png',
            '/images/chat-icon.png',
            '/images/chat-icon.png',
            '/images/chat-icon.png',
            '/images/chat-icon.png'
        ],

    }),
    computed: {
        idRules() {
            return [
                (value) => !!value || this.$t('organizationChartDefinition.idRequired'),
            ];
        },
        nameRules() {
            return [
                (value) => !!value || this.$t('organizationChartDefinition.nameRequired'),
            ];
        },
        isValid() {
            if (this.dialogType == 'add') {
                return this.idRules.every(rule => rule(this.newTeam.id) === true) && this.nameRules.every(rule => rule(this.newTeam.name) === true);
            } else {
                return true
            }
        },
        dialogTitle() {
            if (this.dialogType == 'add') {
                return this.$t('organizationChartDefinition.addTeam')
            } else if (this.dialogType == 'edit') {
                return this.$t('organizationChartDefinition.team') + ' ' + this.$t('organizationChartDefinition.edit')
            } else if (this.dialogType == 'delete') {
                return this.$t('organizationChartDefinition.team') + ' ' + this.$t('organizationChartDefinition.delete')
            }
        },
        buttonText() {
            if (this.dialogType == 'add') {
                return this.$t('organizationChartDefinition.add')
            } else if (this.dialogType == 'edit') {
                return this.$t('organizationChartDefinition.edit')
            } else if (this.dialogType == 'delete') {
                return this.$t('organizationChartDefinition.delete')
            }
        }
    },
    mounted() {
        if (this.dialogType == 'add') {
            this.newTeam = {
                id: '',
                name: '',
                isTeam: true,
                img: '/images/chat-icon.png',
            }
        }
    },
    methods: {
        closeDialog() {
            this.$emit('closeDialog')
        },
        update() {
            this.$emit('updateTeam', this.dialogType, this.editNode, this.newTeam)
        },
        iconChange(icon) {
            this.editNode.data.img = icon
            this.teamIconDialog = false
        }
    }
}
</script>

<style scoped>
.change-team-icon {
    border-radius: 50%;
    padding: 10px;
}

.change-team-icon:hover {
    cursor: pointer;
    opacity: 0.8;
}
</style>