package com.ssuai.domain.auth.mcp;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * MCP auth flow for the library (Task 18 Slice B — start endpoint only).
 *
 * <p>Unlike SAINT/LMS, the library uses its own credential login (not SmartID SSO),
 * so the login UI lives on the frontend at {@code /mcp/auth/library}.
 * This start endpoint redirects the browser there with the state param attached;
 * the frontend page handles the credential form and calls the backend callback.
 *
 * <p>Full library credential callback (POST with username/password → Pyxis token)
 * is implemented in Slice C.
 */
@RestController
@RequestMapping("/api/mcp/auth/library")
public class McpLibraryAuthController {

    private static final Logger log = LoggerFactory.getLogger(McpLibraryAuthController.class);

    private final String frontendOrigin;

    public McpLibraryAuthController(@Value("${ssuai.frontend.origin:}") String frontendOrigin) {
        this.frontendOrigin = frontendOrigin;
    }

    /**
     * Redirects the browser to the frontend library login page with the state param.
     * The frontend form will POST credentials and handle the Pyxis auth flow.
     */
    @GetMapping("/start")
    public ResponseEntity<Void> start(@RequestParam String state) {
        String encoded = URLEncoder.encode(state, StandardCharsets.UTF_8);
        String destination = (frontendOrigin.isBlank() ? "" : frontendOrigin)
                + "/mcp/auth/library?state=" + encoded;
        log.debug("mcp library start: redirecting to frontend login page");
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(destination))
                .build();
    }
}
