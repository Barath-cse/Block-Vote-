package com.voting.controller;

import com.voting.dto.*;
import com.voting.model.Candidate;
import com.voting.model.Election;
import com.voting.service.BiometricService;
import com.voting.service.VotingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminController {

    private final VotingService votingService;
    private final BiometricService biometricService;

    @PostMapping("/login")
    public ResponseEntity<?> loginAdmin(@Valid @RequestBody AdminLoginRequest request) {
        try {
            AdminLoginResponse response = votingService.authenticateAdmin(request);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/stats")
    public ResponseEntity<AdminStatsResponse> getAdminStats(@RequestParam(required = false) String electionId) {
        return ResponseEntity.ok(votingService.getAdminStats(electionId));
    }

    // Elections Management
    @GetMapping("/elections")
    public ResponseEntity<List<Election>> getElections() {
        return ResponseEntity.ok(votingService.getAllElections());
    }

    @PostMapping("/elections")
    public ResponseEntity<?> createElection(@Valid @RequestBody ElectionRequest request) {
        try {
            Election election = votingService.createElection(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(election);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/elections/{electionId}/activate")
    public ResponseEntity<?> setActiveElection(@PathVariable String electionId) {
        try {
            Election election = votingService.setActiveElection(electionId);
            return ResponseEntity.ok(election);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/elections/{electionId}")
    public ResponseEntity<?> deleteElection(@PathVariable String electionId) {
        try {
            votingService.deleteElection(electionId);
            return ResponseEntity.ok(Map.of("message", "Election deleted successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // Voter Registration (Admin tool)
    @PostMapping("/register-voter")
    public ResponseEntity<?> registerVoter(@Valid @RequestBody RegisterRequest request) {
        try {
            VoterResponse response = biometricService.registerVoter(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    // Candidates Management
    @PostMapping("/candidates")
    public ResponseEntity<?> addCandidate(@Valid @RequestBody CandidateRequest request) {
        try {
            Candidate candidate = votingService.addCandidate(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(candidate);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/candidates/{id}")
    public ResponseEntity<?> deleteCandidate(@PathVariable String id) {
        try {
            votingService.deleteCandidate(id);
            return ResponseEntity.ok(Map.of("message", "Candidate deleted successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
