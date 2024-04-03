

export function add(a, b) {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
  };
}

export function sub(a, b) {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
  };
}

export function copy(src, dest) {
  dest.x = src.x;
  dest.y = src.y;
}

export function d({ x, y }) {
  return `${x},${y}`;
}
export default {
  data() {
    return {
      offset: { x: 30, y: 30 },
      blockTemplates: {
        Abs: {
          size: { width: 150, height: 50 },
          ports: {
            "in input": { x: -75, y: 0 },
            out: { x: 75, y: 0, direction: "out" },
          },
          class: "org.uengine.processdesigner.mapper.transformers.AbsTransformer",
          isTransform: true,
        },
        BeanValue: {
          size: { width: 150, height: 50 },
          ports: {
            "in in": { x: -75, y: 0 },
            out: { x: 75, y: 0, direction: "out" },
          },
          class: "org.uengine.processdesigner.mapper.transformers.BeanValueTransformer",
          isTransform: true,
        },
        Ceil: {
          size: { width: 150, height: 50 },
          ports: {
            "in input": { x: -75, y: 0 },
            out: { x: 75, y: 0, direction: "out" },
          },
          class: "org.uengine.processdesigner.mapper.transformers.CeilTransformer",
          isTransform: true,
        },
        Concat: {
          size: { width: 150, height: 250 },
          ports: {
            "in str1": { x: -75, y: -100 },
            "in str2": { x: -75, y: -50 },
            "in str3": { x: -75, y: 0 },
            "in str4": { x: -75, y: 50 },
            "in str5": { x: -75, y: 100 },
            out: { x: 75, y: 0, direction: "out" },
          },
          class: "org.uengine.processdesigner.mapper.transformers.ConcatTransformer",
          isTransform: true,
        },
        DirectSql: {//직접 값을 입력하는듯 함
          size: { width: 150, height: 100 },
          ports: {
            out: { x: 75, y: 0, direction: "out" },
          },
          attributes: {
            "input": { x: -55, y: 25, func: "input" },
          },
          class: "org.uengine.processdesigner.mapper.transformers.DirectSqlTransformer",
          isTransform: true,
        },
        DirectValue: {//직접 값을 입력하는듯 함
          size: { width: 150, height: 100 },
          ports: {
            out: { x: 75, y: 0, direction: "out" },
          },
          attributes: {
            "input": { x: -55, y: 25, func: "input" },
          },
          class: "org.uengine.processdesigner.mapper.transformers.DirectValueTransformer",
          isTransform: true,
        },
        Floor: {
          size: { width: 150, height: 50 },
          ports: {
            "in input": { x: -75, y: 0 },
            out: { x: 75, y: 0, direction: "out" },
          },
          class: "org.uengine.processdesigner.mapper.transformers.FloorTransformer",
          isTransform: true,
        },
        Max: {
          size: { width: 150, height: 100 },
          ports: {
            "in value1": { x: -75, y: -25 },
            "in value2": { x: -75, y: 25 },
            out: { x: 75, y: 0, direction: "out" },
          },
          class: "org.uengine.processdesigner.mapper.transformers.MaxTransformer",
          isTransform: true,
        },
        Min: {
          size: { width: 150, height: 100 },
          ports: {
            "in value1": { x: -75, y: -25 },
            "in value2": { x: -75, y: 25 },
            out: { x: 75, y: 0, direction: "out" },
          },
          class: "org.uengine.processdesigner.mapper.transformers.MinTransformer",
          isTransform: true,
        },
        NumberFormat: {
          size: { width: 150, height: 100 },
          ports: {
            "in input": { x: -75, y: -25 },
            "in locale": { x: -75, y: 25 },
            out: { x: 75, y: 0, direction: "out" },
          },
          class: "org.uengine.processdesigner.mapper.transformers.NumberFormatTransformer",
          isTransform: true,
        },
        Number: {
          size: { width: 150, height: 50 },
          ports: {
            "in input": { x: -75, y: 0 },
            out: { x: 75, y: 0, direction: "out" },
          },
          class: "org.uengine.processdesigner.mapper.transformers.NumberTransformer",
          isTransform: true,
        },
        Round: {
          size: { width: 150, height: 50 },
          ports: {
            "in input": { x: -75, y: 0 },
            out: { x: 75, y: 0, direction: "out" },
          },
          class: "org.uengine.processdesigner.mapper.transformers.RoundTransformer",
          isTransform: true,
        },
        Replace: {//직접 값을 입력하는듯 함
          size: { width: 150, height: 120 },
          ports: {
            "in input": { x: -75, y: 0 },
            out: { x: 75, y: 0, direction: "out" },
          },
          attributes: {
            "from": { x: -55, y: -30, func: "input" },
            "to": { x: -55, y: 25, func: "input" },
          },
          class: "org.uengine.processdesigner.mapper.transformers.ReplaceTransformer",
          isTransform: true,
        },
        Sum: {
          size: { width: 150, height: 250 },
          ports: {
            "in val1": { x: -75, y: -100 },
            "in val2": { x: -75, y: -50 },
            "in val3": { x: -75, y: 0 },
            "in val4": { x: -75, y: 50 },
            "in val5": { x: -75, y: 100 },
            out: { x: 75, y: 0, direction: "out" },
          },
          class: "org.uengine.processdesigner.mapper.transformers.SumTransformer",
          isTransform: true,
        },
        SequenceGenerator: {//직접 값을 입력하는듯 함
          size: { width: 150, height: 50 },
          ports: {
            out: { x: 75, y: 0, direction: "out" },
          },
          class: "org.uengine.processdesigner.mapper.transformers.SequenceGeneratorTransformer",
          isTransform: true,
        },
        XMLParsing: {//직접 값을 입력하는듯 함
          size: { width: 150, height: 100 },
          ports: {
            out: { x: 75, y: 0, direction: "out" },
          },
          attributes: {
            "xml": { x: -55, y: -30, func: "xml" },
          },
          class: "org.uengine.processdesigner.mapper.transformers.XMLParsingTransformer",
          isTransform: true,
        },
        AbstractValidator: {
          size: { width: 150, height: 500 },
          ports: {
            "in in": { x: -75, y: -225 },
            "in in2": { x: -75, y: -175 },
            "in in3": { x: -75, y: -125 },
            "in in4": { x: -75, y: -75 },
            "in in5": { x: -75, y: -25 },
            "in in6": { x: -75, y: 25 },
            "in in7": { x: -75, y: 75 },
            "in in8": { x: -75, y: 125 },
            "in in9": { x: -75, y: 175 },
            "in in10": { x: -75, y: 225 },
            out: { x: 75, y: 0, direction: "out" },
          },
          class: "org.uengine.processdesigner.mapper.transformers.AbstractValidator",
          isTransform: true,
        },
        MergerValidator: {
          size: { width: 150, height: 500 },
          ports: {
            "in in1": { x: -75, y: -225 },
            "in in2": { x: -75, y: -175 },
            "in in3": { x: -75, y: -125 },
            "in in4": { x: -75, y: -75 },
            "in in5": { x: -75, y: -25 },
            "in in6": { x: -75, y: 25 },
            "in in7": { x: -75, y: 75 },
            "in in8": { x: -75, y: 125 },
            "in in9": { x: -75, y: 175 },
            "in in10": { x: -75, y: 225 },
            out: { x: 75, y: 0, direction: "out" },
          },
          class: "org.uengine.processdesigner.mapper.transformers.MergerValidator",
          isTransform: true,
        },
        NotNullValidator: {//직접 값을 입력하는듯 함
          size: { width: 150, height: 50 },
          ports: {
            out: { x: 75, y: 0, direction: "out" },
          },
          class: "org.uengine.processdesigner.mapper.transformers.NotNullValidator",
          isTransform: true,
        },
        RegularExpValidator: {//직접 값을 입력하는듯 함
          size: { width: 150, height: 50 },
          ports: {
            out: { x: 75, y: 0, direction: "out" },
          },
          class: "org.uengine.processdesigner.mapper.transformers.RegularExpValidator",
          isTransform: true,
        },
        SizeValidator: {//직접 값을 입력하는듯 함
          size: { width: 150, height: 50 },
          ports: {
            out: { x: 75, y: 0, direction: "out" },
          },
          class: "org.uengine.processdesigner.mapper.transformers.SizeValidator",
          isTransform: true,
        },
        Source: {//소스
          size: { width: 150, height: 50 },
          ports: {
            out: { x: 75, y: 0, direction: "out" },
          },
          isTransform: false,
        },
        Target: {//타겟
          size: { width: 150, height: 50 },
          ports: {
            in: { x: -75, y: 0, direction: "in" },
          },
          isTransform: false,
        },
      },
      blocks: {
      },
      connections: [
      ],
      pendingConnection: null,
      pendingConnectionEnd: null,
      draggedBlockPos: null,
      dragOffset: null,
    };
  },
  methods: {
    getBlock(name) {
      const block = this.blocks[name];
      return {
        ...this.blockTemplates[block.type],
        ...block,
        name,
      };
    },
    resolvePos(spec) {
      if (_.isObject(spec) && spec.x !== undefined && spec.y !== undefined) {
        return spec;
      }
      const block = this.getBlock(spec[0]);
      return add(block.pos, block.ports[spec[1]] || { x: 0, y: 0 });
    },
    mousePos({ clientX, clientY }) {
      return sub({ x: clientX, y: clientY }, this.offset);
    },
    updateMousePos(event) {
      if (this.pendingConnection) {
        this.pendingConnection[this.pendingConnectionEnd] =
          this.mousePos(event);
      }
      if (this.draggedBlockPos) {
        copy(add(this.mousePos(event), this.dragOffset), this.draggedBlockPos);
      }
    },
    startBlockDrag(blockPos, offset) {
      this.draggedBlockPos = blockPos;
      this.dragOffset = add(this.offset, offset);
    },
    endBlockDrag() {
      this.draggedBlockPos = null;
    },
    newBlockDrag(type) {
      return (blockPos, offset) => {
        const newBlock = {
          type,
          pos: blockPos,
        };
        let nextBlockName = type;
        for (let i = 2; this.blocks[nextBlockName]; i++) {
          nextBlockName = `${type} ${i}`;
        }
        Vue.set(this.blocks, nextBlockName, newBlock);
        this.draggedBlockPos = newBlock.pos;
        this.dragOffset = add(this.offset, offset);
      };
    },
    newBlock(type, pos, blockName) {
      const svgElement = this.$refs.svgElement;

      const svgRect = svgElement.getBoundingClientRect();

      pos.x = pos.x - svgRect.left;
      pos.y = pos.y - svgRect.top;
      const newBlock = {
        type: type,
        pos: pos,
      };
      let nextBlockName = type;
      if (blockName) {
        nextBlockName = blockName;
        for (let i = 2; this.blocks[nextBlockName]; i++) {
          nextBlockName = `${blockName} ${i}`;
        }
      } else {
        for (let i = 2; this.blocks[nextBlockName]; i++) {
          nextBlockName = `${type} ${i}`;
        }
      }
      this.blocks[nextBlockName] = newBlock;
      console.log(this.blocks);
      console.log(this.attributes);
    },
    deleteBlock(name) {
      if (this.blocks[name]) {
        this.connections = this.connections.filter(connection => {
          return connection.from[0] !== name && connection.to[0] !== name;
        });
        delete this.blocks[name];
      }
    },
    newConnection(block, port, portDirection) {
      return (event) => {
        if (portDirection == "out") {
          this.pendingConnectionEnd = "to";
        } else {
          this.pendingConnectionEnd = "from";
        }
        this.pendingConnection = {
          from: [block, port],
          to: [block, port],
          [this.pendingConnectionEnd]: this.mousePos(event),
          isNew: true,
        };
        this.connections.push(this.pendingConnection);
      };
    },
    cancelConnection() {
      if (this.pendingConnection) {
        this.connections.pop();
        this.pendingConnection = null;
        this.pendingConnectionEnd = null;
      }
    },
    completeConnection(block, port, portDirection) {
      return () => {
        if (this.pendingConnection) {
          if (
            (this.pendingConnectionEnd === "to" && portDirection !== "in") ||
            (this.pendingConnectionEnd === "from" && portDirection !== "out")
          ) {
            this.cancelConnection();
          } else {
            this.pendingConnection[this.pendingConnectionEnd] = [block, port];
            delete this.pendingConnection.isNew;
            const duplicateIndex = _.findIndex(
              this.connections,
              this.pendingConnection
            );
            if (duplicateIndex != this.connections.length - 1) {
              console.log("removing duplicate connection", duplicateIndex);
              this.removeConnection(duplicateIndex);
              this.connections.pop();
            }
            this.pendingConnection = null;
            this.pendingConnectionEnd = null;
          }
        }
      };
    },
    removeConnection(index) {
      this.connections.splice(index, 1);
    },
    onMouseUp() {
      this.cancelConnection();
      this.endBlockDrag();
    },
    filterTransformItems(blockTemplates) {
      return Object.keys(blockTemplates).filter(key => blockTemplates[key].isTransform);
    }
  },
  computed: {
    transform() {
      return `translate(${d(this.offset)})`;
    },
    blocks_() {
      return _.map(this.blocks, (block, name) => this.getBlock(name));
    },
    connectors() {
      return this.connections.map(({ from, to, isNew }) => {
        return {
          from,
          to,
          isNew,
          startPos: this.resolvePos(from),
          endPos: this.resolvePos(to),
        };
      });
    },
    ports() {
      return _.flatMap(this.blocks, ({ type, pos }, blockName) => {
        const template = this.blockTemplates[type];
        return _.map(template.ports, (port, name) => ({
          ...port,
          direction: port.direction || "in",
          name,
          blockName,
          pos: add(pos, port),
        }));
      });
    },
    attributes() {
      return _.flatMap(this.blocks, ({ type, pos }, blockName) => {
        const template = this.blockTemplates[type];
        return _.map(template.attributes, (attribute, name) => ({
          ...attribute,
          func: attribute.func,
          name,
          blockName,
          pos: add(pos, attribute),
        }));
      });
    },
    transformers() {
      var computedTransformers = {
        "mappingElements": []
      };
      Object.values(this.blocks).forEach(block => {
        if (block.type == "Source") return;
        if (block.type == "Target") return;
        const blockData = this.blockTemplates[block.type];
        const mappingElement = {
          "_type": "org.uengine.kernel.MappingElement",
          "argument": {},
          "transformerMapping": {
            "transformer": {
              "_type": blockData.class,
              "name": block.type,
              "location": block.pos,
              "argumentSourceMap": {}
            },
            "linkedArgumentName": "out"
          },
          "isKey": false
        };
        const connections = this.connections.filter(conn => conn.to[0] === block.type);
        const argumentSourceMap = {};
        connections.forEach(conn => {
          argumentSourceMap[conn.to[1]] = "[instance]." + conn.from[0];
        });

        mappingElement.transformerMapping.transformer.argumentSourceMap = argumentSourceMap;

        computedTransformers["mappingElements"].push(mappingElement);
      });




      return computedTransformers;
    }
  },
};