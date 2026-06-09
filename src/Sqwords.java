//import java.awt.*;
//import java.awt.event.*;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.InputStreamReader;
//import java.awt.Toolkit;
//import javax.swing.*;
import java.util.Vector;
import java.util.Random;
import java.util.Scanner;


public class Sqwords {

    // VIEW

    /*JFrame window;
    JButton guessButton;
    Game gamePanel;
    JPanel lettersPanel;
    JPanel guessedPanel;
    JLabel guessedWords;
    public class Game extends JPanel{
        @Override
        public void paintComponent(Graphics g){
            super.paintComponent(g);
            g.setColor(Color.white);
            g.drawRect(0,0,this.getWidth(),this.getHeight()/5);
        }
    }*/



    // MODEL

    enum Location{
        TOP, BOTTOM, LEFT, RIGHT, NONE
    }

    class FLW{
        String s;
        Vector<Letter> letters;
        //boolean used;
        Location l;
        boolean guessed;
        int count;
        boolean pointsGiven;

        public FLW(){
            s = "";
            //used = false;
            l = Location.NONE;
            guessed = false;
            letters = new Vector<>();
            count = 0;
            pointsGiven = false;
        }

        public FLW(String word, Location loc){
            s = word;
            letters = new Vector<>();
            for(int i = 0; i < 5; i++){
                letters.add(new Letter(word.charAt(i)));
            }
            //used = true;
            l = loc;
            guessed = false;
            count = 0;
            pointsGiven = false;
        }

    }

    class Letter{
        char l;
        boolean guessed;

        public Letter(){
            l = ' ';
            guessed = false;
        }

        public Letter(char ch){
            l = ch;
            guessed = false;
        }
    }

    Vector<Vector<String>> dictionary; //dictionary[0-25][0-x]
    Vector<FLW> chosenWords;
    Vector<String> guesses;
    Vector<Vector<FLW>> available;
    Vector<Character> lettersNotUsed;
    int points;
    int guessCount;
    boolean won;
    boolean lost;


    // CONTROLLER

    public void chooseWords(){

        boolean exit = false;
        Random r = new Random();
        String s;
        while (!exit){
            int n1 = r.nextInt(26);
            int n2 = -1;
            if (!available.get(n1).isEmpty()){
                n2 = r.nextInt(available.get(n1).size());
                s = available.get(n1).get(n2).s;
            }   
            else{
                s = "";
            }

            if (!s.isEmpty()){
                FLW top = available.get(n1).get(n2);
                System.out.println("TOP: " + top.s);

                int n3 = top.s.charAt(0) - 'a'; // = n1
                int n4 = -1;
                if (!available.get(n3).isEmpty()){
                    n4 = r.nextInt(available.get(n3).size());
                    s = available.get(n3).get(n4).s;
                    if (s.equals(top.s)){
                        s = "";
                    }
                }
                else{
                    s = "";
                }

                if(!s.isEmpty()){
                    FLW left = available.get(n3).get(n4);
                    System.out.println("LEFT: " + left.s);

                    int n5 = top.s.charAt(4) - 'a';
                    int n6 = -1;
                    if (!available.get(n5).isEmpty()){
                        n6 = r.nextInt(available.get(n5).size());
                        s = available.get(n5).get(n6).s;
                        if (s.equals(top.s) || s.equals(left.s)){
                            s = "";
                        }
                    }
                    else{
                        s = "";
                    }

                    if(!s.isEmpty()){
                        FLW right = available.get(n5).get(n6);
                        System.out.println("RIGHT: " + right.s);

                        int n7 = left.s.charAt(4) - 'a';
                        int n8 = -1;
                        s = "";
                        if (!available.get(n7).isEmpty()){
                            // collect ALL valid bottom words, then pick one at random
                            // (scanning from index 0 biased bottom words toward early alphabet)
                            Vector<Integer> candidates = new Vector<>();
                            for (int idx = 0; idx < available.get(n7).size(); idx++){
                                String cand = available.get(n7).get(idx).s;
                                if(cand.charAt(4) == right.s.charAt(4)
                                        && !cand.equals(top.s) && !cand.equals(left.s) && !cand.equals(right.s)){
                                    candidates.add(idx);
                                }
                            }
                            if (!candidates.isEmpty()){
                                n8 = candidates.get(r.nextInt(candidates.size()));
                                s = available.get(n7).get(n8).s;
                            }
                        }

                        if(!s.isEmpty()){
                            FLW bottom = available.get(n7).get(n8);
                            System.out.println("BOTTOM: " + bottom.s);

                            //add to chosen words vector 
                            chosenWords.addElement(new FLW(top.s, Location.TOP)); //idx 0
                            chosenWords.addElement(new FLW(left.s, Location.LEFT)); // 1
                            chosenWords.addElement(new FLW(right.s, Location.RIGHT)); // 2
                            chosenWords.addElement(new FLW(bottom.s, Location.BOTTOM)); // 3
                            // delete from available words vector
                            if (available.get(n1).removeElement(top) && available.get(n3).removeElement(left) && available.get(n5).removeElement(right) && available.get(n7).removeElement(bottom)){
                                System.out.println("\n\nWords have been chosen. About to start game.");
                            }
                            else{
                                System.out.println("ERROR: removing chosen words from available");
                            }
                            // exit
                            exit = true;
                        }

                    }
                }
            }
        }
    }

