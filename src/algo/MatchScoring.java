
//Reciprocal Skill-Matching Algorithm using the Harmonic Mean

package algo;

import model.User;
import ds.MyArrayList;
import ds.MyHashMap;

public class MatchScoring {

    public static double calculateScore(User a, User b) {

        MyArrayList<String> aTeaches = a.getTeaches();
        MyArrayList<String> aWants = a.getWants();
        MyArrayList<String> bTeaches = b.getTeaches();
        MyArrayList<String> bWants = b.getWants();

        if ((aWants.isEmpty()) || (bWants.isEmpty())) {
            return 0;
        }

        //to quickly check if skill exists in users we use String for skill and Boolean for exists or not...
        MyHashMap<String, Boolean> aSkills = new MyHashMap<>();
        MyHashMap<String, Boolean> bSkills = new MyHashMap<>();

        //storing skills userA teaches...
        for (int i = 0; i < aTeaches.size(); i++) {
            aSkills.set(aTeaches.get(i).trim().toLowerCase(), true);
        }

        //storing skills userB teaches...
        for (int i = 0; i < bTeaches.size(); i++) {
            bSkills.set(bTeaches.get(i).trim().toLowerCase(), true);
        }

        int aMatched = 0;

        //checking for aMatched...
        for (int i = 0; i < aWants.size(); i++) {
            if (bSkills.get(aWants.get(i).trim().toLowerCase()) != null) {
                aMatched++;
            }
        }

        //check for bMatched...
        int bMatched = 0;
        for (int i = 0; i < bWants.size(); i++) {
            if (aSkills.get(bWants.get(i).trim().toLowerCase()) != null) {
                bMatched++;
            }
        }

        // Calculate directional compatibility percentages
        // Now we calculate how compatible the two users are in each direction
        double aToB = (double) aMatched / aWants.size() * 100;
        //percetnage of skills that awants that b can teach..
        double bToA = (double) bMatched / bWants.size() * 100;
        //percentage of skill that b wants that a can teach..

        //handling zero compatibility....
        if (aToB == 0 || bToA == 0) {
            return 0.0;
        }

        //we will combine both direction score with Harmonic mean..
        //HM=2ab/a+b; or Score = (2 × C_A→B × C_B→A) / (C_A→B + C_B→A)
        double score = (2 * aToB * bToA) / (aToB + bToA);

        return score;
    }
}
