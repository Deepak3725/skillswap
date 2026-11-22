
package service;

import model.User;
import model.Match;
import algo.MatchScoring;
import algo.MatchSorter;
import ds.MyArrayList;
import ds.MatchMaxHeap;
import repository.SearchRepository;
import repository.UserRepository;

import java.util.List;

public class MatchService {

    private SearchRepository searchRepository;
    private UserRepository userRepository;

    public MatchService() {
        this.searchRepository = new SearchRepository();
        this.userRepository = new UserRepository();
    }

    // Calculate compatibility scores between users
    public MyArrayList<Match> calculateMatches(int currentUserId) {

        MyArrayList<Match> matches = new MyArrayList<>();

        if (currentUserId <= 0) {
            return matches;
        }

        // Get the current user's information
        User currentUser = userRepository.findById(currentUserId);

        if (currentUser == null) {
            return matches;
        }

        // Get all other users with their skills
        List<User> potentialUsers =
                searchRepository.getAllOtherUsers(currentUserId);

        // Calculate compatibility with each user
        for (int i = 0; i < potentialUsers.size(); i++) {

            User otherUser = potentialUsers.get(i);

            if (otherUser == null) {
                continue;
            }

            // Calculate reciprocal skill compatibility
            double score = MatchScoring.calculateScore(
                    currentUser,
                    otherUser
            );

            // Only include users with a positive compatibility score
            if (score > 0) {
                matches.add(new Match(otherUser, score));
            }
        }

        // Sort matches using Merge Sort
        MyArrayList<Match> sortedMatches =
                MatchSorter.sortByScore(matches);

        return sortedMatches;
    }

    // Get top matches using Max Heap
    public MyArrayList<Match> getTopMatches(int currentUserId, int limit) {

        MyArrayList<Match> topMatches = new MyArrayList<>();

        if (limit <= 0) {
            return topMatches;
        }

        // Get all matches with their compatibility scores
        MyArrayList<Match> matches =
                calculateMatches(currentUserId);

        // Insert matches into Max Heap
        MatchMaxHeap maxHeap = new MatchMaxHeap();

        for (int i = 0; i < matches.size(); i++) {
            maxHeap.insert(matches.get(i));
        }

        // Extract highest-scoring matches
        while (!maxHeap.isEmpty() && topMatches.size() < limit) {

            Match highestMatch = maxHeap.extractMax();

            if (highestMatch != null) {
                topMatches.add(highestMatch);
            }
        }

        return topMatches;
    }
}
