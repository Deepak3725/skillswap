//This is BFS algorithm for the graph...
package algo;
import ds.MyArrayList;
import ds.MyHashMap;
import ds.SkillGraph;
import ds.SwapRequestQueue;
import model.User;

public class SwapSearch {

    //finds the shortest chain of swaps from start to target (BFS)
    public static MyArrayList<User> findChain(SkillGraph graph, User start, User target){
        MyArrayList<User> chain = new MyArrayList<User>();

        if(start == target){
            chain.add(start);
            return chain;
        }

        //who reached each user (start points to itself)
        MyHashMap<User,User> reachedBy = new MyHashMap<User,User>();
        SwapRequestQueue<User> queue = new SwapRequestQueue<User>();

        reachedBy.set(start, start);
        queue.enqueue(start);

        while(!queue.isEmpty()){
            User current = queue.dequeue();

            if(current == target){
                break;
            }

            //visit everyone this user can teach
            MyArrayList<User> next = graph.getNeighbors(current);
            for(int i=0;i<next.size();i++){
                User neighbour = next.get(i);
                if(reachedBy.get(neighbour) == null){
                    reachedBy.set(neighbour, current);
                    queue.enqueue(neighbour);
                }
            }
        }

        //target was never reached, so there is no chain
        if(reachedBy.get(target) == null){
            return chain;
        }

        //walk back from target to start, following who reached each user
        User step = target;
        while(step != start){
            chain.add(step);
            step = reachedBy.get(step);
        }
        chain.add(start);

        //the walk gave target..start, so copy it in reverse to get start..target
        MyArrayList<User> path = new MyArrayList<User>();
        for(int i=chain.size()-1;i>=0;i--){
            path.add(chain.get(i));
        }
        return path;
    }
}