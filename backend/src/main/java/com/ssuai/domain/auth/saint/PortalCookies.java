package com.ssuai.domain.auth.saint;

/**
 * Raw {@code Cookie} header value captured at the end of the saint
 * two-phase SSO handshake. The value is intentionally opaque — it is the
 * exact string a connector must echo back to {@code saint.ssu.ac.kr} on
 * authenticated requests for that user.
 *
 * <p>This record is the *plaintext* shape. {@code SaintSessionStore}
 * encrypts the {@code rawCookieHeader} at rest with AES-GCM; only callers
 * of {@code SaintSessionStore.cookies(...)} see this type.
 *
 * <p>Never log {@code rawCookieHeader} directly — see
 * {@code docs/security.md} §4. The store exposes a SHA-256 fingerprint
 * helper for log correlation.
 */
public record PortalCookies(String rawCookieHeader) {

    public PortalCookies {
        if (rawCookieHeader == null || rawCookieHeader.isBlank()) {
            throw new IllegalArgumentException("rawCookieHeader is required");
        }
    }
}
