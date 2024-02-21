import AIGenerator from "./AIGenerator";

import axios from '@/utils/axios';

export default class ProcessDefinitionGenerator extends AIGenerator {

    constructor(client, language) {
        super(client, language);
        
        this.previousMessages = [];
        this.input = {
            answer: "",
            process_instance_id: "",
            process_definition_id: "",
            userInfo: client.userInfo,
            image: null,
        };
    }

    beforeGenerate(obj, isNew) {
        if (obj) {
            if (obj.content)
                this.input.answer = obj.content;
            if (obj.image) 
                this.input.image = obj.image;
        }

        if (isNew) {
            if (this.client.processDefinition) {
                var procDef = this.client.processDefinition[0];
                this.input.process_definition_id = procDef.processDefinitionId;
            };
            this.input.process_instance_id = "new";
        } else {
            var procInst = this.client.processInstance;
            this.input.activity_id = procInst.current_activity_ids[0];
            this.input.process_instance_id = procInst.proc_inst_id;
            this.input.process_definition_id = "";
        }
    }

    async generate() {
        var url = '/complete/invoke';
        if (this.input.image != null) {
            url = '/vision-complete/invoke';
        }
        var req = {
            input: this.input
        };

        await axios.post(url, req).then(async res => {
            if (res.data) {
                const data = res.data;
                if (data.output) {
                    this.client.onGenerationFinished(data.output);
                }
            }
        })
        .catch(error => {
            console.log(error);
            this.client.onError(error);
        });
    }

}