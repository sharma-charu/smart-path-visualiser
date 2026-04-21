package com.smartpath.routes;

import com.google.gson.Gson;
import com.smartpath.services.ReviewService;
import spark.Request;
import spark.Response;
import spark.Route;

import java.util.Map;

import static spark.Spark.get;
import static spark.Spark.post;

public class ReviewRoutes {
    private static final Gson gson = new Gson();

    public static void register() {
        post("/reviews", handleAddReview);
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
}
