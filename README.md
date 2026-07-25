# Collabo-Draw

Collabo-Draw is a Real-Time Collaborative Whiteboard application designed for remote teams, educators, and creative professionals. It allows multiple users to draw, brainstorm, and communicate on a shared infinite canvas in real-time.

## Features

- **Real-Time Collaboration**: Instant sync of drawings, shapes, and cursors using Socket.IO.
- **Object-Based Drawing**: Built with `react-konva`, supporting freehand paths, rectangles, ellipses, and straight lines.
- **Advanced Manipulation**: Select, move, resize, rotate, and delete individual shapes.
- **Sticky Notes & Text**: Easily add typed notes and pastel-colored sticky notes to the canvas.
- **Live Presence & Chat**: See exactly who is on the board with avatar stacks and communicate via the built-in real-time chat panel.
- **Undo / Redo History**: Full local history tracking for rapid mistake correction.
- **Image Export**: Download your entire whiteboard as a high-resolution PNG.
- **Board Persistence**: Drawings are saved seamlessly so you can close your browser and return to your work later.

## Architecture

This project is a monorepo containing two main parts:

1. **Frontend (`/frontend`)**: A React application built with Vite, styled with Tailwind CSS, and utilizing `react-konva` for the canvas rendering.
2. **Backend (`/backend`)**: A Node.js and Express server that handles WebSocket connections via `Socket.IO` and persists board data to the local file system.

## Getting Started

To run this project locally, you will need to start both the backend and frontend servers.

### 1. Start the Backend
```bash
cd backend
npm install
node server.js
```
The backend server will run on `http://localhost:3001`.

### 2. Start the Frontend
In a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
The frontend application will be available at `http://localhost:5173`.

## Usage
- Open the frontend URL in your browser.
- Click **Create New Board** to generate a unique collaborative workspace.
- Click the **Share** button in the header to copy the link and send it to your team.
- Open the link in a second window or device to see the real-time syncing in action!

## License
MIT
