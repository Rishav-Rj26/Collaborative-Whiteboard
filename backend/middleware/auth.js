const { v4: uuidv4 } = require('uuid');

// Dummy authentication middleware
// In a real app, this would verify a JWT token or session.
// Here, we just assign a random guest ID and name if none is provided.
const dummyAuth = (req, res, next) => {
  req.user = {
    id: uuidv4(),
    name: `Guest_${Math.floor(Math.random() * 1000)}`
  };
  next();
};

const socketAuth = (socket, next) => {
  // In a real app, verify socket.handshake.auth.token
  socket.user = {
    id: uuidv4(),
    name: `Guest_${Math.floor(Math.random() * 1000)}`
  };
  next();
};

module.exports = {
  dummyAuth,
  socketAuth
};
