
package algo;

import ds.MyArrayList;
import ds.MyHashMap;
import ds.SkillGraph;
import model.User;

public class SwapDFS {

    //finds a path from start user to target user using DFS
    public static MyArrayList<User> findPath(SkillGraph graph, User start, User target) {

        MyArrayList<User> path = new MyArrayList<User>();

        //stores users that have already been visited
        MyHashMap<User, Boolean> visited = new MyHashMap<User, Boolean>();

        //start DFS from the starting user
        if (dfs(graph, start, target, visited, path)) {
            return path;
        }

        //if target is not found, return an empty path
        return new MyArrayList<User>();
    }

    //recursive DFS method
    private static boolean dfs(SkillGraph graph, User current, User target,
                               MyHashMap<User, Boolean> visited,
                               MyArrayList<User> path) {

        //mark current user as visited
        visited.set(current, true);

        //add current user to the path
        path.add(current);

        //if we reached the target user
        if (current == target) {
            return true;
        }

        //get all users this current user can teach
        MyArrayList<User> neighbors = graph.getNeighbors(current);

        //visit each neighbor one by one
        for (int i = 0; i < neighbors.size(); i++) {

            User neighbor = neighbors.get(i);

            //check whether this neighbor has already been visited
            if (visited.get(neighbor) == null) {

                //recursively explore the neighbor
                if (dfs(graph, neighbor, target, visited, path)) {
                    return true;
                }
            }
        }

        //backtrack if no path is found through current user
        path.remove(path.size() - 1);

        return false;
    }
}
