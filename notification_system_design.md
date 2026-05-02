# Notification System Design

---

## Stage 1

### REST API Design for Campus Notification Platform

#### Core Entities
- **Student** – the user receiving notifications
- **Notification** – a message of type `Placement`, `Event`, or `Result`

---

### API Endpoints

#### 1. Get All Notifications for a Student

```
GET /api/notifications
```

**Headers:**
```json
{
  "Authorization": "Bearer <token>",
  "Content-Type": "application/json"
}
```

**Response (200 OK):**
```json
{
  "notifications": [
    {
      "id": "d146095a-0d86-4a34-9e69-3900a14576bc",
      "type": "Placement",
      "message": "Google hiring drive on May 10th",
      "isRead": false,
      "createdAt": "2026-04-22T17:51:30Z"
    }
  ]
}
```

---

#### 2. Get a Single Notification

```
GET /api/notifications/:id
```

**Headers:**
```json
{
  "Authorization": "Bearer <token>"
}
```

**Response (200 OK):**
```json
{
  "id": "d146095a-0d86-4a34-9e69-3900a14576bc",
  "type": "Result",
  "message": "mid-sem results published",
  "isRead": false,
  "createdAt": "2026-04-22T17:51:30Z"
}
```

---

#### 3. Mark a Notification as Read

```
PATCH /api/notifications/:id/read
```

**Headers:**
```json
{
  "Authorization": "Bearer <token>",
  "Content-Type": "application/json"
}
```

**Response (200 OK):**
```json
{
  "id": "d146095a-0d86-4a34-9e69-3900a14576bc",
  "isRead": true,
  "updatedAt": "2026-04-22T18:00:00Z"
}
```

---

#### 4. Mark All Notifications as Read

```
PATCH /api/notifications/read-all
```

**Headers:**
```json
{
  "Authorization": "Bearer <token>"
}
```

**Response (200 OK):**
```json
{
  "message": "All notifications marked as read",
  "updatedCount": 12
}
```

---

#### 5. Delete a Notification

```
DELETE /api/notifications/:id
```

**Headers:**
```json
{
  "Authorization": "Bearer <token>"
}
```

**Response (200 OK):**
```json
{
  "message": "Notification deleted successfully"
}
```

---

#### 6. Get Unread Notification Count

```
GET /api/notifications/unread-count
```

**Headers:**
```json
{
  "Authorization": "Bearer <token>"
}
```

**Response (200 OK):**
```json
{
  "unreadCount": 5
}
```

---

### Real-Time Notification Mechanism

#### Chosen Approach: WebSockets (via Socket.IO)

When a new notification is created for a student, the server emits an event directly to that student's active socket connection. This gives instant, low-latency delivery without the client needing to poll.

**Flow:**
1. Student opens the app → client connects to WebSocket server
2. Client authenticates using Bearer token on connection
3. Server maps `studentID → socketID`
4. When a new notification is triggered (e.g., HR clicks "Notify All"):
   - Server saves notification to DB
   - Server emits `new_notification` event to the student's socket

**Client Event:**
```json
{
  "event": "new_notification",
  "data": {
    "id": "abc-123",
    "type": "Placement",
    "message": "Amazon hiring drive tomorrow",
    "createdAt": "2026-04-22T18:00:00Z"
  }
}
```

**Why WebSockets over SSE or Polling:**
- Full-duplex — client can also send read receipts in real time
- Lower overhead than repeated HTTP polling
- Socket.IO provides automatic reconnection and fallback support

---

## Stage 2

### Persistent Storage Design

#### Recommended Database: PostgreSQL (Relational)

**Why PostgreSQL:**
- Notifications have a well-defined, consistent schema (type enum, studentID FK, timestamps)
- Strong ACID guarantees — critical when marking notifications read or doing bulk inserts
- Excellent support for indexing, pagination, and complex queries
- Native support for `ENUM` types (Placement, Event, Result)
- Scales well with proper indexing and partitioning strategies

---

### DB Schema

