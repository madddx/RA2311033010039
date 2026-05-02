# Campus Notification & Vehicle Maintenance System

**Roll No:** RA2311033010039 | **Email:** mh8077@srmist.edu.in

A backend assignment submission consisting of three interconnected Node.js modules built for a campus platform evaluation:

1. **Logging Middleware** — a reusable structured logging client that posts logs to an external evaluation API with auto token-refresh
2. **Notification App Backend** — an Express REST API that fetches, filters, prioritizes, and serves campus notifications
3. **Vehicle Maintenance Scheduler** — a standalone script that solves an optimal scheduling problem using the 0/1 Knapsack algorithm

---

## Project Structure

```text
RA2311033010039/
├── LICENSE
├── logging_middleware/
│   ├── config.js
│   ├── index.js
│   └── test.js
├── notification_app_be/
│   ├── api/
│   │   └── notificationApi.js
│   ├── config/
│   │   └── config.js
│   ├── handler/
│   │   └── notificationHandler.js
│   ├── index.js
│   ├── middleware/
│   │   └── auth.js
│   ├── route/
│   │   └── notificationRoute.js
│   ├── service/
│   │   └── notificationService.js
│   └── utils/
│       └── priorityScore.js
├── notification_system_design.md
├── README.md
├── screenshots/
│   ├── all_notifications.png
│   ├── event.png
│   ├── health.png
│   ├── placement.png
│   ├── priority.png
│   ├── result.png
│   └── stats.png
└── vehicle_maintence_scheduler/
    ├── index.js
    └── package.json
```



---

## Module 1: Logging Middleware

### What it does

A shared logging utility used by both other modules. It sends structured log entries to an external evaluation service API. If the access token is expired (HTTP 401), it automatically refreshes it and retries the request.

### API

```js
const { Log, getToken } = require('./logging_middleware/index');

// Log a message
await Log(stack, level, package, message);

// Get the current bearer token (used by other modules)
getToken();
```

### Parameters

| Parameter | Valid Values |
|---|---|
| `stack` | `"backend"`, `"frontend"` |
| `level` | `"debug"`, `"info"`, `"warn"`, `"error"`, `"fatal"` |
| `package` (backend) | `cache`, `controller`, `cron_job`, `db`, `domain`, `handler`, `repository`, `route`, `service`, `auth`, `config`, `middleware`, `utils` |
| `package` (frontend) | `api`, `component`, `hook`, `page`, `state`, `style`, `auth`, `config`, `middleware`, `utils` |

### Configuration

Edit `logging_middleware/config.js` to set credentials:

```js
module.exports = {
  ACCESS_TOKEN:  "<initial_jwt>",
  LOG_API_URL:   "http://<host>/evaluation-service/logs",
  AUTH_API_URL:  "http://<host>/evaluation-service/auth",
  CLIENT_ID:     "<client_id>",
  CLIENT_SECRET: "<client_secret>",
  EMAIL:         "<email>",
  NAME:          "<name>",
  ROLL_NO:       "<roll_no>",
  ACCESS_CODE:   "<access_code>"
};
```

### Running the test

```bash
cd logging_middleware
npm install
node test.js
```

The test covers valid log calls across all levels and packages, plus invalid calls (wrong stack, wrong level, wrong package) which print validation errors locally without hitting the API.

---

## Module 2: Notification App Backend

### What it does

An Express.js REST API that:
- Fetches all campus notifications from an external evaluation service
- Computes a **priority score** for each notification based on type and recency
- Exposes endpoints to get all notifications, the priority inbox, type-filtered results, and statistics

### Setup

```bash
cd notification_app_be
npm install
```

Create a `.env` file (optional — defaults shown):

```env
PORT=3000
BASE_URL=http://20.207.122.201/evaluation-service
TOP_N=10
```

### Running

```bash
node index.js
```

Server starts at `http://localhost:3000` and prints all available endpoints on startup.

### API Endpoints

All routes under `/api/notifications` are protected by auth middleware that injects the bearer token from `getToken()`.

---

#### Health Check

```
GET /health
```

Response:
```json
{
  "success": true,
  "status": "Server is running",
  "timestamp": "2026-05-02T10:00:00.000Z"
}
```

---

#### Get All Notifications

```
GET /api/notifications
```

Response:
```json
{
  "success": true,
  "count": 42,
  "notifications": [ ... ]
}
```

---

#### Get Priority Inbox (Top N)

```
GET /api/notifications/priority?n=10
```

Returns the top `n` notifications sorted by priority score. Defaults to `TOP_N` from config (10).

Response:
```json
{
  "success": true,
  "total": 42,
  "showing": 10,
  "notifications": [
    {
      "ID": "...",
      "Type": "Placement",
      "Message": "Google hiring drive on May 10th",
      "Timestamp": "2026-04-22T17:51:30Z",
      "priorityScore": 3999.23
    }
  ]
}
```

---

#### Get Notifications by Type

