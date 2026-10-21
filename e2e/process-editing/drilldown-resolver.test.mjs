import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveLinkedProcessXml } from '../../src/components/customDrilldown/resolveLinkedProcessXml.js';

test('To-Be uses the dedicated resolver before As-Is', async () => {
    const backend = {
        getToBeDefinitionXml: async () => '<tobe/>',
        getRawDefinition: async () => {
            throw new Error('unexpected fallback');
        }
    };
    assert.equal(await resolveLinkedProcessXml(backend, 'child', 'to-be'), '<tobe/>');
});

test('PAL To-Be uses saved tobe_bpmn and falls back to the As-Is XML when absent', async () => {
    let tobe = '<tobe/>';
    const backend = {
        getDefinitionDetailLite: async () => ({ definition: { tobe_bpmn: tobe } }),
        getRawDefinition: async (id, options) => {
            assert.equal(id, 'child');
            assert.deepEqual(options, { type: 'bpmn' });
            return '<asis/>';
        }
    };
    assert.equal(await resolveLinkedProcessXml(backend, 'child', 'to-be'), '<tobe/>');
    tobe = '';
    assert.equal(await resolveLinkedProcessXml(backend, 'child', 'to-be'), '<asis/>');
});

test('As-Is accepts both XML strings and backend records', async () => {
    for (const raw of ['<asis/>', { bpmn: '<asis/>' }, { snapshot: '<asis/>' }]) {
        assert.equal(await resolveLinkedProcessXml({ getRawDefinition: async () => raw }, 'child'), '<asis/>');
    }
});
