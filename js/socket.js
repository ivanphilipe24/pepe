const Net = (() => {
    let socket = null;
    let myRole = null;
    let opponentName = "";
    let opponentData = null;
    let roomCode = null;
    
    // URL do servidor (Dinâmica para funcionar local e remoto)
    const SERVER_URL = window.location.origin; 

    function init() {
        // Silencioso
        // console.log("Tentando conectar ao servidor:", SERVER_URL);
        
        try {
            socket = io(SERVER_URL, {
                reconnectionAttempts: 5,
                timeout: 10000
            });
        } catch (e) {
            // console.error("Erro ao carregar Socket.io:", e);
            // _showError("Erro técnico: Biblioteca Socket.io não encontrada.");
            return;
        }

        _setupUI();

        socket.on('connect', () => {
            console.log("Conectado ao servidor!");
            document.getElementById('mp-error').style.display = 'none';
        });

        socket.on('connect_error', () => {
            // Silencioso se estiver offline
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
            
            // Aplicar skins do oponente se enviadas
            if(data.opponentKillerSkin) window.opponentKillerSkin = data.opponentKillerSkin;
            if(data.opponentInnocentSkin) window.opponentInnocentSkin = data.opponentInnocentSkin;
            
            // Aplicar classe do assassino
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

        socket.on('rewardCoins', (data) => {
            // Lógica de recompensa se necessário (pode ser feita no main.js via Game.networkGameOver)
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
            
            socket.emit('createRoom', { 
                playerName: name, 
                password: pass, 
                killerClass: kClass,
                killerSkin: window.activeKillerSkin,
                innocentSkin: window.activeInnocentSkin
            });
        });

        document.getElementById('confirm-join-btn').addEventListener('click', () => {
            const code = roomCode; // Definido ao selecionar na lista
            const name = document.getElementById('join-name').value;
            const pass = document.getElementById('join-pass').value;
            const kClass = document.getElementById('join-killer-class').value;

            socket.emit('joinRoom', { 
                code, 
                playerName: name, 
                password: pass,
                killerClass: kClass,
                killerSkin: window.activeKillerSkin,
                innocentSkin: window.activeInnocentSkin
            });
        });
    }

    function _selectRoom(code) {
        roomCode = code;
        document.getElementById('join-room-auth').style.display = 'flex';
    }

    function _showError(msg) {
        // Desativado a pedido do usuário
        // const errEl = document.getElementById('mp-error');
        // errEl.textContent = msg;
        // errEl.style.display = 'block';
    }

    // API Pública
    return {
        init,
        syncState: (data) => socket.emit('syncPlayer', data),
        emitDotCollected: (r, c) => socket.emit('collectDot', { r, c }),
        emitAllDotsCollected: () => socket.emit('allDotsCollected'),
        emitGrowl: () => socket.emit('killerGrowl'),
        emitDash: (data) => socket.emit('dashUsed', data),
        emitPowerActivated: () => socket.emit('powerActivated'),
        emitKillerEaten: (data) => socket.emit('killerEaten', data),
        emitIAmCaught: () => socket.emit('playerCaught'),
        getOpponentData: () => opponentData
    };
})();
