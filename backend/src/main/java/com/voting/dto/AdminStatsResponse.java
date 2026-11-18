package com.voting.dto;

import com.voting.model.Candidate;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminStatsResponse {

    private long totalVoters;
    private long totalVotesCast;
    private double turnoutPercentage;
    private String turnoutPercentageFormatted;
    private List<Candidate> candidates;
    private List<VoterAuditDto> voterAudits;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class VoterAuditDto {
        private String voterId;
        private String name;
        private boolean hasVoted;
        private String votedCandidateId;
        private String registeredAt;
        private String votedAt;
    }
}
