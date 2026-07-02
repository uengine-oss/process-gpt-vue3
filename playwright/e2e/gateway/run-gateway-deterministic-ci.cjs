const { spawnSync } = require('node:child_process');
const path = require('node:path');

const playwrightCli = path.join(
    process.cwd(),
    'node_modules',
    '@playwright',
    'test',
    'cli.js'
);

const result = spawnSync(process.execPath, [
    playwrightCli,
    'test',
    'playwright/e2e/gateway/gateway-regression-branches.spec.ts',
    '--reporter=list'
], {
    stdio: 'inherit',
    env: {
        ...process.env,
        GATEWAY_REGRESSION_MODE: 'deterministic'
    }
});

if (result.error) {
    console.error(result.error);
}

process.exit(result.status ?? 1);
