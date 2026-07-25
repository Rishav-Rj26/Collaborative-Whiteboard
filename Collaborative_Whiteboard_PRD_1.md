# Product Requirements Document (PRD)
## Real-Time Collaborative Whiteboard

**Version:** 1.0
**Date:** July 21, 2026
**Status:** Draft

---

## 1. Overview

### 1.1 Problem Statement
Remote teams need a way to brainstorm, sketch, and plan together the same way they would around a physical whiteboard. Existing collaboration relies on scattered tools (docs, chat, static images) that don't support live, synchronized visual creation. This product delivers a web-based whiteboard where multiple users can draw, edit, and communicate on a shared canvas in real time.

### 1.2 Product Vision
A fast, intuitive, browser-based collaborative whiteboard that feels as natural as drawing with a group in the same room — with drawing actions, cursors, and presence synced instantly across all participants, and boards that persist and can be revisited anytime.

### 1.3 Target Users
- Remote/distributed engineering and design teams (system design, sprint planning)
- Students and educators (remote tutoring, group study)
- Workshop facilitators and consultants (brainstorming sessions)
- Small businesses running virtual meetings

---

## 2. Goals & Success Metrics

| Goal | Metric |
|---|---|
| Real-time sync feels instant | Drawing latency < 150ms between clients on a stable connection |
| Reliable persistence | 0% data loss on refresh/reconnect; board state restores fully |
| Easy onboarding | User can create a board and invite others in < 30 seconds |
| Smooth multi-user experience | Support 10+ concurrent editors per board without visible lag |
| Cross-device usability | Fully functional on desktop, tablet, and mobile breakpoints |

### Non-Goals (v1)
- Native mobile apps (mobile is web-responsive only, not a dedicated app)
- Offline-first editing with conflict resolution across long disconnects
- Enterprise SSO/SAML (basic auth only for v1)

---

## 3. Scope & Prioritization

Features are grouped by release priority, mirroring the challenge's leveling system.

### Level 1 — MVP (Mandatory)

**3.1 User Authentication**
- Email/password registration and login
- Session persistence (JWT or session cookie)
- Authenticated users can create boards and access boards shared with them

**3.2 Board Management**
- Create a new board (auto-generates a unique board ID)
- Join an existing board via ID or link
- Dashboard listing all boards the user owns or has joined
- Delete boards the user owns
- Each board has a unique, shareable identifier

**3.3 Real-Time Collaboration**
- Multiple users on the same board see each other's drawing actions live
- Actions (draw, erase, modify) propagate to all connected clients with minimal delay
- New participants joining mid-session see the current canvas state immediately

**3.4 Drawing Tools**
- Freehand pen
- Straight line
- Rectangle
- Circle/ellipse
- Eraser
- Tool selection is per-user (doesn't affect others' active tool)

**3.5 Color & Stroke Selection**
- Color picker (palette + custom hex)
- Stroke width slider/presets
- Each user's stroke style is visually attributed to their own drawing only

**3.6 Canvas Controls**
- Clear entire canvas (with confirmation)
- Undo last action
- Redo previously undone action
- Undo/redo scoped sensibly in a multi-user context (see Section 6.3)

### Level 2 — Intermediate (Post-MVP, high priority)

**3.7 Live Presence**
- Avatar/name list of currently active collaborators
- Live count of connected users

**3.8 Cursor Presence**
- Real-time cursor position broadcast, labeled with user name/color

**3.9 Board Persistence**
- Canvas state auto-saves continuously (debounced)
- Reopening a board restores the last saved state exactly

**3.10 Sharing**
- Shareable invite link (with optional expiry)
- Shareable board ID for manual entry

**3.11 Responsive Design**
- Optimized layouts for desktop, tablet, and mobile (touch-friendly drawing)

### Level 3 — Advanced (Stretch goals)

**3.12 Shape Manipulation** — select, move, resize, delete existing shapes
**3.13 Text Tool** — editable text boxes anywhere on canvas
**3.14 Image Support** — upload and place images on the board
**3.15 Export** — PNG, JPEG, PDF export of the current board
**3.16 Board History** — version timeline; restore earlier states
**3.17 Permissions** — Owner / Editor / Viewer roles enforced server-side

### Bonus Features (Time-permitting)
- Sticky notes
- Laser pointer (ephemeral, non-persisted pointer trail)
- Real-time chat panel
- Multiple pages/canvases per board
- Keyboard shortcuts (Ctrl+Z, Ctrl+Y, Delete, zoom, etc.)

---

## 4. User Flows

