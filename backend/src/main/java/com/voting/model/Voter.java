package com.voting.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "voters")
public class Voter {

    @Id
    private String id;

    @Indexed(unique = true)
    private String voterId;

    private String name;

    /**
     * Normalized 512-dimensional master baseline embedding calculated
     * as the mean vector from multiple captured frames during registration.
     */
    private List<Float> faceEmbedding;

    private LocalDateTime registeredAt;

    /**
     * Biometric tracking fields
     */
    private String fingerprintHash;

    @Builder.Default
    private boolean hasVoted = false;

    private String votedCandidateId;

    private LocalDateTime votedAt;
}
