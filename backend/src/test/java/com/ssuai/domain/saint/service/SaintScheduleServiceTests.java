package com.ssuai.domain.saint.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;

import com.ssuai.domain.auth.saint.PortalCookies;
import com.ssuai.domain.auth.saint.SaintSessionStore;
import com.ssuai.domain.saint.connector.SaintScheduleConnector;
import com.ssuai.domain.saint.dto.ScheduleEntry;
import com.ssuai.domain.saint.dto.ScheduleResponse;
import com.ssuai.domain.saint.dto.TermSchedule;
import com.ssuai.global.exception.SaintSessionExpiredException;
import com.ssuai.global.exception.UnauthorizedException;

class SaintScheduleServiceTests {

    private final SaintScheduleConnector connector = mock(SaintScheduleConnector.class);
    private final SaintSessionStore sessionStore = mock(SaintSessionStore.class);
    private final SaintScheduleService service = new SaintScheduleService(connector, sessionStore);

    @Test
    void happyPathReadsCookiesAndDelegatesToConnector() {
        PortalCookies cookies = new PortalCookies("MYSAPSSO2=abc");
        ScheduleResponse stub = new ScheduleResponse(2024, 2026, 1, List.of(
                new TermSchedule(2026, 1, List.of(
                        new ScheduleEntry(1, "월", 3, "10:30-11:45",
                                "자료구조", "김교수", "정보과학관 30100")))));
        when(sessionStore.cookies("20241234")).thenReturn(Optional.of(cookies));
        when(connector.fetchSchedule("20241234", cookies)).thenReturn(stub);

        ScheduleResponse result = service.fetchSchedule("20241234");

        assertThat(result).isSameAs(stub);
        verify(connector).fetchSchedule("20241234", cookies);
    }

    @Test
    void missingCookiesRaiseSaintSessionExpired() {
        when(sessionStore.cookies("20241234")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.fetchSchedule("20241234"))
                .isInstanceOf(SaintSessionExpiredException.class);

        verify(connector, never()).fetchSchedule(any(), any());
    }

    @Test
    void connectorMayItselfRaiseSaintSessionExpiredAndItPropagates() {
        PortalCookies cookies = new PortalCookies("MYSAPSSO2=stale");
        when(sessionStore.cookies("20241234")).thenReturn(Optional.of(cookies));
        when(connector.fetchSchedule(eq("20241234"), any()))
                .thenThrow(new SaintSessionExpiredException("upstream gate"));

        assertThatThrownBy(() -> service.fetchSchedule("20241234"))
                .isInstanceOf(SaintSessionExpiredException.class);
    }

    @Test
    void blankStudentIdRaisesUnauthorizedBeforeTouchingStore() {
        assertThatThrownBy(() -> service.fetchSchedule(null))
                .isInstanceOf(UnauthorizedException.class);
        assertThatThrownBy(() -> service.fetchSchedule(""))
                .isInstanceOf(UnauthorizedException.class);
        assertThatThrownBy(() -> service.fetchSchedule("   "))
                .isInstanceOf(UnauthorizedException.class);

        verifyNoInteractions(sessionStore, connector);
    }
}
