
<script>
import { parseString } from 'xml2js';
export default {
    data: () => ({
      currentSource:'start_event',
      currentRole: 'Initiator',
      loopSource: null,
      loopChilds: {},
      sequenceConditions:{}
    }),
    methods: {
        convertOldJson(content) {
          let me = this;
          me.currentSource = 'start_event';
          me.loopSource = null;
          me.loopChilds = {};
          me.sequenceConditions = {};
          let result = 
          {
            "megaProcessId": "test1",
            "majorProcessId": "test1",
            "processDefinitionName": "test",
            "processDefinitionId": "test",
            "description": "test",
          }

          const json = content;
          result.megaProcessId = json.name.text;
          result.majorProcessId = json.name.text;
          result.processDefinitionName = json.name.text;
          result.processDefinitionId = json.serviceDefinitions[0].name;
          result.description = json.description.text;
          result.data = [];
          result.roles = [];
          result.sequences = [];
          result.elements = [];


          me.parseData(json.processVariables[1], result);
          json.roles[1].forEach(role => {
            result.roles.push({
              "name": role.name,
              "resolutionRule": role.name
            });
          });
          result.elements.push(
          {
            "elementType": "Event",
            "id": me.currentSource,
            "name": "Start Event",
            "role": "Initiator",
            "source": null,
            "type": "StartEvent",
            "description": "프로세스 시작"
          });

          me.parseElements(json.childActivities[1], result);
          const lastElement = result.elements[result.elements.length - 1];
          result.elements.push(
          {
            "elementType": "Event",
            "id": "end_event",
            "name": "End Event",
            "role": "Initiator",
            "source": lastElement.id,
            "type": "EndEvent",
            "description": "프로세스 종료"
          });

          
          result.sequences.push({
            "id" : me.currentSource + '_' + 'end_event',
            "source": me.currentSource,
            "target": "end_event"
          })

          return result;
        },
        parseData(variables, definition) {
          variables.forEach(variable => {
            let type = "Text";
            if(variable.type.indexOf("Number") != -1) {
                type = "Number";
            }

            definition.data.push({
              "name": variable.name,
              "description": variable.name,
              "type": type
            });
          });
        },
        getId(element) {
          const activityType = element._type;
          let id = ''
          if(activityType.indexOf("HumanActivity") != -1) {
            id = 'activity_' + element.tracingTag;
          } else if("SwitchActivity") {
            id = 'gateway_' + element.tracingTag;
          }

          return id;
        },
        parseElements(activities, definition, loopId = null) {
          const me = this;
          let id = '';

          activities.forEach((activity, key) => {
            const activityType = activity._type;
            let loopAct = [];
            if(activityType.indexOf("HumanActivity") != -1) {
              
              const name = activity.name.text;
              const roleName = activity.role? activity.role.name: '';
              const description = activity.description.text ? activity.description.text:'';
              id = me.getId(activity);
              const instruction = activity.instruction;
              if(activity.previousActivities) {
                me.currentSource = me.getId(activity.previousActivities[1][0]);
              }

              if(activity.parentId) {
                me.currentSource = activity.parentId;
              }

              if(me.loopSource) {
                me.currentSource = '' + me.loopSource;
                me.loopSource = null;
              }

              if(loopId) {
                if(!me.loopChilds[loopId]) {
                  me.loopChilds[loopId] = [];
                }
                 
                me.loopChilds[loopId].push(activity);
              }

              definition.sequences.push({
                "id" : me.currentSource + '_' + id,
                "source": me.currentSource,
                "target": id
              });

              definition.elements.push(
              {
                  "elementType" :"Activity",
                  "id": id,
                  "name": name,
                  "type": "UserActivity",
                  "source": me.currentSource, 
                  "description": description,
                  "instruction": instruction,
                  "role": roleName, 
                  "inputData": [],
                  "outputData": [],
                  "checkpoints":[],
              });

              me.currentSource = id;

    
            } else if(activityType.indexOf("LoopActivity") != -1) {
              loopAct.push(activity);
            } else if(activityType.indexOf("SwitchActivity") != -1) {
              const name = activity.name.text;
              const role = activity.previousActivities[1][0].role;
              const roleName = role.name;
              id = me.getId(activity);
              const description = activity.description.text ? activity.description.text:'';

              
              if(activity.previousActivities) {
                me.currentSource = me.getId(activity.previousActivities[1][0]);
              }

              if(activity.parentId) {
                me.currentSource = activity.parentId;
              }

              definition.sequences.push({
                "id" : me.currentSource + '_' + id,
                "source": me.currentSource,
                "target": id
              });

              definition.elements.push(
              {
                "elementType" :"Gateway",
                "id": id,
                "name": name,
                "role": roleName, 
                "source": me.currentSource,
                "type": "ExclusiveGateway",
                "description": description
              });

              
            } else if(activityType.indexOf("AllActivity") != -1) {

              const name = activity.name.text;
              const role = activity.previousActivities[1][0].role;
              const roleName = role.name;
              id = me.getId(activity);
              const description = activity.description.text ? activity.description.text:'';

              if(activity.previousActivities) {
                me.currentSource = me.getId(activity.previousActivities[1][0]);
              }

              if(activity.parentId) {
                me.currentSource = activity.parentId;
              }

              definition.sequences.push({
                "id" : me.currentSource + '_' + id,
                "source": me.currentSource,
                "target": id
              });

              definition.elements.push(
              {
                "elementType" :"Gateway",
                "id": id,
                "name": name,
                "role": roleName, 
                "source": me.currentSource,
                "type": "ParallelGateway",
                "description": description
              });

            }


            if(activity.childActivities) {
              activity.childActivities[1].forEach(activity => {
                activity.parentId = id;
              });
              if(activityType.indexOf("LoopActivity") != -1) {
                loopId = me.getId(activity);
              }
              me.parseElements(activity.childActivities[1], definition, loopId)
            }
            
            
            const reversedLoopActivities = loopAct.slice().reverse();
            reversedLoopActivities.forEach(activity => {
              const name = activity.name.text;
              const role = activity.previousActivities[1][0].role;
              const roleName = role.name;
              id = me.getId(activity);
              const description = activity.description.text ? activity.description.text:'';
              let source = me.currentSource;

              if(activity.childActivities) {
                activity.childActivities[1].forEach(child=> {
                  let loopSequence = {
                    "id" : id + '_' + me.getId(child),
                    "source": id,
                    "target": me.getId(child)
                  };
                  if(activity.loopingCondition) {
                    if(activity.loopingCondition.conditions[1]) {
                      const conditions = activity.loopingCondition.conditions[1];
                      loopSequence.condition = conditions[0].conditions[1][0];
                    }
                  }

                  definition.sequences.push(loopSequence);
                });
              }

              if(me.loopChilds[id]) {
                me.loopChilds[id].forEach(activity=> {
                  definition.sequences.push({
                    "id" : me.getId(activity) + '_' + id,
                    "source": me.getId(activity),
                    "target": id
                  });
                });
              }

              

              definition.elements.push(
              {
                "elementType" :"Gateway",
                "id": id,
                "name": name,
                "role": roleName, 
                "source": source,
                "type": "ExclusiveGateway",
                "description": description
              });

              me.loopSource = id;

            });
          });


        }
    }


    /*component
                {
                  "componentType" :"Gateway",
                  "id": "gateway_id",
                  "name": "gateway name",
                  "role": "role name", 
                  "source": "components id",
                  "type": "ExclusiveGateway",
                  "description": "선택적 또는 병렬 프로세스 흐름을 제어하는 게이트웨이 설명"
                },
                {
                  "componentType" :"Activity",
                  "id": "String-based unique id of the activity not including space",
                  "name": "activity name",
                  "type": "UserActivity",
                  "source": "components id", 
                  "description": "description of activity",
                  "instruction": "instruction to user",
                  "role": "role name", 
                  "inputData": ["name of data for input"],
                   "outputData": [
                     "name of data for output"
                   ],
                   "checkpoints":["checkpoint 1", "checkpoint 2"],
                   "source": "components id"
                 },
                 {
                  "componentType" :"Event",
                  "id": "startEvent",
                  "name": "event name",
                  "role": "role name",
                  "source": "components id", 
                  "type": "StartEvent | EndEvent | IntermediateCatchEvent | MessageEvent | TimerEvent | ErrorEvent | ConditionalEvent | SignalEvent | TerminationEvent | LinkEvent | CompensationEvent | MultipleEvent | ParallelEvent | EscalationEvent | CancelEvent",
                  "description": "프로세스의 시작, 종료 또는 중간 이벤트 설명",
                  "trigger": "이벤트 트리거 조건 (if applicable)"
                }
    */
    /*

    {
        "source": "activity id of source activity or gateway id of source gateway",
        "target": "activity id of target activity or gateway id of target gateway", 
        "condition": 
        {
            "key": "data의 name",
            "condition" : " == | != | > | >= | < | <=",
            "value": ""
        } 
    }
    */
};
</script>
