package com.smartpath.routes;

import com.google.gson.Gson;
import com.smartpath.services.ReviewService;
import spark.Request;
import spark.Response;
import spark.Route;

import java.util.Map;
import java.util.List;

import static spark.Spark.get;
import static spark.Spark.post;

public class ReviewRoutes {
    private static final Gson gson = new Gson();

    public static void register() {
        post("/reviews", handleAddReview);
        post("/path-reviews", handleAddPathReview);
        post("/edge-review", handleAddEdgeReview);
        get("/reviews/:roadId", handleGetReviews);
    }

    private static Route handleAddReview = (Request req, Response res) -> {
        res.type("application/json");
        Map<String, Object> body = gson.fromJson(req.body(), Map.class);
        
        int roadId = ((Double) body.get("road_id")).intValue();
        int rating = ((Double) body.get("rating")).intValue();
        String comment = (String) body.get("comment");
        String email = (String) body.get("email");

        boolean success = ReviewService.addReview(roadId, rating, comment, email);
        return gson.toJson(Map.of("success", success, "message", success ? "Review added" : "Review rejected due to low trust score or error"));
    };

    private static Route handleGetReviews = (Request req, Response res) -> {
        res.type("application/json");
        int roadId = Integer.parseInt(req.params(":roadId"));
        return gson.toJson(ReviewService.getReviewsForRoad(roadId));
    };

    private static Route handleAddPathReview = (Request req, Response res) -> {
        res.type("application/json");
        Map<String, Object> body = gson.fromJson(req.body(), Map.class);
        
        List<String> path = (List<String>) body.get("path");
        int surface = ((Double) body.get("surface")).intValue();
        int safety = ((Double) body.get("safety")).intValue();
        int weather = ((Double) body.get("weather")).intValue();
        String email = (String) body.get("email");

        boolean success = ReviewService.addPathReview(path, surface, safety, weather, email);
        return gson.toJson(Map.of("success", success, "message", success ? "Path review added and weights updated" : "Path review rejected"));
    };

    private static Route handleAddEdgeReview = (Request req, Response res) -> {
        res.type("application/json");
        Map<String, Object> body = gson.fromJson(req.body(), Map.class);
        
        String fromNode = (String) body.get("fromNode");
        String toNode = (String) body.get("toNode");
        int surface = ((Double) body.get("surface")).intValue();
        int safety = ((Double) body.get("safety")).intValue();
        int weather = ((Double) body.get("weather")).intValue();
        String email = (String) body.get("email");

        boolean success = ReviewService.addEdgeReview(fromNode, toNode, surface, safety, weather, email);
        return gson.toJson(Map.of("success", success, "message", success ? "Segment review added and weights updated" : "Segment review rejected or road not found"));
    };
}
