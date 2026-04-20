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
  let powerTimer = null; // Para modo Single Player
  let score = 0; // Pontuação global
  
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

    Renderer.init();
    Audio.init();
    Player.init(); // just bindings
    if(typeof Net !== 'undefined') Net.init();
    
    uiPlayBtn.addEventListener('click', () => {
      isMultiplayer = false;
      Audio.resume();
      Audio.click();
      startGame();
    });

    // Multiplayer UI bindings are initialized inside socket.js _setupUI()
    window.addEventListener('keydown', (e) => {
        if(e.code === 'Space' && isMultiplayer && myRole === 'KILLER' && state === 'PLAY') {
            if(growlCooldown <= 0) {
                Net.emitGrowl();
                growlCooldown = 15; // 15s cooldown
                // Audios or visual cue locally
                document.getElementById('score-wrap').textContent = "ROSNADO ATIVADO (Recarga: 15s)";
            }
        }
    });

    // Pause UI bindings
    document.getElementById('pause-btn').addEventListener('click', togglePause);
    document.getElementById('resume-btn').addEventListener('click', togglePause);
    document.getElementById('restart-btn').addEventListener('click', () => {
        togglePause();
        startLevel();
    });

    window.addEventListener('keydown', (e) => {
        if(e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
            if(state === 'PLAY' || state === 'PAUSED') togglePause();
        }
    });

    setupSwipeControls();

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
    uiMessage.textContent = LEVEL_NAMES[level];
    
    if(level === 2) uiSubmsg.textContent = "[ A lanterna falha... ]";
    else if(level === 4) uiSubmsg.textContent = "[ Piso pegajoso... ]";
    else if(level === 5) uiSubmsg.textContent = "[ Realidade distorcida. ]";
    else uiSubmsg.textContent = "";

    GameMap.init(); // resets dots
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
      
      // Delay before Pac-Man wakes up
      setTimeout(() => { 
        if(state==='PLAY') Entity.activate(); 
      }, 3000 - level*300);

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
    
    GameMap.init();
    Renderer.preRenderMaze(level);
    Player.init();
    Entity.init(level);
    
    Audio.stopChase();
    Object.keys(document.body.style).forEach(k => document.body.style[k]='');
    document.body.className = '';

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

    if(isMultiplayer && myRole === 'KILLER') {
      if(growlCooldown > 0) document.getElementById('score-wrap').textContent = `RECARGA DO ROSNADO: ${Math.ceil(growlCooldown)}s`;
      else document.getElementById('score-wrap').textContent = `ESPAÇO: ROSNAR (DESORIENTAR)`;
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
    }

    if(!isMultiplayer) {
        const pts = Player.update(dt * speedMult, isCorredoresCegos);
        if(pts){
           score += pts * 10; // Bolas valem pontos
           if(scoreEl) scoreEl.textContent = score;
           dotsEl.textContent = GameMap.dotsLeft();
           if(pts === 5) {
               activatePowerMode(10000);
           }
           if(GameMap.dotsLeft() <= 0){
               winLevel();
               return;
           }
        }
        const pPos = Player.getPos();
        Entity.update(dt, pPos.row, pPos.col);
    } else {
        // MULTIPLAYER
        if(myRole === 'INNOCENT') {
            const pts = Player.update(dt, false);
            if(pts){
                score += pts * 10;
                if(scoreEl) scoreEl.textContent = score;
                dotsEl.textContent = GameMap.dotsLeft();
                Net.emitDotCollected(Player.getPos().row, Player.getPos().col);
                if(pts === 5) {
                    activatePowerMode(10000); // Ativação imediata local
                }
                if(GameMap.dotsLeft() <= 0){
                    Net.emitAllDotsCollected();
                    return;
                }
            }
            // Recebe posição do Assassino
            const oppData = Net.getOpponentData();
            if(oppData && !Entity.isFrozen()) Entity.forcePos(oppData.x, oppData.y, oppData.row, oppData.col, oppData.dir, oppData.mouth);
            
            // Send pos
            const p = Player.getPos();
            Net.syncState({ x: p.x, y: p.y, row: p.row, col: p.col, dir: Player.getDir(), angle: Player.getAngle(), flicker: Player.getFlicker() });
            
        } else if (myRole === 'KILLER') {
            // Assassino controlando Entity
            Entity.updateManual(dt);
            const oppData = Net.getOpponentData();
            if(oppData) Player.forcePos(oppData.x, oppData.y, oppData.row, oppData.col, oppData.dir, oppData.angle, oppData.flicker);
            
            Entity.animateMouth(dt);
            // Send pos
            const ep = Entity.getPos();
            Net.syncState({ x: ep.x, y: ep.y, row: ep.row, col: ep.col, dir: Entity.getDir(), mouth: Entity.getMouth() });
        }
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
    Renderer.renderAll(dt, Player, Entity, GameMap.getMap(), level, proximity, isMultiplayer ? myRole : null, window.isPowerModeActive);

    animId = requestAnimationFrame(gameLoop);
  }

  function die(){
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
    Audio.playVictory();
    Audio.stopSteps();
    
    uiOverlay.style.display = 'flex';
    uiMessage.textContent = "MEMÓRIAS RESTAURADAS";
    uiMessage.style.color = "#00FFFF";
    uiSubmsg.textContent = "";
    document.body.className = '';
    
    setTimeout(() => {
      level++;
      uiMessage.style.color = "#FFFFFF";
      if(level < LEVEL_NAMES.length){
         startLevel();
      } else {
         gameComplete();
      }
    }, 4000);
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

  function triggerGrowlEffect() {
      if(state !== 'PLAY') return;
      Audio.playDeath(); // Som agudo/monstruoso
      document.body.classList.add('flipped');
      setTimeout(() => {
          document.body.classList.remove('flipped');
      }, 4000);
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

  return { init, startMultiplayer, triggerGrowlEffect, networkGameOver, networkDisconnect, setPowerMode, activatePowerMode, handleKillerEaten };
})();

window.onload = Game.init;
