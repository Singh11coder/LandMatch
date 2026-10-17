# LandWatch — "See Change Before It Becomes Damage."

> **Geospatial AI Command Center for Surface Encroachment, Illegal Construction, Vegetation Loss, Water Shrinkage, and Sand Mining Detection.**

LandWatch empowers state environmental authorities, municipal town planners, and forest departments to monitor vast geographical territories using multi-temporal satellite imagery, detect unauthorized environmental and land-use breaches, coordinate rapid field ground truthing, and capture verifiable audit trails.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm 9+
- Modern desktop browser (Chrome, Edge, Firefox, Safari)

### Installation
```bash
# Clone and enter the repository
cd landwatch

# Install dependencies
npm install

# Seed mock database & generate high-contrast placeholder satellite imagery
npm run setup

# Launch local development server
npm run dev
```
Open **http://localhost:5173** in your browser.

### Key Scripts
| Script | Command | Purpose |
|---|---|---|
| `npm run dev` | `vite` | Starts dev server with instant HMR |
| `npm run build` | `vite build` | Compiles optimized production bundle |
| `npm run preview` | `vite preview` | Serves production build locally |
| `npm run lint` | `eslint src --ext js,jsx` | Runs ESLint with zero-tolerance checks |
| `npm run seed` | `node scripts/seed.mjs` | Resets and seeds localStorage database |
| `npm run tiles` | `node scripts/generate-placeholder-tiles.mjs` | Generates Sentinel-2 sample tile imagery |
| `npm run setup` | `npm run seed && npm run tiles` | Complete one-shot setup |

---

## 🔑 Demo Credentials

LandWatch enforces strict **Role-Based Access Control (RBAC)** at both the UI routing layer and the client service layer:

| Role | Email | Password | Permissions & Scope |
|---|---|---|---|
| **System Admin** | `admin@landwatch.gov.in` | `demo123` | Full system access. Create, edit, and delete protected ecological zones with instant ray-casting alert recalculation. View all alerts, assign inspections, view timeline. |
| **Land Officer** | `officer@landwatch.gov.in` | `demo123` | Command dashboard, Change Detection stepper & swipe slider, Alerts review, Create single & bulk field inspections, Historical timeline. Read-only zone buffer view. |
| **Field Inspector** | `inspector@landwatch.gov.in` | `demo123` | Focused field operations workspace. Restricted strictly to tasks assigned to their user ID (`user-inspector-1`). Drag-and-drop Kanban status updates, geotagged evidence photo uploads, decision remarks, and final violation/false-alarm confirmation. |

*Additional demo accounts: `officer2@landwatch.gov.in`, `inspector2@landwatch.gov.in`, `inspector3@landwatch.gov.in` (all password: `demo123`).*

---

## 🎬 3-Minute Hackathon Demo Script

Follow this script to demonstrate the complete end-to-end workflow in under 3 minutes:

### 1. Command Dashboard & Real-Time Monitoring (0:00 – 0:30)
1. Navigate to `http://localhost:5173/login` and log in as **Land Officer** (`officer@landwatch.gov.in` / `demo123`).
2. Point out the **Command Center Dashboard**:
   - 4 live StatCards (Total Monitored Area, New Changes in 30 days, High-Priority Alerts, Pending Inspections) with interactive trend sparklines.
   - Interactive GIS Leaflet map with clustered markers, severity color-coding, and protected zone boundaries.
   - Recharts visual analytics: Weekly Change Detection Area chart and Donut breakdown by classification type.
3. Click any alert item in the **Recent Detection Activity Feed** to deep-link directly into Change Detection.

### 2. Change Detection & Interactive Swipe Comparison (0:30 – 1:15)
1. On the **Change Detection** page (`/detect`):
   - Select area: **Upper Lake Bhopal** (`area-bhopal-lake`).
   - Dates auto-populate from available imagery (`2024-01-15` vs `2024-05-15`).
   - Adjust the **Confidence Slider** (debounced) and filter categories.
   - Click **Run Detection Analysis** to observe the 4-stage processing stepper (*Fetching images → Aligning imagery → Computing change mask → Classifying changes*).
2. Switch comparison modes:
   - **Swipe Mode**: Drag the interactive vertical divider handle across the satellite image to reveal before/after surface alterations in real time.
   - **Overlay Mode**: Toggle categorized vector polygons (Construction in Red, Vegetation loss in Orange, Water shrinkage in Blue, Sand mining in Amber).
