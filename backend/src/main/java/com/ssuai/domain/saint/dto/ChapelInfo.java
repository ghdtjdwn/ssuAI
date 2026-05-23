package com.ssuai.domain.saint.dto;

import java.util.List;

public record ChapelInfo(
        int year,
        String semester,
        String chapelTime,
        String chapelRoom,
        Integer absenceAllowedMinutes,
        int absenceUsedMinutes,
        String result,
        List<ChapelAttendanceEntry> attendances
) {

    public ChapelInfo {
        attendances = attendances == null ? List.of() : List.copyOf(attendances);
    }
}
