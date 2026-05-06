package com.ssuai.domain.meal.controller;

import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.isEmptyOrNullString;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.ssuai.domain.meal.dto.MealItem;
import com.ssuai.domain.meal.dto.MealResponse;
import com.ssuai.domain.meal.dto.MealType;
import com.ssuai.domain.meal.service.MealService;

@ActiveProfiles("test")
@WebMvcTest(MealController.class)
class MealControllerTests {

    private final MockMvc mockMvc;

    @MockBean
    private MealService mealService;

    @Autowired
    MealControllerTests(MockMvc mockMvc) {
        this.mockMvc = mockMvc;
    }

    @Test
    void getTodayMealReturnsSuccessEnvelope() throws Exception {
        MealResponse response = new MealResponse(
                LocalDate.of(2026, 5, 6),
                List.of(new MealItem("학생식당", MealType.BREAKFAST, "조식", List.of("쌀밥", "미역국")))
        );
        when(mealService.getTodayMeal()).thenReturn(response);

        mockMvc.perform(get("/api/meals/today"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.date").value(not(isEmptyOrNullString())))
                .andExpect(jsonPath("$.data.meals[0].restaurant").value("학생식당"))
                .andExpect(jsonPath("$.data.meals[0].type").value("BREAKFAST"))
                .andExpect(jsonPath("$.data.meals[0].corner").value("조식"))
                .andExpect(jsonPath("$.data.meals[0].menu").value(not(empty())))
                .andExpect(jsonPath("$.data.closures").value(empty()))
                .andExpect(jsonPath("$.error").value(nullValue()))
                .andExpect(jsonPath("$.traceId").value(not(isEmptyOrNullString())));
    }
}
