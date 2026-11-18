package com.voting.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ElectionRequest {

    @NotBlank(message = "Election ID is required")
    private String electionId;

    @NotBlank(message = "Election Title is required")
    private String title;

    private String description;

    @JsonFormat(pattern = "yyyy-MM-dd['T'][ ]HH:mm[:ss]")
    private LocalDateTime startTime;

    @JsonFormat(pattern = "yyyy-MM-dd['T'][ ]HH:mm[:ss]")
    private LocalDateTime endTime;
}
