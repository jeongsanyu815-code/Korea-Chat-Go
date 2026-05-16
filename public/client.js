const socket = io();

let currentRoom = null;

const nicknameInput = document.getElementById('nickname');

nicknameInput.value = localStorage.getItem('nickname') || '';

function saveNickname() {
  localStorage.setItem('nickname', nicknameInput.value);
}

function changeNickname() {
  localStorage.removeItem('nickname');
  location.reload();
}

async function loadRooms() {

  const res = await fetch('/rooms');
  const rooms = await res.json();

  const ul = document.getElementById('roomList');

  ul.innerHTML = '';

  rooms.forEach(room => {

    const li = document.createElement('li');

    li.innerHTML = `
      ${room.name} by ${room.owner}
      <button onclick="joinRoom(${room.id})">입장</button>
    `;

    ul.appendChild(li);
  });
}

async function createRoom() {

  const name = document.getElementById('roomName').value;
  const password = document.getElementById('privateCheck').checked
    ? document.getElementById('roomPassword').value
    : '';

  const res = await fetch('/create-room', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name,
      owner: nicknameInput.value,
      password
    })
  });

  const room = await res.json();

  loadRooms();
  joinRoom(room.id);
}

function joinRoom(roomId) {

  currentRoom = roomId;

  localStorage.setItem('lastRoom', roomId);

  document.getElementById('currentRoom').innerText = `방: ${roomId}`;

  socket.emit('joinRoom', {
    roomId,
    nickname: nicknameInput.value
  });
}

function appendMessage(text) {

  const div = document.createElement('div');
  div.innerHTML = text;

  document.getElementById('chat').appendChild(div);
}

function sendMessage() {

  const input = document.getElementById('message');

  if (!input.value.trim()) return;

  socket.emit('chatMessage', {
    roomId: currentRoom,
    nickname: nicknameInput.value,
    message: input.value
  });

  input.value = '';
}

document.getElementById('message').addEventListener('keydown', (e) => {

  if (e.key === 'Enter') {
    sendMessage();
  }
});

socket.on('chatMessage', (data) => {

  appendMessage(`
    <b>${data.nickname}</b>: ${data.message}
  `);
});

socket.on('systemMessage', (data) => {

  appendMessage(`<i>${data.text}</i>`);
});

socket.on('userList', (users) => {

  document.getElementById('users').innerHTML = users.join('<br>');
});

socket.on('loadMessages', (messages) => {

  document.getElementById('chat').innerHTML = '';

  messages.forEach(msg => {

    if (msg.image) {
      appendMessage(`
        <b>${msg.nickname}</b><br>
        <img src="${msg.image}" class="preview">
      `);

    } else {

      appendMessage(`
        <b>${msg.nickname}</b>: ${msg.message}
      `);
    }
  });
});

async function uploadFile() {

  const file = document.getElementById('fileInput').files[0];

  const form = new FormData();
  form.append('file', file);

  const res = await fetch('/upload', {
    method: 'POST',
    body: form
  });

  const data = await res.json();

  socket.emit('chatMessage', {
    roomId: currentRoom,
    nickname: nicknameInput.value,
    image: data.url
  });
}

loadRooms();

const lastRoom = localStorage.getItem('lastRoom');

if (lastRoom) {
  setTimeout(() => {
    joinRoom(lastRoom);
  }, 500);
}
