package ds;

//SkillArrayList will store the skills user want to teach and learn
//when someone search for teaches it will loop through SkillArrayList
public class MyArrayList<T>{
    T[] items;
    int size;

    public MyArrayList(){
        this.items=(T[]) new Object[5];
        this.size=0;
    }
    public void resize(int newlength){
        T[] newItems=(T[]) new Object[newlength];

        for(int i=0;i<size;i++){
            newItems[i]=items[i];
        }
        items=newItems;
    }

    public void add(T item){
        if(size==items.length){
            resize(items.length*2);
        }
        items[size++]=item;
    }

    public boolean isEmpty(){
        if(size==0){
            return true;
        }else{
            return false;
        }
    }

    public T get(int idx){
        if(isEmpty()){
            System.out.println("There is not items ");
            return null;
        }
        if(idx<0 || idx>=size){
            System.out.println("The index don't exist");
            return null;
        }
        return items[idx];

    }
    public void remove(int idx){
        if(isEmpty()){
            System.out.println("There is no items");
            return;
        }
        if(idx<0 || idx>=size){
            System.out.println("The index don't exist");
            return;
        }
        for(int i=idx;i<size-1;i++){
            items[i]=items[i+1];
        }
        items[size-1]=null;
        size--;
        if(size<items.length/4){
            resize(items.length/2);
        }
    }

    public int size(){
        return size;
    }
    public void traverse(){
        for(int i=0;i<size;i++){
            System.out.println(items[i]);
        }
    }
    
}