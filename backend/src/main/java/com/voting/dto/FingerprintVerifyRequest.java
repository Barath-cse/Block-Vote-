package com.voting.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class FingerprintVerifyRequest {

    @NotBlank(message = "Voter ID is required")
    private String voterId;

    @NotBlank(message = "Fingerprint scan token is required")
    private String fingerprintToken;
}
