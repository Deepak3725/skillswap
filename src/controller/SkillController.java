
package controller;

import com.google.gson.Gson;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import service.SkillService;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class SkillController implements HttpHandler {

    private Gson gson = new Gson();
    private SkillService skillService = new SkillService();
    private UserController userController;

    public SkillController(UserController userController) {
        this.userController = userController;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {

        String method = exchange.getRequestMethod();

        String response;
        int statusCode = 200;

        try {

            // Check whether user is logged in
            Integer userId = userController.getLoggedInUserId(exchange);

            if (userId == null) {

                statusCode = 401;
                response = gson.toJson("Please login first!");

            }

            // Get teaching and learning skills
            else if (method.equalsIgnoreCase("GET")) {

                List<String> teachingSkills =
                        skillService.getTeachingSkills(userId);

                List<String> learningSkills =
                        skillService.getLearningSkills(userId);

                Map<String, Object> skillsResponse = new HashMap<>();

                skillsResponse.put("teachingSkills", teachingSkills);
                skillsResponse.put("learningSkills", learningSkills);

                response = gson.toJson(skillsResponse);

            }

            // Add a teaching or learning skill
            else if (method.equalsIgnoreCase("POST")) {

                InputStream input = exchange.getRequestBody();

                String requestBody = new String(
                        input.readAllBytes(),
                        StandardCharsets.UTF_8
                );

                Map<String, String> skillData = gson.fromJson(
                        requestBody,
                        Map.class
                );

                String skillName = skillData.get("skillName");
                String skillType = skillData.get("skillType");

                String result = skillService.addSkill(
                        userId,
                        skillName,
                        skillType
                );

                if (result.equals("Skill added successfully.")) {

                    response = gson.toJson(result);

                } else {

                    statusCode = 400;
                    response = gson.toJson(result);
                }

            }

            // Remove a teaching or learning skill
            else if (method.equalsIgnoreCase("DELETE")) {

                InputStream input = exchange.getRequestBody();

                String requestBody = new String(
                        input.readAllBytes(),
                        StandardCharsets.UTF_8
                );

                Map<String, String> skillData = gson.fromJson(
                        requestBody,
                        Map.class
                );

                String skillName = skillData.get("skillName");
                String skillType = skillData.get("skillType");

                String result = skillService.removeSkill(
                        userId,
                        skillName,
                        skillType
                );

                if (result.equals("Skill removed successfully.")) {

                    response = gson.toJson(result);

                } else {

                    statusCode = 400;
                    response = gson.toJson(result);
                }

            }

            // Unsupported HTTP method
            else {

                statusCode = 405;
                response = gson.toJson("Method not allowed!");
            }

        } catch (Exception e) {

            e.printStackTrace();

            statusCode = 400;
            response = gson.toJson("Invalid request!");
        }

        // Send response
        byte[] responseBytes = response.getBytes(
                StandardCharsets.UTF_8
        );

        exchange.getResponseHeaders().set(
                "Content-Type",
                "application/json; charset=UTF-8"
        );

        exchange.sendResponseHeaders(
                statusCode,
                responseBytes.length
        );

        try (OutputStream output = exchange.getResponseBody()) {
            output.write(responseBytes);
        }
    }
}