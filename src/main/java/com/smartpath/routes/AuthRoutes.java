package com.smartpath.routes;

import com.google.gson.Gson;
import com.smartpath.services.AuthService;
import spark.Request;
import spark.Response;
import spark.Route;

import java.util.Map;

import static spark.Spark.post;

public class AuthRoutes {
    private static final Gson gson = new Gson();

    public static void register() {
        post("/auth/signup", handleSignup);
        post("/auth/login", handleLogin);
    }

    private static Route handleSignup = (Request req, Response res) -> {
        res.type("application/json");
        Map<String, String> body = gson.fromJson(req.body(), Map.class);
        
        String name = body.get("name");
        String email = body.get("email");
        String password = body.get("password");

        if (name == null || email == null || password == null) {
            return gson.toJson(Map.of("success", false, "message", "Missing fields"));
        }

        boolean success = AuthService.signupUser(name, email, password);
        if (success) {
            return gson.toJson(Map.of("success", true));
        } else {
            return gson.toJson(Map.of("success", false, "message", "Email may already exist"));
        }
    };

    private static Route handleLogin = (Request req, Response res) -> {
        res.type("application/json");
        Map<String, String> body = gson.fromJson(req.body(), Map.class);
        
        String email = body.get("email");
        String password = body.get("password");

        if (email == null || password == null) {
            return gson.toJson(Map.of("success", false, "message", "Missing credentials"));
        }

        Map<String, Object> result = AuthService.loginUser(email, password);
        return gson.toJson(result);
    };
}
