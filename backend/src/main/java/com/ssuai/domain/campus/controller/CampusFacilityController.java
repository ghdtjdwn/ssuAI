package com.ssuai.domain.campus.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ssuai.domain.campus.dto.CampusFacilityListResponse;
import com.ssuai.domain.campus.service.CampusFacilityService;
import com.ssuai.global.response.ApiResponse;

@RestController
@RequestMapping("/api/campus/facilities")
public class CampusFacilityController {

    private final CampusFacilityService campusFacilityService;

    public CampusFacilityController(CampusFacilityService campusFacilityService) {
        this.campusFacilityService = campusFacilityService;
    }

    @GetMapping
    public ApiResponse<CampusFacilityListResponse> getFacilities(
            @RequestParam(required = false) String query
    ) {
        return ApiResponse.success(campusFacilityService.searchFacilities(query));
    }
}
