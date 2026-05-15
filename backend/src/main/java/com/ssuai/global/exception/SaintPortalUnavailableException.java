package com.ssuai.global.exception;

/**
 * Thrown when the saint.ssu.ac.kr phase 2 portal fetch fails or returns HTML
 * that cannot be parsed into a student identity (missing {@code main_box09}
 * cells, blank required fields, upstream 5xx). Like
 * {@link SaintAuthFailedException}, the SSO callback controller maps this
 * to a 302 redirect with {@code error=portal_unavailable} instead of a JSON
 * error body.
 */
public class SaintPortalUnavailableException extends RuntimeException {

    public SaintPortalUnavailableException(String message) {
        super(message);
    }

    public SaintPortalUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
