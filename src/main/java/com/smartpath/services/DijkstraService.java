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

    public static Map<String, Object> findShortestPath(Map<String, List<Edge>> graph, String source,
            String destination) {
        return findShortestPath(graph, source, destination, Collections.emptySet(), Collections.emptySet());
    }

    public static Map<String, Object> findShortestPath(Map<String, List<Edge>> graph, String source, String destination,
            Set<String> removedNodes, Set<String> removedEdges) {
        Map<String, Double> dist = new HashMap<>();
        Map<String, String> prev = new HashMap<>();

        class NodeDist {
            String node;
            double distance;

            NodeDist(String node, double distance) {
                this.node = node;
                this.distance = distance;
            }
        }

        PriorityQueue<NodeDist> pq = new PriorityQueue<>(Comparator.comparingDouble(nd -> nd.distance));

        for (String node : graph.keySet()) {
            dist.put(node, Double.MAX_VALUE);
        }
        dist.put(source, 0.0);
        pq.add(new NodeDist(source, 0.0));

        while (!pq.isEmpty()) {
            NodeDist current = pq.poll();

            if (current.distance > dist.getOrDefault(current.node, Double.MAX_VALUE)) {
                continue;
            }

            if (current.node.equals(destination))
                break;

            List<Edge> neighbors = graph.get(current.node);
            if (neighbors != null) {
                for (Edge edge : neighbors) {
                    if (removedNodes.contains(edge.to))
                        continue;
                    String edgeKey1 = current.node + "-" + edge.to;
                    String edgeKey2 = edge.to + "-" + current.node;
                    if (removedEdges.contains(edgeKey1) || removedEdges.contains(edgeKey2))
                        continue;

                    double newDist = dist.get(current.node) + edge.weight;
                    if (newDist < dist.getOrDefault(edge.to, Double.MAX_VALUE)) {
                        dist.put(edge.to, newDist);
                        prev.put(edge.to, current.node);
                        pq.add(new NodeDist(edge.to, newDist));
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

    public static double calculatePathDistance(Map<String, List<Edge>> graph, List<String> path) {
        double dist = 0.0;
        for (int i = 0; i < path.size() - 1; i++) {
            String u = path.get(i);
            String v = path.get(i + 1);
            boolean found = false;
            if (graph.containsKey(u)) {
                for (Edge e : graph.get(u)) {
                    if (e.to.equals(v)) {
                        dist += e.weight;
                        found = true;
                        break;
                    }
                }
            }
            if (!found)
                return Double.MAX_VALUE;
        }
        return dist;
    }

    public static List<Map<String, Object>> findKShortestPaths(Map<String, List<Edge>> graph, String source,
            String destination, int K) {
        List<Map<String, Object>> A = new ArrayList<>();
        List<List<String>> A_paths = new ArrayList<>();

        Map<String, Object> shortest = findShortestPath(graph, source, destination);
        @SuppressWarnings("unchecked")
        List<String> shortestPath = (List<String>) shortest.get("path");
        if (shortestPath.isEmpty()) {
            return A;
        }

        A.add(shortest);
        A_paths.add(shortestPath);

        PriorityQueue<Map<String, Object>> B = new PriorityQueue<>(
                Comparator.comparingDouble(p -> (Double) p.get("distance")));

        for (int k = 1; k < K; k++) {
            List<String> prevPath = A_paths.get(k - 1);

            for (int i = 0; i < prevPath.size() - 1; i++) {
                String spurNode = prevPath.get(i);
                List<String> rootPath = new ArrayList<>(prevPath.subList(0, i + 1));

                Set<String> removedEdges = new HashSet<>();
                for (List<String> p : A_paths) {
                    if (p.size() > i && p.subList(0, i + 1).equals(rootPath)) {
                        removedEdges.add(p.get(i) + "-" + p.get(i + 1));
                        removedEdges.add(p.get(i + 1) + "-" + p.get(i));
                    }
                }

                Set<String> removedNodes = new HashSet<>();
                for (int j = 0; j < rootPath.size() - 1; j++) {
                    removedNodes.add(rootPath.get(j));
                }

                Map<String, Object> spurPathResult = findShortestPath(graph, spurNode, destination, removedNodes,
                        removedEdges);
                @SuppressWarnings("unchecked")
                List<String> spurPath = (List<String>) spurPathResult.get("path");

                if (!spurPath.isEmpty()) {
                    List<String> totalPath = new ArrayList<>(rootPath.subList(0, rootPath.size() - 1));
                    totalPath.addAll(spurPath);

                    double totalDist = calculatePathDistance(graph, totalPath);
                    if (totalDist == Double.MAX_VALUE)
                        continue;

                    Map<String, Object> candidate = new HashMap<>();
                    candidate.put("path", totalPath);
                    candidate.put("distance", totalDist);

                    boolean exists = false;
                    for (Map<String, Object> b : B) {
                        if (b.get("path").equals(totalPath)) {
                            exists = true;
                            break;
                        }
                    }
                    if (!exists) {
                        B.add(candidate);
                    }
                }
            }

            if (B.isEmpty())
                break;
            Map<String, Object> bestCandidate = B.poll();
            A.add(bestCandidate);
            A_paths.add((List<String>) bestCandidate.get("path"));
        }

        return A;
    }
}
