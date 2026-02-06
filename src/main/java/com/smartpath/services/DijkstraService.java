package com.smartpath.services;

import java.util.*;

public class DijkstraService {

    public static class Edge {
        public String to;
        public double weight;

        public Edge(String to, double weight) {
            this.to = to;
            this.weight = weight;
        }
    }

    public static Map<String, Object> findShortestPath(Map<String, List<Edge>> graph, String source, String destination) {
        Map<String, Double> dist = new HashMap<>();
        Map<String, String> prev = new HashMap<>();
        PriorityQueue<String> pq = new PriorityQueue<>(Comparator.comparingDouble(dist::get));

        for (String node : graph.keySet()) {
            dist.put(node, Double.MAX_VALUE);
        }
        dist.put(source, 0.0);
        pq.add(source);

        while (!pq.isEmpty()) {
            String current = pq.poll();
            if (current.equals(destination)) break;

            if (dist.get(current) == Double.MAX_VALUE) break; // unreachable

            List<Edge> neighbors = graph.get(current);
            if (neighbors != null) {
                for (Edge edge : neighbors) {
                    double newDist = dist.get(current) + edge.weight;
                    if (newDist < dist.getOrDefault(edge.to, Double.MAX_VALUE)) {
                        dist.put(edge.to, newDist);
                        prev.put(edge.to, current);
                        pq.add(edge.to);
                    }
                }
            }
        }

        List<String> path = new ArrayList<>();
        if (prev.containsKey(destination) || source.equals(destination)) {
             String step = destination;
             while (step != null) {
                 path.add(step);
                 step = prev.get(step);
             }
             Collections.reverse(path);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("path", path);
        result.put("distance", dist.getOrDefault(destination, -1.0));
        return result;
    }
}
