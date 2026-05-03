package com.smartpath.services;

import com.smartpath.db.DBConnection;
import com.smartpath.models.Road;
import com.smartpath.models.RoadMetrics;
import com.smartpath.services.DijkstraService.Edge;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class RoadService {

    private static Map<String, Map<String, List<Edge>>> graphCache = new HashMap<>();

    public static void clearCache() {
        graphCache.clear();
    }

    public static Map<String, List<Edge>> buildGraph(boolean avoidTolls, boolean avoidHighways, boolean prefQuality, boolean prefObstacles) {
        String cacheKey = avoidTolls + "-" + avoidHighways + "-" + prefQuality + "-" + prefObstacles;
        if (graphCache.containsKey(cacheKey)) {
            return graphCache.get(cacheKey);
        }

        Map<String, List<Edge>> graph = new HashMap<>();

        String sql = "SELECT r.from_node, r.to_node, r.distance, " +
                "m.surface_condition, m.traffic_density, m.safety_score, m.weather_impact, m.obstacle_count " +
                "FROM roads r " +
                "LEFT JOIN road_metrics m ON r.road_id = m.road_id";

        try (Connection conn = DBConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql);
                ResultSet rs = pstmt.executeQuery()) {

            while (rs.next()) {
                String from = rs.getString("from_node");
                String to = rs.getString("to_node");
                double distance = rs.getDouble("distance");

                int surfaceCondition = rs.getInt("surface_condition");
                if (rs.wasNull()) surfaceCondition = 50;
                int trafficDensity = rs.getInt("traffic_density");
                if (rs.wasNull()) trafficDensity = 50;
                int safetyScore = rs.getInt("safety_score");
                if (rs.wasNull()) safetyScore = 50;
                int weatherImpact = rs.getInt("weather_impact");
                if (rs.wasNull()) weatherImpact = 50;
                int obstacleCount = rs.getInt("obstacle_count");

                // Simulated checks since no schema column exists yet
                boolean isHighway = distance > 5.0;
                boolean isToll = distance > 8.0;

                // Normalize penalties to a factor (0.0 to 1.0)
                // 100 surface = perfect, 0 surface = terrible
                double surfacePenalty = (100.0 - surfaceCondition) / 100.0;
                // 100 traffic = jammed, 0 traffic = clear
                double trafficPenalty = trafficDensity / 100.0;
                // 100 safety = perfectly safe, 0 safety = dangerous
                double safetyPenalty = (100.0 - safetyScore) / 100.0;
                // 100 weather = high impact, 0 = clear
                double weatherPenalty = weatherImpact / 100.0;
                
                // Average penalty factor from the 4 metrics combined
                double combinedPenalty = (surfacePenalty + trafficPenalty + safetyPenalty + weatherPenalty) / 4.0;
                
                // Weight formula: distance as base, adjusted dynamically by qualities ONLY if requested
                double weight = distance;
                if (prefQuality) {
                    weight += distance * combinedPenalty;
                }
                
                if (avoidHighways && isHighway) {
                    weight += 50.0;
                }
                if (avoidTolls && isToll) {
                    weight += 50.0;
                }
                if (prefObstacles) {
                    weight += obstacleCount * 2.0;
                }

                graph.putIfAbsent(from, new ArrayList<>());
                graph.putIfAbsent(to, new ArrayList<>());

                graph.get(from).add(new Edge(to, weight, distance, surfaceCondition, obstacleCount, trafficDensity, safetyScore, weatherImpact));
                graph.get(to).add(new Edge(from, weight, distance, surfaceCondition, obstacleCount, trafficDensity, safetyScore, weatherImpact));
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        
        graphCache.put(cacheKey, graph);
        return graph;
    }

    public static List<Road> getAllRoads() {
        List<Road> list = new ArrayList<>();
        String sql = "SELECT * FROM roads";
        try (Connection conn = DBConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql);
                ResultSet rs = pstmt.executeQuery()) {

            while (rs.next()) {
                list.add(new Road(
                        rs.getInt("road_id"),
                        rs.getString("from_node"),
                        rs.getString("to_node"),
                        rs.getDouble("distance")));
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return list;
    }
}
