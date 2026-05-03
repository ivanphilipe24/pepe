const Net = (() => {
    let socket = null;
    let myRole = null;
    let opponentName = "";
    let opponentData = null;
    let roomCode = null;
    
    // Configuração para Render.com: Se estiver rodando pelo servidor, usa a mesma origem.
    // Se estiver abrindo o arquivo direto, usa o localhost:3000.
    const SERVER_URL = (window.location.protocol === 'file:') 
        ? "http://localhost:3000" 
        : window.location.origin; 

    function init() {
        _setupUI();

        // Se estiver no GitHub sem um servidor remoto definido, nem tenta conectar para evitar 404
        if (!SERVER_URL) return;

        try {
            socket = io(SERVER_URL, {
                reconnectionAttempts: 2,
                timeout: 5000
            });
        } catch (e) {
            return;
        }

        socket.on('connect', () => {
            console.log("Conectado ao servidor!");
        });

        socket.on('connect_error', () => {
            // Silencioso conforme pedido anteriormente
        });

        socket.on('roomCreated', (data) => {
            roomCode = data.code;
            document.getElementById('create-room-ui').style.display = 'none';
            document.getElementById('lobby-ui').style.display = 'block';
            document.getElementById('lobby-code').textContent = roomCode;
        });

        socket.on('roomList', (rooms) => {
            const listEl = document.getElementById('room-list');
            listEl.innerHTML = "";
            if (rooms.length === 0) {
                listEl.innerHTML = '<div style="color: #444; padding: 20px;">Nenhuma sala encontrada.</div>';
            } else {
                rooms.forEach(room => {
                    const div = document.createElement('div');
                    div.className = 'room-item';
                    div.style = "padding: 10px; border-bottom: 1px solid #222; cursor: pointer; text-align: left;";
                    div.innerHTML = `<strong>SALA: ${room.id}</strong> <br> <span style="font-size:0.8rem; color:#888;">Dono: ${room.owner}</span>`;
                    div.onclick = () => _selectRoom(room.id);
                    listEl.appendChild(div);
                });
            }
        });

        socket.on('gameStart', (data) => {
            myRole = data.role;
            opponentName = data.opponentName;
            
            if(data.opponentKillerSkin) window.opponentKillerSkin = data.opponentKillerSkin;
            if(data.opponentInnocentSkin) window.opponentInnocentSkin = data.opponentInnocentSkin;
            if(data.killerClass) window.activeKillerClass = data.killerClass;

            console.log("Jogo Iniciado! Role:", myRole, "Oponente:", opponentName);
            
            document.getElementById('lobby-ui').style.display = 'none';
            document.getElementById('join-room-ui').style.display = 'none';
            Game.startMultiplayer(myRole);
        });

        socket.on('updatePlayer', (data) => {
            opponentData = data;
        });

        socket.on('dotCollected', (data) => {
            GameMap.removeDot(data.r, data.c);
        });

        socket.on('growlEffect', () => {
            Game.triggerGrowlEffect();
        });

        socket.on('dashEffect', (data) => {
            Game.triggerDashEffect(data);
        });

        socket.on('applyPowerColors', () => {
            Game.setPowerMode(true);
        });

        socket.on('resetColors', () => {
            Game.setPowerMode(false);
        });

        socket.on('killerEaten', (data) => {
            Game.handleKillerEaten(data.r, data.c);
        });

        socket.on('gameOver', (data) => {
            Game.networkGameOver(data.winner);
        });

        socket.on('opponentDisconnected', () => {
            Game.networkDisconnect();
        });

        socket.on('errorMsg', (msg) => {
            alert(msg);
        });
    }

    function _setupUI() {
        const mpMenuBtn = document.getElementById('mp-menu-btn');
        const mpSubmenu = document.getElementById('mp-submenu');
        const createBtn = document.getElementById('mp-create-nav-btn');
        const joinBtn = document.getElementById('mp-join-nav-btn');
        const backBtn = document.getElementById('mp-back-btn');
        const cancelBtns = document.querySelectorAll('.mp-cancel-btn');

        mpMenuBtn.addEventListener('click', () => {
            document.getElementById('play-btn').style.display = 'none';
            mpMenuBtn.style.display = 'none';
            mpSubmenu.style.display = 'flex';
        });

        backBtn.addEventListener('click', () => {
            mpSubmenu.style.display = 'none';
            document.getElementById('play-btn').style.display = 'block';
            mpMenuBtn.style.display = 'block';
        });

        createBtn.addEventListener('click', () => {
            mpSubmenu.style.display = 'none';
            document.getElementById('create-room-ui').style.display = 'flex';
        });

        joinBtn.addEventListener('click', () => {
            if(!socket || !socket.connected) {
                alert("Erro: Sem conexão com o servidor. Certifique-se de que o servidor está rodando.");
                return;
            }
            mpSubmenu.style.display = 'none';
            document.getElementById('join-room-ui').style.display = 'flex';
            socket.emit('requestRooms');
        });

        cancelBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('create-room-ui').style.display = 'none';
                document.getElementById('join-room-ui').style.display = 'none';
                document.getElementById('lobby-ui').style.display = 'none';
                mpSubmenu.style.display = 'flex';
            });
        });

        document.getElementById('confirm-create-btn').addEventListener('click', () => {
            const name = document.getElementById('create-name').value;
            const pass = document.getElementById('create-pass').value;
            const kClass = document.getElementById('create-killer-class').value;
            
            if(socket && socket.connected) {
                socket.emit('createRoom', { 
                    playerName: name, 
                    password: pass, 
                    killerClass: kClass,
                    killerSkin: window.activeKillerSkin,
                    innocentSkin: window.activeInnocentSkin
                });
            } else {
                alert("Erro: Sem conexão com o servidor. Certifique-se de que o servidor está rodando.");
            }
        });

        document.getElementById('confirm-join-btn').addEventListener('click', () => {
            const code = roomCode;
            const name = document.getElementById('join-name').value;
            const pass = document.getElementById('join-pass').value;
            const kClass = document.getElementById('join-killer-class').value;

            if(socket && socket.connected) {
                socket.emit('joinRoom', { 
                    code, 
                    playerName: name, 
                    password: pass,
                    killerClass: kClass,
                    killerSkin: window.activeKillerSkin,
                    innocentSkin: window.activeInnocentSkin
                });
            } else {
                alert("Erro: Sem conexão com o servidor!");
            }
        });
    }

    function _selectRoom(code) {
        roomCode = code;
        document.getElementById('join-room-auth').style.display = 'flex';
    }

    // API Pública
    return {
        init,
        syncState: (data) => socket && socket.emit('syncPlayer', data),
        emitDotCollected: (r, c) => socket && socket.emit('collectDot', { r, c }),
        emitAllDotsCollected: () => socket && socket.emit('allDotsCollected'),
        emitGrowl: () => socket && socket.emit('killerGrowl'),
        emitDash: (data) => socket && socket.emit('dashUsed', data),
        emitPowerActivated: () => socket && socket.emit('powerActivated'),
        emitKillerEaten: (data) => socket && socket.emit('killerEaten', data),
        emitIAmCaught: () => socket && socket.emit('playerCaught'),
        getOpponentData: () => opponentData
    };
})();
