import { JSONPath } from 'jsonpath-plus';

function toPathArray(path) {
    if (Array.isArray(path)) {
        return path;
    }

    const tokens = ['$'];
    let index = path.startsWith('$') ? 1 : 0;

    while (index < path.length) {
        const char = path[index];

        if (char === '.') {
            index += 1;
            let key = '';
            while (index < path.length && path[index] !== '.' && path[index] !== '[') {
                key += path[index];
                index += 1;
            }
            if (key) {
                tokens.push(key);
            }
            continue;
        }

        if (char === '[') {
            index += 1;
            const quote = path[index];

            if (quote === '\'' || quote === '"') {
                index += 1;
                let key = '';
                while (index < path.length && path[index] !== quote) {
                    key += path[index];
                    index += 1;
                }
                tokens.push(key);
                index += 2;
                continue;
            }

            let raw = '';
            while (index < path.length && path[index] !== ']') {
                raw += path[index];
                index += 1;
            }

            if (/^\d+$/.test(raw)) {
                tokens.push(Number(raw));
            } else if (raw) {
                tokens.push(raw);
            }

            index += 1;
            continue;
        }

        index += 1;
    }

    return tokens;
}

export function query(json, path) {
    return JSONPath({ path, json, wrap: true });
}

export function nodes(json, path) {
    return JSONPath({ path, json, resultType: 'all', wrap: true }).map((result) => ({
        path: toPathArray(result.path),
        value: result.value
    }));
}

export default {
    query,
    nodes
};
