const Net = (() => {
    let peer = null;
    let conn = null;
    let myId = null;
    let myRole = null;
    let myName = null;
    let opponentData = null;
    let isHost = false;
    window.isPowerModeActive = false;

    function init() {
        if (typeof Peer !== 'undefined') {
            peer = new Peer();
            
            peer.on('open', (id) => {
                myId = id;
                console.log('Meu Peer ID:', id);
                _setupUI();
            });

            peer.on('connection', (incomingConn) => {
                if (conn) {
                    incomingConn.close();
                    return;
                }
                isHost = true;
                conn = incomingConn;
                _setupDataEvents();
            });

            peer.on('error', (err) => {
                console.error('PeerJS Error:', err);
                const mpError = document.getElementById('mp-error');
                if (mpError) {
                    mpError.style.display = 'block';
                    mpError.textContent = 'ERRO DE CONEXÃO: ' + err.type;
                }
            });
        } else {
            console.warn('PeerJS ainda não carregado. Tentando novamente em 1s...');
            setTimeout(init, 1000);
        }
    }

    function _setupUI() {
        const mpMenuBtn       = document.getElementById('mp-menu-btn');
        const mpCreateNavBtn  = document.getElementById('mp-create-nav-btn');
        const mpJoinNavBtn    = document.getElementById('mp-join-nav-btn');
        const mpBackBtn       = document.getElementById('mp-back-btn');
        
        const mainMenuContent = document.querySelector('.menu-content > #play-btn').parentElement;
        const mpSubmenu       = document.getElementById('mp-submenu');
        const createRoomUI    = document.getElementById('create-room-ui');
        const joinRoomUI      = document.getElementById('join-room-ui');
        const lobbyUI         = document.getElementById('lobby-ui');
        const joinAuthUI      = document.getElementById('join-room-auth');
        
        const confirmCreateBtn = document.getElementById('confirm-create-btn');
        const confirmJoinBtn   = document.getElementById('confirm-join-btn');
        const cancelBtns       = document.querySelectorAll('.mp-cancel-btn');
        const mpError          = document.getElementById('mp-error');

        function hideAllSections() {
            [mpSubmenu, createRoomUI, joinRoomUI, lobbyUI].forEach(s => s.style.display = 'none');
            document.getElementById('play-btn').style.display = 'none';
            mpMenuBtn.style.display = 'none';
            if(mpError) mpError.style.display = 'none';
        }

        function resetToMain() {
            hideAllSections();
            document.getElementById('play-btn').style.display = 'inline-block';
            document.getElementById('mp-menu-btn').style.display = 'inline-block';
        }

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
            joinAuthUI.style.display = 'flex';
            // Em P2P, a lista de salas não existe sem servidor, então pedimos o código
            const roomList = document.getElementById('room-list');
            if(roomList) roomList.innerHTML = '<div style="color: #00FFFF; padding: 10px;">DIGITE O CÓDIGO DO SEU AMIGO ABAIXO:</div>';
        });

        cancelBtns.forEach(btn => btn.addEventListener('click', () => {
            if (conn) conn.close();
            conn = null;
            resetToMain();
        }));

        confirmCreateBtn.addEventListener('click', () => {
            const name = document.getElementById('create-name').value.trim();
            if (!name) return alert("Digite seu nome!");
            myName = name.toUpperCase();
            
            isHost = true;
            hideAllSections();
            lobbyUI.style.display = 'block';
            document.getElementById('lobby-code').textContent = myId;
            
            // O host fica esperando a conexão (peer.on('connection') já lida com isso)
        });

        confirmJoinBtn.addEventListener('click', () => {
            const name = document.getElementById('join-name').value.trim();
            const hostId = document.getElementById('join-pass').value.trim(); // Usando o campo de senha para o ID

            if (!name) return alert("Digite seu nome!");
            if (!hostId) return alert("Digite o CÓDIGO da sala!");

            myName = name.toUpperCase();
            isHost = false;
            
            conn = peer.connect(hostId);
            _setupDataEvents();
        });
    }

    function _setupDataEvents() {
        conn.on('open', () => {
            console.log('Conexão P2P Aberta!');
            
            // Envia dados iniciais
            if (isHost) {
                // Host espera o cliente se apresentar ou inicia
            } else {
                send('hello', { 
                    name: myName,
                    killerClass: document.getElementById('join-killer-class').value,
                    killerSkin: window.activeKillerSkin,
                    innocentSkin: window.activeInnocentSkin
                });
            }
        });

        conn.on('data', (data) => {
            const { type, payload } = data;
            
            switch (type) {
                case 'hello':
                    if (isHost) {
                        // Host recebe o "oi" do cliente e inicia o jogo
                        const isFirstKiller = Math.random() > 0.5;
                        myRole = isFirstKiller ? 'KILLER' : 'INNOCENT';
                        const opponentRole = isFirstKiller ? 'INNOCENT' : 'KILLER';
                        
                        const killerClass = document.getElementById('create-killer-class').value;
                        
                        send('gameStart', {
                            role: opponentRole,
                            opponentName: myName,
                            killerClass: killerClass,
                            opponentKillerSkin: window.activeKillerSkin,
                            opponentInnocentSkin: window.activeInnocentSkin
                        });

                        // Inicia para si mesmo
                        window.activeKillerClass = killerClass;
                        window.opponentKillerSkin = payload.killerSkin;
                        window.opponentInnocentSkin = payload.innocentSkin;
                        document.getElementById('menu').style.display = 'none';
                        Game.startMultiplayer(myRole);
                    }
                    break;

                case 'gameStart':
                    myRole = payload.role;
                    window.activeKillerClass = payload.killerClass;
                    window.opponentKillerSkin = payload.opponentKillerSkin;
                    window.opponentInnocentSkin = payload.opponentInnocentSkin;
                    document.getElementById('menu').style.display = 'none';
                    Game.startMultiplayer(myRole);
                    break;

                case 'syncPlayer':
                    opponentData = payload;
                    break;

                case 'dotCollected':
                    if (typeof GameMap !== 'undefined') GameMap.forceCollectDot(payload.row, payload.col);
                    break;

                case 'growlEffect':
                    if (typeof Game !== 'undefined') Game.triggerGrowlEffect();
                    break;

                case 'dashEffect':
                    if (typeof Game !== 'undefined') Game.triggerDashEffect(payload);
                    break;

                case 'applyPowerColors':
                    if (typeof Game !== 'undefined') Game.setPowerMode(true);
                    window.isPowerModeActive = true;
                    break;

                case 'resetColors':
                    if (typeof Game !== 'undefined') Game.setPowerMode(false);
                    window.isPowerModeActive = false;
                    break;

                case 'killerEaten':
                    if (typeof Game !== 'undefined') Game.handleKillerEaten(payload.r, payload.c);
                    break;

                case 'gameOver':
                    if (typeof Game !== 'undefined') Game.networkGameOver(payload.winner);
                    break;

                case 'rewardCoins':
                    if (myRole === payload.winner && typeof Game !== 'undefined') {
                        Game.addCoins(5);
                    }
                    break;

                case 'opponentDisconnected':
                    if (typeof Game !== 'undefined') Game.networkDisconnect();
                    break;
            }
        });

        conn.on('close', () => {
            if (typeof Game !== 'undefined') Game.networkDisconnect();
        });
    }

    function send(type, payload) {
        if (conn && conn.open) {
            conn.send({ type, payload });
        }
    }

    return {
        init,
        syncState: (data) => { if (conn) send('syncPlayer', data); },
        emitDotCollected: (row, col) => { if (conn && myRole === 'INNOCENT') send('dotCollected', { row, col }); },
        emitGrowl: () => { if (conn && myRole === 'KILLER') send('growlEffect'); },
        emitDash: (data) => { if (conn && myRole === 'KILLER') send('dashEffect', data); },
        emitCaught: () => { 
            if (conn && myRole === 'KILLER' && !window.isPowerModeActive) {
                send('gameOver', { winner: 'KILLER' });
                send('rewardCoins', { winner: 'KILLER' });
                if (typeof Game !== 'undefined') Game.networkGameOver('KILLER');
            }
        },
        emitIAmCaught: () => {
            if (conn && myRole === 'INNOCENT' && !window.isPowerModeActive) {
                send('gameOver', { winner: 'KILLER' });
                send('rewardCoins', { winner: 'KILLER' });
                if (typeof Game !== 'undefined') Game.networkGameOver('KILLER');
            }
        },
        emitKillerEaten: (data) => { if (conn) send('killerEaten', data); },
        emitPowerActivated: () => { 
            if (conn && myRole === 'INNOCENT') {
                send('applyPowerColors');
                if (typeof Game !== 'undefined') Game.setPowerMode(true);
                window.isPowerModeActive = true;
                setTimeout(() => {
                    send('resetColors');
                    if (typeof Game !== 'undefined') Game.setPowerMode(false);
                    window.isPowerModeActive = false;
                }, 10000);
            }
        },
        emitAllDotsCollected: () => { 
            if (conn && myRole === 'INNOCENT') {
                send('gameOver', { winner: 'INNOCENT' });
                send('rewardCoins', { winner: 'INNOCENT' });
                if (typeof Game !== 'undefined') Game.networkGameOver('INNOCENT');
            }
        },
        getRole: () => myRole,
        getMyName: () => myName,
        getOpponentData: () => opponentData,
    };
})();
