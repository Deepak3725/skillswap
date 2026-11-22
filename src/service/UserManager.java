package service;

import ds.MyArrayList;
import ds.MyHashMap;
import model.User;

public class UserManager {
    MyArrayList<User> users;
    MyHashMap<String, MyArrayList<User>> skillIndex; //skill -> list of users who teach it

    public UserManager(){
        this.users=new MyArrayList<User>();
        this.skillIndex=new MyHashMap<String, MyArrayList<User>>();
    }

    //here we will add all user to users array....
    public void addUser(User user){
        users.add(user);

        //fill the skill index: for each skill this user teaches, add the user to that skill's list
        MyArrayList<String> teaches=user.getTeaches();
        for(int i=0;i<teaches.size();i++){
            String skill=teaches.get(i);

            MyArrayList<User> teachers=skillIndex.get(skill);
            if(teachers==null){
                //first teacher for this skill, so create its list
                teachers=new MyArrayList<User>();
                skillIndex.set(skill,teachers);
            }

            //don't add the same user twice if they listed the skill twice
            if(!containsUser(teachers,user)){
                teachers.add(user);
            }
        }
    }

    //checks if this user is already in the list (compares names)
    private boolean containsUser(MyArrayList<User> list, User user){
        for(int i=0;i<list.size();i++){
            if(list.get(i).getName().equals(user.getName())){
                return true;
            }
        }
        return false;
    }

    public MyArrayList<User> getUsers(){
        return users;
    }

    //uses the skill index, no loop over users
    public MyArrayList<User> findTeachers(String skill){
        MyArrayList<User> teachers=skillIndex.get(skill);
        if(teachers==null){
            //nobody teaches this skill, return an empty list instead of null
            return new MyArrayList<User>();
        }
        return teachers;
    }

    //old loop kept for comparison in the demo
    public MyArrayList<User> findTeachersByScan(String skill){
        MyArrayList<User> teachers=new MyArrayList<>();

        for(int i=0;i<users.size();i++){
            User user=users.get(i);
            for(int j=0;j<user.getTeaches().size();j++){
                String teach=user.getTeaches().get(j);
                if(skill.equals(teach)){
                    teachers.add(user);
                    break;
                }
            }
        }
        return teachers;
    }
}