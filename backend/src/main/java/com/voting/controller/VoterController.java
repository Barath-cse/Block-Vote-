package com.voting.controller;

import com.voting.dto.RegisterRequest;
import com.voting.dto.VerificationResponse;
import com.voting.dto.VerifyRequest;
import com.voting.dto.VoterResponse;
import com.voting.service.BiometricService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/voters")
@RequiredArgsConstructor
public class VoterController {

    private final BiometricService biometricService;

    /**
     * POST /api/v1/voters/register
     * Accepts Voter ID, Name, and multi-frame base64 webcam captures.
     */
    @PostMapping("/register")
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

    /**
     * POST /api/v1/voters/verify
     * Accepts Voter ID and a single live base64 frame for 1:1 Cosine Similarity check.
     */
    @PostMapping("/verify")
    public ResponseEntity<?> verifyVoter(@Valid @RequestBody VerifyRequest request) {
        try {
            VerificationResponse response = biometricService.verifyVoter(request);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * GET /api/v1/voters/{voterId}
     * Retrieves voter record by Voter ID.
     */
    @GetMapping("/{voterId}")
    public ResponseEntity<?> getVoter(@PathVariable String voterId) {
        try {
            VoterResponse response = biometricService.getVoter(voterId);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }
}