```sql
CREATE TYPE notification_type AS ENUM ('Placement', 'Event', 'Result');

CREATE TABLE students (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100)        NOT NULL,
  email       VARCHAR(150) UNIQUE NOT NULL,
  rollNo      VARCHAR(50) UNIQUE  NOT NULL,
  createdAt   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE notifications (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studentID        UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  type             notification_type NOT NULL,
  message          TEXT NOT NULL,
  isRead           BOOLEAN DEFAULT FALSE,
  createdAt        TIMESTAMP DEFAULT NOW(),
  updatedAt        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_studentID ON notifications(studentID);
CREATE INDEX idx_notifications_isRead    ON notifications(studentID, isRead);
CREATE INDEX idx_notifications_createdAt ON notifications(studentID, createdAt DESC);
```

---

### Problems as Data Volume Grows

| Problem | Description |
|---|---|
| **Slow queries** | Full table scans on large `notifications` table without proper indexes |
| **High write load** | Bulk inserts for 50,000 students at once causes lock contention |
| **Read bottleneck** | Every page load fetches all notifications per student |
| **Storage bloat** | Old read notifications accumulate indefinitely |
| **Connection pool exhaustion** | Too many concurrent DB connections under load |

**Solutions:**
- **Indexing** on `studentID`, `isRead`, `createdAt`
- **Table partitioning** by `createdAt` (monthly partitions) for archival
- **Read replicas** for read-heavy workloads
- **Soft delete + archival** — move old read notifications to a cold storage table
- **Connection pooling** via PgBouncer

---

### SQL Queries

#### Fetch all unread notifications for a student (sorted newest first):
```sql
SELECT id, type, message, createdAt
FROM notifications
WHERE studentID = '1042'
  AND isRead = false
ORDER BY createdAt DESC;
```

#### Fetch all notifications for a student (paginated):
```sql
SELECT id, type, message, isRead, createdAt
FROM notifications
WHERE studentID = '1042'
ORDER BY createdAt DESC
LIMIT 20 OFFSET 0;
```

#### Mark a notification as read:
```sql
UPDATE notifications
SET isRead = true, updatedAt = NOW()
WHERE id = 'notification-uuid'
  AND studentID = '1042';
```

---

## Stage 3

### Slow Query Analysis

**Original query:**
```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt DESC;
```

**Why is this slow?**

1. `SELECT *` fetches all columns including large `message` TEXT fields — unnecessary data transfer
2. Without an index on `(studentID, isRead)`, the DB does a full table scan across 5,000,000 rows
3. `ORDER BY createdAt DESC` requires sorting the entire result set if no index covers it
4. At 50,000 students × 100 avg notifications = 5M rows, an unindexed scan is extremely slow

**Is adding indexes on every column a good idea?**

No. Adding indexes on every column is bad advice because:
- Each index increases storage and slows down `INSERT`/`UPDATE`/`DELETE` operations
- Indexes are only useful when a column has high cardinality or is frequently used in `WHERE` or `ORDER BY`
- `isRead` is a boolean — low cardinality, not useful as a standalone index
- A **composite index** on `(studentID, isRead, createdAt DESC)` is the right approach

**Improved query:**
```sql
SELECT id, type, message, createdAt
FROM notifications
WHERE studentID = 1042
  AND isRead = false
ORDER BY createdAt DESC
LIMIT 20;
```

**Add this composite index:**
```sql
CREATE INDEX idx_notifications_student_unread_date
ON notifications(studentID, isRead, createdAt DESC);
```

**Computation cost:**
- Before index: O(N) full scan — ~5M rows scanned
- After index: O(log N + K) — index seek + fetch only matching rows

---

### Query: Students who got a Placement notification in the last 7 days

```sql
SELECT DISTINCT s.id, s.name, s.email, s.rollNo
FROM students s
JOIN notifications n ON n.studentID = s.id
WHERE n.type = 'Placement'
  AND n.createdAt >= NOW() - INTERVAL '7 days';
```

---

## Stage 4

### Problem: DB Overload on Every Page Load

