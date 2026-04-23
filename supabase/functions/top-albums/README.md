# Top Albums API

A REST endpoint that returns a user's top-ranked albums from Album Ranker, sorted by ELO rating.

**Base URL:** `https://xeiygyromiabfiroykba.supabase.co/functions/v1/top-albums`

---

## Authentication

This API uses **Bearer token auth** — the standard two-step pattern:

### Step 1 — Get an access token

```http
POST https://xeiygyromiabfiroykba.supabase.co/auth/v1/token?grant_type=password
Content-Type: application/json

{
  "email": "your@email.com",
  "password": "yourpassword"
}
```

Copy the `access_token` from the response.

### Step 2 — Call the API

```http
GET https://xeiygyromiabfiroykba.supabase.co/functions/v1/top-albums
Authorization: Bearer <access_token>
```

---

## Endpoint

### `GET /functions/v1/top-albums`

Returns the top albums for the authenticated user (or another user by ID).

#### Query Parameters

| Parameter | Type   | Default | Description                                         |
|-----------|--------|---------|-----------------------------------------------------|
| `limit`   | int    | `10`    | Number of albums to return (1–50)                   |
| `user_id` | UUID   | —       | View a specific user's list; omit for your own list |

#### Example Request

```bash
curl -X GET \
  "https://xeiygyromiabfiroykba.supabase.co/functions/v1/top-albums?limit=5" \
  -H "Authorization: Bearer <your_access_token>"
```

#### Example Response

```json
{
  "user_id": "a1b2c3d4-...",
  "total_returned": 5,
  "limit": 5,
  "albums": [
    {
      "rank": 1,
      "id": "1440935467",
      "title": "Rumours",
      "artist": "Fleetwood Mac",
      "year": "1977",
      "cover_url": "https://is1-ssl.mzstatic.com/...",
      "rating": 1247,
      "comparisons": 18,
      "placement_complete": true
    },
    ...
  ],
  "generated_at": "2026-04-22T17:00:00.000Z"
}
```

#### Error Responses

| Status | Meaning                                              |
|--------|------------------------------------------------------|
| `401`  | Missing, invalid, or expired token                   |
| `405`  | Wrong HTTP method (use GET)                          |
| `500`  | Database error                                       |

---

## Postman Setup

1. Create a new collection → **Album Ranker API**
2. Add a **POST** request to `https://xeiygyromiabfiroykba.supabase.co/auth/v1/token?grant_type=password`  
   - Body (JSON): `{ "email": "...", "password": "..." }`
   - In **Tests** tab, add: `pm.collectionVariables.set("token", pm.response.json().access_token);`
3. Add a **GET** request to `{{base_url}}/functions/v1/top-albums`  
   - Authorization: Bearer Token → `{{token}}`
4. Run the auth request first, then the albums request — the token saves automatically.

---

## Fields

| Field                | Description                                                |
|----------------------|------------------------------------------------------------|
| `rating`             | ELO rating (starts at 1000, higher = better ranked)        |
| `comparisons`        | Total head-to-head comparisons completed for this album    |
| `placement_complete` | `true` once the album has finished its initial 6 matches   |
