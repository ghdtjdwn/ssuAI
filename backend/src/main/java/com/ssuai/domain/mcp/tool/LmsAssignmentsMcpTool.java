package com.ssuai.domain.mcp.tool;

import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;

import com.ssuai.domain.lms.dto.AssignmentsResponse;
import com.ssuai.domain.lms.mcp.LmsToolContext;
import com.ssuai.domain.lms.service.LmsAssignmentsService;

/**
 * MCP tool that returns the authenticated student's pending LMS assignments
 * and quizzes for the current term.
 *
 * <p>Takes no caller-supplied student id — same security model as
 * {@link SaintScheduleMcpTool}. The chat path binds the authenticated student
 * id to {@link LmsToolContext} before dispatching; an external MCP client
 * that calls this tool directly will see the context unset and receive an
 * explicit failure.
 */
@Component
public class LmsAssignmentsMcpTool {

    private final LmsAssignmentsService assignmentsService;

    public LmsAssignmentsMcpTool(LmsAssignmentsService assignmentsService) {
        this.assignmentsService = assignmentsService;
    }

    @Tool(
            name = "get_my_assignments",
            description = "로그인된 학생의 현재 학기 LMS (canvas.ssu.ac.kr) 미제출 과제·퀴즈 목록을 가져옵니다. "
                    + "과목명, 제목, 유형(과제/퀴즈), 마감일이 포함됩니다. "
                    + "학번 같은 인자를 받지 않습니다 — 인증된 chat 세션에서만 호출 가능합니다."
    )
    public AssignmentsResponse getMyAssignments() {
        String studentId = LmsToolContext.currentStudentId();
        if (studentId == null || studentId.isBlank()) {
            throw new IllegalStateException(
                    "이 도구는 인증된 chat 세션에서만 호출 가능합니다. "
                            + "외부 MCP 클라이언트는 본인 학번 인자를 전달할 수 없습니다.");
        }
        return assignmentsService.fetchAssignments(studentId);
    }
}
