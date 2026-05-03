/**
 * ANTIGRAVITY — main.js
 * Game Loop and Phase Management.
 */

const Game = (() => {
  let lastTime = 0;
  let animId;
  let level = 0;
  let state = 'MENU'; // MENU, PLAY, PAUSED, GAMEOVER, VICTORY, LEVEL_TRANSITION
  let isMultiplayer = false;
  let myRole = null;
  let growlCooldown = 0;
  let dashCooldown = 0;
  let powerTimer = null; // Para modo Single Player
  let score = 0; // Pontuação global
  
  // Economy & Skins
  let coins = 0;
  let ownedSkins = [];
  window.activeKillerSkin = null;
  window.activeInnocentSkin = null;
  
  let stalkerInLightTimer = 0;
  window.isStalkerRevealed = false;
  
  let adminClicks = 0;
  window.AdminState = {
      godMode: false,
      revealMap: false,
      speedMult: 1.0,
      silenceMode: false,
      insanityInf: false
  };
  
  let sanity = 100;
  let ghosts = []; // {x, y, timer, maxTimer, alpha}
  let micThreshold = 50; // Threshold para captar barulho
  
  const LEVEL_NAMES = [
    "Nível 1: O Eco",
    "Nível 2: O Matadouro",
    "Nível 3: Corredores Cegos",
    "Nível 4: A Fome",
    "Nível 5: Labirinto de Sangue",
    "Nível 6: Antigravity"
  ];
  
  // DOM Elements
  let uiMenu, uiTitle, uiPlayBtn;
  let uiOverlay, uiMessage, uiSubmsg;
  let scoreEl, dotsEl;

  function init(){
    uiMenu = document.getElementById('menu');
    uiPlayBtn = document.getElementById('play-btn');
    uiOverlay = document.getElementById('overlay');
    uiMessage = document.getElementById('msg-title');
    uiSubmsg = document.getElementById('msg-sub');
    scoreEl = document.getElementById('score');
    dotsEl = document.getElementById('dots-left');

    GameMap.init(0);
    Renderer.init();
    Audio.init();
    Player.init(); // just bindings
    if(typeof Net !== 'undefined') Net.init();
    
    loadEconomy();
    updateShopUI();
    
    uiPlayBtn.addEventListener('click', () => {
      isMultiplayer = false;
      Audio.resume();
      Audio.click();
      startGame();
    });

    // Multiplayer UI bindings are initialized inside socket.js _setupUI()
    window.addEventListener('keydown', (e) => {
        if(e.code === 'Space' && isMultiplayer && myRole === 'KILLER' && state === 'PLAY') {
            doGrowl();
        }
        if((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && isMultiplayer && myRole === 'KILLER' && state === 'PLAY') {
            doDash();
        }
    });

    document.getElementById('mobile-growl-btn').addEventListener('touchstart', (e) => { e.preventDefault(); doGrowl(); });
    document.getElementById('mobile-dash-btn').addEventListener('touchstart', (e) => { e.preventDefault(); doDash(); });

    // Pause UI bindings
    document.getElementById('pause-btn').addEventListener('click', togglePause);
    document.getElementById('resume-btn').addEventListener('click', togglePause);
    document.getElementById('restart-btn').addEventListener('click', () => {
        togglePause();
        startLevel();
    });

    document.getElementById('exit-btn').addEventListener('click', () => {
        if(confirm("Deseja realmente sair da partida?")) {
            window.location.reload();
        }
    });

    window.addEventListener('keydown', (e) => {
        if(e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
            if(state === 'PLAY' || state === 'PAUSED') togglePause();
        }
    });

    // Shop UI Bindings
    document.getElementById('shop-btn').addEventListener('click', () => {
        updateShopUI();
        document.getElementById('shop-ui').style.display = 'flex';
        Audio.click();
    });
    document.getElementById('shop-close-btn').addEventListener('click', () => {
        document.getElementById('shop-ui').style.display = 'none';
        Audio.click();
    });

    // Setup Buy/Equip buttons
    document.querySelectorAll('.shop-buy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const itemDiv = e.target.closest('.shop-item');
            const skinId = itemDiv.dataset.id;
            const price = parseInt(itemDiv.dataset.price);
            const type = itemDiv.dataset.type; // killer or innocent

            const isAdmin = document.getElementById('admin-panel').style.display === 'flex';

            if(ownedSkins.includes(skinId) || isAdmin || skinId.startsWith('default_')) {
                // Equip
                if(type === 'killer') window.activeKillerSkin = skinId.startsWith('default_') ? null : skinId;
                else window.activeInnocentSkin = skinId.startsWith('default_') ? null : skinId;
                
                saveEconomy();
                updateShopUI();
                Audio.click();
            } else {
                // Buy
                if(coins >= price) {
                    coins -= price;
                    ownedSkins.push(skinId);
                    saveEconomy();
                    updateShopUI();
                    Audio.playCollect(); // Cash sound
                } else {
                    // Not enough coins
                    alert('Moedas insuficientes!');
                }
            }
        });
    });

    setupSwipeControls();

    uiTitle = document.querySelector('.title');
    uiTitle.addEventListener('click', () => {
        adminClicks++;
        if(adminClicks >= 5) {
            adminClicks = 0;
            toggleAdminPanel();
        }
    });

    window.addEventListener('keydown', (e) => {
        if(e.key.toLowerCase() === 'e') {
            toggleAdminPanel();
        }
    });

    document.getElementById('admin-close-btn').addEventListener('click', toggleAdminPanel);

    requestAnimationFrame(menuLoop);
  }

  function setupSwipeControls() {
    let startX = 0, startY = 0;
    const threshold = 30; // pixels

    // Touch events
    window.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    }, {passive: false});

    window.addEventListener('touchend', (e) => {
        handleGesture(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    }, {passive: false});

    // Mouse events (for testing on desktop)
    window.addEventListener('mousedown', (e) => {
        startX = e.clientX;
        startY = e.clientY;
    });

    window.addEventListener('mouseup', (e) => {
        handleGesture(e.clientX, e.clientY);
    });

    function handleGesture(endX, endY) {
        const dx = endX - startX;
        const dy = endY - startY;

        if (Math.abs(dx) > Math.abs(dy)) {
            if (Math.abs(dx) > threshold) {
                Player.setDirection(dx > 0 ? 'right' : 'left', true);
            }
        } else {
            if (Math.abs(dy) > threshold) {
                Player.setDirection(dy > 0 ? 'down' : 'up', true);
            }
        }
    }
  }

  function togglePause() {
    if (state === 'PLAY') {
        state = 'PAUSED';
        document.getElementById('pause-menu').style.display = 'flex';
        Audio.stopChase();
        Audio.stopSteps(); 
    } else if (state === 'PAUSED') {
        state = 'PLAY';
        document.getElementById('pause-menu').style.display = 'none';
        lastTime = performance.now();
        animId = requestAnimationFrame(gameLoop);
    }
  }

  function menuLoop(now){
    if(state === 'MENU'){
      // Glitchy visual logic can be CSS mostly
      requestAnimationFrame(menuLoop);
    }
  }

  function startGame(){
    level = 0;
    score = 0;
    if(scoreEl) scoreEl.textContent = "0";
    document.getElementById('score-wrap').style.display = 'block';
    document.getElementById('pause-btn').style.display = 'block';
    startLevel();
  }

  function startLevel(){
    state = 'STARTING';
    uiMenu.style.display = 'none';
    uiOverlay.style.display = 'flex';
    if(navigator.vibrate) navigator.vibrate(200);
    const phaseEl = document.getElementById('phase');
    if(phaseEl) phaseEl.textContent = level + 1;
    uiMessage.textContent = LEVEL_NAMES[level];
    
    if(level === 2) uiSubmsg.textContent = "[ A lanterna falha... ]";
    else if(level === 4) uiSubmsg.textContent = "[ Piso pegajoso... ]";
    else if(level === 5) uiSubmsg.textContent = "[ Realidade distorcida. ]";
    else uiSubmsg.textContent = "";

    GameMap.init(level); // resets dots
    Renderer.preRenderMaze(level);
    Player.init();
    Entity.init(level);
    
    Audio.stopChase();
    Object.keys(document.body.style).forEach(k => document.body.style[k]=''); // reset styles
    document.body.className = '';

    // Wait 3 seconds, then start playing
    setTimeout(() => {
      uiOverlay.style.display = 'none';
      state = 'PLAY';
      lastTime = performance.now();
      Audio.startDrone();
      
      setTimeout(() => { 
        if(state==='PLAY') Entity.activate(); 
      }, 3000 - level*300);

      // Iniciar microfone e resetar sanidade
      if(!isMultiplayer) {
          Audio.initMic();
          sanity = 100;
          ghosts = [];
          const sanityUi = document.getElementById('sanity-ui');
          if(sanityUi) sanityUi.textContent = sanity;
      }

      animId = requestAnimationFrame(gameLoop);
    }, 3000);
  }

  function startMultiplayer(role){
    isMultiplayer = true;
    myRole = role;
    level = 0; // Standard level for MP
    state = 'STARTING';
    uiMenu.style.display = 'none';
    uiOverlay.style.display = 'flex';
    document.getElementById('score-wrap').style.display = 'block';
    
    uiMessage.textContent = role === 'KILLER' ? "VOCÊ É O ASSASSINO" : "VOCÊ É O INOCENTE";
    uiMessage.style.color = role === 'KILLER' ? "#FF0000" : "#00FFFF";
    uiSubmsg.textContent = role === 'KILLER' ? "Encontre e devore o fantasma guiando-se pela sua luz." : "Recolha todas as memórias. Cuidado com o predador.";
    
    GameMap.init(level);
    Renderer.preRenderMaze(level);
    Player.init();
    Entity.init(level);
    
    Audio.stopChase();
    Object.keys(document.body.style).forEach(k => document.body.style[k]='');
    document.body.className = '';

    if (role === 'KILLER') {
        document.getElementById('mobile-abilities').style.display = 'flex';
        document.getElementById('mobile-dash-btn').style.display = window.activeKillerClass === 'GLITCHER' ? 'block' : 'none';
    } else {
        document.getElementById('mobile-abilities').style.display = 'none';
        Audio.initMic();
        sanity = 100; // Reset sanity for Innocent in MP
    }

    setTimeout(() => {
      uiOverlay.style.display = 'none';
      state = 'PLAY';
      lastTime = performance.now();
      Audio.startDrone();
      Entity.activate(); 
      animId = requestAnimationFrame(gameLoop);
    }, 4000);
  }

  function gameLoop(now){
    if(state !== 'PLAY') return;
    
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    if(growlCooldown > 0) growlCooldown -= dt;
    if(dashCooldown > 0) dashCooldown -= dt;

    if(isMultiplayer && myRole === 'KILLER') {
      let uiText = "";
      if(growlCooldown > 0) uiText += `ROSNADO: ${Math.ceil(growlCooldown)}s `;
      else uiText += `ESPAÇO: ROSNAR `;
      
      if(window.activeKillerClass === 'GLITCHER') {
          if(dashCooldown > 0) uiText += `| DASH: ${Math.ceil(dashCooldown)}s`;
          else uiText += `| SHIFT: DASH`;
      }
      document.getElementById('score-wrap').textContent = uiText;
    }

    const isLabirintoSangue = (level === 4);
    const speedMult = isLabirintoSangue ? 0.6 : 1.0;
    const isCorredoresCegos = (level >= 2) && !isMultiplayer; // MP keeps it standard mostly
    
    const isAntigravity = (level === 5) && !isMultiplayer;
    if(isAntigravity) {
       const rX = (Math.random()-0.5)*10;
       const rY = (Math.random()-0.5)*10;
       document.getElementById('game-canvas').style.transform = `translate(${rX}px, ${rY}px) scale(1.02)`;
       if(Math.random()<0.005){
           const flipped = document.body.classList.contains('flipped');
           if(flipped) document.body.classList.remove('flipped');
           else document.body.classList.add('flipped');
       }
       if(Math.random()<0.02){
           const cvs = document.getElementById('game-canvas');
           cvs.style.filter = "invert(1) hue-rotate(90deg)";
           setTimeout(() => {
               if(state === 'PLAY') cvs.style.filter = window.isPowerModeActive ? "hue-rotate(180deg) brightness(1.2)" : "none";
           }, 50);
       }
    }

    if(!isMultiplayer) {
        const pts = Player.update(dt * speedMult, isCorredoresCegos);
        if(pts){
           score += pts * 10; // Bolas valem pontos
           if(scoreEl) scoreEl.textContent = score;
           dotsEl.textContent = GameMap.dotsLeft();
           if(pts === 5) {
               activatePowerMode(Math.max(2000, 10000 - level * 1000));
           }
           if(GameMap.dotsLeft() <= 0){
               winLevel();
               return;
           }
        }
        const pPos = Player.getPos();
        Entity.update(dt, pPos.row, pPos.col);

        // --- SISTEMA DE TERROR PSICOLÓGICO ---
        // 1. Sanidade cai se no escuro
        if(window.AdminState.insanityInf) {
            sanity = 0;
        } else {
            if(Player.getFlicker() < 0.5) {
                sanity = Math.max(0, sanity - dt * 2); // Cai 2 por segundo no escuro total (ou piscando)
            } else {
                sanity = Math.min(100, sanity + dt * 0.5); // Recupera lentamente na luz
            }
        }
        
        const sanityUi = document.getElementById('sanity-ui');
        if(sanityUi) {
            sanityUi.textContent = Math.floor(sanity);
            sanityUi.style.color = sanity < 30 ? '#FF0000' : '#00FFFF';
        }

        const cvs = document.getElementById('game-canvas');
        if(sanity < 30) {
            // Crise de Pânico
            if(Math.random() < 0.05) {
                cvs.style.filter = Math.random() > 0.5 ? "invert(1)" : "hue-rotate(90deg)";
            } else {
                cvs.style.filter = window.isPowerModeActive ? "hue-rotate(180deg) brightness(1.2)" : "none";
            }
            
            // Spawn de Fantasmas Aleatórios
            if(Math.random() < 0.01 && ghosts.length < 3) {
                const spawnTile = GameMap.randomOpenTile(pPos.row, pPos.col, 5); // Perto do player
                if(spawnTile) {
                    ghosts.push({
                        x: spawnTile.c * GameMap.TILE + GameMap.TILE/2,
                        y: spawnTile.r * GameMap.TILE + GameMap.TILE/2,
                        timer: 2.0, // Fica vivo por 2 segs
                        maxTimer: 2.0,
                        alpha: 0
                    });
                }
            }
        } else if(!isAntigravity) {
            cvs.style.filter = window.isPowerModeActive ? "hue-rotate(180deg) brightness(1.2)" : "none";
        }

        // Atualiza Fantasmas
        for(let i = ghosts.length - 1; i >= 0; i--) {
            let g = ghosts[i];
            g.timer -= dt;
            const distToPlayer = Math.sqrt((pPos.x - g.x)**2 + (pPos.y - g.y)**2);
            if(g.timer <= 0 || distToPlayer < GameMap.TILE * 1.5) {
                ghosts.splice(i, 1); // Some se o tempo acabar ou o jogador chegar perto
            } else {
                // Fade in/out
                if(g.timer > g.maxTimer - 0.5) g.alpha = (g.maxTimer - g.timer) / 0.5;
                else if(g.timer < 0.5) g.alpha = g.timer / 0.5;
                else g.alpha = 1.0;
            }
        }

        // 2. Microfone (The Silence)
        if(Audio.getMicVolume && !window.AdminState.silenceMode) {
            const vol = Audio.getMicVolume();
            const micIcon = document.getElementById('mic-icon');
            if(vol > micThreshold) {
                if(micIcon) micIcon.style.color = '#FF0000';
                Entity.forceHunting(pPos.row, pPos.col); // Assassino escuta e vai direto para o jogador
            } else {
                if(micIcon) micIcon.style.color = '#888888';
            }
        } else {
            const micIcon = document.getElementById('mic-icon');
            if(micIcon) micIcon.style.color = window.AdminState.silenceMode ? '#00FF00' : '#888888';
        }
        // -------------------------------------
    } else {
        // MULTIPLAYER
        if(myRole === 'INNOCENT') {
            const pts = Player.update(dt, true); // Permite flicker no Multiplayer para o Inocente
            if(pts){
                score += pts * 10;
                if(scoreEl) scoreEl.textContent = score;
                dotsEl.textContent = GameMap.dotsLeft();
                Net.emitDotCollected(Player.getPos().row, Player.getPos().col);
                if(pts === 5) {
                    activatePowerMode(Math.max(2000, 10000 - level * 1000)); // Ativação imediata local
                }
                if(GameMap.dotsLeft() <= 0){
                    Net.emitAllDotsCollected();
                    return;
                }
            }
            // Recebe posição do Assassino
            const oppData = Net.getOpponentData();
            if(oppData && !Entity.isFrozen()) Entity.forcePos(oppData.x, oppData.y, oppData.row, oppData.col, oppData.dir, oppData.mouth);
            
            // Atualiza e Sincroniza Sanidade
            if(Player.getFlicker() < 0.5) sanity = Math.max(0, sanity - dt * 2);
            else sanity = Math.min(100, sanity + dt * 0.5);
            
            const sanityUi = document.getElementById('sanity-ui');
            if(sanityUi) {
                sanityUi.textContent = Math.floor(sanity);
                sanityUi.style.color = sanity < 30 ? '#FF0000' : '#00FFFF';
            }

            // Send pos
            const p = Player.getPos();
            Net.syncState({ x: p.x, y: p.y, row: p.row, col: p.col, dir: Player.getDir(), angle: Player.getAngle(), flicker: Player.getFlicker(), sanity: sanity });
            
        } else if (myRole === 'KILLER') {
            // Assassino controlando Entity
            Entity.updateManual(dt);
            const oppData = Net.getOpponentData();
            if(oppData) {
                Player.forcePos(oppData.x, oppData.y, oppData.row, oppData.col, oppData.dir, oppData.angle, oppData.flicker);
                if(oppData.sanity !== undefined) window.opponentSanity = oppData.sanity;
            }
            
            Entity.animateMouth(dt);
            // Send pos
            const ep = Entity.getPos();
            Net.syncState({ x: ep.x, y: ep.y, row: ep.row, col: ep.col, dir: Entity.getDir(), mouth: Entity.getMouth() });
        }
    }

    // Stalker Visibility Logic (Innocent only)
    if(isMultiplayer && myRole === 'INNOCENT' && window.activeKillerClass === 'STALKER' && Entity.isActive()) {
        const pPos = Player.getPos(), ePos = Entity.getPos();
        const dx = ePos.x - pPos.x, dy = ePos.y - pPos.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const flicker = Player.getFlicker();
        const lightDist = 24 * 6 * flicker; // TILE * 6
        
        let inLight = false;
        if(dist <= lightDist && flicker > 0) {
            let angleBase = 0;
            const pDir = Player.getDir();
            if(pDir.name==='right') angleBase = 0;
            else if(pDir.name==='down')  angleBase = Math.PI/2;
            else if(pDir.name==='left')  angleBase = Math.PI;
            else if(pDir.name==='up')    angleBase = -Math.PI/2;
            angleBase += Player.getAngle();
            
            let angleToE = Math.atan2(dy, dx);
            let diff = angleToE - angleBase;
            while(diff <= -Math.PI) diff += Math.PI*2;
            while(diff > Math.PI) diff -= Math.PI*2;
            
            if(Math.abs(diff) <= (Math.PI / 3.5) / 2) {
                inLight = true;
            }
        }
        
        if(inLight) stalkerInLightTimer += dt;
        else stalkerInLightTimer = 0;
        
        window.isStalkerRevealed = (stalkerInLightTimer >= 2.0);
    }

    // Prox logic and Death collision
    let proximity = 0;
    if(Entity.isActive()){
      const pPos = Player.getPos();
      const ePos = Entity.getPos();
      const dist = Math.abs(pPos.row-ePos.row) + Math.abs(pPos.col-ePos.col);
      
      if(dist < 10) proximity = 1 - (dist/10);
      else proximity = 0;

      if(proximity > 0.1 && (!isMultiplayer || myRole === 'INNOCENT')){ // Só o inocente ouve perseguição
        Audio.startChase();
        Audio.playWaka(proximity);
      } else {
        Audio.stopChase();
      }

      // Death collision
      const pX = pPos.x, pY = pPos.y;
      const eX = ePos.x, eY = ePos.y;
      const dPixel = Math.sqrt((pX-eX)**2 + (pY-eY)**2);
      if(dPixel < GameMap.TILE){
        if(!isMultiplayer) {
            // SINGLE PLAYER: Inocente come o monstro se Power Mode ativo
            if(window.isPowerModeActive) {
                const target = GameMap.randomOpenTile(pPos.row, pPos.col, 10);
                handleKillerEaten(target.r, target.c);
            } else {
                die();
                return; // Só retorna se o jogo acabar
            }
        } else {
            // MULTIPLAYER: Sincronização Aleatória Distante
            if(window.isPowerModeActive) {
                // MODO PODER: Inocente bate no Assassino.
                // NOVIDADE: Empurrar para trás (Knockback) no MP.
                const ePos = Entity.getPos(), pPos = Player.getPos();
                let dr = Math.sign(ePos.row - pPos.row);
                let dc = Math.sign(ePos.col - pPos.col);
                
                // Se estiverem exatamente no mesmo tile, usa a direção do Player
                if(dr === 0 && dc === 0) {
                    const pDir = Player.getDir();
                    if(pDir.name === 'up') dr = -1;
                    else if(pDir.name === 'down') dr = 1;
                    else if(pDir.name === 'left') dc = -1;
                    else if(pDir.name === 'right') dc = 1;
                }

                let targetR = ePos.row, targetC = ePos.col;
                for(let i=0; i<5; i++) {
                    let nr = targetR + dr, nc = targetC + dc;
                    if(GameMap.walkable(nr, nc, false)) {
                        targetR = nr; targetC = nc;
                    } else break;
                }

                if(myRole === 'INNOCENT') Net.emitKillerEaten({ r: targetR, c: targetC });
                handleKillerEaten(targetR, targetC);
            } else {
                // MODO NORMAL: Assassino come Inocente. 
                if(myRole === 'INNOCENT') Net.emitIAmCaught();
            }
        }
      }
    }

    // 2. Render
    Renderer.renderAll(dt, Player, Entity, GameMap.getMap(), level, proximity, isMultiplayer ? myRole : 'INNOCENT', window.isPowerModeActive, ghosts);

    animId = requestAnimationFrame(gameLoop);
  }

  function die(){
    if(window.AdminState.godMode) return;
    state = 'GAMEOVER';
    cancelAnimationFrame(animId);
    Audio.playDeath();
    Audio.stopSteps();
    
    uiOverlay.style.display = 'flex';
    document.getElementById('pause-btn').style.display = 'none';
    uiMessage.textContent = "ALIMENTADO";
    uiMessage.style.color = "#FF0000";
    uiSubmsg.textContent = "... clique para recomeçar o pesadelo ...";
    document.getElementById('game-canvas').style.filter = "grayscale(100%) brightness(50%) sepia(100%) hue-rotate(-50deg)";
    document.body.className = ''; // remove flips
    
    setTimeout(() => {
      window.onclick = () => {
        window.onclick = null;
        document.getElementById('game-canvas').style.filter = "none";
        uiMessage.style.color = "#FFFFFF";
        startGame(); // full restart
      }
    }, 2000);
  }

  function winLevel(){
    state = 'LEVEL_TRANSITION';
    cancelAnimationFrame(animId);
    Audio.stopSteps();
    if(navigator.vibrate) navigator.vibrate([100, 50, 100]);
    
    uiOverlay.style.display = 'flex';
    uiMessage.textContent = "SISTEMA CORROMPIDO... PRÓXIMO NÍVEL";
    uiMessage.style.color = "#FF00FF";
    uiMessage.style.textShadow = "2px 0 red, -2px 0 blue";
    uiSubmsg.textContent = "";
    document.body.className = '';
    
    setTimeout(() => {
      level++;
      uiMessage.style.color = "#FFFFFF";
      uiMessage.style.textShadow = "none";
      if(level < LEVEL_NAMES.length){
         startLevel();
      } else {
         gameComplete();
      }
    }, 2000);
  }

  function gameComplete(){
    state = 'VICTORY';
    uiMenu.style.display = 'flex';
    uiOverlay.style.display = 'none';
    document.querySelector('.title').textContent = "SOBREVIVENTE";
    document.querySelector('.title').style.color = "#FFFFFF";
    document.querySelector('.subtitle').innerHTML = "A Entidade não lhe devorou.<br>Mas o labirinto ainda chama.";
    uiPlayBtn.textContent = "DESPERTAR NOVAMENTE";
  }

  function doGrowl() {
      if(growlCooldown <= 0) {
          Net.emitGrowl();
          growlCooldown = 15;
      }
  }

  function doDash() {
      if(window.activeKillerClass === 'GLITCHER' && dashCooldown <= 0) {
          const dashPos = Entity.calculateDash(4); // 4 blocos
          if (dashPos) {
              Entity.forcePos(dashPos.x, dashPos.y, dashPos.r, dashPos.c);
              Net.emitDash({ r: dashPos.r, c: dashPos.c, x: dashPos.x, y: dashPos.y });
              dashCooldown = 5; // 5 segundos
              Audio.playCollect(); // Efeito temporário
          }
      }
  }

  function triggerDashEffect(data) {
      if(state !== 'PLAY') return;
      if(typeof Entity !== 'undefined') {
          Entity.forcePos(data.x, data.y, data.r, data.c);
          Entity.freeze(200); // pequeno freeze visual no oponente
      }
  }

  function triggerGrowlEffect() {
      if(state !== 'PLAY') return;
      Audio.playDeath(); // Som agudo/monstruoso
      document.body.classList.add('flipped');
      setTimeout(() => {
          document.body.classList.remove('flipped');
      }, 4000);
      
      // Banshee Heartbeat Vibration
      if(window.activeKillerClass === 'BANSHEE' && isMultiplayer && myRole === 'INNOCENT' && navigator.vibrate) {
          navigator.vibrate([200, 100, 200, 500, 200, 100, 200]);
      }
  }

  function networkGameOver(winnerStr) {
      state = 'GAMEOVER';
      cancelAnimationFrame(animId);
      
      uiOverlay.style.display = 'flex';
      document.getElementById('pause-btn').style.display = 'none';
      if(winnerStr === 'KILLER') {
          uiMessage.textContent = myRole === 'KILLER' ? "ALIMENTADO (VITÓRIA)" : "DEVORADO";
          uiMessage.style.color = "#FF0000";
          if(myRole === 'INNOCENT') Audio.playDeath();
      } else {
          uiMessage.textContent = myRole === 'INNOCENT' ? "SOBREVIVENTE (VITÓRIA)" : "FOME (DERROTA)";
          uiMessage.style.color = "#00FFFF";
          if(myRole === 'INNOCENT') Audio.playVictory();
      }
      
      uiSubmsg.textContent = "Retornando ao lobby...";
      setTimeout(() => {
          window.location.reload();
      }, 5000);
  }

  function networkDisconnect() {
      if(state !== 'MENU') {
          alert('Oponente desconectou-se.');
          window.location.reload();
      }
  }

  function setPowerMode(active) {
      window.isPowerModeActive = active;
      if(active) {
          document.getElementById('game-canvas').style.filter = "hue-rotate(180deg) brightness(1.2)";
          document.body.style.backgroundColor = "#000033";
          setTimeout(() => { document.body.style.backgroundColor = "#000000"; }, 200);
      } else {
          document.getElementById('game-canvas').style.filter = "none";
          document.body.style.backgroundColor = "#000000";
      }
  }

  function activatePowerMode(duration) {
      setPowerMode(true);
      if(powerTimer) clearTimeout(powerTimer);
      powerTimer = setTimeout(() => {
          setPowerMode(false);
          powerTimer = null;
      }, duration);
  }

  function handleKillerEaten(r, c) {
      // 1. Respawn em local específico (r, c)
      const tx = c * GameMap.TILE + GameMap.TILE / 2;
      const ty = r * GameMap.TILE + GameMap.TILE / 2;
      Entity.forcePos(tx, ty, r, c);

      // 2. Freeze
      Entity.freeze(2000);

      // 3. Feedback Visual (Mensagem rápida)
      if(isMultiplayer && myRole === 'KILLER') {
          const oldMsg = uiSubmsg.textContent;
          uiSubmsg.textContent = "[ VOCÊ FOI DEVORADO! RESPAWN... ]";
          uiSubmsg.style.color = "#00FFFF";
          setTimeout(() => { 
              uiSubmsg.textContent = oldMsg; 
              uiSubmsg.style.color = "";
          }, 2000);
      }

      // 4. Score (apenas o Inocente ganha pontos)
      if(!isMultiplayer || myRole === 'INNOCENT') {
          score += 200;
          if(scoreEl) scoreEl.textContent = score;
      }
  }

  function toggleAdminPanel() {
      const panel = document.getElementById('admin-panel');
      if(panel.style.display === 'none') {
          panel.style.display = 'flex';
          updateShopUI(); // Refresh shop prices to show "GRÁTIS"
          Audio.click();
      } else {
          panel.style.display = 'none';
          updateShopUI(); // Refresh shop prices back to normal
      }
  }

  function adminJump(targetLevel) {
      level = targetLevel;
      startLevel();
      toggleAdminPanel();
  }

  function adminToggle(feature) {
      if(feature === 'god') {
          AdminState.godMode = !AdminState.godMode;
          document.getElementById('admin-god-btn').textContent = AdminState.godMode ? 'ON' : 'OFF';
          document.getElementById('admin-god-btn').classList.toggle('active', AdminState.godMode);
      }
      if(feature === 'reveal') {
          AdminState.revealMap = !AdminState.revealMap;
          document.getElementById('admin-reveal-btn').textContent = AdminState.revealMap ? 'ON' : 'OFF';
          document.getElementById('admin-reveal-btn').classList.toggle('active', AdminState.revealMap);
      }
      if(feature === 'speed') {
          AdminState.speedMult = AdminState.speedMult === 1.0 ? 2.5 : 1.0;
          document.getElementById('admin-speed-btn').textContent = AdminState.speedMult > 1.0 ? 'ON' : 'OFF';
          document.getElementById('admin-speed-btn').classList.toggle('active', AdminState.speedMult > 1.0);
      }
      if(feature === 'silence') {
          AdminState.silenceMode = !AdminState.silenceMode;
          document.getElementById('admin-silence-btn').textContent = AdminState.silenceMode ? 'ON' : 'OFF';
          document.getElementById('admin-silence-btn').classList.toggle('active', AdminState.silenceMode);
      }
      if(feature === 'insanity') {
          AdminState.insanityInf = !AdminState.insanityInf;
          document.getElementById('admin-insanity-btn').textContent = AdminState.insanityInf ? 'ON' : 'OFF';
          document.getElementById('admin-insanity-btn').classList.toggle('active', AdminState.insanityInf);
      }
      Audio.click();
  }

  // --- ECONOMY ---
  function loadEconomy() {
      const savedCoins = localStorage.getItem('ag_coins');
      if(savedCoins !== null) coins = parseInt(savedCoins);
      
      const savedSkins = localStorage.getItem('ag_skins');
      if(savedSkins !== null) ownedSkins = JSON.parse(savedSkins);
      
      window.activeKillerSkin = localStorage.getItem('ag_active_killer_skin') || null;
      window.activeInnocentSkin = localStorage.getItem('ag_active_innocent_skin') || null;
      
      document.getElementById('coin-count').textContent = coins;
  }

  function saveEconomy() {
      localStorage.setItem('ag_coins', coins);
      localStorage.setItem('ag_skins', JSON.stringify(ownedSkins));
      localStorage.setItem('ag_active_killer_skin', window.activeKillerSkin || "");
      localStorage.setItem('ag_active_innocent_skin', window.activeInnocentSkin || "");
      
      document.getElementById('coin-count').textContent = coins;
  }

  function addCoins(amount) {
      coins += amount;
      saveEconomy();
  }

  function updateShopUI() {
      const isAdmin = document.getElementById('admin-panel').style.display === 'flex';
      document.getElementById('shop-coin-count').textContent = coins;
      document.querySelectorAll('.shop-item').forEach(item => {
          const btn = item.querySelector('.shop-buy-btn');
          const skinId = item.dataset.id;
          const type = item.dataset.type;
          
          btn.classList.remove('owned', 'equipped');
          const isDefault = skinId.startsWith('default_');
          
          if(ownedSkins.includes(skinId) || isAdmin || isDefault) {
              const isActive = (type === 'killer' && window.activeKillerSkin === (isDefault ? null : skinId)) || 
                               (type === 'innocent' && window.activeInnocentSkin === (isDefault ? null : skinId));
              if(isActive) {
                  btn.textContent = "[ EQUIPADO ]";
                  btn.classList.add('equipped');
              } else {
                  btn.textContent = "[ EQUIPAR ]";
                  btn.classList.add('owned');
              }
          } else {
              btn.textContent = "🪙 " + item.dataset.price;
          }
      });
  }

  return { init, startMultiplayer, triggerGrowlEffect, triggerDashEffect, networkGameOver, networkDisconnect, setPowerMode, activatePowerMode, handleKillerEaten, adminJump, adminToggle, addCoins };
})();

window.onload = Game.init;
