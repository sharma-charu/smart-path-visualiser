package com.smartpath.routes;

import com.google.gson.Gson;
import com.smartpath.services.ComplaintService;
import spark.Request;
import spark.Response;
import spark.Route;

import java.util.Map;

import static spark.Spark.get;
import static spark.Spark.post;

public class ComplaintRoutes {
    private static final Gson gson = new Gson();

    public static void register() {
        post("/complaints", handleAddComplaint);
        get("/complaints/:roadId", handleGetComplaints);
    }

    private static Route handleAddComplaint = (Request req, Response res) -> {
        res.type("application/json");
        Map<String, Object> body = gson.fromJson(req.body(), Map.class);
        
        int roadId = ((Double) body.get("road_id")).intValue();
        String userName = (String) body.get("user_name");
        String type = (String) body.get("complaint_type");
        String desc = (String) body.get("description");

        boolean success = ComplaintService.addComplaint(roadId, userName, type, desc);
        return gson.toJson(Map.of("success", success));
    };

    private static Route handleGetComplaints = (Request req, Response res) -> {
        res.type("application/json");
        int roadId = Integer.parseInt(req.params(":roadId"));
        return gson.toJson(ComplaintService.getComplaintsForRoad(roadId));
    };
}
