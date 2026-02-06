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

    public static Map<String, List<Edge>> buildGraph() {
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
                
                // Get metrics, default to average/good if null
                int surface = rs.getInt("surface_condition"); 
                if (rs.wasNull()) surface = 5;
                int traffic = rs.getInt("traffic_density");
                if (rs.wasNull()) traffic = 1;
                int safety = rs.getInt("safety_score");
                if (rs.wasNull()) safety = 5;
                int weather = rs.getInt("weather_impact");
                if (rs.wasNull()) weather = 1;
                int obstacles = rs.getInt("obstacle_count");
                
                // Calculate Dynamic Weight
                double weight = distance 
                              + (obstacles * 2.0)
                              + ((5 - surface) * 2.0)
                              + (traffic * 1.5)
                              + (5 - safety)
                              + weather;
                              
                graph.putIfAbsent(from, new ArrayList<>());
                graph.putIfAbsent(to, new ArrayList<>()); // bidirectionality? Roads usually 2-way but graph might be directed. 
                // Assuming undirected for simplicity unless specified.
                // Let's make it undirected (add both ways)
                graph.get(from).add(new Edge(to, weight));
                graph.get(to).add(new Edge(from, weight));
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
                    rs.getDouble("distance")
                ));
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return list;
    }
}
