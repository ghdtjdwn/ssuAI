package com.ssuai.domain.mcp.config;

import org.springframework.ai.tool.ToolCallbackProvider;
import org.springframework.ai.tool.method.MethodToolCallbackProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.ssuai.domain.mcp.tool.CampusMcpTools;
import com.ssuai.domain.mcp.tool.DormMcpTools;
import com.ssuai.domain.mcp.tool.LibraryBookMcpTool;
import com.ssuai.domain.mcp.tool.LibraryLoansMcpTool;
import com.ssuai.domain.mcp.tool.LibrarySeatMcpTool;
import com.ssuai.domain.mcp.tool.LmsAssignmentsMcpTool;
import com.ssuai.domain.mcp.tool.MealMcpTools;
import com.ssuai.domain.mcp.tool.McpAuthMcpTools;
import com.ssuai.domain.mcp.tool.NoticeMcpTools;
import com.ssuai.domain.mcp.tool.SaintExtendedMcpTools;
import com.ssuai.domain.mcp.tool.SaintGradesMcpTool;
import com.ssuai.domain.mcp.tool.SaintScheduleMcpTool;

@Configuration
class McpServerConfig {

    @Bean
    ToolCallbackProvider ssuaiMcpTools(
            MealMcpTools mealMcpTools,
            DormMcpTools dormMcpTools,
            CampusMcpTools campusMcpTools,
            McpAuthMcpTools mcpAuthMcpTools,
            LibrarySeatMcpTool libraryMcpTool,
            LibraryBookMcpTool libraryBookMcpTool,
            LibraryLoansMcpTool libraryLoansMcpTool,
            SaintScheduleMcpTool saintScheduleMcpTool,
            SaintGradesMcpTool saintGradesMcpTool,
            SaintExtendedMcpTools saintExtendedMcpTools,
            LmsAssignmentsMcpTool lmsAssignmentsMcpTool,
            NoticeMcpTools noticeMcpTools
    ) {
        return MethodToolCallbackProvider.builder()
                .toolObjects(
                        mealMcpTools,
                        dormMcpTools,
                        campusMcpTools,
                        mcpAuthMcpTools,
                        libraryMcpTool,
                        libraryBookMcpTool,
                        libraryLoansMcpTool,
                        saintScheduleMcpTool,
                        saintGradesMcpTool,
                        saintExtendedMcpTools,
                        lmsAssignmentsMcpTool,
                        noticeMcpTools)
                .build();
    }
}
