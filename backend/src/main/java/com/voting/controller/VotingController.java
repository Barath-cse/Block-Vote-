package com.voting.controller;

import com.voting.dto.VoteCastRequest;
import com.voting.model.Candidate;
import com.voting.model.Election;
import com.voting.service.VotingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class VotingController {

    private final VotingService votingService;

    @GetMapping("/election/active")
    public ResponseEntity<Election> getActiveElection() {
        Election activeElection = votingService.getActiveElection();
        return ResponseEntity.ok(activeElection);
    }

    @GetMapping("/candidates")
    public ResponseEntity<List<Candidate>> getCandidates() {
        return ResponseEntity.ok(votingService.getAllCandidates());
    }

    @PostMapping("/votes/cast")
    public ResponseEntity<?> castVote(@Valid @RequestBody VoteCastRequest request) {
        try {
            Candidate votedCandidate = votingService.castVote(request);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Vote cast successfully for candidate " + votedCandidate.getName(),
                    "candidate", votedCandidate
            ));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(409).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