### 4.1 Create & Share a Board
1. User logs in → Dashboard
2. Clicks "New Board" → names it → board created with unique ID
3. Clicks "Share" → copies link or ID
4. Sends link to collaborators

### 4.2 Join a Board
1. Collaborator opens shared link (or enters board ID manually)
2. If not logged in, prompted to log in/register
3. Lands on the board canvas; sees existing content and active collaborators instantly

### 4.3 Collaborative Drawing Session
1. User selects a tool, color, and stroke width
2. Draws on canvas → action is sent to server → broadcast to all connected clients
3. Other users see the stroke render in real time
4. Canvas state is periodically persisted

---

## 5. Technical Architecture (Recommended)

### 5.1 Frontend
- **Framework:** React (or Vue) + Canvas API or a canvas library (e.g., Fabric.js / Konva.js) for shape handling
- **State sync:** WebSocket client (Socket.IO) or CRDT client library (e.g., Yjs) for conflict-free merging
- **Styling:** Responsive CSS framework/utility classes (e.g., Tailwind)

### 5.2 Backend
- **API server:** Node.js (Express/Fastify) or similar
- **Real-time layer:** WebSocket server (Socket.IO / native WS) broadcasting drawing events per board "room"
- **Auth:** JWT-based sessions, bcrypt-hashed passwords
- **Database:**
  - Relational (Postgres/MySQL) for users, boards, permissions, metadata
  - Document store or serialized canvas snapshots (e.g., stored as JSON in Postgres/Mongo, or Redis for hot state + periodic flush to persistent DB)
- **File storage:** S3-compatible bucket for uploaded images and exports

### 5.3 Data Model (simplified)
- **User:** id, name, email, password_hash, created_at
- **Board:** id, title, owner_id, created_at, updated_at
- **BoardMember:** board_id, user_id, role (owner/editor/viewer)
- **Stroke/Action:** id, board_id, user_id, type, points/coords, color, stroke_width, timestamp, order_index
- **BoardSnapshot:** board_id, canvas_state (JSON), version, saved_at

### 5.4 Real-Time Sync Approach
- Each board = a WebSocket "room"
- Drawing action → emitted to server → validated → broadcast to all room members → optionally persisted as an event (for undo/history)
- Cursor/presence events sent on a lighter, higher-frequency, non-persisted channel
- Use operation-based sync (each stroke as a discrete event) rather than full-canvas diffing, for efficiency and undo/redo support

---

## 6. Key Design Considerations

### 6.1 Concurrency
- Actions from different users should not block each other; last-write-wins is acceptable for overlapping strokes since strokes are additive, not overwriting.

### 6.2 Latency & Performance
- Debounce cursor-position broadcasts (e.g., 20–30 events/sec max)
- Batch/throttle freehand stroke points before emitting
- Target < 150ms round-trip for drawing events on a typical connection

### 6.3 Undo/Redo in Multi-User Context
- Recommended: **per-user undo stack** — each user can only undo/redo their own actions, avoiding confusing cross-user interference. This should be called out explicitly since it's a common ambiguity in the original spec.

### 6.4 Security
- Only board members (per permission role) can view/edit
- Validate all drawing/action payloads server-side (size limits, rate limits) to prevent abuse

### 6.5 Responsiveness
- Touch event support for tablet/mobile (pointer events API to unify mouse/touch/pen)

---

## 7. Evaluation Alignment

| Criterion | How This PRD Addresses It |
|---|---|
| Functionality | Full Level 1–3 feature breakdown with clear MVP scope |
| Real-Time Sync | Dedicated WebSocket architecture, latency targets, throttling strategy |
| User Experience | Defined user flows, responsive design requirement, presence/cursor features |
| Technical Implementation | Explicit architecture, data model, and sync approach |
| Performance | Concurrency and latency considerations, room-based scaling |
| Innovation | Bonus features (sticky notes, laser pointer, chat, multi-page) as differentiation opportunities |

---

## 8. Suggested Milestones

1. **Milestone 1:** Auth + board CRUD + basic canvas (local, no sync)
2. **Milestone 2:** Real-time sync of freehand + shape tools across users
3. **Milestone 3:** Persistence, presence, cursors, sharing
4. **Milestone 4:** Responsive polish + Level 3 features as time allows
5. **Milestone 5:** Bonus features + demo/export polish

---

## 9. Open Questions
- Should boards support anonymous/guest access via link, or strictly require login?
- What's the maximum acceptable board size/history length before performance degrades?
- Is offline drawing (queued and synced on reconnect) required for v1, or acceptable to skip?
