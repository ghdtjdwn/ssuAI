package com.ssuai.domain.saint.service;

import org.springframework.stereotype.Service;

import com.ssuai.domain.auth.saint.PortalCookies;
import com.ssuai.domain.auth.saint.SaintSessionStore;
import com.ssuai.domain.saint.connector.SaintScheduleConnector;
import com.ssuai.domain.saint.dto.ScheduleResponse;
import com.ssuai.global.exception.SaintSessionExpiredException;
import com.ssuai.global.exception.UnauthorizedException;

/**
 * Façade for the realtime u-SAINT timetable fetch (Task 16 PR 16b).
 *
 * <p>Reads the post-SSO portal cookies for the caller out of
 * {@link SaintSessionStore} and hands them to the active
 * {@link SaintScheduleConnector}. A missing or expired store entry surfaces
 * as {@link SaintSessionExpiredException}, which the global handler maps to
 * HTTP 401 {@code SAINT_SESSION_EXPIRED} so the frontend can route the user
 * back to the SmartID login. Connector-side detection of an upstream auth
 * failure (logon page returned in place of the timetable) raises the same
 * exception from inside {@code fetchSchedule}, so both paths converge on
 * the same error code.
 *
 * <p>No in-memory caching yet — every controller call re-runs the multi-term
 * iterate against ecc. The cookie store TTL bounds how often this can
 * happen (30 minutes), and Mock is the default profile, so prod is the only
 * place this matters; spec §6 #5 tracks the eventual cache.
 */
@Service
public class SaintScheduleService {

    private final SaintScheduleConnector connector;
    private final SaintSessionStore sessionStore;

    public SaintScheduleService(SaintScheduleConnector connector, SaintSessionStore sessionStore) {
        this.connector = connector;
        this.sessionStore = sessionStore;
    }

    public ScheduleResponse fetchSchedule(String studentId) {
        if (studentId == null || studentId.isBlank()) {
            throw new UnauthorizedException();
        }
        PortalCookies cookies = sessionStore.cookies(studentId)
                .orElseThrow(SaintSessionExpiredException::new);
        return connector.fetchSchedule(studentId, cookies);
    }
}
