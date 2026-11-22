
package ds;
import model.User;

public class SkillGraph {
    //it will store user name-->skills they can give to list of username...

    private MyHashMap<User,MyArrayList<User>> adjacency;
    //adjacency :map User-->List of user they can teach skill too..

    public SkillGraph(){
        this.adjacency=new MyHashMap<User,MyArrayList<User>>();

    }
    
    public void addUser(User user){
        //check if user exist in adjacency HashMap...
        if(adjacency.get(user)==null){
            adjacency.set(user,new MyArrayList<User>());
        }
    }

    //adding an arrow from one user to another...
    public void addEdge(User from,User to){
        //list the user that already has list of user {from}
        MyArrayList<User> outgoing=adjacency.get(from);

        //if no list for {to} from {from}

        if(outgoing==null){
            outgoing=new MyArrayList<User>();//this will hold from's arrow...
            adjacency.set(from,outgoing);//holds arrow from {from}...
        }

        //without adding twice we will add here...
        for(int i=0;i<outgoing.size();i++){
            if(outgoing.get(i).equals(to)){
                return;
            }
        }
        outgoing.add(to);
    }

    public MyArrayList<User> getNeighbors(User user){
        MyArrayList<User> outgoing=adjacency.get(user);
        if(outgoing==null){
            return new MyArrayList<User>();
        }
        return outgoing;
    }
}
