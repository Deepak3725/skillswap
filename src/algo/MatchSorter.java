//Here we use mergeSort algorithm...

package algo;
import ds.MyArrayList;
import model.Match;

public class MatchSorter {

    public static MyArrayList<Match> sortByScore(MyArrayList<Match> matches){
        int n = matches.size();

        Match[] arr = new Match[n];
        for(int i = 0; i < n; i++){
            arr[i] = matches.get(i);
        }

        mergeSort(arr);

        MyArrayList<Match> sorted = new MyArrayList<>();
        for(int i = 0; i < n; i++){
            sorted.add(arr[i]);
        }
        return sorted;
    }

    //divide...
    private static void mergeSort(Match[] arr){
        //base case..
        if(arr.length <= 1){
            return;
        }

        //find mid index...
        int mid = arr.length / 2;

        //create left and right array..
        Match[] left = new Match[mid];
        Match[] right = new Match[arr.length - mid];

        //copy data from arr to left..
        for(int i = 0; i < mid; i++){
            left[i] = arr[i];
        }
        //copy remainig to right..
        for(int i = mid; i < arr.length; i++){
            right[i - mid] = arr[i];
        }

        //recursively divide left and right array... 
        mergeSort(left);
        mergeSort(right);

        merge(arr, left, right);
    }

    private static void merge(Match[] arr, Match[] left, Match[] right){
        int index = 0; //idx for arr...
        int i = 0;//index for left
        int j = 0;//index for right..

        //compare and merge the element....
        while(i < left.length && j < right.length){
            if(left[i].getScore() >= right[j].getScore()){
                arr[index] = left[i];
                index++;
                i++;
            } else {
                arr[index] = right[j];
                index++;
                j++;
            }
        }

        //copy rest of the elment from left..
        while(i < left.length){
            arr[index] = left[i];
            i++;
            index++;
        }

        //copy rest of the element from right...
        while(j < right.length){
            arr[index] = right[j];
            j++;
            index++;
        }
    }
}