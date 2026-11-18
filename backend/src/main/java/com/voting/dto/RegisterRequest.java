package com.voting.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RegisterRequest {

    @NotBlank(message = "Voter ID is required")
    private String voterId;

    @NotBlank(message = "Voter name is required")
    private String name;

    @NotEmpty(message = "At least one camera frame must be captured for registration")
    private List<String> frames;
}
