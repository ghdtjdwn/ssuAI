package com.ssuai.domain.meal.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssuai.domain.meal.dto.MealResponse;
import com.ssuai.domain.meal.service.MealService;
import com.ssuai.global.response.ApiResponse;

@RestController
@RequestMapping("/api/meals")
public class MealController {

    private final MealService mealService;

    public MealController(MealService mealService) {
        this.mealService = mealService;
    }

    @GetMapping("/today")
    public ApiResponse<MealResponse> getTodayMeal() {
        return ApiResponse.success(mealService.getTodayMeal());
    }
}
