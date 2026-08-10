/**
 * MCP Validator API Service
 *
 * mcp-validator 서버와 통신해 MCP 서버 설정을 검증하고 사용 가능한 도구 목록을 조회한다.
 */
const normalizeBaseUrl = (value, fallback) => {
    const v = (value ?? '').toString().trim();
    if (!v || v === '/') return fallback;
    return v.endsWith('/') ? v.slice(0, -1) : v;
};

const MCP_VALIDATOR_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_MCP_VALIDATOR_URL, '/mcp-validator');

class McpValidatorService {
    constructor() {
        this.baseUrl = MCP_VALIDATOR_BASE_URL;
    }

    /**
     * @param {Record<string, any>} mcpServers - 서버 이름 -> 설정
     * @param {number} timeout - 연결 테스트 타임아웃(초)
     */
    async validateServers(mcpServers, timeout = 10) {
        const response = await fetch(`${this.baseUrl}/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mcpServers, timeout })
        });

        if (!response.ok) {
            throw new Error(`MCP Validator API error: ${response.status}`);
        }

        return response.json();
    }

    async validateServer(serverName, serverConfig, timeout = 10) {
        const result = await this.validateServers({ [serverName]: serverConfig }, timeout);
        return result.servers && result.servers.length ? result.servers[0] : null;
    }
}

export default new McpValidatorService();