    public int getPoints(){
        //return 100 - 20*(guesses.size()-1);
        if (guesses.size() == 1){
            return 100;
        }
        else if(guesses.size() == 2){
            return 80;
        }
        else if(guesses.size() == 3){
            return 60;
        }
        else if(guesses.size() == 4){
            return 40;
        }
        else if(guesses.size() == 5){
            return 30;
        }
        else if(guesses.size() == 6){
            return 20;
        }
        else{
            return 10;
        }
    }


    public void playGame(BufferedReader in){
        try{
            System.out.println("\nLET'S PLAY SQWORDS!");
            System.out.println("You have 3 wrong guesses. If you guess a word correctly, it will not count as a guess.");
            System.out.println("--------------------------------------------------------------------------------------------");
            
            //boolean won = false;
            //boolean lost = false;
            //int guessCount = 0;
            //int correctCount = 0;
            String s = "";
            boolean error = false;

            while(!won && !lost){
                error = false;
                System.out.println("\nGuess a Five Letter Word");
                s = in.readLine();
                if (s != null && s.matches("[a-zA-Z]{5}")){
                    s = s.toLowerCase();
                    if(!dictionary.get(s.charAt(0)-'a').contains(s)){
                        System.out.println("Not found in dictionary -- try again!");
                    }
                    else{
                        for(String str: guesses){
                            if(s.equalsIgnoreCase(str)){
                                System.out.println("Already guessed -- try a different word");
                                error = true;
                                break;
                            }
                        }
                        if(!error){
                            guesses.add(s);
                            guessCount++;
                            for (int i = 0; i < chosenWords.size(); i++){
                                if (s.equalsIgnoreCase(chosenWords.elementAt(i).s)){
                                    guessCount--;
                                    // only award points if not already solved -- otherwise typing an
                                    // auto-completed word would collect its points a second time
                                    if (!chosenWords.elementAt(i).guessed){
                                        chosenWords.elementAt(i).guessed = true;
                                        points = points + getPoints();
                                    }
                                }
                                for(int j = 0; j < 5; j++){
                                    for(int k = 0; k < 5; k++){
                                        if (s.charAt(j) == chosenWords.elementAt(i).letters.elementAt(k).l && !chosenWords.elementAt(i).letters.elementAt(k).guessed){
                                            chosenWords.elementAt(i).letters.elementAt(k).guessed = true;
                                            chosenWords.elementAt(i).count++;
                                            //correctCount++;
                                        }
                                    }
                                }
                                if (chosenWords.elementAt(i).count == 5 && !chosenWords.elementAt(i).guessed){
                                    chosenWords.elementAt(i).guessed = true;
                                    points = points + getPoints() - 10;
                                    // add points
                                }
                            }
    
                            if(chosenWords.elementAt(0).count + chosenWords.elementAt(1).count + chosenWords.elementAt(2).count + chosenWords.elementAt(3).count == 20){
                                won = true;
                            }else if(guessCount >= 3){
                                lost = true; 
                            }
                            
                            printGame();
                        }
                    }
                }
                else{
                    System.out.println("Please use FIVE letter words only!");
                }
            }

        }catch(Exception e){
            System.out.println("ERROR: playing game");
            e.printStackTrace();
        }finally{
            chosenWords.clear();
            guesses.clear();
            lettersNotUsed.clear();
            fillLNU();
            points = 0;
            guessCount = 0;
            won = false;
            lost = false;
        }

    }

