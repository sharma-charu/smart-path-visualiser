# Smart Route Analyzer

A robust backend system for analyzing optimal routes that considers not just distance, but also dynamic metrics such as road condition, traffic density, safety scores, and weather impact. This project serves as the backend for the Smart Path Visualiser.

## Features

*   **Optimal Path Finding**: Implementation of Dijkstra's Algorithm to find the shortest and most efficient path between nodes.
*   **Dynamic Road Metrics**: Analysis of various road factors including:
    *   Surface Quality
    *   Traffic Density
    *   Safety Score
    *   Weather Impact
*   **User Feedback System**: 
    *   Submit and retrieve complaints about specific road segments.
    *   Rate and review roads.
*   **RESTful API**: A comprehensive set of endpoints to interact with the system.
*   **Data Persistence**: Uses SQLite for lightweight and reliable data storage.

## Technology Stack

*   **Java 17**: Core programming language.
*   **Spark Java**: Lightweight web framework for creating microservices.
*   **SQLite**: Relational database management system.
*   **Maven**: Project management and build automation tool.
*   **Gson**: For JSON serialization and deserialization.

## Prerequisites

*   Java Development Kit (JDK) 17 or higher.
*   Apache Maven installed and configured.

## Installation & Build

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/sharma-charu/smart-path-visualiser.git
    cd smart-path-visualiser
    ```

2.  **Build the project**:
    ```bash
    mvn clean install
    ```

3.  **Package (Create JAR)**:
    The project is configured with the Maven Shade Plugin to create a "fat" JAR containing all dependencies.
    ```bash
    mvn package
    ```

## Running the Application

You can run the application directly using Maven or by executing the generated JAR file.

**Option 1: Using Maven**
```bash
mvn exec:java
```

**Option 2: Using JAR**
```bash
java -jar target/smart-route-analyzer-1.0-SNAPSHOT.jar
```

The server will start on **port 8081**.
Access the health check at: `http://localhost:8081/hello`

## API Documentation

### General
*   **Health Check**
    *   `GET /hello`
    *   Returns a welcome message to verify the server is running.

### Metadata
*   **Get All Nodes**
    *   `GET /nodes`
    *   Returns a list of all map points (intersections/locations).
*   **Get All Roads**
    *   `GET /roads`
    *   Returns a list of all road segments connecting nodes.

### Path Finding
*   **Find Shortest Path**
    *   `POST /path`
    *   **Body**:
        ```json
        {
          "source": "A",
          "destination": "C"
        }
        ```
    *   Returns the optimal path and total cost/distance.

### Complaints
*   **Submit a Complaint**
    *   `POST /complaints`
    *   **Body**:
        ```json
        {
          "road_id": 1,
          "user_name": "John Doe",
          "complaint_type": "Pothole",
          "description": "Deep pothole near the crossing"
        }
        ```
*   **Get Complaints for a Road**
    *   `GET /complaints/:roadId`
    *   Example: `GET /complaints/1`

### Reviews
*   **Submit a Review**
    *   `POST /reviews`
    *   **Body**:
        ```json
        {
          "road_id": 1,
          "rating": 4,
          "comment": "Smooth ride but heavy traffic"
        }
        ```
*   **Get Reviews for a Road**
    *   `GET /reviews/:roadId`

## Database Schema

The project uses a SQLite database (`database/smart_route.db`) initialized via `database/schema.sql`.

*   `users`: Registered users (if applicable).
*   `nodes`: Geographical points (Latitude/Longitude).
*   `roads`: Connections between nodes with base distance.
*   `road_metrics`: Dynamic data for roads (traffic, surface, etc.).
*   `complaints`: specific issues reported by users.
*   `reviews`: Ratings and comments for road segments.
