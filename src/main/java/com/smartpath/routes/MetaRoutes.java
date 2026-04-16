package com.smartpath.routes;

import com.google.gson.Gson;
import com.smartpath.services.NodeService;
import com.smartpath.services.RoadService;
import spark.Request;
import spark.Response;
import spark.Route;
import java.util.List;

import static spark.Spark.get;

public class MetaRoutes {
    private static final Gson gson = new Gson();

    public static void register() {
        get("/nodes", handleGetNodes);
        get("/roads", handleGetRoads);
        get("/search/nodes", handleSearchNodes);
    }

    private static Route handleGetNodes = (Request req, Response res) -> {
        res.type("application/json");
        return gson.toJson(NodeService.getAllNodes());
    };

    private static Route handleGetRoads = (Request req, Response res) -> {
        res.type("application/json");
        return gson.toJson(RoadService.getAllRoads());
    };
    
    private static Route handleSearchNodes = (Request req, Response res) -> {
        res.type("application/json");
        String query = req.queryParams("q");
        if (query == null || query.isEmpty()) {
            return "[]";
        }

        // 1. Check local DB
        List<com.smartpath.models.Node> localNodes = NodeService.searchNodes(query);

        com.google.gson.JsonArray resultsArray = new com.google.gson.JsonArray();
        for (com.smartpath.models.Node n : localNodes) {
             com.google.gson.JsonObject obj = new com.google.gson.JsonObject();
             obj.addProperty("nodeId", n.getNodeId());
             obj.addProperty("display_name", n.getNodeId()); // UI expects display_name or nodeId
             obj.addProperty("lat", n.getLatitude());
             obj.addProperty("lon", n.getLongitude());
             obj.addProperty("is_local", true); // Flag purely explicit local SQLite properties
             resultsArray.add(obj);
        }

        // 2. Fetch from Nominatim API to ensure vast coverage globally
        try {
            java.net.URL url = new java.net.URL("https://nominatim.openstreetmap.org/search?q=" + java.net.URLEncoder.encode(query, "UTF-8") + "&format=jsonv2&limit=15");
            java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("User-Agent", "SmartPathDesktopApp/1.0");
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);

            if (conn.getResponseCode() == 200) {
                java.io.InputStreamReader reader = new java.io.InputStreamReader(conn.getInputStream());
                com.google.gson.JsonArray nomData = com.google.gson.JsonParser.parseReader(reader).getAsJsonArray();
                for (com.google.gson.JsonElement el : nomData) {
                     resultsArray.add(el);
                }
                reader.close();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        return gson.toJson(resultsArray);
    };
}