3. Click a detection polygon to view the inspection drawer with area metrics and confidence score.

### 3. Alerts Feed & Field Assignment (1:15 – 1:55)
1. Navigate to **Alerts** (`/alerts`):
   - Notice protected-zone alerts pinned to the top with high-visibility red badges and delicate tints.
   - Filter by change type (e.g., *Vegetation Loss*) and severity (*Critical*).
   - Use checkboxes to select multiple alerts, opening the sticky bottom **Bulk Action Bar**.
   - Click **Schedule Bulk Inspection**, select assignee **Ramesh Patel (Field Inspector 1)**, set priority, and submit.
   - Notice the selected alerts immediately transition to `under_inspection`.
2. Click the **Protected Zones** tab:
   - View registered ecological reserves (Forest, Lake Buffer, River Bank).
   - *(Optional Admin step)*: Log in as `admin@landwatch.gov.in`, click **Draw New Zone**, draw a polygon on the map, name it, and save. Notice how LandWatch automatically runs ray-casting point-in-polygon tests to update all affected alerts!

### 4. Inspector Workflow, Geotagged Evidence & Decision (1:55 – 2:35)
1. Log out and log in as **Field Inspector** (`inspector@landwatch.gov.in` / `demo123`).
2. The UI automatically displays the **Inspector Dashboard** and redirects to `/inspections`:
   - Verify that **only** tasks assigned to `Ramesh Patel` are visible (RBAC enforced in the service layer).
3. On the **Kanban Board**:
   - Drag an assigned inspection card from **Assigned** to **Visited**.
   - Click the card to open the **Inspection Detail Drawer**.
   - Review the mini-map and before/after satellite image thumbnails.
4. Upload field ground evidence:
   - Drag & drop or select ground photos in the **Field Photos** dropzone.
   - Observe live preview staging, progress simulation, and validation (max 5 photos, 5 MB limit).
5. Finalize decision:
   - Enter ground inspection remarks: *"Ground verification completed. Unlicensed concrete batching facility encroaching upon lake buffer zone."*
   - Click **Confirm Violation**.
   - Review confirmation modal and confirm. The inspection locks with an immutable audit log timestamp and auto-resolves the linked alert.

### 5. Historical Timeline & Spatiotemporal Progression (2:35 – 3:00)
1. Log back in as **Officer** or **Admin** and navigate to **Timeline** (`/timeline`).
2. Select an area with long temporal coverage (e.g., *Aravalli Forest Buffer*).
3. Hit the **Auto-Play** button:
   - Watch the timeline progress across acquisition dates at 1x or 2x speed.
   - The map dynamically updates satellite tiles, vector change overlays, and pulsing rings.
   - The interactive Recharts area progression line chart plots cumulative altered area over time, synchronizing the reference dot with the current active date.

---

## 🛠 Architecture & Tech Stack

```
landwatch/
├── public/
│   └── tiles/                     # Sample Sentinel-2 imagery (areaId/YYYY-MM-DD.jpg)
├── scripts/
│   ├── seed.mjs                   # Initial mock database seeder
│   └── generate-placeholder-tiles.mjs # Sharp image generator for satellite tiles
├── src/
│   ├── components/
│   │   ├── alerts/                # Alert cards, filters, and bulk bars
│   │   ├── common/                # Button, Badge, Modal, Drawer, Toast, Pagination, Skeleton
│   │   ├── inspections/           # PhotoUpload dropzone, Kanban cards, Audit log
│   │   ├── layout/                # Header, Sidebar, Nav, User profile menu
│   │   └── map/                   # SatelliteMap, ProtectedZoneLayer, ChangeOverlay,
│   │                              # BeforeAfterSlider (swipe), DrawControl, DetectionMarkers
│   ├── context/                   # AuthContext, ToastContext
│   ├── hooks/                     # useAuth, useAsync, useDebounce, useJobPolling
│   ├── mocks/                     # staticData.js, areas.json, mockStore.js (localStorage)
│   ├── pages/                     # Dashboard, ChangeDetection, Alerts, Inspections, Timeline, Login
│   ├── services/                  # api.js, authService, alertService, inspectionService,
│   │                              # zoneService, areaService, timelineService, changeService
│   └── utils/                     # geo.js (turf-like ray casting & area calc), format.js
```

