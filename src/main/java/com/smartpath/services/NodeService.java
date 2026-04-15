package com.smartpath.services;

import com.smartpath.db.DBConnection;
import com.smartpath.models.Node;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public class NodeService {

    public static List<Node> getAllNodes() {
        List<Node> list = new ArrayList<>();
        // Limit total nodes to 2000 to prevent crash if not searching
        String sql = "SELECT * FROM nodes LIMIT 2000";
        try (Connection conn = DBConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql);
                ResultSet rs = pstmt.executeQuery()) {

            while (rs.next()) {
                list.add(new Node(
                        rs.getString("node_id"),
                        rs.getDouble("latitude"),
                        rs.getDouble("longitude")));
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return list;
    }

    public static List<Node> searchNodes(String query) {
        List<Node> list = new ArrayList<>();
        // Case-insensitive SQL search with limit
        String sql = "SELECT * FROM nodes WHERE UPPER(node_id) LIKE UPPER(?) LIMIT 20";
        try (Connection conn = DBConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql)) {

            pstmt.setString(1, "%" + query + "%");
            ResultSet rs = pstmt.executeQuery();

            while (rs.next()) {
                list.add(new Node(
                        rs.getString("node_id"),
                        rs.getDouble("latitude"),
                        rs.getDouble("longitude")));
            }
            rs.close();
        } catch (Exception e) {
            e.printStackTrace();
        }
        return list;
    }

    public static Map<String, double[]> getNodeCoordinates(List<String> nodeIds) {
        Map<String, double[]> coordinates = new HashMap<>();

        if (nodeIds == null || nodeIds.isEmpty()) {
            return coordinates;
        }

        // Build placeholders for IN clause
        String placeholders = nodeIds.stream()
                .map(id -> "?")
                .collect(Collectors.joining(","));

        String sql = "SELECT node_id, latitude, longitude FROM nodes WHERE node_id IN (" + placeholders + ")";

        try (Connection conn = DBConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql)) {

            // Set parameters
            for (int i = 0; i < nodeIds.size(); i++) {
                pstmt.setString(i + 1, nodeIds.get(i));
            }

            ResultSet rs = pstmt.executeQuery();
            while (rs.next()) {
                String nodeId = rs.getString("node_id");
                double lat = rs.getDouble("latitude");
                double lon = rs.getDouble("longitude");
                coordinates.put(nodeId, new double[] { lat, lon });
            }
            rs.close();

        } catch (Exception e) {
            e.printStackTrace();
        }

        return coordinates;
    }

    public static String getNearestNode(double lat, double lon) {
        String nearestNodeId = null;
        double minDistance = Double.MAX_VALUE;

        String sql = "SELECT DISTINCT n.node_id, n.latitude, n.longitude " +
                "FROM nodes n " +
                "JOIN roads r ON n.node_id = r.from_node OR n.node_id = r.to_node";
        try (Connection conn = DBConnection.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql);
                ResultSet rs = pstmt.executeQuery()) {

            while (rs.next()) {
                String nodeId = rs.getString("node_id");
                double nLat = rs.getDouble("latitude");
                double nLon = rs.getDouble("longitude");

                // Using Euclidean distance for simplicity instead of Haversine
                double dist = Math.pow(nLat - lat, 2) + Math.pow(nLon - lon, 2);
                if (dist < minDistance) {
                    minDistance = dist;
                    nearestNodeId = nodeId;
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        return nearestNodeId;
    }
}
