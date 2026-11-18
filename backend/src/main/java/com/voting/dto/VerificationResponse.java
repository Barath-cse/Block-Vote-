package com.voting.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VerificationResponse {

    private String voterId;
    private String name;
    private double similarityScore;
    private String displayPercentage;
    private boolean matched;
    private String message;
}
