package com.voting.repository;

import com.voting.model.Election;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface ElectionRepository extends MongoRepository<Election, String> {

    Optional<Election> findByElectionId(String electionId);

    Optional<Election> findByActiveTrue();

    List<Election> findAllByOrderByCreatedAtDesc();

    boolean existsByElectionId(String electionId);
}
