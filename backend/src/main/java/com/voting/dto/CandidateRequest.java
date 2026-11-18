package com.voting.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CandidateRequest {

    @NotBlank(message = "Candidate ID is required")
    private String candidateId;

    private String electionId;

    @NotBlank(message = "Candidate name is required")
    private String name;

    @NotBlank(message = "Party name is required")
    private String partyName;

    private String partySymbol;

    private String description;
}
