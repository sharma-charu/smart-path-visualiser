package com.smartpath.models;

public class Review {
    private int reviewId;
    private int roadId;
    private String userName;
    private int rating;
    private String comment;
    private String createdAt;

    public Review(int reviewId, int roadId, String userName, int rating, String comment, String createdAt) {
        this.reviewId = reviewId;
        this.roadId = roadId;
        this.userName = userName;
        this.rating = rating;
        this.comment = comment;
        this.createdAt = createdAt;
    }

    // Getters
    public int getReviewId() { return reviewId; }
    public int getRoadId() { return roadId; }
}
