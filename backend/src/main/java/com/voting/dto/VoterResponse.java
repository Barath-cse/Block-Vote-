package com.voting.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VoterResponse {

    private String id;
    private String voterId;
    private String name;
    private int embeddingDimension;
    private LocalDateTime registeredAt;
}