When 50,000 students load the app simultaneously, each triggers a DB query to fetch notifications. This overwhelms the database.

---

### Solutions

#### Solution 1: Server-Side Caching with Redis (Recommended)

Cache each student's notification list in Redis with a short TTL.

**Flow:**
1. Student requests notifications
2. Server checks Redis cache: `cache:notifications:{studentID}`
3. If **cache hit** → return cached data (no DB query)
4. If **cache miss** → query DB, store result in Redis with TTL of 60 seconds, return data
5. When a new notification arrives for that student → **invalidate** their cache key

**Tradeoffs:**
- Dramatically reduces DB load
- Sub-millisecond response times from cache
- Slight staleness (up to TTL duration) — acceptable for notifications
- Cache invalidation logic must be correct or students see stale data

```js
// Pseudocode
const cacheKey = `cache:notifications:${studentID}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const data = await db.query(`SELECT ... WHERE studentID = $1`, [studentID]);
await redis.setex(cacheKey, 60, JSON.stringify(data));
return data;
```

---

#### Solution 2: Pagination + Lazy Loading

Instead of fetching all notifications, fetch only the first page (e.g., 20 most recent) on load.

**Tradeoffs:**
- Reduces data transferred per request
- Works without extra infrastructure
- Still hits DB on every page load — needs caching to fully solve the problem

---

#### Solution 3: Read Replicas

Route all read queries (GET notifications) to a PostgreSQL read replica, keeping the primary free for writes.

**Tradeoffs:**
- Scales read throughput horizontally
- Replication lag — replica may be slightly behind primary
- More infrastructure to manage

---

### Recommended Combined Strategy:
**Redis cache + Pagination + Read replica** — cache handles the hot path, pagination keeps payloads small, and the read replica handles cache misses at scale.

---

## Stage 5

### Problem: Unreliable `notify_all` for 50,000 Students

**Original pseudocode:**
```
function notify_all(student_ids: array, message: string):
  for student_id in student_ids:
    send_email(student_id, message)   # calls Email API
    save_to_db(student_id, message)   # DB insert
    push_to_app(student_id, message)  # real-time push
```

---

### Shortcomings

1. **Sequential processing** — looping through 50,000 students one by one is extremely slow
2. **No error handling** — if `send_email` fails for student 200, the loop crashes and remaining 49,800 students are skipped
3. **Partial failure** — some students get email but not DB record (or vice versa) — inconsistent state
4. **No atomicity** — email and DB write are not in a transaction — they can diverge
5. **Tight coupling** — all three operations in one synchronous flow — one slow service blocks others

---

### Should saving to DB and sending email happen together?

**No — they should NOT be atomic together.** Here's why:
- DB writes are fast and reliable
- Email sending depends on an external API that can be slow, rate-limited, or fail
- Coupling them means a failed email prevents the DB record from being saved — student loses their notification entirely

**Better approach:** Save to DB first (guaranteed), then send email asynchronously via a queue.

---

### Redesigned `notify_all`

```
function notify_all(student_ids: array, message: string):

  // Step 1: Bulk insert all notifications to DB atomically
  BEGIN TRANSACTION
    bulk_insert_notifications(student_ids, message)
  COMMIT

  // Step 2: Push all jobs to a message queue (e.g., Redis Queue / RabbitMQ)
  for student_id in student_ids:
    queue.push({ job: "send_email", student_id, message })
    queue.push({ job: "push_to_app", student_id, message })

