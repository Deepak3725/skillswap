package ds;
import model.Match;

public class MatchMaxHeap {
    private Match[] heap;
    private int size;

    public MatchMaxHeap(){
        this.heap=new Match[5];
        this.size=0;
    }

    public void resize(int newlength){
        Match[] newHeap=new Match[newlength];

        for(int i=0;i<=size;i++){
            newHeap[i]=heap[i];
        }
        heap=newHeap;
    }
    private void swap(int cIdx,int pIdx){
        Match temp=heap[cIdx];
        heap[cIdx]=heap[pIdx];
        heap[pIdx]=temp;
    }

    public void insert(Match match){
        if(size==heap.length-1){
            resize(heap.length*2);
        }
        size++;
        heap[size]=match;

        heapifyUp(size);
    }
    private void heapifyUp(int index){
        while(index>1 && heap[index].getScore()>heap[index/2].getScore()){
            swap(index,index/2);
            index=index/2;
        }
    }

   public Match extractMax(){
    if(size==0){
        System.out.println("Heap is empty");
        return null;
    }
    Match max=heap[1];
    heap[1]=heap[size];
    heap[size]=null;
    size--;

    heapifyDown(1);
    return max;
}

private void heapifyDown(int index){
    int left=2*index;
    int right=(2*index)+1;

    int largestIndex=index;

    if(left<=size && heap[left].getScore()>heap[largestIndex].getScore()){
        largestIndex=left;
    }
    if(right<=size && heap[right].getScore()>heap[largestIndex].getScore()){
        largestIndex=right;
    }

    if(largestIndex!=index){
        swap(largestIndex,index);
        heapifyDown(largestIndex);
    }
}

public boolean isEmpty(){
    if(size==0){
        return true;
    }else{
        return false;
    }
}
public Match peek(){
    if(size==0){
        return null;
    }
    return heap[1];
}
    

}