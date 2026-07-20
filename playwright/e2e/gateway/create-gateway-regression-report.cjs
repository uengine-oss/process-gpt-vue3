const fs = require('node:fs');
const path = require('node:path');

const dir = 'D:/uEngineProject/process-gpt-vue3/playwright/test-results/gateway-regression-processes';
const items = [
    {
        id: 'exclusive-explicit-join-4',
        title: 'Exclusive explicit join, 4 branches',
        status: 'PASS',
        results: [
            ['deterministic', 'PASS', 'branch_3', 'merge_task', 'merge_task'],
            ['AI', 'PASS', 'branch_3', 'merge_task', 'merge_task'],
            ['coverage deterministic', 'PASS', 'branch_1', 'merge_task', 'merge_task'],
            ['coverage AI', 'PASS', 'branch_1', 'merge_task', 'merge_task']
        ],
        note: 'Explicit exclusive join proceeds to merge_task in deterministic and AI tests, including a non-default branch_1 path.'
    },
    {
        id: 'inclusive-explicit-join-4',
        title: 'Inclusive explicit join, 4 branches',
        status: 'PASS',
        results: [
            ['deterministic', 'PASS', 'branch_2, branch_3', 'merge_task', 'merge_task'],
            ['AI', 'PASS', 'branch_2, branch_3', 'merge_task', 'merge_task'],
            ['coverage deterministic', 'PASS', 'branch_4', 'merge_task', 'merge_task'],
            ['coverage AI', 'PASS', 'branch_4', 'merge_task', 'merge_task']
        ],
        note: 'Explicit inclusive join proceeds to merge_task for selected branches, including multi-branch and single-branch selections.'
    },
    {
        id: 'parallel-explicit-join-4',
        title: 'Parallel explicit join, 4 branches',
        status: 'PASS',
        results: [['deterministic', 'PASS', 'branch_1, branch_2, branch_3, branch_4', 'merge_task', 'merge_task']],
        note: 'Explicit parallel join proceeds when all branches are done. AI condition evaluation is not applicable to parallel split.'
    },
    {
        id: 'exclusive-direct-merge-8',
        title: 'Exclusive direct merge, 8 branches',
        status: 'PASS',
        results: [
            ['deterministic', 'PASS', 'branch_3', 'merge_task', 'merge_task'],
            ['AI', 'PASS', 'branch_3', 'merge_task', 'merge_task'],
            ['coverage deterministic', 'PASS', 'branch_8', 'merge_task', 'merge_task'],
            ['coverage AI', 'PASS', 'branch_8', 'merge_task', 'merge_task']
        ],
        note: 'Direct exclusive merge now behaves as an implicit join and proceeds to merge_task for different single selected branches.'
    },
    {
        id: 'inclusive-direct-merge-4',
        title: 'Inclusive direct merge, 4 branches',
        status: 'PASS',
        results: [
            ['deterministic', 'PASS', 'branch_2, branch_3', 'merge_task', 'merge_task'],
            ['AI', 'PASS', 'branch_2, branch_3', 'merge_task', 'merge_task'],
            ['coverage deterministic single', 'PASS', 'branch_2', 'merge_task', 'merge_task'],
            ['coverage AI single', 'PASS', 'branch_2', 'merge_task', 'merge_task'],
            ['coverage deterministic triple', 'PASS', 'branch_1, branch_2, branch_3', 'merge_task', 'merge_task'],
            ['coverage AI triple', 'PASS', 'branch_1, branch_2, branch_3', 'merge_task', 'merge_task']
        ],
        note: 'Direct inclusive merge now behaves as an implicit join for single, double, and triple selected branch combinations.'
    },
    {
        id: 'parallel-direct-merge-4',
        title: 'Parallel direct merge, 4 branches',
        status: 'PASS',
        results: [['deterministic', 'PASS', 'branch_1, branch_2, branch_3, branch_4', 'merge_task', 'merge_task']],
        note: 'Direct parallel merge proceeds when all branches are done. AI condition evaluation is not applicable to parallel split.'
    },
    {
        id: 'parallel-direct-merge-waits-4',
        title: 'Parallel direct merge waits, 4 branches',
        status: 'PASS',
        results: [['deterministic negative', 'PASS', 'branch_1, branch_2, branch_3, branch_4', 'merge_task', 'empty']],
        note: 'Direct parallel merge waits when only branch_1 is DONE and the other parallel branches are still TODO.'
    },
    {
        id: 'exclusive-direct-merge-then-inclusive-split',
        title: 'Exclusive direct merge then inclusive split',
        status: 'PASS',
        results: [
            ['deterministic', 'PASS', 'branch_3; then follow_branch_2, follow_branch_3', 'merge_task', 'merge_task'],
            ['AI', 'PASS', 'branch_2; then follow_branch_2, follow_branch_3', 'merge_task', 'merge_task']
        ],
        note: 'After an exclusive direct merge, a following inclusive split can still select multiple downstream branches.'
    },
    {
        id: 'inclusive-direct-merge-then-exclusive-split',
        title: 'Inclusive direct merge then exclusive split',
        status: 'PASS',
        results: [
            ['deterministic', 'PASS', 'branch_2, branch_3; then follow_branch_3', 'merge_task', 'merge_task'],
            ['AI', 'PASS', 'branch_3; then follow_branch_3', 'merge_task', 'merge_task']
        ],
        note: 'After an inclusive direct merge, a following exclusive split still selects a single priority branch.'
    },
    {
        id: 'nested-branch-inclusive-direct-merge',
        title: 'Nested branch split then direct merge',
        status: 'PASS',
        results: [
            ['deterministic', 'PASS', 'branch_3; then nested_branch_2, nested_branch_3', 'nested_merge_task', 'nested_merge_task'],
            ['AI', 'PASS', 'branch_3; then nested_branch_3', 'nested_merge_task', 'nested_merge_task'],
            ['coverage deterministic', 'PASS', 'branch_3; then nested_branch_2', 'nested_merge_task', 'nested_merge_task']
        ],
        note: 'A selected branch can split again, then selected nested branches can direct-merge into nested_merge_task for single and multi nested selections.'
    },
    {
        id: 'inclusive-split-without-merge',
        title: 'Inclusive split without merge',
        status: 'PASS',
        results: [
            ['deterministic', 'PASS', 'branch_2, branch_3', 'branch_2_end, branch_3_end', 'branch_2_end, branch_3_end'],
            ['AI', 'PASS', 'branch_2, branch_3', 'branch_2_end, branch_3_end', 'branch_2_end, branch_3_end'],
            ['coverage deterministic', 'PASS', 'branch_2', 'branch_2_end', 'branch_2_end'],
            ['coverage AI', 'PASS', 'branch_2', 'branch_2_end', 'branch_2_end']
        ],
        note: 'Selected branches can proceed independently to their own end events without merging, for single and multi selections.'
    },
    {
        id: 'exclusive-direct-merge-with-mid-task',
        title: 'Exclusive direct merge with mid task',
        status: 'PASS',
        results: [
            ['deterministic', 'PASS', 'branch_3; branch_3_mid_task; branch_3_alert_task', 'merge_task', 'merge_task'],
            ['AI', 'PASS', 'branch_3; branch_3_mid_task; branch_3_alert_task', 'merge_task', 'merge_task']
        ],
        note: 'An exclusive branch can contain intermediate tasks before direct-merging into merge_task.'
    }
];