// Workers process the queue independently with retry logic
worker.process("send_email", async (job) => {
  try:
    send_email(job.student_id, job.message)
  catch:
    retry(job, max_attempts=3, backoff=exponential)
})
```

**Improvements:**
- DB insert is atomic — all or nothing via transaction
- Email failures are retried independently — don't affect other students
- Queue workers process in parallel — much faster for 50k students
- If email API is down, jobs stay in queue and are retried when it recovers
- DB record always exists — app notification is never lost even if email fails

---

## Stage 6

### Priority Inbox — Top N Notifications

#### Priority Rules:
- **Type weight:** `Placement = 3`, `Result = 2`, `Event = 1`
- **Recency:** more recent notifications score higher
- **Score formula:**

```
score = (typeWeight × 1000) + recencyScore
recencyScore = 1000 - minutesSinceCreated (capped at 0)
```

This ensures Placements always outrank Results which outrank Events, and within the same type, newer ones rank higher.

---

### How to Maintain Top 10 Efficiently as New Notifications Arrive

Use a **Min-Heap of size N**:
- Keep a min-heap of the top N notifications sorted by score
- When a new notification arrives:
  - Compute its score
  - If heap size < N → push it in
  - Else if its score > heap minimum → pop min, push new one
- This gives O(log N) insertion — efficient even with continuous incoming notifications

---

### Code: Priority Inbox

```js
const axios = require("axios");
const { Log, getToken } = require("../logging_middleware/index");

const BASE_URL = "http://20.207.122.201/evaluation-service";
const TOP_N = 10;

// Type weights: Placement > Result > Event
const TYPE_WEIGHT = {
  Placement: 3,
  Result: 2,
  Event: 1
};

function getHeaders() {
  return { Authorization: `Bearer ${getToken()}` };
}

// Calculate priority score for a notification
function calculateScore(notification) {
  const typeWeight = TYPE_WEIGHT[notification.Type] || 0;
  const createdAt = new Date(notification.Timestamp).getTime();
  const now = Date.now();
  const minutesAgo = (now - createdAt) / (1000 * 60);
  const recencyScore = Math.max(0, 1000 - minutesAgo);
  return (typeWeight * 1000) + recencyScore;
}

// Get top N notifications by priority score
function getTopN(notifications, n) {
  return notifications
    .map(n => ({ ...n, score: calculateScore(n) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}

async function fetchNotifications() {
  await Log("backend", "info", "service", "Fetching notifications from API");
  try {
    const res = await axios.get(`${BASE_URL}/notifications`, { headers: getHeaders() });
    const notifications = res.data.notifications;
    await Log("backend", "info", "service", `Fetched ${notifications.length} notifications`);
    return notifications;
  } catch (err) {
    await Log("backend", "error", "service", `Failed to fetch notifications: ${err.message}`);
    throw err;
  }
}

async function priorityInbox() {
  await Log("backend", "info", "handler", "Priority inbox computation started");

  let notifications;
  try {
    notifications = await fetchNotifications();
  } catch (err) {
    await Log("backend", "fatal", "handler", `Aborting priority inbox: ${err.message}`);
    return;
  }

  const topN = getTopN(notifications, TOP_N);

  await Log("backend", "info", "handler", `Top ${TOP_N} notifications selected from ${notifications.length} total`);

  console.log("\n============================================================");
  console.log(`        PRIORITY INBOX — TOP ${TOP_N} NOTIFICATIONS`);
  console.log("============================================================");
  console.log(`  Total Notifications : ${notifications.length}`);
  console.log(`  Showing Top         : ${TOP_N}`);
  console.log("============================================================\n");

  topN.forEach((n, i) => {
    console.log(`  ${i + 1}. [${n.Type}] ${n.Message}`);
    console.log(`     Timestamp : ${n.Timestamp}`);
    console.log(`     Score     : ${n.score.toFixed(2)}`);
    console.log(`     ID        : ${n.ID}`);
    console.log();
  });

  console.log("============================================================");
  console.log("              PRIORITY INBOX COMPLETE ✓");
  console.log("============================================================\n");
}

priorityInbox();
```

---

### Approach Explanation

The priority score combines **type importance** and **recency** into a single numeric value:

- Placement notifications always outrank Results, which outrank Events
- Within the same type, newer notifications rank higher
- As new notifications arrive, the score is recomputed dynamically
- For a production system, a **Min-Heap of size N** ensures O(log N) updates — efficient even with millions of incoming notifications
- Redis Sorted Sets (`ZADD`, `ZREVRANGE`) can also be used to maintain the leaderboard server-side in real time
