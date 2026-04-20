const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            // Permite origens nulas (ficheiros locais) ou qualquer outra
            callback(null, true);
        },
        methods: ["GET", "POST"],
        credentials: true
    }
});

app.use(express.static(__dirname));

const rooms = {};

io.on('connection', (socket) => {
    
    // Lista de salas para o menu de entrar
    socket.on('requestRooms', () => {
        const availableRooms = Object.keys(rooms)
            .filter(code => rooms[code].gameState === 'LOBBY' && rooms[code].players.length === 1)
            .map(code => ({
                id: code,
                owner: rooms[code].players[0].name
            }));
        socket.emit('roomList', availableRooms);
    });

    socket.on('createRoom', (data) => {
        const { playerName, password } = data;
        if (!playerName) return socket.emit('errorMsg', 'Nome é obrigatório.');

        const code = Math.floor(1000 + Math.random() * 9000).toString();
        rooms[code] = {
            players: [{ id: socket.id, name: playerName, role: null }],
            password: password || '', // Opcional
            gameState: 'LOBBY',
            isPowerActive: false
        };
        
        socket.join(code);
        console.log(`Jogador [${playerName}] criou a sala [${code}] com senha [${password || 'NENHUMA'}]`);
        socket.emit('roomCreated', { code, playerName });
    });

    socket.on('joinRoom', (data) => {
        const { code, playerName, password } = data;
        const room = rooms[code];

        if (!room) {
            return socket.emit('errorMsg', 'Sala não encontrada.');
        }

        if (room.gameState !== 'LOBBY' || room.players.length >= 2) {
            return socket.emit('errorMsg', 'Sala cheia ou em jogo.');
        }

        // Verificar senha
        if (room.password && room.password !== password) {
            return socket.emit('errorMsg', 'Senha incorreta.');
        }

        room.players.push({ id: socket.id, name: playerName || 'JOGADOR 2', role: null });
        socket.join(code);

        // Início do jogo
        const isFirstKiller = Math.random() > 0.5;
        room.players[0].role = isFirstKiller ? 'KILLER' : 'INNOCENT';
        room.players[1].role = isFirstKiller ? 'INNOCENT' : 'KILLER';
        room.gameState = 'PLAYING';

        console.log(`Jogador [${playerName}] entrou na sala [${code}]. Iniciando jogo...`);

        io.to(room.players[0].id).emit('gameStart', {
            role: room.players[0].role,
            opponentName: room.players[1].name,
            level: 0
        });
        io.to(room.players[1].id).emit('gameStart', {
            role: room.players[1].role,
            opponentName: room.players[0].name,
            level: 0
        });
    });

    // Sincronização de estado
    socket.on('syncPlayer', (data) => {
        const roomCode = Array.from(socket.rooms).find(r => r !== socket.id);
        if(roomCode){
            socket.to(roomCode).emit('updatePlayer', data);
        }
    });

    socket.on('collectDot', (data) => {
        const roomCode = Array.from(socket.rooms).find(r => r !== socket.id);
        if(roomCode){
            socket.to(roomCode).emit('dotCollected', data);
        }
    });

    socket.on('killerGrowl', () => {
        const roomCode = Array.from(socket.rooms).find(r => r !== socket.id);
        if(roomCode){
            socket.to(roomCode).emit('growlEffect');
        }
    });

    // ── INVERSÃO DE PAPÉIS (BOLA GRANDE) ──
    socket.on('powerActivated', () => {
        const roomCode = Array.from(socket.rooms).find(r => r !== socket.id);
        if(roomCode) {
            io.to(roomCode).emit('applyPowerColors');
            const room = rooms[roomCode];
            if(room) {
               room.isPowerActive = true;
               if(room.powerTimer) clearTimeout(room.powerTimer);
               room.powerTimer = setTimeout(() => {
                   io.to(roomCode).emit('resetColors');
                   room.powerTimer = null;
                   room.isPowerActive = false;
               }, 10000);
            }
        }
    });

    socket.on('killerEaten', (data) => {
        const roomCode = Array.from(socket.rooms).find(r => r !== socket.id);
        if(roomCode) {
            io.to(roomCode).emit('killerEaten', data); // Repassa coordenadas {r, c}
        }
    });

    socket.on('playerCaught', () => {
        const roomCode = Array.from(socket.rooms).find(r => r !== socket.id);
        if(roomCode && rooms[roomCode]) {
            const room = rooms[roomCode];
            // Bloqueio categórico: se o poder estiver ativo, nada morre.
            if (room.isPowerActive || room.powerTimer) return; 
            
            io.to(roomCode).emit('gameOver', { winner: 'KILLER' });
            room.gameState = 'LOBBY';
        }
    });

    socket.on('allDotsCollected', () => {
        const roomCode = Array.from(socket.rooms).find(r => r !== socket.id);
        if(roomCode){
            io.to(roomCode).emit('gameOver', { winner: 'INNOCENT' });
            if(rooms[roomCode]) rooms[roomCode].gameState = 'LOBBY';
        }
    });

    socket.on('disconnecting', () => {
        for (const roomCode of socket.rooms) {
            if (roomCode !== socket.id && rooms[roomCode]) {
                socket.to(roomCode).emit('opponentDisconnected');
                delete rooms[roomCode];
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server a correr na porta ${PORT}`);
});
