package com.ssuai.domain.saint.connector;

import com.ssuai.domain.saint.dto.GradesResponse;
import com.ssuai.domain.saint.dto.ScheduleResponse;

public interface RusaintClient {

    RusaintAuthenticatedSession authenticateWithToken(String studentId, String ssoToken);

    ScheduleResponse fetchSchedule(String studentId, String sessionJson);

    GradesResponse fetchGrades(String studentId, String sessionJson);
}