```
GET /api/notifications/type/:type
```

Valid types: `Placement`, `Result`, `Event` (case-insensitive).

Response:
```json
{
  "success": true,
  "type": "Placement",
  "count": 15,
  "notifications": [ ... ]
}
```

---

#### Get Notification Statistics

```
GET /api/notifications/stats
```

Response:
```json
{
  "success": true,
  "stats": {
    "total": 42,
    "byType": {
      "Placement": 15,
      "Result": 12,
      "Event": 15
    }
  }
}
```

---

### Priority Score Algorithm

Each notification is scored using:

```
score = (typeWeight × 1000) + recencyScore
recencyScore = max(0, 1000 - minutesSinceCreated)
```

Type weights:

| Type | Weight |
|---|---|
| Placement | 3 |
| Result | 2 |
| Event | 1 |

This ensures **Placements always outrank Results, which outrank Events**. Within the same type, more recent notifications rank higher. The `getTopN()` utility in `utils/priorityScore.js` computes scores, sorts descending, and slices to `n`.

---

### Architecture

```
Request → authMiddleware → Route → Handler → Service → API (external) → Response
                                                      ↘ priorityScore util
```

Every layer calls `Log()` from the logging middleware, producing structured audit logs for each request and operation.

---

## Module 3: Vehicle Maintenance Scheduler

### What it does

A standalone Node.js script that solves an **optimal vehicle maintenance scheduling problem** using the classic **0/1 Knapsack algorithm**. It:

1. Fetches all depots (each with a `MechanicHours` budget) from the evaluation API
2. Fetches all vehicles (each with a `Duration` cost and `Impact` value)
3. For each depot, runs the Knapsack algorithm to select which vehicles to service within the available mechanic-hours to **maximize total impact**
4. Backtracks through the DP table to identify the exact selected vehicles
5. Prints a formatted per-depot report to the console

### Setup & Running

```bash
cd vehicle_maintence_scheduler
npm install
node index.js
```

### Algorithm

**Problem:** Given vehicles each with a `Duration` (mechanic-hours required) and `Impact` (value if serviced), and a depot budget of `MechanicHours` — select vehicles to maximize total impact without exceeding the budget. Each vehicle can only be selected once (0/1).

**Solution:** Standard 0/1 Knapsack with a 2D DP table, followed by backtracking to recover selected vehicles.

```
Time Complexity:  O(n × W)   where n = number of vehicles, W = mechanic-hours budget
Space Complexity: O(n × W)   for the DP table
```

### Sample Output


```text id="8y7j2m"
============================================================
            VEHICLE MAINTENANCE SCHEDULER
============================================================
Total Depots   : 3
Total Vehicles : 12
============================================================

┌──────────────────── Depot ID: D01 ───────────────────────┐
│ Budget            : 40 mechanic-hours                    │
│ Hours Used        : 38                                   │
│ Hours Remaining   : 2                                    │
│ Total Impact      : 270                                  │
│ Vehicles Selected : 4                                    │
│                                                          │
│ 1. TaskID         : T03                                  │
│    Duration       : 10h   |   Impact : 80                │
│                                                          │
│ 2. TaskID         : T07                                  │
│    Duration       : 12h   |   Impact : 90                │
└──────────────────────────────────────────────────────────┘

============================================================
              SCHEDULING JOB COMPLETE ✓
============================================================

```

---

## System Design Summary

The `notification_system_design.md` file contains a full 6-stage system design write-up:

| Stage | Topic |
|---|---|
| 1 | REST API design (6 endpoints) + WebSocket real-time delivery via Socket.IO |
| 2 | PostgreSQL schema with ENUM types, FK constraints, and indexing strategy |
| 3 | Slow query analysis — composite index reducing O(N) scan to O(log N + K) |
| 4 | Redis caching + pagination + read replicas for 50,000 concurrent users |
| 5 | Redesigning `notify_all` with message queues, bulk DB transactions, and retry logic |
| 6 | Priority inbox scoring formula + Min-Heap / Redis Sorted Set approach |

---

## Dependencies

| Package | Used In | Purpose |
|---|---|---|
| `axios` | All modules | HTTP requests to the evaluation service |
| `express` | `notification_app_be` | REST API server |
| `cors` | `notification_app_be` | Cross-origin request handling |
| `dotenv` | `notification_app_be` | Environment variable loading |

Install per-module by running `npm install` inside each directory.

---

## Screenshots

The `screenshots/` folder contains API response screenshots from the running server:

| File | Endpoint |
|---|---|
| `all_notifications.png` | `GET /api/notifications` |
| `priority.png` | `GET /api/notifications/priority` |
| `event.png` | `GET /api/notifications/type/Event` |
| `placement.png` | `GET /api/notifications/type/Placement` |
| `result.png` | `GET /api/notifications/type/Result` |
| `stats.png` | `GET /api/notifications/stats` |
| `health.png` | `GET /health` |

---

## License

MIT — see [LICENSE](LICENSE).
