const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const rooms = new Map();

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  } while (rooms.has(code));
  return code;
}

function send(ws, obj) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type':'application/json'});
  res.end(JSON.stringify({service:'PES 2009 online relay', rooms: rooms.size}));
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  let roomCode = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch (_) { return; }

    if (msg.op === 'create') {
      if (roomCode) return;
      roomCode = makeCode();
      rooms.set(roomCode, {host: ws, client: null});
      send(ws, {type:'room_created', room:roomCode});
      return;
    }

    if (msg.op === 'join') {
      if (roomCode) return;
      const code = String(msg.room || '').trim().toUpperCase();
      const room = rooms.get(code);
      if (!room || room.client) {
        send(ws, {type:'error', message:'ROOM_NOT_AVAILABLE'});
        return;
      }
      room.client = ws;
      roomCode = code;
      send(ws, {type:'room_joined', room:code});
      send(room.host, {type:'peer_joined'});
      return;
    }

    if (msg.op === 'relay' && roomCode) {
      const room = rooms.get(roomCode);
      if (!room) return;
      const other = room.host === ws ? room.client : room.host;
      if (other) send(other, {type:'relay', data:msg.data || {}});
    }
  });

  ws.on('close', () => {
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    if (!room) return;
    const other = room.host === ws ? room.client : room.host;
    if (other) send(other, {type:'peer_left'});
    rooms.delete(roomCode);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`PES 2009 relay listening on ${PORT}`);
});
