package com.voting.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class VerifyRequest {

    @NotBlank(message = "Voter ID is required")
    private String voterId;

    @NotBlank(message = "Live webcam image frame is required")
    private String frame;
}
