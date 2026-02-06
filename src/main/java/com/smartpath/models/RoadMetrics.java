package com.smartpath.models;

public class RoadMetrics {
    private int roadId;
    private int surfaceCondition;
    private int trafficDensity;
    private int safetyScore;
    private int weatherImpact;
    private int obstacleCount;
    private String lastUpdated;

    public RoadMetrics(int roadId, int surfaceCondition, int trafficDensity, int safetyScore, int weatherImpact, int obstacleCount, String lastUpdated) {
        this.roadId = roadId;
        this.surfaceCondition = surfaceCondition;
        this.trafficDensity = trafficDensity;
        this.safetyScore = safetyScore;
        this.weatherImpact = weatherImpact;
        this.obstacleCount = obstacleCount;
        this.lastUpdated = lastUpdated;
    }

    public int getRoadId() { return roadId; }
    public int getSurfaceCondition() { return surfaceCondition; }
    public int getTrafficDensity() { return trafficDensity; }
    public int getSafetyScore() { return safetyScore; }
    public int getWeatherImpact() { return weatherImpact; }
    public int getObstacleCount() { return obstacleCount; }
}
