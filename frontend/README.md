# Collabo-Draw Frontend

This is the frontend application for Collabo-Draw, built with React and Vite.

## Tech Stack
- **React 18**
- **Vite** for fast bundling and HMR
- **Tailwind CSS v4** for styling and design tokens
- **React-Konva** for object-based HTML5 Canvas rendering and shape manipulation
- **Socket.IO-Client** for real-time WebSocket communication
- **Lucide-React** for beautiful, consistent iconography
- **React Router DOM** for navigation

## Directory Structure
- `/src/components/Dashboard.jsx`: The landing page where users can create or join boards.
- `/src/components/Whiteboard.jsx`: The main wrapper for a board room, handling the socket connection, active user presence, and the chat UI.
- `/src/components/Canvas.jsx`: The core drawing engine. It manages the `Konva` stage, tools (pen, shapes, text, sticky notes), selection transformations, undo/redo history, and remote cursor tracking.

## Development

Install dependencies:
```bash
npm install
```

Start the development server:
```bash
npm run dev
```

The application expects the backend WebSocket server to be running on `http://localhost:3001`. You can modify this in `src/components/Whiteboard.jsx` if needed.
