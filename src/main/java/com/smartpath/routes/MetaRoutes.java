package com.smartpath.routes;

import com.google.gson.Gson;
import com.smartpath.services.NodeService;
import com.smartpath.services.RoadService;
import spark.Request;
import spark.Response;
import spark.Route;

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
        return gson.toJson(NodeService.searchNodes(query));
    };
}
