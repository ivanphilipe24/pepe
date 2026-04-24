const Net = (() => {
    let socket = null;
    let roomCode = null;
    let myRole = null;
    let myName = null;
    let opponentData = null;
    let selectedRoomId = null;
    window.isPowerModeActive = false; // Estado Global da Pílula de Poder

    function init() {
        if (typeof io !== 'undefined') {
            // Usa o host atual se disponível (importante para mobile na mesma rede)
            // Se abrir como arquivo local, tenta localhost:3000 como fallback
            const serverUrl = window.location.hostname !== '' ? window.location.origin : "http://localhost:3000";
            
            socket = io(serverUrl, {
                transports: ['websocket'],
                upgrade: false
            });
            _setupEvents();
            _setupUI();
        } else {
            console.error('Socket.io não carregado.');
        }
    }

    function _setupUI() {
        // Nav Buttons
        const mpMenuBtn       = document.getElementById('mp-menu-btn');
        const mpCreateNavBtn  = document.getElementById('mp-create-nav-btn');
        const mpJoinNavBtn    = document.getElementById('mp-join-nav-btn');
        const mpBackBtn       = document.getElementById('mp-back-btn');
        
        // Sections
        const mainMenuContent = document.querySelector('.menu-content > #play-btn').parentElement;
        const mpSubmenu       = document.getElementById('mp-submenu');
        const createRoomUI    = document.getElementById('create-room-ui');
        const joinRoomUI      = document.getElementById('join-room-ui');
        const lobbyUI         = document.getElementById('lobby-ui');
        const joinAuthUI      = document.getElementById('join-room-auth');
        
        // Actions
        const confirmCreateBtn = document.getElementById('confirm-create-btn');
        const confirmJoinBtn   = document.getElementById('confirm-join-btn');
        const cancelBtns       = document.querySelectorAll('.mp-cancel-btn');
        const mpError          = document.getElementById('mp-error');

        function hideAllSections() {
            [mpSubmenu, createRoomUI, joinRoomUI, lobbyUI].forEach(s => s.style.display = 'none');
            // Show/Hide main play buttons
            const playBtn = document.getElementById('play-btn');
            const mpBtn = document.getElementById('mp-menu-btn');
            playBtn.style.display = 'none';
            mpBtn.style.display = 'none';
            mpError.textContent = '';
        }

        function resetToMain() {
            hideAllSections();
            document.getElementById('play-btn').style.display = 'inline-block';
            document.getElementById('mp-menu-btn').style.display = 'inline-block';
            mpSubmenu.style.display = 'none';
        }

        // Navigation
        mpMenuBtn.addEventListener('click', () => {
            document.getElementById('play-btn').style.display = 'none';
            mpMenuBtn.style.display = 'none';
            mpSubmenu.style.display = 'flex';
        });

        mpBackBtn.addEventListener('click', resetToMain);

        mpCreateNavBtn.addEventListener('click', () => {
            hideAllSections();
            createRoomUI.style.display = 'flex';
        });

        mpJoinNavBtn.addEventListener('click', () => {
            hideAllSections();
            joinRoomUI.style.display = 'flex';
            joinAuthUI.style.display = 'none';
            socket.emit('requestRooms');
        });

        cancelBtns.forEach(btn => btn.addEventListener('click', () => {
            hideAllSections();
            mpSubmenu.style.display = 'flex';
        }));

        // Logical Actions
        confirmCreateBtn.addEventListener('click', () => {
            const name = document.getElementById('create-name').value.trim();
            const pass = document.getElementById('create-pass').value.trim();

            if (!name) return alert("Digite seu nome!");
            
            myName = name.toUpperCase();
            socket.emit('createRoom', { playerName: myName, password: pass });
        });

        confirmJoinBtn.addEventListener('click', () => {
            const name = document.getElementById('join-name').value.trim();
            const pass = document.getElementById('join-pass').value.trim();

            if (!name) return alert("Digite seu nome!");
            if (!selectedRoomId) return alert("Selecione uma sala primeiro!");

            myName = name.toUpperCase();
            socket.emit('joinRoom', { code: selectedRoomId, playerName: myName, password: pass });
        });
    }

    function _setupEvents() {
        socket.on('roomList', (rooms) => {
            const listContainer = document.getElementById('room-list');
            listContainer.innerHTML = '';

            if (rooms.length === 0) {
                listContainer.innerHTML = '<div style="color: #444; padding: 20px;">Nenhuma sala disponível...</div>';
                return;
            }

            rooms.forEach(room => {
                const item = document.createElement('div');
                item.className = 'room-item';
                item.innerHTML = `
                    <span class="room-name">SALA DE ${room.owner.toUpperCase()}</span>
                    <span class="room-status">ESPERANDO</span>
                `;
                item.onclick = () => {
                    selectedRoomId = room.id;
                    document.getElementById('join-room-auth').style.display = 'flex';
                    // Scroll to auth
                    document.getElementById('join-room-auth').scrollIntoView({ behavior: 'smooth' });
                };
                listContainer.appendChild(item);
            });
        });

        socket.on('roomCreated', (data) => {
            roomCode = data.code;
            document.getElementById('create-room-ui').style.display = 'none';
            document.getElementById('lobby-ui').style.display = 'block';
            document.getElementById('lobby-owner-name').textContent = data.playerName;
        });

        socket.on('gameStart', (data) => {
            myRole = data.role;
            document.getElementById('menu').style.display = 'none';
            Game.startMultiplayer(myRole);
        });

        socket.on('errorMsg', (msg) => {
            alert(msg);
            const mpError = document.getElementById('mp-error');
            if (mpError) mpError.textContent = msg;
        });

        socket.on('updatePlayer', (data) => { opponentData = data; });
        // Sincroniza coleta de pontos no mapa do adversário
        socket.on('dotCollected', (data) => {
            if (typeof GameMap !== 'undefined') GameMap.forceCollectDot(data.row, data.col);
        });
        socket.on('growlEffect', () => { if (typeof Game !== 'undefined') Game.triggerGrowlEffect(); });
        socket.on('applyPowerColors', () => { 
            if (typeof Game !== 'undefined') Game.setPowerMode(true);
        });
        socket.on('resetColors', () => { 
            if (typeof Game !== 'undefined') Game.setPowerMode(false);
        });
        socket.on('killerEaten', (data) => {
            if (typeof Game !== 'undefined') Game.handleKillerEaten(data.r, data.c);
        });
        socket.on('gameOver', (data) => { if (typeof Game !== 'undefined') Game.networkGameOver(data.winner); });
        socket.on('opponentDisconnected', () => { if (typeof Game !== 'undefined') Game.networkDisconnect(); });
    }

    return {
        init,
        syncState: (data) => { if (socket && myRole) socket.emit('syncPlayer', data); },
        emitDotCollected: (row, col) => { if (socket && myRole === 'INNOCENT') socket.emit('collectDot', { row, col }); },
        emitGrowl: () => { if (socket && myRole === 'KILLER') socket.emit('killerGrowl'); },
        emitCaught: () => { if (socket && myRole === 'KILLER') socket.emit('playerCaught'); },
        emitIAmCaught: () => { if (socket && myRole === 'INNOCENT') socket.emit('playerCaught'); },
        emitKillerEaten: (data) => { if (socket && myRole) socket.emit('killerEaten', data); },
        emitPowerActivated: () => { if (socket && myRole === 'INNOCENT') socket.emit('powerActivated'); },
        emitAllDotsCollected: () => { if (socket && myRole === 'INNOCENT') socket.emit('allDotsCollected'); },
        getRole: () => myRole,
        getMyName: () => myName,
        getOpponentData: () => opponentData,
    };
})();
