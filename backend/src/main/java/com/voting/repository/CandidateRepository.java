package com.voting.repository;

import com.voting.model.Candidate;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface CandidateRepository extends MongoRepository<Candidate, String> {

    Optional<Candidate> findByCandidateId(String candidateId);

    boolean existsByCandidateId(String candidateId);
}
