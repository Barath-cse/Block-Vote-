package com.voting.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "elections")
public class Election {

    @Id
    private String id;

    @Indexed(unique = true)
    private String electionId;

    private String title;

    private String description;

    @com.fasterxml.jackson.annotation.JsonFormat(pattern = "yyyy-MM-dd['T'][ ]HH:mm[:ss]")
    private LocalDateTime startTime;

    @com.fasterxml.jackson.annotation.JsonFormat(pattern = "yyyy-MM-dd['T'][ ]HH:mm[:ss]")
    private LocalDateTime endTime;

    @Builder.Default
    private String status = "ACTIVE"; // ACTIVE, COMPLETED, DRAFT, SCHEDULED

    @Builder.Default
    private boolean active = true;

    private LocalDateTime createdAt;
}
