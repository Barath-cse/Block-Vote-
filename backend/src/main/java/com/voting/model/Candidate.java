package com.voting.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "candidates")
public class Candidate {

    @Id
    private String id;

    @Indexed(unique = true)
    private String candidateId;

    private String electionId;

    private String name;

    private String partyName;

    private String partySymbol;

    private String description;

    @Builder.Default
    private long voteCount = 0;
}