    public void printGame(){

        try{
            System.out.println("\nBOARD:\n");

            //top -- idx 0
            if (chosenWords.elementAt(0).letters.elementAt(0).guessed || lost){
                System.out.print(chosenWords.elementAt(0).letters.elementAt(0).l);
            }
            else{
                System.out.print("_");
            }

            for (int i = 1; i < 5; i ++){
                if (chosenWords.elementAt(0).letters.elementAt(i).guessed || lost){
                    System.out.print(String.format("%3s", chosenWords.elementAt(0).letters.elementAt(i).l));
                }
                else{
                    System.out.print(String.format("%3s", "_"));
                }
            }
            System.out.println();

            //left + right -- idx 1,2 -- print letters 2,3,4
            for (int i = 1; i < 4; i++){
                if (chosenWords.elementAt(1).letters.elementAt(i).guessed || lost){
                    System.out.print(chosenWords.elementAt(1).letters.elementAt(i).l);
                }
                else{
                    System.out.print("_");
                }

                if (chosenWords.elementAt(2).letters.elementAt(i).guessed || lost){
                    System.out.print(String.format("%12s", chosenWords.elementAt(2).letters.elementAt(i).l));
                }
                else{
                    System.out.print(String.format("%12s", "_"));
                }
                System.out.println();
            }
            //bottom -- idx 3
            if(chosenWords.elementAt(3).letters.elementAt(0).guessed || lost){
                System.out.print(chosenWords.elementAt(3).letters.elementAt(0).l);
            }
            else{
                System.out.print("_");
            }

            for (int i = 1; i < 5; i ++){
                if(chosenWords.elementAt(3).letters.elementAt(i).guessed || lost){
                    System.out.print(String.format("%3s", chosenWords.elementAt(3).letters.elementAt(i).l));
                }
                else{
                    System.out.print(String.format("%3s", "_"));
                }
            }
            System.out.println();

            System.out.print("\nGUESSES:     ");
            for (String a : guesses){
                System.out.print(a + "   ");
            }
            System.out.println();

            if(!won && !lost){

                System.out.print("Letters NOT guessed yet:  ");
                for(String str : guesses){
                    for(int i = 0; i < str.length(); i ++){
                        Character c = str.charAt(i);
                        if(lettersNotUsed.contains(c)){
                            lettersNotUsed.remove(c);
                        }
                    }
                }
                for(char ch: lettersNotUsed){
                    System.out.print(ch + " ");
                }
                System.out.println();


                int guessesLeft = 3 - guessCount;
                if (guessesLeft > 1){
                    System.out.println("\nYou have " + guessesLeft + " wrong guesses remaining");
                }
                else if (guessesLeft < 1){
                    System.out.println("\nYou have ZERO wrong guesses remaining");
                }
                else{
                    System.out.println("\nYou have ONE wrong guess remaining");
                }
                //System.out.println();

            }

            System.out.println("POINTS:  " + points);

            if(won){
                System.out.println("\nCONGRATULATIONS! YOU WON SQWORDS!");
            }
            if(lost){
                System.out.println("\nYOU LOST SQWORDS :(");
            }
        }catch(Exception e){
            System.out.println("ERROR: printing game");
            e.printStackTrace();
        }
    }

    public void loadDictionary(){

        // dictionary.txt = every valid guess (~14,855 words)
        // answers.txt    = curated pool the four square words are drawn from (~2,309 words)
        // if answers.txt is missing, puzzles fall back to the full dictionary
        Vector<Vector<String>> dicRows = readWordFile("dictionary.txt");
        Vector<Vector<String>> ansRows = readWordFile("answers.txt");
        if (ansRows == null){
            ansRows = dicRows;
        }
        if (dicRows == null){
            System.out.println("ERROR: opening dictionary file");
            return;
        }
        for (int i = 0; i < 26; i++){
            dictionary.add(i, dicRows.get(i));
            Vector<FLW> avail = new Vector<>();
            for (String a : ansRows.get(i)){
                avail.addElement(new FLW(a, Location.NONE));
            }
            available.add(i, avail);
        }
    }

    // reads a 26-line word file (one line per starting letter); always returns
    // all 26 rows so a guess starting with any letter is safe, or null on error
    private Vector<Vector<String>> readWordFile(String name){
        File f = new File(name);
        if (!f.exists()){
            f = new File("C:\\_Aly\\Personal\\coding\\sqwords\\src\\" + name);
        }
        try (Scanner sc = new Scanner(new FileInputStream(f))) {
            Vector<Vector<String>> rows = new Vector<>();
            for (int i = 0; i < 26; i++){
                Vector<String> row = new Vector<>();
                if(sc.hasNextLine()){
                    String words = sc.nextLine().trim();
                    if(!words.isEmpty()){
                        for(String a : words.split(" ")){
                            row.addElement(a);
                        }
                    }
                }
                rows.add(row);
            }
            return rows;
        } catch (Exception e) {
            return null;
        }
        

        /*chosenWords.addElement(new FLW("debut", Location.TOP)); //idx 0
        chosenWords.addElement(new FLW("dance", Location.LEFT)); // 1
        chosenWords.addElement(new FLW("truly", Location.RIGHT)); // 2
        chosenWords.addElement(new FLW("essay", Location.BOTTOM)); // 3
        */
    }

    public void fillLNU(){
        
        for (char i = 'a'; i <= 'z'; i++){
            lettersNotUsed.add(i);
        }
    }

    public static void main(String[] args) {
        new Sqwords();
    }
    
    public Sqwords(){
        try{
            chosenWords = new Vector<>();
            guesses = new Vector<>();
            dictionary = new Vector<>();
            available = new Vector<>();
            lettersNotUsed = new Vector<>();
            fillLNU();
            won = false;
            lost = false;
            guessCount = 0;
            points = 0;

            loadDictionary();

            boolean exit = false;
            BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
            
            do{
                chooseWords();
                playGame(in);
                boolean cont = false;
                while(!cont){
                    System.out.println("\nPlay Again? Type YES or NO");
                    String s = in.readLine();
                    if (s.equalsIgnoreCase("yes")){
                        cont = true;
                        exit = false;
                    }
                    else if(s.equalsIgnoreCase("no")){
                        cont = true;
                        exit = true;
                    }
                    else{
                        cont = false;
                    }
                }   
            }while(!exit);

        }catch(Exception e){
            System.out.println("ERROR: main");
            e.printStackTrace();
        }
    }
}
