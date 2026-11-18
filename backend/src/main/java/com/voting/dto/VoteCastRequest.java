package com.voting.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class VoteCastRequest {

    @NotBlank(message = "Voter ID is required")
    private String voterId;

    @NotBlank(message = "Candidate ID is required")
    private String candidateId;
}
