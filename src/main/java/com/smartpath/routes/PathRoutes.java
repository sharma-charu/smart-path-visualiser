package com.smartpath.routes;

import com.google.gson.Gson;
import com.smartpath.services.DijkstraService;
import com.smartpath.services.NodeService;
import com.smartpath.services.RoadService;
import spark.Request;
import spark.Response;
import spark.Route;

import java.util.ArrayList;
import java.util.HashMap;
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
        
        // Enhance result with node coordinates for visualization
        @SuppressWarnings("unchecked")
        List<String> path = (List<String>) result.get("path");
        
        if (path != null && !path.isEmpty()) {
            Map<String, double[]> nodeCoordinates = NodeService.getNodeCoordinates(path);
            
            // Build coordinate array in path order
            List<Map<String, Object>> pathWithCoordinates = new ArrayList<>();
            for (String nodeId : path) {
                if (nodeCoordinates.containsKey(nodeId)) {
                    Map<String, Object> nodeInfo = new HashMap<>();
                    nodeInfo.put("nodeId", nodeId);
                    nodeInfo.put("latitude", nodeCoordinates.get(nodeId)[0]);
                    nodeInfo.put("longitude", nodeCoordinates.get(nodeId)[1]);
                    pathWithCoordinates.add(nodeInfo);
                }
            }
            
            result.put("pathWithCoordinates", pathWithCoordinates);
        }

        return gson.toJson(result);
    };
}