const sections = items
    .map((item, index) => {
        const { id, title, status, results, note } = item;
        const file = path.join(dir, `${id}.png`);
        const b64 = fs.readFileSync(file).toString('base64');
        const statusClass = status === 'PASS' ? 'pass' : 'fail';
        const rows = results
            .map(([mode, rowStatus, selected, resolved, filtered]) => {
                const rowClass = rowStatus === 'PASS' ? 'passText' : 'failText';
                return `<tr>
      <td>${mode}</td>
      <td class="${rowClass}">${rowStatus}</td>
      <td>${selected}</td>
      <td>${resolved}</td>
      <td>${filtered}</td>
    </tr>`;
            })
            .join('\n');
        return `<section>
  <h2>${index + 1}. ${title} <span class="badge ${statusClass}">${status}</span></h2>
  <table>
    <thead>
      <tr>
        <th>Mode</th>
        <th>Result</th>
        <th>Selected branch</th>
        <th>Resolved after branch</th>
        <th>Filtered after check_task_status</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
  <table>
    <tr><th>Note</th><td>${note}</td></tr>
  </table>
  <img src="data:image/png;base64,${b64}" alt="${title}" />
</section>`;
    })
    .join('\n');

const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Gateway regression processes</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; background: #fff; color: #111; }
    section { margin: 0 0 40px; }
    h1 { font-size: 24px; margin: 0 0 24px; }
    h2 { font-size: 18px; margin: 0 0 12px; display: flex; align-items: center; gap: 8px; }
    table { border-collapse: collapse; margin: 0 0 14px; min-width: 720px; }
    th, td { border: 1px solid #ddd; padding: 7px 10px; text-align: left; font-size: 14px; }
    th { background: #f7f7f7; }
    .passText { color: #137333; font-weight: 700; }
    .failText { color: #b3261e; font-weight: 700; }
    .badge { display: inline-block; border-radius: 4px; padding: 2px 8px; font-size: 12px; color: #fff; }
    .pass { background: #137333; }
    .fail { background: #b3261e; }
    img { display: block; max-width: 100%; border: 1px solid #ddd; }
  </style>
</head>
<body>
  <h1>Gateway regression processes</h1>
  ${sections}
</body>
</html>
`;

const out = path.join(dir, 'index.html');
fs.writeFileSync(out, html, 'utf8');
console.log(out);
