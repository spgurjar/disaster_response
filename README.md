# Disaster Response Coordination Platform

A real-time, full-stack application to track and coordinate responses to disasters.

Key features:

* **Disaster Management**: Create post about disasters with title, description, tags, and automated location extraction + geocoding.
* **Real-Time Updates**: WebSocket-powered events (`disaster_updated`, `social_media_updated`, `resources_updated`, `official_updates_updated`) to keep the UI in sync across clients.
* **Social Media Aggregation**: Mock social feed fetched and cached per disaster, with live update broadcasts.
* **Resource Mapping**: Geospatial lookup of nearby resources using PostGIS functions or RPCs, with caching.
* **Official Updates Scraping**: Fetch and cache official bulletins via web scraping or mocks.
* **Image Verification**: Integrate Gemini Vision API (with fallback) to verify image authenticity.
* **Caching Layer**: Unified `cache` table in Supabase for geocoding, social, resources, updates, and image verification (TTL: 1 hour).

---

## Tech Stack

* **Frontend**: Create React App (CRA) + React + Tailwind CSS + Socket.io-client
* **Backend**: Node.js + Express + Socket.io + Supabase JS + Axios + Cheerio
* **Database**: Supabase (PostgreSQL + PostGIS extension + custom RPC)
* **APIs**:

  * Google Maps Geocoding
  * Gemini Language & Vision APIs
  * OpenStreetMap Nominatim fallback

---

## Prerequisites

* Node.js >= 18

* npm or yarn

* Supabase project with the following tables & extension:

  ```sql
  -- Enable PostGIS
  create extension if not exists postgis;

  -- Disasters table
  create table if not exists public.disasters (
    id bigserial primary key,
    title text not null,
    description text not null,
    location_name text not null,
    tags text[] not null default '{}'::text[],
    owner_id text not null,
    audit_trail jsonb not null default '[]',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    location geometry(Point,4326) not null
  );

  -- Resources table
  create table if not exists public.resources (
    id bigserial primary key,
    disaster_id bigint not null references public.disasters(id) on delete cascade,
    name text not null,
    type text,
    location_name text,
    location geometry(Point,4326) not null,
    created_at timestamptz not null default now()
  );
  create index if not exists idx_resources_location on public.resources using gist(location);

  -- Cache table
  create table if not exists public.cache (
    key text primary key,
    value jsonb not null,
    expires_at timestamptz not null
  );
  ```

* Environment variables in `.env` (root of both client & backend):

  ```ini
  REACT_APP_API_BASE=http://localhost:5001

  SUPABASE_URL=https://your-project.supabase.co
  SUPABASE_KEY=your-anon-key

  GEMINI_API_KEY=your-gemini-api-key
  GOOGLE_MAPS_API_KEY=your-google-maps-api-key
  ```

---

## Getting Started

### Backend

```bash
cd backend
npm install
npm start
```

Runs Express + Socket.io server on port **5001**. Ensure `.env` is set.

### Frontend (Create React App)

```bash
cd client
npm install
npm start
```

Starts CRA dev server at **[http://localhost:3000](http://localhost:3000)**. It proxies API requests to `REACT_APP_API_BASE`.

---

---

## Usage

1. Open **[http://localhost:3000](http://localhost:3000)** in your browser.
2. Choose a user role (Admin or Contributor).
3. Create a new disaster: provide title, description, tags.
4. Select a disaster to see:

   * Real-time **social media** mock posts
   * Nearby **resources** fetched from Supabase RPC
   * **Official updates** via scraping or mock
   * **Image verification** using Gemini Vision
5. All sections have **Refresh** buttons and update via WebSockets.

---

## Contributing

1. Fork the repo.
2. Create a feature branch: `git checkout -b feature/...`
3. Commit your changes.
4. Open a Pull Request.

---

## License

This project is licensed under MIT.
