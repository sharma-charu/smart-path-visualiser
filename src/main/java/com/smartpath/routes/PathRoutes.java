package com.smartpath.routes;

import com.google.gson.Gson;
import com.smartpath.services.DijkstraService;
import com.smartpath.services.RoadService;
import spark.Request;
import spark.Response;
import spark.Route;

import java.util.List;
import java.util.Map;

import static spark.Spark.post;

public class PathRoutes {
    private static final Gson gson = new Gson();

    public static void register() {
        post("/path", handleFindPath);
    }

    private static Route handleFindPath = (Request req, Response res) -> {
        res.type("application/json");
        Map<String, String> body = gson.fromJson(req.body(), Map.class);
        String source = body.get("source");
        String destination = body.get("destination");

        Map<String, List<DijkstraService.Edge>> graph = RoadService.buildGraph();
        Map<String, Object> result = DijkstraService.findShortestPath(graph, source, destination);

        return gson.toJson(result);
    };
}
