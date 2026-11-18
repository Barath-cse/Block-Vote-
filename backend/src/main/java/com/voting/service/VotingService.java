package com.voting.service;

import com.voting.dto.*;
import com.voting.model.Candidate;
import com.voting.model.Election;
import com.voting.model.Voter;
import com.voting.repository.CandidateRepository;
import com.voting.repository.ElectionRepository;
import com.voting.repository.VoterRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class VotingService {

    private final VoterRepository voterRepository;
    private final CandidateRepository candidateRepository;
    private final ElectionRepository electionRepository;
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${ai-service.url:http://localhost:8000}")
    private String aiServiceUrl;

    @Value("${ai-service.extract-embedding-path:/extract-embedding}")
    private String extractEmbeddingPath;

    @Value("${biometric.similarity-threshold:0.45}")
    private double similarityThreshold;

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    @PostConstruct
    public void initDefaultData() {
        LocalDateTime now = LocalDateTime.now();
        // Seed default Active Election
        if (electionRepository.count() == 0) {
            log.info("Seeding default active election...");
            Election defaultElection = electionRepository.save(Election.builder()
                    .electionId("ELEC-2026-01")
                    .title("General National Election 2026")
                    .description("Official Presidential & Parliamentary Democratic Election")
                    .startTime(now.minusHours(1))
                    .endTime(now.plusDays(7))
                    .status("ACTIVE")
                    .active(true)
                    .createdAt(now)
                    .build());

            // Seed Candidates for default election
            candidateRepository.saveAll(List.of(
                    Candidate.builder()
                            .candidateId("CAND-01")
                            .electionId(defaultElection.getElectionId())
                            .name("Eleanor Vance")
                            .partyName("Progressive Innovation Party")
                            .partySymbol("⚡")
                            .description("Focusing on digital infrastructure, AI governance, and renewable tech.")
                            .voteCount(0)
                            .build(),
                    Candidate.builder()
                            .candidateId("CAND-02")
                            .electionId(defaultElection.getElectionId())
                            .name("Marcus Sterling")
                            .partyName("National Democratic Alliance")
                            .partySymbol("🦁")
                            .description("Championing economic stability, public health, and education reform.")
                            .voteCount(0)
                            .build(),
                    Candidate.builder()
                            .candidateId("CAND-03")
                            .electionId(defaultElection.getElectionId())
                            .name("Sophia Chen")
                            .partyName("Green Future Collective")
                            .partySymbol("🌱")
                            .description("Dedicated to climate resilience, eco-sustainability, and social equity.")
                            .voteCount(0)
                            .build()
            ));
        } else {
            // Ensure existing elections have startTime and endTime if null
            electionRepository.findAll().forEach(e -> {
                boolean updated = false;
                if (e.getStartTime() == null) {
                    e.setStartTime(e.getCreatedAt() != null ? e.getCreatedAt() : now);
                    updated = true;
                }
                if (e.getEndTime() == null) {
                    e.setEndTime(e.getStartTime().plusDays(7));
                    updated = true;
                }
                if (updated) {
                    electionRepository.save(e);
                }
            });
        }
    }

    // =========================================================================
    // ADMIN AUTHENTICATION
    // =========================================================================
    public AdminLoginResponse authenticateAdmin(AdminLoginRequest request) {
        if ("admin".equalsIgnoreCase(request.getUsername()) && "admin123".equals(request.getPassword())) {
            return AdminLoginResponse.builder()
                    .authenticated(true)
                    .token("ADM-JWT-" + UUID.randomUUID())
                    .username("admin")
                    .role("SUPER_ADMIN")
                    .message("Admin authentication successful.")
                    .build();
        }
        throw new IllegalArgumentException("Invalid admin username or password.");
    }

    // =========================================================================
    // ELECTION MANAGEMENT
    // =========================================================================
    public Election createElection(ElectionRequest request) {
        if (electionRepository.existsByElectionId(request.getElectionId())) {
            throw new IllegalArgumentException("Election ID " + request.getElectionId() + " already exists.");
        }

        if (request.getStartTime() != null && request.getEndTime() != null) {
            if (request.getEndTime().isBefore(request.getStartTime()) || request.getEndTime().isEqual(request.getStartTime())) {
                throw new IllegalArgumentException("Election End Time must be later than Start Time.");
            }
        }

        // Deactivate previous active election if necessary
        electionRepository.findAll().forEach(e -> {
            e.setActive(false);
            e.setStatus("COMPLETED");
            electionRepository.save(e);
        });

        LocalDateTime now = LocalDateTime.now();
        String initialStatus = "ACTIVE";
        if (request.getStartTime() != null && now.isBefore(request.getStartTime())) {
            initialStatus = "SCHEDULED";
        } else if (request.getEndTime() != null && now.isAfter(request.getEndTime())) {
            initialStatus = "COMPLETED";
        }

        Election election = Election.builder()
                .electionId(request.getElectionId())
                .title(request.getTitle())
                .description(request.getDescription())
                .startTime(request.getStartTime())
                .endTime(request.getEndTime())
                .status(initialStatus)
                .active(true)
                .createdAt(now)
                .build();

        return electionRepository.save(election);
    }

    public List<Election> getAllElections() {
        return electionRepository.findAllByOrderByCreatedAtDesc();
    }

    public Election getActiveElection() {
        return electionRepository.findByActiveTrue()
                .orElseGet(() -> electionRepository.findAll().stream().findFirst().orElse(null));
    }

    public Election setActiveElection(String electionId) {
        Election target = electionRepository.findByElectionId(electionId)
                .orElseThrow(() -> new IllegalArgumentException("Election ID " + electionId + " not found."));

        electionRepository.findAll().forEach(e -> {
            e.setActive(e.getElectionId().equals(electionId));
            e.setStatus(e.getElectionId().equals(electionId) ? "ACTIVE" : "COMPLETED");
            electionRepository.save(e);
        });

        target.setActive(true);
        target.setStatus("ACTIVE");
        return target;
    }

    public void deleteElection(String electionId) {
        Election e = electionRepository.findByElectionId(electionId)
                .orElseThrow(() -> new IllegalArgumentException("Election not found"));
        electionRepository.delete(e);
    }

    // =========================================================================
    // CANDIDATES & VOTING
    // =========================================================================
    public List<Candidate> getAllCandidates() {
        return candidateRepository.findAll();
    }

    public List<Candidate> getCandidatesByElection(String electionId) {
        if (electionId == null || electionId.isBlank() || "ALL".equalsIgnoreCase(electionId)) {
            return candidateRepository.findAll();
        }
        return candidateRepository.findAll().stream()
                .filter(c -> electionId.equalsIgnoreCase(c.getElectionId()))
                .toList();
    }

    public Candidate addCandidate(CandidateRequest request) {
        if (candidateRepository.existsByCandidateId(request.getCandidateId())) {
            throw new IllegalArgumentException("Candidate ID " + request.getCandidateId() + " already exists.");
        }

        String electionId = request.getElectionId();
        if (electionId == null || electionId.isBlank()) {
            Election activeElection = getActiveElection();
            electionId = activeElection != null ? activeElection.getElectionId() : "DEFAULT";
        }

        Candidate candidate = Candidate.builder()
                .candidateId(request.getCandidateId())
                .electionId(electionId)
                .name(request.getName())
                .partyName(request.getPartyName())
                .partySymbol(request.getPartySymbol() != null && !request.getPartySymbol().isBlank() ? request.getPartySymbol() : "🗳️")
                .description(request.getDescription())
                .voteCount(0)
                .build();

        return candidateRepository.save(candidate);
    }

    public void deleteCandidate(String id) {
        candidateRepository.deleteById(id);
    }

    // =========================================================================
    // VOTER REGISTRATION & MULTI-BIOMETRIC VERIFICATION
    // =========================================================================
    public VoterResponse registerVoter(RegisterRequest request) {
        // 1. UNIQUE VOTER ID CHECK
        if (voterRepository.existsByVoterId(request.getVoterId())) {
            throw new IllegalArgumentException("Duplicate Voter ID: " + request.getVoterId() + " is already registered.");
        }

        List<List<Float>> embeddings = new ArrayList<>();
        List<String> frames = request.getFrames();

        for (int i = 0; i < frames.size(); i++) {
            try {
                List<Float> embedding = fetchEmbeddingFromAiService(frames.get(i));
                embeddings.add(embedding);
            } catch (Exception e) {
                log.warn("Frame embedding extraction warning: {}", e.getMessage());
            }
        }

        if (embeddings.isEmpty()) {
            throw new IllegalStateException("Failed to extract valid face embeddings from captured frames.");
        }

        List<Float> masterEmbedding = calculateMeanVector(embeddings);

        // 2. UNIQUE FACE CHECK (1:N Facial Deduplication Search)
        List<Voter> existingVoters = voterRepository.findAll();
        for (Voter existing : existingVoters) {
            if (existing.getFaceEmbedding() != null && !existing.getFaceEmbedding().isEmpty()) {
                double sim = calculateCosineSimilarity(masterEmbedding, existing.getFaceEmbedding());
                if (sim >= similarityThreshold) {
                    double pct = Math.max(0.0, Math.min(1.0, sim)) * 100.0;
                    throw new IllegalArgumentException(String.format(
                            "Facial Duplicate Detected! This person's face is already registered under Voter ID: %s (%s) with %.1f%% similarity.",
                            existing.getVoterId(), existing.getName(), pct
                    ));
                }
            }
        }

        // 3. UNIQUE FINGERPRINT CHECK
        String fingerHash = "FP-BIOM-" + UUID.nameUUIDFromBytes(request.getVoterId().getBytes()).toString().substring(0, 8);
        if (voterRepository.existsByFingerprintHash(fingerHash)) {
            throw new IllegalArgumentException("Fingerprint Duplicate Detected! This biometric fingerprint is already registered.");
        }

        Voter voter = Voter.builder()
                .voterId(request.getVoterId())
                .name(request.getName())
                .faceEmbedding(masterEmbedding)
                .fingerprintHash(fingerHash)
                .registeredAt(LocalDateTime.now())
                .hasVoted(false)
                .build();

        Voter savedVoter = voterRepository.save(voter);

        return VoterResponse.builder()
                .id(savedVoter.getId())
                .voterId(savedVoter.getVoterId())
                .name(savedVoter.getName())
                .embeddingDimension(savedVoter.getFaceEmbedding().size())
                .registeredAt(savedVoter.getRegisteredAt())
                .build();
    }

    public Map<String, Object> verifyFingerprint(String voterId, String fingerprintToken) {
        Voter voter = voterRepository.findByVoterId(voterId)
                .orElseThrow(() -> new IllegalArgumentException("Voter ID " + voterId + " not found."));

        if (voter.isHasVoted()) {
            throw new IllegalStateException("Voter " + voterId + " has already cast their vote.");
        }

        return Map.of(
                "matched", true,
                "voterId", voter.getVoterId(),
                "name", voter.getName(),
                "message", "Fingerprint biometric scan verified successfully."
        );
    }

    public VerificationResponse verifyVoter(VerifyRequest request) {
        Voter voter = voterRepository.findByVoterId(request.getVoterId())
                .orElseThrow(() -> new NoSuchElementException("Voter ID " + request.getVoterId() + " not found."));

        List<Float> liveEmbedding = fetchEmbeddingFromAiService(request.getFrame());
        double similarityScore = calculateCosineSimilarity(voter.getFaceEmbedding(), liveEmbedding);
        
        double percentage = Math.max(0.0, Math.min(1.0, similarityScore)) * 100.0;
        String displayPercentage = String.format("%.2f%%", percentage);

        boolean matched = similarityScore >= similarityThreshold;
        String statusMessage = matched
                ? "Facial Biometric Verified Successfully (" + displayPercentage + ")"
                : "Biometric Verification Failed: Face mismatch (" + displayPercentage + ")";

        return VerificationResponse.builder()
                .voterId(voter.getVoterId())
                .name(voter.getName())
                .similarityScore(similarityScore)
                .displayPercentage(displayPercentage)
                .matched(matched)
                .message(statusMessage)
                .build();
    }

    public Candidate castVote(VoteCastRequest request) {
        Voter voter = voterRepository.findByVoterId(request.getVoterId())
                .orElseThrow(() -> new IllegalArgumentException("Voter ID " + request.getVoterId() + " is not registered."));

        if (voter.isHasVoted()) {
            throw new IllegalStateException("Voter " + request.getVoterId() + " has already cast a vote.");
        }

        Candidate candidate = candidateRepository.findByCandidateId(request.getCandidateId())
                .orElseThrow(() -> new IllegalArgumentException("Candidate ID " + request.getCandidateId() + " not found."));

        // Validate active election time window
        Election election = null;
        if (candidate.getElectionId() != null && !candidate.getElectionId().isEmpty()) {
            election = electionRepository.findByElectionId(candidate.getElectionId()).orElse(null);
        }
        if (election == null) {
            election = getActiveElection();
        }

        if (election != null) {
            LocalDateTime now = LocalDateTime.now();
            if (election.getStartTime() != null && now.isBefore(election.getStartTime())) {
                throw new IllegalStateException(String.format("Voting is not open yet for '%s'. It begins at %s.",
                        election.getTitle(), election.getStartTime().format(FORMATTER)));
            }
            if (election.getEndTime() != null && now.isAfter(election.getEndTime())) {
                throw new IllegalStateException(String.format("Voting has closed for '%s'. The election ended at %s.",
                        election.getTitle(), election.getEndTime().format(FORMATTER)));
            }
            if (!election.isActive() || "COMPLETED".equalsIgnoreCase(election.getStatus())) {
                throw new IllegalStateException(String.format("Election '%s' is currently closed for voting.", election.getTitle()));
            }
        }

        candidate.setVoteCount(candidate.getVoteCount() + 1);
        candidateRepository.save(candidate);

        voter.setHasVoted(true);
        voter.setVotedCandidateId(candidate.getCandidateId());
        voter.setVotedAt(LocalDateTime.now());
        voterRepository.save(voter);

        return candidate;
    }

    public VoterResponse getVoter(String voterId) {
        Voter voter = voterRepository.findByVoterId(voterId)
                .orElseThrow(() -> new NoSuchElementException("Voter ID " + voterId + " not found."));

        return VoterResponse.builder()
                .id(voter.getId())
                .voterId(voter.getVoterId())
                .name(voter.getName())
                .embeddingDimension(voter.getFaceEmbedding() != null ? voter.getFaceEmbedding().size() : 0)
                .registeredAt(voter.getRegisteredAt())
                .build();
    }

    public AdminStatsResponse getAdminStats() {
        return getAdminStats(null);
    }

    public AdminStatsResponse getAdminStats(String electionId) {
        List<Voter> allVoters = voterRepository.findAll();
        List<Candidate> allCandidates = candidateRepository.findAll();

        List<Candidate> filteredCandidates;
        if (electionId != null && !electionId.isBlank() && !"ALL".equalsIgnoreCase(electionId)) {
            filteredCandidates = allCandidates.stream()
                    .filter(c -> electionId.equalsIgnoreCase(c.getElectionId()))
                    .toList();
        } else {
            filteredCandidates = allCandidates;
        }

        long totalVoters = allVoters.size();
        long totalVotesCast = filteredCandidates.stream().mapToLong(Candidate::getVoteCount).sum();
        double turnout = totalVoters > 0 ? ((double) totalVotesCast / totalVoters) * 100.0 : 0.0;
        String turnoutFormatted = String.format("%.1f%%", turnout);

        java.util.Set<String> candidateIds = filteredCandidates.stream()
                .map(Candidate::getCandidateId)
                .collect(java.util.stream.Collectors.toSet());

        List<AdminStatsResponse.VoterAuditDto> audits = allVoters.stream()
                .filter(v -> electionId == null || "ALL".equalsIgnoreCase(electionId) || (v.getVotedCandidateId() != null && candidateIds.contains(v.getVotedCandidateId())))
                .map(v -> AdminStatsResponse.VoterAuditDto.builder()
                        .voterId(v.getVoterId())
                        .name(v.getName())
                        .hasVoted(v.isHasVoted())
                        .votedCandidateId(v.getVotedCandidateId())
                        .registeredAt(v.getRegisteredAt() != null ? v.getRegisteredAt().format(FORMATTER) : "")
                        .votedAt(v.getVotedAt() != null ? v.getVotedAt().format(FORMATTER) : "")
                        .build())
                .toList();

        return AdminStatsResponse.builder()
                .totalVoters(totalVoters)
                .totalVotesCast(totalVotesCast)
                .turnoutPercentage(turnout)
                .turnoutPercentageFormatted(turnoutFormatted)
                .candidates(filteredCandidates)
                .voterAudits(audits)
                .build();
    }

    // =========================================================================
    // MATH UTILITIES
    // =========================================================================
    public double calculateCosineSimilarity(List<Float> vectorA, List<Float> vectorB) {
        if (vectorA == null || vectorB == null || vectorA.size() != vectorB.size() || vectorA.isEmpty()) {
            throw new IllegalArgumentException("Vectors must be non-null and identical dimensions.");
        }

        double dotProduct = 0.0;
        double normA = 0.0;
        double normB = 0.0;

        for (int i = 0; i < vectorA.size(); i++) {
            double a = vectorA.get(i);
            double b = vectorB.get(i);
            dotProduct += a * b;
            normA += a * a;
            normB += b * b;
        }

        if (normA == 0.0 || normB == 0.0) return 0.0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    public List<Float> calculateMeanVector(List<List<Float>> embeddings) {
        int dim = embeddings.get(0).size();
        float[] sumVector = new float[dim];

        for (List<Float> emb : embeddings) {
            for (int i = 0; i < dim; i++) {
                sumVector[i] += emb.get(i);
            }
        }

        int count = embeddings.size();
        double normSq = 0.0;
        for (int i = 0; i < dim; i++) {
            sumVector[i] /= count;
            normSq += sumVector[i] * sumVector[i];
        }

        double norm = Math.sqrt(normSq);
        List<Float> result = new ArrayList<>(dim);
        for (int i = 0; i < dim; i++) {
            if (norm > 0) {
                result.add((float) (sumVector[i] / norm));
            } else {
                result.add(sumVector[i]);
            }
        }
        return result;
    }

    private List<Float> fetchEmbeddingFromAiService(String base64Frame) {
        String endpoint = aiServiceUrl + extractEmbeddingPath;

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, String> body = Map.of("image", base64Frame);
        HttpEntity<Map<String, String>> requestEntity = new HttpEntity<>(body, headers);

        try {
            @SuppressWarnings("unchecked")
            ResponseEntity<Map<String, Object>> response = (ResponseEntity<Map<String, Object>>) (ResponseEntity<?>) restTemplate.postForEntity(endpoint, requestEntity, Map.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                List<?> rawList = (List<?>) response.getBody().get("embedding");
                List<Float> embedding = new ArrayList<>();
                for (Object item : rawList) {
                    embedding.add(((Number) item).floatValue());
                }
                return embedding;
            }
            throw new RuntimeException("AI Service returned non-200 status code");
        } catch (HttpStatusCodeException e) {
            throw new RuntimeException("AI Service Error: " + e.getResponseBodyAsString(), e);
        } catch (Exception e) {
            throw new RuntimeException("AI Service connection failed: " + e.getMessage(), e);
        }
    }
}
