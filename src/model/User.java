
package model;

import ds.MyArrayList;

public class User {

    // NEW: Database fields
    private int userId;
    private String email;
    private String password;
    private String profilePicture;
    private String bio;
    private String whatsapp;
    private String telegram;

    private String name;
    private MyArrayList<String> teaches;
    private MyArrayList<String> wants;

    public User(String name){
        this.name=name;
        this.teaches=new MyArrayList<String>();//whatever skill they teach stores here..
        this.wants=new MyArrayList<String>();//skills they  like to teach..
    }

    // NEW: Constructor for database users
    public User(int userId, String name, String email, String password,
                String profilePicture, String bio, String whatsapp, String telegram){
        this.userId = userId;
        this.name = name;
        this.email = email;
        this.password = password;
        this.profilePicture = profilePicture;
        this.bio = bio;
        this.whatsapp = whatsapp;
        this.telegram = telegram;

        this.teaches = new MyArrayList<String>();
        this.wants = new MyArrayList<String>();
    }

    // NEW: Getters for database fields
    public int getUserId(){
        return userId;
    }

    public String getEmail(){
        return email;
    }

    public String getPassword(){
        return password;
    }

    public String getProfilePicture(){
        return profilePicture;
    }

    public String getBio(){
        return bio;
    }

    public String getWhatsapp(){
        return whatsapp;
    }

    public String getTelegram(){
        return telegram;
    }

    public String getName(){
        return name;
    }

    public MyArrayList<String> getTeaches(){
        return teaches;
    }

    public  MyArrayList<String> getWants(){
        return wants;
    }

    //adding skills of user..

    public void addTeachSkills(String skill){
        teaches.add(skill);
    }

    public void addWantSkills(String skill){
        wants.add(skill);
    }

    //deleting skills of user....

    public void removeTeachSkills(int idx){
        teaches.remove(idx);
    }

    public void removeWantSkills(int idx){
        wants.remove(idx);
    }

    //finding skills of user..

    public String getTeachSkills(int idx){
        return teaches.get(idx);
    }

    public  String getWantSkills(int idx){
        return wants.get(idx);
    }

    //how many skills do I have..

    public int teachSkillsize(){
        return teaches.size();
    }

    public int wantSkillsize(){
        return wants.size();
    }
}
