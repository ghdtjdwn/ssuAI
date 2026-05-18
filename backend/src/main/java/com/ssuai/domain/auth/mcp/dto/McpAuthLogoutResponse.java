package com.ssuai.domain.auth.mcp.dto;

/**
 * Response for {@code logout_provider} and {@code logout_all} MCP tools.
 * {@code provider} is null for logout_all.
 */
public record McpAuthLogoutResponse(String status, String mcpSessionId, String provider, String message) {

    public static McpAuthLogoutResponse providerLogout(String mcpSessionId, String provider) {
        return new McpAuthLogoutResponse("OK", mcpSessionId, provider,
                provider + " 로그아웃 완료. 다시 사용하려면 start_auth를 호출하세요.");
    }

    public static McpAuthLogoutResponse allLogout(String mcpSessionId) {
        return new McpAuthLogoutResponse("OK", mcpSessionId, null,
                "MCP 세션 전체 로그아웃 완료.");
    }
}
