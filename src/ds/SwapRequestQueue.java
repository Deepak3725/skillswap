package ds;

public class SwapRequestQueue<T>{
    private SwapLinkedList<T> requests;

    public SwapRequestQueue(){
        this.requests=new SwapLinkedList<>();
    }

    public void enqueue(T item){
        requests.addLast(item);
    }

    public T dequeue(){
        if(isEmpty()){
            System.out.println("Empty queue");
            return null;
        }
        return requests.removeFirst();
    }

    public T peek(){
        if(isEmpty()){
            System.out.println("Empty queue");
            return null;
        }
        return requests.peekFirst();
    }

    public boolean isEmpty(){
        return requests.isEmpty();
    }

    public int size(){
        return requests.size();
    }

}