- **Frontend Framework**: React 18 + Vite 5 + JSX
- **Styling**: Tailwind CSS with custom geospatial palette (Base `#0F1214`, Surface `#171B1F`, Border `#232A30`, Cyan `#22D3EE`, Status semantics)
- **Mapping**: Leaflet 1.9 + React-Leaflet 4 + Leaflet-Draw + Leaflet.markercluster with custom Esri World Imagery & Dark Carto basemaps
- **Charts & Data Viz**: Recharts 2.12 (Stacked Area, Donut, Line Progression)
- **Icons**: Lucide React
- **Persistence**: Hybrid in-memory + browser `localStorage` layer (`lw_store_v1`) with full offline demo capability

---

## 🌐 Real Backend Integration & API Specification

LandWatch was architected with a **dual-driver service pattern**. Out of the box, `VITE_USE_MOCKS=true` runs zero-dependency realistic mock services with realistic network latency (150–400ms).

To switch to a live production backend, set `.env`:
```env
VITE_USE_MOCKS=false
VITE_API_BASE_URL=https://api.landwatch.gov.in/v1
```

### Production REST API Contract

#### 1. Authentication & Users
- `POST /auth/login` — `{ email, password }` ➔ `{ token, user: { id, name, email, role, avatar } }`
- `GET /auth/me` — Authenticated session check ➔ `User`
- `GET /users/inspectors` — List active field officers for assignment ➔ `User[]`

#### 2. Monitored Areas
- `GET /areas` — List monitored administrative boundaries ➔ `Area[]`
- `GET /areas/:id` — Details, imagery dates, and GeoJSON bounds ➔ `Area`

#### 3. Change Detection Engine
- `POST /changes/compare` — Trigger pipeline `{ areaId, beforeDate, afterDate, customPolygon?, categories?, minConfidence? }` ➔ `{ jobId }`
- `GET /changes/jobs/:jobId` — Polling status ➔ `{ status: 'pending'|'processing'|'done'|'failed', progress: 0-100, step: string }`
- `GET /changes/:resultId` — Fetch detected GeoJSON features ➔ `{ id, detections: FeatureCollection }`

#### 4. Alerts
- `GET /alerts` — Filtered alerts `?type=&severity=&status=&protectedOnly=&search=&page=&limit=` ➔ `{ items: Alert[], total: number }`
- `PATCH /alerts/:id/status` — `{ status: 'new'|'under_inspection'|'resolved'|'false_alarm' }`
- `POST /alerts/bulk-status` — `{ alertIds: string[], status }`

#### 5. Protected Zones
- `GET /zones` — GeoJSON FeatureCollection of restricted ecological zones
- `POST /zones` — *(Admin only)* Create new protected zone `{ type: 'Feature', geometry, properties }`
- `PUT /zones/:id` — *(Admin only)* Update zone boundary or metadata
- `DELETE /zones/:id` — *(Admin only)* Remove zone and trigger alert recalculation

#### 6. Field Inspections
- `GET /inspections` — List inspections (strictly scoped to user ID if role is `inspector`)
- `POST /inspections` — Create assignment `{ detectionId, assigneeId, priority, dueDate, notes }`
- `POST /inspections/bulk` — Create multiple assignments in one batch
- `GET /inspections/:id` — Get inspection details, before/after thumbnails, and audit trail
- `PATCH /inspections/:id` — Update status, assignee, or remarks
- `POST /inspections/:id/photos` — Multipart form upload for field ground evidence
- `POST /inspections/:id/finalize` — Submit final determination (`confirmed` or `false_alarm`)

#### 7. Historical Timeline
- `GET /timeline/:areaId` — Time-series metadata, change metrics per date, and cumulative encroachment area

---

## 🛰 Using Real Sentinel-2 Satellite Imagery

To display genuine Sentinel-2 or high-resolution drone imagery:
1. Obtain georeferenced satellite exports (e.g., from Copernicus Open Access Hub or USGS EarthExplorer) in JPG/PNG format.
2. Save tiles following the naming convention:
   ```
   public/tiles/<areaId>/<YYYY-MM-DD>.jpg
   ```
   *(Example: `public/tiles/area-bhopal-lake/2024-01-15.jpg`)*
3. Add the corresponding dates to the area's `imageryDates` array in `src/mocks/areas.json` or configure your GIS tile server.
4. The before/after swipe slider and timeline player will automatically bind to the new imagery.

---

## 🛡 License
Government Open Use License. Developed for hackathon demonstration.
