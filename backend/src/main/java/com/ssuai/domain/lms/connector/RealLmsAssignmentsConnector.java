package com.ssuai.domain.lms.connector;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import com.ssuai.domain.auth.lms.LmsCookies;
import com.ssuai.domain.auth.lms.LmsSsoProperties;
import com.ssuai.domain.lms.dto.AssignmentItem;
import com.ssuai.domain.lms.dto.AssignmentsResponse;
import com.ssuai.global.exception.LmsSessionExpiredException;

/**
 * Calls the canvas.ssu.ac.kr LearningX API with the student's session cookies.
 *
 * <p>Three-step flow per call:
 * <ol>
 *   <li>GET {@code /learningx/api/v1/users/{studentId}/terms} — pick the first
 *       (most-recent) term id returned by canvas.</li>
 *   <li>GET {@code /learningx/api/v1/learn_activities/courses?term_ids[]={termId}}
 *       — build a map from course id → course name.</li>
 *   <li>GET {@code /learningx/api/v1/learn_activities/to_dos?term_ids[]={termId}}
 *       — flatten the {@code todo_list} arrays into {@link AssignmentItem}s,
 *       joining course names from step 2.</li>
 * </ol>
 *
 * <p>A 401 from canvas is treated as a session expiry
 * ({@link LmsSessionExpiredException}). Any other non-2xx is an I/O error.
 */
@Component
@ConditionalOnProperty(name = "ssuai.connector.lms-assignments", havingValue = "real")
class RealLmsAssignmentsConnector implements LmsAssignmentsConnector {

    private static final Logger log = LoggerFactory.getLogger(RealLmsAssignmentsConnector.class);

    private final LmsSsoProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    RealLmsAssignmentsConnector(LmsSsoProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NORMAL)
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    @Override
    public AssignmentsResponse fetchAssignments(String studentId, LmsCookies cookies) {
        String cookieHeader = cookies.rawCookieHeader();
        long termId = fetchCurrentTermId(studentId, cookieHeader);
        Map<Long, String> courseNames = fetchCourseNames(termId, cookieHeader);
        List<AssignmentItem> items = fetchTodoItems(termId, courseNames, cookieHeader);
        return new AssignmentsResponse(termId, items);
    }

    private long fetchCurrentTermId(String studentId, String cookieHeader) {
        String encoded = URLEncoder.encode(studentId, StandardCharsets.UTF_8);
        String url = properties.getCanvasBaseUrl()
                + "/learningx/api/v1/users/" + encoded
                + "/terms?include_invited_course_contained=true";
        JsonNode body = getJson(url, cookieHeader);
        // Canvas returns the list with most-recent term first.
        if (body.isArray() && !body.isEmpty()) {
            return body.get(0).path("id").asLong();
        }
        throw new LmsSessionExpiredException("no terms returned for student");
    }

    private Map<Long, String> fetchCourseNames(long termId, String cookieHeader) {
        String url = properties.getCanvasBaseUrl()
                + "/learningx/api/v1/learn_activities/courses?term_ids[]=" + termId;
        JsonNode body = getJson(url, cookieHeader);
        Map<Long, String> map = new HashMap<>();
        if (body.isArray()) {
            for (JsonNode course : body) {
                long id = course.path("id").asLong();
                String name = course.path("name").asText("");
                if (id > 0) {
                    map.put(id, name);
                }
            }
        }
        return map;
    }

    private List<AssignmentItem> fetchTodoItems(
            long termId, Map<Long, String> courseNames, String cookieHeader) {
        String url = properties.getCanvasBaseUrl()
                + "/learningx/api/v1/learn_activities/to_dos?term_ids[]=" + termId;
        JsonNode body = getJson(url, cookieHeader);
        JsonNode todos = body.path("to_dos");
        List<AssignmentItem> items = new ArrayList<>();
        if (todos.isArray()) {
            for (JsonNode courseNode : todos) {
                long courseId = courseNode.path("course_id").asLong();
                String courseName = courseNames.getOrDefault(courseId, "Unknown Course");
                JsonNode todoList = courseNode.path("todo_list");
                if (todoList.isArray()) {
                    for (JsonNode todo : todoList) {
                        String title = todo.path("title").asText("");
                        String type = todo.path("component_type").asText("assignment");
                        String dueDate = todo.path("due_date").isNull()
                                ? null : todo.path("due_date").asText(null);
                        items.add(new AssignmentItem(courseName, title, type, dueDate));
                    }
                }
            }
        }
        return items;
    }

    private JsonNode getJson(String url, String cookieHeader) {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Cookie", cookieHeader)
                .header("Accept", "application/json")
                .timeout(properties.getTimeout())
                .GET()
                .build();
        try {
            HttpResponse<String> response = httpClient.send(
                    request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() == 401) {
                String bodySnippet = response.body() == null ? "(null)"
                        : response.body().substring(0, Math.min(400, response.body().length()))
                                .replaceAll("\\s+", " ");
                log.warn("lms canvas 401: url={} body='{}'", url, bodySnippet);
                throw new LmsSessionExpiredException("canvas returned 401 — session expired");
            }
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new LmsSessionExpiredException(
                        "canvas API error: status=" + response.statusCode() + " url=" + url);
            }
            return objectMapper.readTree(response.body());
        } catch (LmsSessionExpiredException exception) {
            throw exception;
        } catch (IOException exception) {
            throw new LmsSessionExpiredException("canvas API io error: " + exception.getMessage());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new LmsSessionExpiredException("canvas API interrupted");
        }
    }
}
