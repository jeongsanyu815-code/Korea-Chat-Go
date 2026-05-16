const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(express.json());

if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

if (!fs.existsSync('messages.json')) {
  fs.writeFileSync('messages.json', JSON.stringify({}));
}

if (!fs.existsSync('rooms.json')) {
  fs.writeFileSync('rooms.json', JSON.stringify([]));
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

function loadRooms() {
  return JSON.parse(fs.readFileSync('rooms.json'));
}

function saveRooms(rooms) {
  fs.writeFileSync('rooms.json', JSON.stringify(rooms, null, 2));
}

function loadMessages() {
  return JSON.parse(fs.readFileSync('messages.json'));
}

function saveMessages(messages) {
  fs.writeFileSync('messages.json', JSON.stringify(messages, null, 2));
}

app.get('/rooms', (req, res) => {
  res.json(loadRooms());
});

app.post('/create-room', express.json(), (req, res) => {
  const rooms = loadRooms();

  const room = {
    id: Date.now(),
    name: req.body.name,
    owner: req.body.owner,
    password: req.body.password || ''
  };

  rooms.push(room);
  saveRooms(rooms);

  res.json(room);
});

app.post('/upload', upload.single('file'), (req, res) => {
  res.json({
    url: '/uploads/' + req.file.filename,
    type: req.file.mimetype
  });
});

const roomUsers = {};

io.on('connection', (socket) => {

  socket.on('joinRoom', ({ roomId, nickname }) => {

    socket.join(roomId);

    socket.roomId = roomId;
    socket.nickname = nickname;

    if (!roomUsers[roomId]) {
      roomUsers[roomId] = [];
    }

    roomUsers[roomId].push(nickname);

    const messages = loadMessages();

    io.to(roomId).emit('systemMessage', {
      text: `${nickname}님이 입장했습니다.`
    });

    io.to(roomId).emit('userList', roomUsers[roomId]);

    socket.emit('loadMessages', messages[roomId] || []);
  });

  socket.on('chatMessage', (data) => {

    const messages = loadMessages();

    if (!messages[data.roomId]) {
      messages[data.roomId] = [];
    }

    messages[data.roomId].push(data);

    saveMessages(messages);

    io.to(data.roomId).emit('chatMessage', data);
  });

  socket.on('disconnect', () => {

    const roomId = socket.roomId;

    if (!roomId || !roomUsers[roomId]) return;

    roomUsers[roomId] = roomUsers[roomId].filter(
      u => u !== socket.nickname
    );

    io.to(roomId).emit('systemMessage', {
      text: `${socket.nickname}님이 퇴장했습니다.`
    });

    io.to(roomId).emit('userList', roomUsers[roomId]);
  });
});

server.listen(PORT, () => {
  console.log('Korea Chat Go Server running');
});
