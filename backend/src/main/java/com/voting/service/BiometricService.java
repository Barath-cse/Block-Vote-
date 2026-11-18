package com.voting.service;

import com.voting.dto.RegisterRequest;
import com.voting.dto.VerificationResponse;
import com.voting.dto.VerifyRequest;
import com.voting.dto.VoterResponse;
import com.voting.model.Voter;
import com.voting.repository.VoterRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class BiometricService {

    private final VoterRepository voterRepository;
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${ai-service.url:http://localhost:8000}")
    private String aiServiceUrl;

    @Value("${ai-service.extract-embedding-path:/extract-embedding}")
    private String extractEmbeddingPath;

    @Value("${biometric.similarity-threshold:0.45}")
    private double similarityThreshold;

    /**
     * Registers a voter by extracting face embeddings for multiple webcam frames,
     * computing the mean vector baseline, and saving to MongoDB.
     */
    public VoterResponse registerVoter(RegisterRequest request) {
        // =========================================================================
        // 1. UNIQUE VOTER ID CHECK
        // =========================================================================
        if (voterRepository.existsByVoterId(request.getVoterId())) {
            throw new IllegalArgumentException("Duplicate Voter ID: " + request.getVoterId() + " is already registered.");
        }

        List<List<Float>> embeddings = new ArrayList<>();
        List<String> frames = request.getFrames();

        log.info("Extracting embeddings for {} frames for voterId={}", frames.size(), request.getVoterId());

        for (int i = 0; i < frames.size(); i++) {
            try {
                List<Float> embedding = fetchEmbeddingFromAiService(frames.get(i));
                embeddings.add(embedding);
            } catch (Exception e) {
                log.warn("Failed to extract embedding from frame {}: {}", i + 1, e.getMessage());
            }
        }

        if (embeddings.isEmpty()) {
            throw new IllegalStateException("Failed to extract valid face embeddings from any of the provided frames.");
        }

        List<Float> masterEmbedding = calculateMeanVector(embeddings);

        // =========================================================================
        // 2. UNIQUE FACE CHECK (1:N Facial Deduplication Search)
        // Checks the new face vector against all existing registered voters in MongoDB.
        // =========================================================================
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

        // =========================================================================
        // 3. UNIQUE FINGERPRINT CHECK
        // =========================================================================
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
        log.info("Voter registered successfully with ID={}", savedVoter.getVoterId());

        return VoterResponse.builder()
                .id(savedVoter.getId())
                .voterId(savedVoter.getVoterId())
                .name(savedVoter.getName())
                .embeddingDimension(savedVoter.getFaceEmbedding().size())
                .registeredAt(savedVoter.getRegisteredAt())
                .build();
    }

    /**
     * Verifies a live captured frame against the stored voter baseline embedding.
     */
    public VerificationResponse verifyVoter(VerifyRequest request) {
        Voter voter = voterRepository.findByVoterId(request.getVoterId())
                .orElseThrow(() -> new NoSuchElementException("Voter ID " + request.getVoterId() + " not found."));

        // Extract live embedding from Python sidecar AI service
        List<Float> liveEmbedding = fetchEmbeddingFromAiService(request.getFrame());

        // Compute Cosine Similarity between stored baseline and live vector
        double similarityScore = calculateCosineSimilarity(voter.getFaceEmbedding(), liveEmbedding);
        
        // Formulate display percentage (clamped between 0% and 100%)
        double percentage = Math.max(0.0, Math.min(1.0, similarityScore)) * 100.0;
        String displayPercentage = String.format("%.2f%%", percentage);

        boolean matched = similarityScore >= similarityThreshold;
        String statusMessage = matched
                ? "Identity Verified Successfully (Similarity: " + displayPercentage + " >= " + String.format("%.2f%%", similarityThreshold * 100) + ")"
                : "Biometric Verification Failed: Face mismatch (Similarity: " + displayPercentage + " < " + String.format("%.2f%%", similarityThreshold * 100) + ")";

        log.info("Verification result for voterId={}: matched={}, score={}", request.getVoterId(), matched, similarityScore);

        return VerificationResponse.builder()
                .voterId(voter.getVoterId())
                .name(voter.getName())
                .similarityScore(similarityScore)
                .displayPercentage(displayPercentage)
                .matched(matched)
                .message(statusMessage)
                .build();
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

    // =========================================================================
    // MATHEMATICAL UTILITIES FOR VECTOR OPERATIONS
    // =========================================================================

    /**
     * Calculates Cosine Similarity between two N-dimensional float vectors A and B.
     * 
     * Formula:
     *   Cosine Similarity = (A · B) / (||A||_2 * ||B||_2)
     *   Dot Product (A · B) = sum(A[i] * B[i])
     *   Magnitude ||A||_2    = sqrt(sum(A[i]^2))
     * 
     * Range: [-1.0, 1.0]. For normalized facial feature vectors, range is typically [0.0, 1.0].
     * Threshold: >= 0.45 signifies matching identity for InsightFace buffalo_s embeddings.
     */
    public double calculateCosineSimilarity(List<Float> vectorA, List<Float> vectorB) {
        if (vectorA == null || vectorB == null || vectorA.size() != vectorB.size() || vectorA.isEmpty()) {
            throw new IllegalArgumentException("Vectors must be non-null, non-empty, and of identical dimensions.");
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

        if (normA == 0.0 || normB == 0.0) {
            return 0.0;
        }

        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * Calculates the mean vector from a list of N-dimensional embeddings,
     * then normalizes the result using L2-norm.
     */
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

        // Normalize mean vector
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
            throw new RuntimeException("AI Service returned non-200 status code: " + response.getStatusCode());
        } catch (HttpStatusCodeException e) {
            log.error("AI Service Error: {}", e.getResponseBodyAsString());
            throw new RuntimeException("AI Service Error: " + e.getResponseBodyAsString(), e);
        } catch (Exception e) {
            log.error("Failed to connect to AI Service at {}: {}", endpoint, e.getMessage());
            throw new RuntimeException("AI Service connection failed: " + e.getMessage(), e);
        }
    }
}
