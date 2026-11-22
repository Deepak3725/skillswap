package ds;

class MapNode<K,V>{
    K key;
    V value;

    MapNode<K,V> next;

    MapNode(K key,V value){
        this.key=key;
        this.value=value;
        this.next=null;
    }

}

public class MyHashMap<K,V>{

    MapNode<K,V>[] hashMap;
    int size;

    public MyHashMap(){
        this.hashMap=(MapNode<K,V>[]) new MapNode[7];
        size=0;
    }

    public void resize(int newlength){
        MapNode<K,V>[] oldHashMap=hashMap;
        hashMap=(MapNode<K,V>[]) new MapNode[newlength];

        for(int i=0;i<oldHashMap.length;i++){
            MapNode<K,V> current=oldHashMap[i];

            while(current!=null){
                MapNode<K,V> next=current.next;

                int index=hash(current.key);
                current.next=hashMap[index];
                hashMap[index]=current;

                current=next;
            }
        }
    }
//method to convert key to ASCII value and return index...
    public int hash(K key){
        return (key.hashCode() & 0x7fffffff) % hashMap.length;

        //hash code returns integer value for the key...
    }

    //Inserting in hashMap...

    public void set(K key,V value){

        if(size==hashMap.length-1){
            resize(hashMap.length*2);
        }
        
        //get index where to insert...
        int index=hash(key);

        MapNode<K,V> newNode=new MapNode<K,V>(key,value);

        //if no collision exists...
        if(hashMap[index]==null){
            hashMap[index]=newNode;
        }else{
            //if value already exist then we will store it as linkedlist and add value to tail...
            MapNode<K,V> current=hashMap[index];

            while(true){
                //if the key is already in this bucket, update its value instead of adding a duplicate...
                if(current.key.equals(key)){
                    current.value=value;
                    return;
                }
                //stop at the last node of the chain...
                if(current.next==null){
                    break;
                }
                current=current.next;
            }
            current.next=newNode;
        }
        size++;
    }

    public V get(K key){
        int index=hash(key);

        MapNode<K,V> current=hashMap[index];

        while(current!=null && !key.equals(current.key)){
            current=current.next;

        }

        if(current==null){
            return null;
        }

        return current.value;


    }

}