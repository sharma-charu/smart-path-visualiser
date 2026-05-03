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

        // Initialize cache if needed (reusing the same logic from getNearestNode)
        if (cachedConnectedNodes == null) {
            getNearestNode(0, 0); // Trigger cache loading safely
        }

        if (cachedConnectedNodes != null) {
            // Convert cache to quick lookup map if it isn't already, but looping is fast enough for ~2000 nodes
            // Or just do a nested loop since path is small
            for (String id : nodeIds) {
                for (Node n : cachedConnectedNodes) {
                    if (n.getNodeId().equals(id)) {
                        coordinates.put(id, new double[]{n.getLatitude(), n.getLongitude()});
                        break;
                    }
                }
            }
        }

        // Fallback for isolated nodes not in the connected cache
        if (coordinates.size() < nodeIds.size()) {
            List<String> missingIds = nodeIds.stream().filter(id -> !coordinates.containsKey(id)).collect(Collectors.toList());
            if (!missingIds.isEmpty()) {
                String placeholders = missingIds.stream().map(id -> "?").collect(Collectors.joining(","));
                String sql = "SELECT node_id, latitude, longitude FROM nodes WHERE node_id IN (" + placeholders + ")";
                
                try (Connection conn = DBConnection.getConnection();
                     PreparedStatement pstmt = conn.prepareStatement(sql)) {
                    for (int i = 0; i < missingIds.size(); i++) {
                        pstmt.setString(i + 1, missingIds.get(i));
                    }
                    ResultSet rs = pstmt.executeQuery();
                    while (rs.next()) {
                        coordinates.put(rs.getString("node_id"), new double[]{rs.getDouble("latitude"), rs.getDouble("longitude")});
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        }

        return coordinates;
    }

    private static List<Node> cachedConnectedNodes = null;

    public static String getNearestNode(double lat, double lon) {
        if (cachedConnectedNodes == null) {
            cachedConnectedNodes = new ArrayList<>();
            String sql = "SELECT DISTINCT n.node_id, n.latitude, n.longitude " +
                    "FROM nodes n " +
                    "JOIN roads r ON n.node_id = r.from_node OR n.node_id = r.to_node";
            try (Connection conn = DBConnection.getConnection();
                 PreparedStatement pstmt = conn.prepareStatement(sql);
                 ResultSet rs = pstmt.executeQuery()) {
                while (rs.next()) {
                    cachedConnectedNodes.add(new Node(
                            rs.getString("node_id"),
                            rs.getDouble("latitude"),
                            rs.getDouble("longitude")));
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        String nearestNodeId = null;
        double minDistance = Double.MAX_VALUE;

        for (Node n : cachedConnectedNodes) {
            double nLat = n.getLatitude();
            double nLon = n.getLongitude();

            // Using Euclidean distance for simplicity instead of Haversine
            double dist = Math.pow(nLat - lat, 2) + Math.pow(nLon - lon, 2);
            if (dist < minDistance) {
                minDistance = dist;
                nearestNodeId = n.getNodeId();
            }
        }

        return nearestNodeId;
    }
    public static double calculateDistance(double lat1, double lon1, double lat2, double lon2) {
        final int R = 6371; // Radius of Earth in kilometers
        double latDistance = Math.toRadians(lat2 - lat1);
        double lonDistance = Math.toRadians(lon2 - lon1);
        double a = Math.sin(latDistance / 2) * Math.sin(latDistance / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(lonDistance / 2) * Math.sin(lonDistance / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
}
