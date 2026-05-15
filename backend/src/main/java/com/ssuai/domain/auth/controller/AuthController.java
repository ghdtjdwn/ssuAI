package com.ssuai.domain.auth.controller;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssuai.domain.auth.AuthProperties;
import com.ssuai.domain.auth.dto.MeResponse;
import com.ssuai.domain.auth.dto.RefreshResponse;
import com.ssuai.domain.user.entity.Student;
import com.ssuai.domain.user.service.StudentService;
import com.ssuai.global.auth.AuthAttributes;
import com.ssuai.global.auth.InvalidJwtException;
import com.ssuai.global.auth.JwtClaims;
import com.ssuai.global.auth.JwtProperties;
import com.ssuai.global.auth.JwtProvider;
import com.ssuai.global.auth.JwtTokenType;
import com.ssuai.global.exception.UnauthorizedException;
import com.ssuai.global.response.ApiResponse;

/**
 * Authenticated endpoints for the current ssuAI user. Reads the student
 * identity off the request attributes populated by
 * {@code JwtAuthFilter} for {@code /me} — Spring Security is intentionally
 * not in play (Task 14 spec §6). The refresh endpoint reads the refresh
 * JWT directly out of the HttpOnly cookie set by the SSO callback.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final StudentService studentService;
    private final JwtProvider jwtProvider;
    private final JwtProperties jwtProperties;
    private final AuthProperties authProperties;

    public AuthController(
            StudentService studentService,
            JwtProvider jwtProvider,
            JwtProperties jwtProperties,
            AuthProperties authProperties) {
        this.studentService = studentService;
        this.jwtProvider = jwtProvider;
        this.jwtProperties = jwtProperties;
        this.authProperties = authProperties;
    }

    @GetMapping("/me")
    public ApiResponse<MeResponse> me(HttpServletRequest request) {
        Object studentId = request.getAttribute(AuthAttributes.STUDENT_ID);
        if (!(studentId instanceof String id) || id.isBlank()) {
            throw new UnauthorizedException();
        }
        Student student = studentService.findById(id)
                .orElseThrow(UnauthorizedException::new);
        return ApiResponse.success(MeResponse.from(student));
    }

    /**
     * Reads the refresh JWT out of the HttpOnly cookie, validates + parses
     * it, issues a fresh access JWT, and rotates the refresh JWT (the
     * new refresh JWT is written back as a Set-Cookie). The access JWT
     * is returned in the body — the frontend keeps it in memory only.
     */
    @PostMapping("/refresh")
    public ApiResponse<RefreshResponse> refresh(
            HttpServletRequest request,
            HttpServletResponse response) {
        String refreshToken = readRefreshCookie(request);
        if (refreshToken == null) {
            throw new UnauthorizedException();
        }
        JwtClaims claims;
        try {
            claims = jwtProvider.parse(refreshToken, JwtTokenType.REFRESH);
        } catch (InvalidJwtException exception) {
            throw new UnauthorizedException();
        }
        Student student = studentService.findById(claims.studentId())
                .orElseThrow(UnauthorizedException::new);

        String accessToken = jwtProvider.issueAccess(student);
        String rotatedRefresh = jwtProvider.issueRefresh(student);
        response.addHeader(HttpHeaders.SET_COOKIE, buildRefreshCookie(rotatedRefresh).toString());

        return ApiResponse.success(new RefreshResponse(
                accessToken,
                jwtProperties.getAccessTtl().getSeconds()));
    }

    private String readRefreshCookie(HttpServletRequest request) {
        String cookieName = authProperties.getRefreshCookie().getName();
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if (cookieName.equals(cookie.getName())) {
                String value = cookie.getValue();
                return (value == null || value.isBlank()) ? null : value;
            }
        }
        return null;
    }

    private ResponseCookie buildRefreshCookie(String refreshToken) {
        AuthProperties.RefreshCookie cookieConfig = authProperties.getRefreshCookie();
        return ResponseCookie.from(cookieConfig.getName(), refreshToken)
                .httpOnly(true)
                .secure(cookieConfig.isSecure())
                .sameSite(cookieConfig.getSameSite())
                .path(cookieConfig.getPath())
                .maxAge(jwtProperties.getRefreshTtl())
                .build();
    }
}
