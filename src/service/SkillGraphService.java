
package service;

import algo.SwapSearch;
import algo.SwapDFS;

import ds.SkillGraph;
import ds.MyArrayList;

import model.User;

import repository.UserRepository;
import repository.RequestRepository;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class SkillGraphService {

    private UserRepository userRepository;
    private RequestRepository requestRepository;

    public SkillGraphService() {
        this.userRepository = new UserRepository();
        this.requestRepository = new RequestRepository();
    }

    // Holds the graph and its canonical user objects together
    private static class GraphData {

        private SkillGraph graph;
        private Map<Integer, User> userMap;
        private List<User> users;

        public GraphData(SkillGraph graph, Map<Integer, User> userMap,
                         List<User> users) {
            this.graph = graph;
            this.userMap = userMap;
            this.users = users;
        }
    }

    // Build the learning network using completed swap relationships
    private GraphData buildGraphData() {

        SkillGraph graph = new SkillGraph();

        // Retrieve all registered users with their skills
        List<User> users = userRepository.getAllUsers();

        // Store one canonical User object for each user ID
        Map<Integer, User> userMap = new HashMap<>();

        // First, add every registered user as a graph vertex
        for (int i = 0; i < users.size(); i++) {

            User user = users.get(i);

            graph.addUser(user);

            userMap.put(user.getUserId(), user);
        }

        // Retrieve completed swap relationships
        List<Map<String, Integer>> relationships =
                requestRepository.getCompletedSwapRelationships();

        // Add edges to the graph (both directions, see below)
        for (int i = 0; i < relationships.size(); i++) {

            Map<String, Integer> relationship = relationships.get(i);

            int senderId = relationship.get("senderId");
            int receiverId = relationship.get("receiverId");

            // Get the canonical User objects
            User sender = userMap.get(senderId);
            User receiver = userMap.get(receiverId);

            // Add an edge only if both users exist
            if (sender != null && receiver != null) {

                // A completed swap connects both people, so it can be
                // followed in either direction. The original request
                // direction is kept in the swap details (describeSwap).
                graph.addEdge(sender, receiver);
                graph.addEdge(receiver, sender);
            }
        }

        return new GraphData(graph, userMap, users);
    }

    // Build and return the learning graph
    public SkillGraph buildGraph() {

        GraphData data = buildGraphData();

        return data.graph;
    }

    // Find the shortest learning chain using BFS
    public MyArrayList<User> findShortestLearningChain(
            int startUserId, int targetUserId) {

        GraphData data = buildGraphData();

        User start = data.userMap.get(startUserId);
        User target = data.userMap.get(targetUserId);

        // Check whether both users exist
        if (start == null || target == null) {
            return new MyArrayList<User>();
        }

        return SwapSearch.findChain(data.graph, start, target);
    }

    // Largest number of people returned by the network endpoint, so the
    // "all connections" option stays a usable response.
    public static final int MAX_NETWORK_PEOPLE = 300;

    // The people connected to a user through completed swaps, up to
    // maxHops swaps away (maxHops <= 0 means every reachable person), with
    // the skills exchanged in each swap.
    //
    // Distances come from SwapSearch.findChain() (BFS) on the same
    // bidirectional SkillGraph used by /chain and /path, so every person
    // listed here can be reached by those endpoints.
    public Map<String, Object> getLearningNetwork(int userId, int maxHops) {

        Map<String, Object> network = new java.util.LinkedHashMap<>();
        List<Map<String, Object>> nodes = new java.util.ArrayList<>();
        List<Map<String, Object>> edges = new java.util.ArrayList<>();

        network.put("userId", userId);
        network.put("maxHops", maxHops > 0 ? maxHops : null);
        network.put("nodes", nodes);
        network.put("edges", edges);
        network.put("truncated", false);

        GraphData data = buildGraphData();
        User me = data.userMap.get(userId);

        if (me == null) {
            return network;
        }

        List<Map<String, Object>> swaps =
                requestRepository.getCompletedSwapDetails();

        // Only people who took part in a completed swap can be reached
        Map<Integer, Boolean> swapped = new HashMap<>();

        for (int i = 0; i < swaps.size(); i++) {
            swapped.put((Integer) swaps.get(i).get("senderId"), true);
            swapped.put((Integer) swaps.get(i).get("receiverId"), true);
        }

        // Distance of each person from the user, found with BFS
        Map<Integer, Integer> hopsById = new HashMap<>();
        hopsById.put(userId, 0);

        for (int i = 0; i < data.users.size(); i++) {

            User other = data.users.get(i);

            if (other == me || swapped.get(other.getUserId()) == null) {
                continue;
            }

            MyArrayList<User> chain =
                    SwapSearch.findChain(data.graph, me, other);

            int hops = chain.size() - 1;

            if (chain.size() > 1 && (maxHops <= 0 || hops <= maxHops)) {
                hopsById.put(other.getUserId(), hops);
            }
        }

        // Keep the closest people if the network is very large
        if (hopsById.size() > MAX_NETWORK_PEOPLE) {

            int limitHops = 0;
            int count = 0;

            while (count < MAX_NETWORK_PEOPLE) {
                limitHops++;
                count = 0;
                for (Integer h : hopsById.values()) {
                    if (h <= limitHops) {
                        count++;
                    }
                }
            }

            final int keepHops = limitHops - 1;
            hopsById.values().removeIf(h -> h > keepHops);
            network.put("truncated", true);
        }

        for (int i = 0; i < data.users.size(); i++) {

            User user = data.users.get(i);
            Integer hops = hopsById.get(user.getUserId());

            if (hops == null) {
                continue;
            }

            Map<String, Object> node = new java.util.LinkedHashMap<>();

            node.put("userId", user.getUserId());
            node.put("name", user.getName());
            node.put("profilePicture",
                    user.getProfilePicture() == null
                            ? "" : user.getProfilePicture());
            node.put("hops", hops);

            nodes.add(node);
        }

        // Keep the swaps between people who are in the network
        for (int i = 0; i < swaps.size(); i++) {

            Map<String, Object> swap = swaps.get(i);

            if (hopsById.containsKey((Integer) swap.get("senderId"))
                    && hopsById.containsKey((Integer) swap.get("receiverId"))) {
                edges.add(describeSwap(swap));
            }
        }

        return network;
    }

    // One completed swap, keeping the original request direction.
    // The requester (sender) teaches offeredSkill, which is null for a
    // one-way request; the receiver teaches requestedSkill.
    private Map<String, Object> describeSwap(Map<String, Object> swap) {

        Map<String, Object> edge = new java.util.LinkedHashMap<>();

        edge.put("requestId", swap.get("requestId"));
        edge.put("senderId", swap.get("senderId"));
        edge.put("receiverId", swap.get("receiverId"));
        edge.put("requesterId", swap.get("senderId"));
        edge.put("offeredSkill", swap.get("offeredSkill"));
        edge.put("requestedSkill", swap.get("requestedSkill"));
        edge.put("oneWay", swap.get("offeredSkill") == null);

        return edge;
    }

    // For a route returned by BFS or DFS, the completed swaps behind each
    // step. "direction" says whether the step follows the original request
    // (requester -> receiver) or goes against it.
    public List<Map<String, Object>> describeRoute(MyArrayList<User> route) {

        List<Map<String, Object>> steps = new java.util.ArrayList<>();

        if (route.size() < 2) {
            return steps;
        }

        List<Map<String, Object>> swaps =
                requestRepository.getCompletedSwapDetails();

        for (int i = 0; i + 1 < route.size(); i++) {

            int from = route.get(i).getUserId();
            int to = route.get(i + 1).getUserId();

            List<Map<String, Object>> stepSwaps = new java.util.ArrayList<>();

            for (int j = 0; j < swaps.size(); j++) {

                Map<String, Object> swap = swaps.get(j);
                int sender = (Integer) swap.get("senderId");
                int receiver = (Integer) swap.get("receiverId");

                if ((sender == from && receiver == to)
                        || (sender == to && receiver == from)) {

                    Map<String, Object> edge = describeSwap(swap);
                    edge.put("direction", sender == from
                            ? "requester-to-receiver" : "receiver-to-requester");
                    stepSwaps.add(edge);
                }
            }

            Map<String, Object> step = new java.util.LinkedHashMap<>();
            step.put("fromUserId", from);
            step.put("toUserId", to);
            step.put("swaps", stepSwaps);
            steps.add(step);
        }

        return steps;
    }

    // Find a learning path using DFS
    public MyArrayList<User> findLearningPath(
            int startUserId, int targetUserId) {

        GraphData data = buildGraphData();

        User start = data.userMap.get(startUserId);
        User target = data.userMap.get(targetUserId);

        // Check whether both users exist
        if (start == null || target == null) {
            return new MyArrayList<User>();
        }

        return SwapDFS.findPath(data.graph, start, target);
    }
}
