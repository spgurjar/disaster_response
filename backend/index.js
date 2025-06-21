const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const disastersRouter = require('./src/routes/disasters');
const socialRouter = require('./src/routes/social');
const resourcesRouter = require('./src/routes/resources');
const updatesRouter = require('./src/routes/updates');
const verifyRouter = require('./src/routes/verify');
const geocodeRouter = require('./src/routes/geocode');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/test', (req, res) => {
  res.send('Disaster Response Coordination Platform API');
});

// All API routes
app.use('/disasters', disastersRouter);
app.use('/disasters', socialRouter);
app.use('/disasters', resourcesRouter);
app.use('/disasters', updatesRouter);
app.use('/disasters', verifyRouter);
app.use('/', geocodeRouter);

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
  
  // Join disaster room for real-time updates
  socket.on('join_disaster', (disasterId) => {
    socket.join(`disaster_${disasterId}`);
    console.log(`Client ${socket.id} joined disaster room: ${disasterId}`);
  });
  
  // Leave disaster room
  socket.on('leave_disaster', (disasterId) => {
    socket.leave(`disaster_${disasterId}`);
    console.log(`Client ${socket.id} left disaster room: ${disasterId}`);
  });
});

// Make io available to routes
app.set('io', io);

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Server running on ==> http://localhost:${PORT}`);
  console.log(`WebSocket server initialized`);
});

module.exports = { app, server, io };
