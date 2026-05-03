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
        Map<String, Object> body = gson.fromJson(req.body(), Map.class);
        String source = (String) body.get("source");
        String destination = (String) body.get("destination");

        // Parse raw Nominatim lat/lon if they exist
        Double sourceLat = body.get("sourceLat") != null ? (Double) body.get("sourceLat") : null;
        Double sourceLon = body.get("sourceLon") != null ? (Double) body.get("sourceLon") : null;
        Double destLat = body.get("destLat") != null ? (Double) body.get("destLat") : null;
        Double destLon = body.get("destLon") != null ? (Double) body.get("destLon") : null;
        
        Boolean prefTolls = body.get("prefTolls") != null ? (Boolean) body.get("prefTolls") : false;
        Boolean prefHighways = body.get("prefHighways") != null ? (Boolean) body.get("prefHighways") : false;
        Boolean prefQuality = body.get("prefQuality") != null ? (Boolean) body.get("prefQuality") : true;
        Boolean prefObstacles = body.get("prefObstacles") != null ? (Boolean) body.get("prefObstacles") : true;

        Map<String, List<DijkstraService.Edge>> graph = RoadService.buildGraph(prefTolls, prefHighways, prefQuality, prefObstacles);

        // Snap to nearest graph nodes if latitudes are provided
        String actualGraphSource = source;
        String actualGraphDest = destination;

        if (sourceLat != null && sourceLon != null && !graph.containsKey(source)) {
            actualGraphSource = NodeService.getNearestNode(sourceLat, sourceLon);
        }
        if (destLat != null && destLon != null && !graph.containsKey(destination)) {
            actualGraphDest = NodeService.getNearestNode(destLat, destLon);
        }

        if (actualGraphSource == null || actualGraphDest == null) {
            Map<String, Object> responseBody = new HashMap<>();
            responseBody.put("paths", new ArrayList<>());
            return gson.toJson(responseBody);
        }

        List<Map<String, Object>> paths = new ArrayList<>();
        Map<String, Object> shortest = DijkstraService.findShortestPath(graph, actualGraphSource, actualGraphDest);
        @SuppressWarnings("unchecked")
        List<String> spath = (List<String>) shortest.get("path");
        if (spath != null && !spath.isEmpty()) {
            paths.add(shortest);
        }

        if (paths.isEmpty()) {
            Map<String, Object> fallbackPath = new HashMap<>();
            List<String> pathList = new ArrayList<>();
            pathList.add(actualGraphSource);
            if (!actualGraphSource.equals(actualGraphDest)) {
                pathList.add(actualGraphDest);
            }
            
            fallbackPath.put("path", pathList);
            
            double d1Lat = sourceLat != null ? sourceLat : 0;
            double d1Lon = sourceLon != null ? sourceLon : 0;
            double d2Lat = destLat != null ? destLat : 0;
            double d2Lon = destLon != null ? destLon : 0;
            
            if (sourceLat == null || destLat == null) {
                List<String> qNodes = new ArrayList<>();
                qNodes.add(actualGraphSource);
                qNodes.add(actualGraphDest);
                Map<String, double[]> coords = NodeService.getNodeCoordinates(qNodes);
                if (coords.containsKey(actualGraphSource)) {
                    d1Lat = coords.get(actualGraphSource)[0];
                    d1Lon = coords.get(actualGraphSource)[1];
                }
                if (coords.containsKey(actualGraphDest)) {
                    d2Lat = coords.get(actualGraphDest)[0];
                    d2Lon = coords.get(actualGraphDest)[1];
                }
            }
            
            fallbackPath.put("distance", NodeService.calculateDistance(d1Lat, d1Lon, d2Lat, d2Lon));
            fallbackPath.put("time", 0);
            fallbackPath.put("quality", 50.0);
            fallbackPath.put("obstacles", 0);
            paths.add(fallbackPath);
        }

        // Enhance result with node coordinates for visualization
        for (Map<String, Object> pathData : paths) {
            @SuppressWarnings("unchecked")
            List<String> path = (List<String>) pathData.get("path");

            if (path != null && !path.isEmpty()) {
                Map<String, double[]> nodeCoordinates = NodeService.getNodeCoordinates(path);

                // Build coordinate array in path order
                List<Map<String, Object>> pathWithCoordinates = new ArrayList<>();

                // If it's a Nominatim source, prepend exact Nominatim coordinate
                if (sourceLat != null && sourceLon != null && !graph.containsKey(source)) {
                    Map<String, Object> exactSource = new HashMap<>();
                    exactSource.put("nodeId", source);
                    exactSource.put("latitude", sourceLat);
                    exactSource.put("longitude", sourceLon);
                    pathWithCoordinates.add(exactSource);

                    // Keep track so the UI array shows the Nominatim name
                    path.add(0, source);
                }

                for (String nodeId : path) {
                    if (nodeCoordinates.containsKey(nodeId)) {
                        Map<String, Object> nodeInfo = new HashMap<>();
                        nodeInfo.put("nodeId", nodeId);
                        nodeInfo.put("latitude", nodeCoordinates.get(nodeId)[0]);
                        nodeInfo.put("longitude", nodeCoordinates.get(nodeId)[1]);
                        pathWithCoordinates.add(nodeInfo);
                    }
                }

                // If it's a Nominatim destination, append exact Nominatim coordinate at the end
                if (destLat != null && destLon != null && !graph.containsKey(destination)) {
                    Map<String, Object> exactDest = new HashMap<>();
                    exactDest.put("nodeId", destination);
                    exactDest.put("latitude", destLat);
                    exactDest.put("longitude", destLon);
                    pathWithCoordinates.add(exactDest);

                    path.add(destination); // keep UI consistent
                }

                pathData.put("pathWithCoordinates", pathWithCoordinates);
            }
        }

        Map<String, Object> responseBody = new HashMap<>();
        responseBody.put("paths", paths);

        return gson.toJson(responseBody);
    };
}
