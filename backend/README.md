# Collabo-Draw Backend

This is the backend server for Collabo-Draw, responsible for managing real-time WebSocket connections and persisting board states.

## Tech Stack
- **Node.js**
- **Express** for basic API routing and health checks
- **Socket.IO** for low-latency, real-time bidirectional event communication

## Data Persistence
For the MVP, this backend uses a lightweight file-system based persistence strategy. 
- All active boards and their canvas elements are kept in-memory for immediate access and high performance.
- The state is debounced and periodically written to `data/boards.json`.
- When the server starts, it hydrates its memory from `data/boards.json` if it exists.

## Socket Events
The server manages rooms corresponding to unique `boardId`s.
- `join-board`: Subscribes a user to a board room and sends them the current `board-state`.
- `update-element`: Broadcasts additions or transformations of shapes.
- `delete-element`: Broadcasts the removal of a shape.
- `set-elements`: Overwrites the entire board state (used for Undo/Redo operations).
- `cursor-move`: Volatile broadcast of X/Y coordinates for real-time cursor presence.
- `chat-message`: Broadcasts text messages to the chat panel.

## Development

Install dependencies:
```bash
npm install
```

Start the server:
```bash
node server.js
```

The server runs on port `3001` by default. You can override this by setting a `PORT` environment variable.
