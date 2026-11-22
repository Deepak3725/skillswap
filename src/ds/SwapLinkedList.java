package ds;

class Node<T>{
    T item;
    Node<T> next;

    Node(T item){
        this.item=item;
        this.next=null;
    }
}

public class SwapLinkedList<T>{
    Node<T> head,tail;
    int size;

    public SwapLinkedList(){
        this.head=null;
        this.tail=null;
        this.size=0;
    }

    public void addLast(T item){
        Node<T> newNode=new Node<>(item);
        if(head==null){
            head=newNode;
            tail=newNode;
        }else{
            tail.next=newNode;
            tail=newNode;
        }
        size++;
    }

    public boolean isEmpty(){
        if(size==0){
            return true;
        }else{
            return false;
        }
    }

    public T removeFirst(){
        if(head==null){
            System.out.println("The LinkedList is empty");
            return null;
        }
        Node<T> temp=head;
        head=head.next;
        temp.next=null;
        size--;

        if(isEmpty()){
            tail=null;
        }
        return temp.item;
    }

    public T peekFirst(){
        if(head==null){
            System.out.println("The LinkedList is empty");
            return null;
        }
        return head.item;
    }

    public int size(){
        return size;
    }

}