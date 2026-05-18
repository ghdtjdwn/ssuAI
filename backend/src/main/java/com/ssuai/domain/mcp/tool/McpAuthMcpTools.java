package com.ssuai.domain.mcp.tool;

import java.util.Arrays;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;

import com.ssuai.domain.auth.mcp.McpAuthService;
import com.ssuai.domain.auth.mcp.McpAuthSession;
import com.ssuai.domain.auth.mcp.McpAuthSessionId;
import com.ssuai.domain.auth.mcp.McpAuthStateEntry;
import com.ssuai.domain.auth.mcp.McpAuthUrlFactory;
import com.ssuai.domain.auth.mcp.McpProviderType;
import com.ssuai.domain.auth.mcp.dto.McpAuthLogoutResponse;
import com.ssuai.domain.auth.mcp.dto.McpAuthStartResponse;
import com.ssuai.domain.auth.mcp.dto.McpAuthStatusResponse;
import com.ssuai.domain.auth.mcp.dto.McpProviderStatusEntry;

/**
 * MCP tools for the auth session lifecycle (Task 18 Slice B).
 *
 * <p>These are the public-facing auth tools that external MCP clients call to check
 * their authentication state and initiate or revoke provider sessions. They do NOT
 * return any student ID, cookie, or token value.
 *
 * <p>All log output uses session fingerprints, never raw {@code mcpSessionId} values.
 */
@Component
public class McpAuthMcpTools {

    private static final Logger log = LoggerFactory.getLogger(McpAuthMcpTools.class);

    private final McpAuthService mcpAuthService;
    private final McpAuthUrlFactory urlFactory;

    public McpAuthMcpTools(McpAuthService mcpAuthService, McpAuthUrlFactory urlFactory) {
        this.mcpAuthService = mcpAuthService;
        this.urlFactory = urlFactory;
    }

    @Tool(
            name = "get_auth_status",
            description = "MCP 인증 세션의 현재 상태를 반환합니다. "
                    + "각 provider(SAINT/LMS/LIBRARY)의 연결 여부를 확인합니다. "
                    + "mcp_session_id가 없거나 유효하지 않으면 모든 provider가 미연결 상태로 반환됩니다."
    )
    public McpAuthStatusResponse getAuthStatus(String mcp_session_id) {
        McpAuthSession session = mcpAuthService.find(mcp_session_id).orElse(null);
        String sessionIdValue = session != null ? session.id().value() : null;

        List<McpProviderStatusEntry> providers = Arrays.stream(McpProviderType.values())
                .map(p -> {
                    if (session == null) {
                        return McpProviderStatusEntry.notLinked(p);
                    }
                    return session.provider(p)
                            .map(link -> McpProviderStatusEntry.linked(p, link.linkedAt()))
                            .orElseGet(() -> McpProviderStatusEntry.notLinked(p));
                })
                .toList();

        if (session != null) {
            log.debug("get_auth_status session={}", session.id().fingerprint());
        }
        return new McpAuthStatusResponse(sessionIdValue, providers);
    }

    @Tool(
            name = "start_auth",
            description = "지정한 provider(SAINT/LMS/LIBRARY)에 대한 로그인 URL을 생성합니다. "
                    + "mcp_session_id가 없으면 새 세션을 발급합니다. "
                    + "반환된 loginUrl을 브라우저에서 열어 로그인을 완료하면, "
                    + "이후 private tool 호출 시 mcpSessionId를 인자로 전달하세요."
    )
    public McpAuthStartResponse startAuth(String provider, String mcp_session_id) {
        McpProviderType providerType = parseProvider(provider);
        if (providerType == null) {
            return new McpAuthStartResponse(
                    "ERROR", provider, mcp_session_id, null, null,
                    "알 수 없는 provider: " + provider + ". SAINT, LMS, LIBRARY 중 하나를 사용하세요.");
        }

        McpAuthSession session = mcpAuthService.getOrCreate(mcp_session_id);
        McpAuthStateEntry state = mcpAuthService.generateState(session.id(), providerType);
        String loginUrl = urlFactory.buildLoginUrl(providerType, state.state());

        log.debug("start_auth session={} provider={}", session.id().fingerprint(), providerType);
        return new McpAuthStartResponse(
                "LOGIN_STARTED",
                providerType.name(),
                session.id().value(),
                loginUrl,
                state.expiresAt(),
                "브라우저에서 loginUrl을 열어 로그인을 완료하세요. "
                        + "완료 후 mcpSessionId(" + session.id().value() + ")를 사용해 private tool을 다시 호출하세요.");
    }

    @Tool(
            name = "logout_provider",
            description = "지정한 provider(SAINT/LMS/LIBRARY)의 인증 세션을 해제합니다. "
                    + "mcp_session_id와 provider가 모두 필요합니다."
    )
    public McpAuthLogoutResponse logoutProvider(String provider, String mcp_session_id) {
        McpProviderType providerType = parseProvider(provider);
        if (providerType == null) {
            return new McpAuthLogoutResponse("ERROR", mcp_session_id, provider,
                    "알 수 없는 provider: " + provider);
        }
        if (mcp_session_id == null || mcp_session_id.isBlank()) {
            return new McpAuthLogoutResponse("ERROR", null, provider, "mcp_session_id가 필요합니다.");
        }

        McpAuthSession session = mcpAuthService.find(mcp_session_id).orElse(null);
        if (session == null) {
            return new McpAuthLogoutResponse("ERROR", mcp_session_id, provider,
                    "유효한 MCP 세션이 없습니다.");
        }

        mcpAuthService.unlinkProvider(session.id(), providerType);
        log.debug("logout_provider session={} provider={}", session.id().fingerprint(), providerType);
        return McpAuthLogoutResponse.providerLogout(session.id().value(), providerType.name());
    }

    @Tool(
            name = "logout_all",
            description = "MCP 인증 세션 전체를 삭제합니다. 모든 provider 연결이 해제됩니다. "
                    + "mcp_session_id가 필요합니다."
    )
    public McpAuthLogoutResponse logoutAll(String mcp_session_id) {
        if (mcp_session_id == null || mcp_session_id.isBlank()) {
            return new McpAuthLogoutResponse("ERROR", null, null, "mcp_session_id가 필요합니다.");
        }

        McpAuthSession session = mcpAuthService.find(mcp_session_id).orElse(null);
        if (session == null) {
            return new McpAuthLogoutResponse("ERROR", mcp_session_id, null,
                    "유효한 MCP 세션이 없습니다.");
        }

        mcpAuthService.invalidateSession(session.id());
        log.debug("logout_all session={}", new McpAuthSessionId(mcp_session_id).fingerprint());
        return McpAuthLogoutResponse.allLogout(mcp_session_id);
    }

    private static McpProviderType parseProvider(String provider) {
        if (provider == null) {
            return null;
        }
        try {
            return McpProviderType.valueOf(provider.toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
