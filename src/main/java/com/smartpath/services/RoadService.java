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

    public static Map<String, List<Edge>> buildGraph(boolean avoidTolls, boolean avoidHighways, boolean prefQuality, boolean prefObstacles) {
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
                if (rs.wasNull()) surfaceCondition = 4;
                int trafficDensity = rs.getInt("traffic_density");
                if (rs.wasNull()) trafficDensity = 2;
                int safetyScore = rs.getInt("safety_score");
                if (rs.wasNull()) safetyScore = 4;
                int obstacleCount = rs.getInt("obstacle_count");

                // Simulated checks since no schema column exists yet
                boolean isHighway = distance > 5.0;
                boolean isToll = distance > 8.0;

                double weight = distance;
                
                if (avoidHighways && isHighway) {
                    weight += 50.0;
                }
                if (avoidTolls && isToll) {
                    weight += 50.0;
                }
                if (prefObstacles) {
                    weight += obstacleCount * 2.0;
                }
                if (prefQuality) {
                    weight += (5 - surfaceCondition) * 2.0;
                    weight += trafficDensity * 1.5;
                    weight += (5 - safetyScore);
                }

                graph.putIfAbsent(from, new ArrayList<>());
                graph.putIfAbsent(to, new ArrayList<>());

                graph.get(from).add(new Edge(to, weight, distance, surfaceCondition, obstacleCount, trafficDensity));
                graph.get(to).add(new Edge(from, weight, distance, surfaceCondition, obstacleCount, trafficDensity));
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
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
