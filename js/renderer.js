/**
 * ANTIGRAVITY — renderer.js
 * Canvas 2D rendering: Maze, shadows, lighting, entities.
 */

const Renderer = (() => {
  let canvas, ctx;
  let bgCanvas, bgCtx; // Pre-render static maze parts to optimize
  let TILE = 24;
  let isMobileDevice = false;
  let currentLevel = 0;

  const COLORS = {
    wallLevel:   ['#0000AA', '#550000', '#222222', '#660000', '#880000', '#AA0000'],
    floorNormal: '#000000',
    floorSlow:   '#220000', // Level 5 blood maze
    dot:         '#FFB8AE',
    bgLight:     'rgba(180,220,255,0.85)', // Flashlight color
    entityDef:   '#FFFF00', // Yellow core for Pac-Man
  };

  function init(){
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d', {alpha: false});
    
    bgCanvas = document.createElement('canvas');
    bgCtx = bgCanvas.getContext('2d');
    
    isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 800;

    window.addEventListener('resize', resize);
    resize();
  }

  function resize(){
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    isMobileDevice = window.innerWidth < 800; 
    
    // Re-calculate tile and pre-render if we are already in a level
    if (GameMap.getMap()) {
      preRenderMaze(currentLevel);
    }
  }

  function preRenderMaze(level){
    currentLevel = level;
    const cols = GameMap.COLS, rows = GameMap.ROWS;
    const baseTile = Math.floor(Math.min(canvas.width / cols, canvas.height / rows));
    
    // Zoom factor for mobile
    if (isMobileDevice) {
      TILE = Math.floor(baseTile * 2.2); 
    } else {
      TILE = baseTile;
    }
    
    GameMap.TILE = TILE; // Sync tile size
    
    // Sync pixel positions for player and entity if they exist
    if (typeof Player !== 'undefined' && Player.syncPixels) Player.syncPixels();
    if (typeof Entity !== 'undefined' && Entity.syncPixels) Entity.syncPixels();
    
    // Resize bg canvas based on tile logic
    bgCanvas.width = cols * TILE;
    bgCanvas.height = rows * TILE;
    
    const wallColor = COLORS.wallLevel[Math.min(level, 5)];
    const isLabirintoSangue = level === 4; // Level 5 (index 4)
    
    bgCtx.fillStyle = '#000000';
    bgCtx.fillRect(0,0,bgCanvas.width,bgCanvas.height);
    
    for(let r=0; r<rows; r++){
      for(let c=0; c<cols; c++){
        const t = GameMap.tile(r,c);
        const px = c*TILE, py = r*TILE;
        
        if(t === GameMap.W || t === GameMap.O){
          // simple walls for now, can add border logic later
          bgCtx.fillStyle = (t===GameMap.W) ? wallColor : '#000000';
          bgCtx.fillRect(px,py,TILE+1,TILE+1);
          // inner black
          if(t===GameMap.W){
             bgCtx.fillStyle = '#000000';
             bgCtx.fillRect(px+2,py+2,TILE-4,TILE-4);
          }
        } 
        else if (isLabirintoSangue && t !== GameMap.W && t !== GameMap.O) {
           bgCtx.fillStyle = COLORS.floorSlow;
           bgCtx.fillRect(px,py,TILE,TILE);
        }
      }
    }
  }

  function render(dt, player, entity, levelMap, proximity){
    // Center logic
    const gW = GameMap.COLS * TILE, gH = GameMap.ROWS * TILE;
    const offsetX = Math.floor((canvas.width - gW)/2);
    const offsetY = Math.floor((canvas.height - gH)/2);

    ctx.fillStyle = '#000000';
    ctx.fillRect(0,0,canvas.width,canvas.height);

    ctx.save();
    ctx.translate(offsetX, offsetY);

    // 1. Draw static maze
    ctx.drawImage(bgCanvas, 0, 0);

    // 2. Draw blood trail (Entity)
    const blood = Entity.getBlood();
    ctx.fillStyle = 'rgba(150,0,0,0.4)';
    for(const k of blood){
      const [r,c] = k.split(',').map(Number);
      ctx.fillRect(c*TILE, r*TILE, TILE, TILE);
    }

    // 3. Draw dots
    for(let r=0; r<GameMap.ROWS; r++){
      for(let c=0; c<GameMap.COLS; c++){
        const t = levelMap[r][c];
        const cx = c*TILE + TILE/2, cy = r*TILE + TILE/2;
        if(t===GameMap.D){
           ctx.fillStyle = COLORS.dot;
           ctx.fillRect(cx-2, cy-2, 4, 4);
        } else if(t===GameMap.P){
           ctx.fillStyle = COLORS.dot;
           ctx.beginPath(); ctx.arc(cx,cy,5,0,Math.PI*2); ctx.fill();
        }
      }
    }

    // 4. Lighting Mask (Flashlight view)
    _drawLighting(player);

    // 5. Draw Entity (Only what's visible, handled by lighting usually, but we draw it on top)
    // Actually, to make it spooky, we draw the screen, then paint darkness OVER it,
    // leaving a transparent hole where the flashlight is.
    ctx.restore();
    
    // Re-draw in isolated space? Easier to use globalCompositeOperation.
    // Let's do darkness overlay logic here.
  }

  function _drawLighting(player){
    // Draw darkness
    const gW = GameMap.COLS * TILE, gH = GameMap.ROWS * TILE;
    
    ctx.globalCompositeOperation = 'destination-in';
    
    // Create a temporary canvas for the light cone
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = gW; maskCanvas.height = gH;
    const mtx = maskCanvas.getContext('2d');
    
    // Fill mask background with black
    mtx.fillStyle = 'transparent';
    mtx.fillRect(0,0,gW,gH);
    
    const pPos = Player.getPos();
    const px = pPos.x, py = pPos.y;
    const pDir = Player.getDir();
    const flicker = Player.getFlicker();
    
    let angleBase = 0;
    if(pDir.name==='right') angleBase = 0;
    if(pDir.name==='down')  angleBase = Math.PI/2;
    if(pDir.name==='left')  angleBase = Math.PI;
    if(pDir.name==='up')    angleBase = -Math.PI/2;
    
    angleBase += Player.getAngle(); // Panic jitter
    
    // Draw light cone on mask
    const radius = TILE * 6 * flicker; // 6 tiles view distance
    const spread = Math.PI / 3.5; // Beam width
    
    if(flicker > 0){
      const grad = mtx.createRadialGradient(px,py,TILE, px,py,radius);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.8, 'rgba(255,255,255,0.8)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      
      mtx.fillStyle = grad;
      mtx.beginPath();
      mtx.moveTo(px,py);
      mtx.arc(px,py,radius, angleBase-spread/2, angleBase+spread/2);
      mtx.closePath();
      mtx.fill();
    }
    
    // Also draw a small ambient glow around the player
    const amb = mtx.createRadialGradient(px,py,0, px,py,TILE*2);
    amb.addColorStop(0, 'rgba(255,255,255,0.7)');
    amb.addColorStop(1, 'rgba(255,255,255,0)');
    mtx.fillStyle=amb;
    mtx.beginPath(); mtx.arc(px,py,TILE*2,0,Math.PI*2); mtx.fill();
    
    // Apply the mask
    ctx.drawImage(maskCanvas, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    
    // Now draw Entity (Monstrous Pac-Man) on top, partially obscured by darkness if far
    // But since it's horror, we ONLY see him if he is within the light!
    // We do THIS by drawing him before the mask, so he is clipped by the mask.
  }

  // Rewrite render flow for proper clipping
  function renderAll(dt, player, entity, levelMap, level, proximity, myRole, isPowerModeActive, ghosts = []){
    const gW = GameMap.COLS * TILE, gH = GameMap.ROWS * TILE;
    
    let offsetX, offsetY;
    
    if (isMobileDevice) {
      // Follow camera logic for mobile
      const pPos = player.getPos();
      offsetX = Math.floor(canvas.width / 2 - pPos.x);
      offsetY = Math.floor(canvas.height / 2 - pPos.y);
      
      // Optional: Clamp offsets so we don't show too much void (if desired)
      // For now, let's keep it simple as darkness covers the void anyway
    } else {
      // Classic center maze for desktop
      offsetX = Math.floor((canvas.width - gW)/2);
      offsetY = Math.floor((canvas.height - gH)/2);
    }

    ctx.fillStyle = '#050510'; // Deep void
    ctx.fillRect(0,0,canvas.width,canvas.height);

    ctx.save();
    ctx.translate(offsetX, offsetY);

    // 1. Scene
    ctx.drawImage(bgCanvas, 0, 0);

    // Blood
    const blood = Entity.getBlood();
    ctx.fillStyle = 'rgba(120,0,0,0.6)';
    for(const k of blood){
      const [r,c] = k.split(',').map(Number);
      ctx.fillRect(c*TILE, r*TILE, TILE, TILE);
    }

    // Dots
    for(let r=0; r<GameMap.ROWS; r++){
      for(let c=0; c<GameMap.COLS; c++){
        const t = levelMap[r][c];
        const cx = c*TILE + TILE/2, cy = r*TILE + TILE/2;
        if(t===GameMap.D){ ctx.fillStyle=COLORS.dot; ctx.fillRect(cx-2,cy-2,4,4); }
        else if(t===GameMap.P){ ctx.fillStyle=COLORS.dot; ctx.beginPath(); ctx.arc(cx,cy,5,0,Math.PI*2); ctx.fill(); }
        else if(t===GameMap.DR){ ctx.fillStyle='pink'; ctx.fillRect(cx-TILE/2,cy-TILE/4,TILE,TILE/2); } // Ghost door
      }
    }

    // 2. Player (Ghost)
    _drawGhost(Player.getPos().x, Player.getPos().y, false, myRole);

    // 3. Entity (Pac-Man)
    if(Entity.isActive()){
      _drawEntity(Entity.getPos().x, Entity.getPos().y, Entity.getDir(), Entity.getMouth(), level, proximity, isPowerModeActive, myRole);
    }

    // 3.5 Fantasmas (Alucinações)
    if(ghosts && ghosts.length > 0) {
        for(const g of ghosts) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, g.alpha * 0.5); // Translúcido
            const pPos = player.getPos();
            const dx = pPos.x - g.x;
            const dy = pPos.y - g.y;
            let dirName = 'up';
            if(Math.abs(dx) > Math.abs(dy)) dirName = dx > 0 ? 'right' : 'left';
            else dirName = dy > 0 ? 'down' : 'up';
            
            _drawEntity(g.x, g.y, {name: dirName}, 0.5, level, 0.5, false, myRole); // Proximity 0.5 for some jitter
            ctx.restore();
        }
    }

    ctx.restore();

    // 4. Darkness Mask (Drawn over the entire screen)
    if(myRole === 'KILLER') {
        _drawKillerVision(offsetX, offsetY);
    } else {
        _drawDarkness(offsetX, offsetY);
    }
  }



  function _drawEntity(x, y, dir, mouthPhase, level, proximity, isPowerModeActive, myRole){
    if (window.activeKillerClass === 'STALKER' && myRole === 'INNOCENT' && !window.isStalkerRevealed) {
        return; // Totalmente invisível até ser revelado
    }

    const baseR = TILE * 0.8;
    // Jitter increases with proximity - "corrupted code" feel
    const jitter = proximity > 0.3 ? (Math.random() - 0.5) * 5 * proximity : 0;
    const r = baseR + jitter;
    
    const isTeleporting = Entity.isTeleporting && Entity.isTeleporting();
    const teleportFlash = isTeleporting && (Math.floor(Date.now()/100)%2===0);

    let ang = 0;
    if(dir.name==='right') ang=0;
    if(dir.name==='down') ang=Math.PI/2;
    if(dir.name==='left') ang=Math.PI;
    if(dir.name==='up') ang=-Math.PI/2;

    const m = 0.15 + 0.35 * mouthPhase; 

    ctx.save();
    ctx.translate(x + jitter, y + jitter);
    ctx.rotate(ang);

    // 1. Body Base
    const bodyGrad = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
    const killerSkin = (myRole === 'KILLER') ? window.activeKillerSkin : window.opponentKillerSkin;
    
    if(!isPowerModeActive) {
        if(killerSkin === 'skin_blood_shadow') {
            // Sombra de Sangue: Vermelho pulsante
            const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 200);
            bodyGrad.addColorStop(0, `rgba(255, 0, 0, ${pulse})`);
            bodyGrad.addColorStop(1, '#550000');
        } else if(killerSkin === 'skin_observer') {
            // O Observador: Cinza
            bodyGrad.addColorStop(0, '#AAAAAA');
            bodyGrad.addColorStop(0.7, '#666666');
            bodyGrad.addColorStop(1, '#333333');
        } else if(killerSkin === 'skin_toxic_glitch') {
            // Toxic Glitch: Verde Neon
            bodyGrad.addColorStop(0, '#00FF00');
            bodyGrad.addColorStop(0.7, '#008800');
            bodyGrad.addColorStop(1, '#004400');
        } else if(killerSkin === 'skin_void') {
            // Vazio: Preto total
            bodyGrad.addColorStop(0, '#111111');
            bodyGrad.addColorStop(1, '#000000');
        } else if(killerSkin === 'skin_phantom_gold') {
            // Ouro Fantasma: Dourado brilhante
            bodyGrad.addColorStop(0, '#FFFACD');
            bodyGrad.addColorStop(0.5, '#FFD700');
            bodyGrad.addColorStop(1, '#B8860B');
        } else {
            // Default/Old skin_blood logic fallback
            bodyGrad.addColorStop(0, '#C0C040'); // Sickly core
            bodyGrad.addColorStop(0.7, '#A0A020'); // Dirty yellow
            bodyGrad.addColorStop(1, '#605010'); // Dark edge
        }
    } else {
        // VULNERABLE STATE: Bright Blue
        bodyGrad.addColorStop(0, '#00FFFF'); // Cyan core
        bodyGrad.addColorStop(0.7, '#0000FF'); // Blue body
        bodyGrad.addColorStop(1, '#000044'); // Dark blue edge
    }
    
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r, m * Math.PI, (2 - m) * Math.PI);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();

    // 2. Veins/Gore on skin
    ctx.strokeStyle = isPowerModeActive ? 'rgba(0, 255, 255, 0.4)' : 'rgba(100, 0, 0, 0.4)';
    ctx.lineWidth = 1;
    for(let i=0; i<3; i++) {
        ctx.beginPath();
        ctx.moveTo(-r*0.5, -r*0.2);
        ctx.bezierCurveTo(-r*0.2, -r*0.8, r*0.2, -r*0.4, r*0.6, -r*0.7);
        ctx.stroke();
    }

    // 3. Mouth Interior
    ctx.fillStyle = isPowerModeActive ? '#000040' : '#400000'; 
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.arc(0,0, r*0.95, m*Math.PI, (2-m)*Math.PI, true);
    ctx.closePath();
    ctx.fill();

    // 4. Irregular Teeth (White but blueish if power mode)
    ctx.fillStyle = isPowerModeActive ? '#A0FFFF' : '#E0E0E0';
    const toothCount = 6;
    // Top Row
    for(let i=1; i<=toothCount; i++){
      const toothAng = m * Math.PI + (i / (toothCount + 1)) * (0.9);
      const tw = r * 0.08;
      const th = r * (0.2 + Math.random() * 0.2); // irregular length
      
      ctx.save();
      ctx.rotate(toothAng);
      ctx.beginPath();
      ctx.moveTo(r * 0.7, -tw);
      ctx.lineTo(r * (0.7 + th/r), 0);
      ctx.lineTo(r * 0.7, tw);
      ctx.fill();
      ctx.restore();
    }
    // Bottom Row
    for(let i=1; i<=toothCount; i++){
      const toothAng = (2 - m) * Math.PI - (i / (toothCount + 1)) * (0.9);
      const tw = r * 0.08;
      const th = r * (0.2 + Math.random() * 0.2);
      
      ctx.save();
      ctx.rotate(toothAng);
      ctx.beginPath();
      ctx.moveTo(r * 0.7, -tw);
      ctx.lineTo(r * (0.7 + th/r), 0);
      ctx.lineTo(r * 0.7, tw);
      ctx.fill();
      ctx.restore();
    }

    // 5. THE BIZARRE EYE (The center of horror)
    // It should NOT rotate with the body, it stares forward or at player
    ctx.restore(); // Exit rotation
    ctx.save();
    ctx.translate(x + jitter, y + jitter);
    
    const eyeX = -r * 0.1, eyeY = -r * 0.5;
    const eyeSize = r * 0.35 + (Math.random() * 2 * proximity);
    
    // Sclera (Bloodshot white usually)
    let scleraColor = '#FFF0F0';
    if(killerSkin === 'skin_observer') scleraColor = '#FFFFFF';
    if(killerSkin === 'skin_phantom_gold') scleraColor = '#FFFFCC';
    
    ctx.fillStyle = scleraColor;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeSize, 0, Math.PI * 2);
    ctx.fill();
    
    // Blood vessels in eye (Except for some skins)
    if(killerSkin !== 'skin_phantom_gold' && killerSkin !== 'skin_void') {
        ctx.strokeStyle = killerSkin === 'skin_toxic_glitch' ? 'rgba(0, 200, 0, 0.6)' : 'rgba(200, 0, 0, 0.6)';
        ctx.lineWidth = 0.5;
        for(let i=0; i<6; i++) {
            const a = Math.random() * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(eyeX, eyeY);
            ctx.lineTo(eyeX + Math.cos(a)*eyeSize, eyeY + Math.sin(a)*eyeSize);
            ctx.stroke();
        }
    }
    
    // Pupil (Realistic and small)
    ctx.fillStyle = (killerSkin === 'skin_void') ? '#111111' : '#000000';
    // Pupil jitters/dilates
    const pupilSize = eyeSize * (0.3 + Math.random() * 0.2 * proximity);
    ctx.beginPath();
    ctx.arc(eyeX + (Math.random()-0.5)*2, eyeY + (Math.random()-0.5)*2, pupilSize, 0, Math.PI * 2);
    ctx.fill();
    
    // Pupil glow
    let glowColor = 'rgba(255, 0, 0, 0.8)'; // Default Red
    if(isPowerModeActive) glowColor = 'rgba(0, 255, 255, 0.8)';
    else if(killerSkin === 'skin_toxic_glitch') glowColor = 'rgba(0, 255, 0, 0.8)';
    else if(killerSkin === 'skin_phantom_gold') glowColor = 'rgba(255, 215, 0, 0.8)';
    else if(killerSkin === 'skin_observer') glowColor = 'rgba(255, 255, 255, 0.9)';
    else if(killerSkin === 'skin_void') glowColor = 'rgba(50, 50, 50, 0.5)';
    
    ctx.fillStyle = glowColor;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, pupilSize * 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // 6. Proximity Distortion / Aura
    if(proximity > 0.2){
       ctx.save();
       ctx.translate(x, y);
       ctx.globalCompositeOperation = 'screen';
       const aura = ctx.createRadialGradient(0, 0, r, 0, 0, r * (2 + proximity));
       let auraCol = isPowerModeActive ? '0, 255, 255' : '255, 0, 0';
       if(!isPowerModeActive) {
           if(killerSkin === 'skin_toxic_glitch') auraCol = '0, 255, 0';
           if(killerSkin === 'skin_phantom_gold') auraCol = '255, 215, 0';
           if(killerSkin === 'skin_observer') auraCol = '200, 200, 200';
           if(killerSkin === 'skin_void') auraCol = '20, 20, 20';
       }
       aura.addColorStop(0, `rgba(${auraCol}, ${0.4 * proximity})`);
       aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
       ctx.fillStyle = aura;
       ctx.fillRect(-r*4, -r*4, r*8, r*8);
       ctx.restore();
       
       // Glitch scanline offset occasionally
       if(Math.random() < 0.1 * proximity) {
           ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
           ctx.fillRect(x - r*2, y + (Math.random()-0.5)*r*2, r*4, 2);
       }
    }
  }

  function _drawDarkness(offsetX, offsetY){
    if(window.AdminState && window.AdminState.revealMap) return;
    const pPos = Player.getPos();
    let px = pPos.x + offsetX, py = pPos.y + offsetY;
    const pDir = Player.getDir();
    const flicker = Player.getFlicker();

    let angleBase = 0;
    if(pDir.name==='right') angleBase = 0;
    if(pDir.name==='down')  angleBase = Math.PI/2;
    if(pDir.name==='left')  angleBase = Math.PI;
    if(pDir.name==='up')    angleBase = -Math.PI/2;
    angleBase += Player.getAngle();

    // Create a rect covering whole screen with darkness
    ctx.fillStyle = '#000000';
    
    // We punch a hole using 'destination-out'
    // Draw darkness as a solid block first, to an offscreen canvas
    // Or simpler: composite over main canvas, using radial gradients.
    // Actually, drawing black with globalCompositeOperation = 'source-over' but we only want to leave the light transparent.
    // It is easiest to use a path with arc/lines, then 'rect/rect' with fillRule 'evenodd', or composite.
    
    const darkCanvas = document.createElement('canvas'); // we can cache this size
    darkCanvas.width = canvas.width; darkCanvas.height = canvas.height;
    const dx = darkCanvas.getContext('2d');
    
    dx.fillStyle = '#000000'; // Base absolute dark
    dx.fillRect(0,0,darkCanvas.width,darkCanvas.height);
    
    // Cut out light
    dx.globalCompositeOperation = 'destination-out';
    
    const radius = Math.max(window.innerWidth, window.innerHeight);
    const lightDist = TILE * 6 * flicker;
    const spread = Math.PI / 4.0;
    
    if(flicker > 0){
      const grad = dx.createRadialGradient(px,py,TILE, px,py,lightDist);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.8, 'rgba(255,255,255,0.7)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      
      dx.fillStyle = grad;
      dx.beginPath();
      dx.moveTo(px,py);
      dx.arc(px,py,lightDist, angleBase-spread, angleBase+spread);
      dx.closePath();
      dx.fill();
    }
    
    // Ambient minimal glow so player isn't completely blind
    const amb = dx.createRadialGradient(px,py,0, px,py,TILE*2.5);
    amb.addColorStop(0, 'rgba(255,255,255,0.8)');
    amb.addColorStop(1, 'rgba(255,255,255,0)');
    dx.fillStyle=amb;
    dx.beginPath(); dx.arc(px,py,TILE*2.5,0,Math.PI*2); dx.fill();

    // Draw the darkness layer over the main screen
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(darkCanvas, 0, 0);
  }

  function _drawKillerVision(offsetX, offsetY){
    const ePos = Entity.getPos();
    let ex = ePos.x + offsetX, ey = ePos.y + offsetY;
    const eDir = Entity.getDir();
    
    // Create darkness centered on Entity
    const darkCanvas = document.createElement('canvas');
    darkCanvas.width = canvas.width; darkCanvas.height = canvas.height;
    const dx = darkCanvas.getContext('2d');
    
    dx.fillStyle = '#000000';
    dx.fillRect(0,0,darkCanvas.width,darkCanvas.height);
    
    dx.globalCompositeOperation = 'destination-out';
    
    const lightDist = TILE * 5; // Assassin has slightly smaller vision than flashlight
    const spread = Math.PI * 2; // Assassin sees all around but limited distance
    
    const grad = dx.createRadialGradient(ex,ey,TILE, ex,ey,lightDist);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.7, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    
    dx.fillStyle = grad;
    dx.beginPath();
    dx.arc(ex,ey,lightDist, 0, Math.PI*2);
    dx.fill();
    
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(darkCanvas, 0, 0);

    // Tint red for killer feel
    ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
    ctx.fillRect(0,0,canvas.width,canvas.height);

    // Render innocent flashlight beam REMOVIDO para que o Assassino não veja a luz do Inocente

    // Banshee Silhouette Vision
    if(window.activeKillerClass === 'BANSHEE' && window.opponentSanity !== undefined && window.opponentSanity < 40) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.6;
        _drawGhost(px, py, true); // True flag for silhouette mode
        ctx.restore();
    }
  }

  function _drawGhost(x, y, isSilhouette = false, myRole = null){
    const r = TILE*0.6;
    const isPower = window.isPowerModeActive;
    
    const innocentSkin = (myRole === 'INNOCENT') ? window.activeInnocentSkin : window.opponentInnocentSkin;
    
    let baseColor = '#FF0000'; // Default Innocent Color (Reddish Ghost)
    if (isPower) baseColor = '#FFFF00';
    else {
        if (innocentSkin === 'skin_observer') baseColor = '#AAAAAA';
        else if (innocentSkin === 'skin_toxic_glitch') baseColor = '#00FFFF';
    }

    ctx.fillStyle = isSilhouette ? '#FF0000' : baseColor; 
    
    // Pulse effect for silhouette or specific skins
    if(isSilhouette || (innocentSkin === 'skin_toxic_glitch' && !isPower)) {
        const pulse = 0.8 + 0.2 * Math.sin(Date.now() / 150);
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(pulse, pulse);
        ctx.translate(-x, -y);
        ctx.shadowColor = isSilhouette ? '#FF0000' : '#00FFFF';
        ctx.shadowBlur = 15;
    }

    ctx.beginPath();
    ctx.arc(x,y-r*0.2,r,Math.PI,0);
    ctx.lineTo(x+r,y+r);
    // wavy bottom
    ctx.lineTo(x+r/2,y+r-4);
    ctx.lineTo(x,y+r);
    ctx.lineTo(x-r/2,y+r-4);
    ctx.lineTo(x-r,y+r);
    ctx.closePath();
    ctx.fill();

    if(isSilhouette || (innocentSkin === 'skin_toxic_glitch' && !isPower)) {
        ctx.restore();
    }

    // Eyes
    if(!isSilhouette) {
        ctx.fillStyle = (innocentSkin === 'skin_observer') ? '#FFFFFF' : 'white';
        ctx.beginPath(); ctx.arc(x-r/3,y-r/3,r/3.5,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(x+r/3,y-r/3,r/3.5,0,Math.PI*2); ctx.fill();
        
        ctx.fillStyle = (innocentSkin === 'skin_observer') ? '#333333' : 'blue';
        ctx.beginPath(); ctx.arc(x-r/3,y-r/3,r/6,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(x+r/3,y-r/3,r/6,0,Math.PI*2); ctx.fill();
    }
  }

  return { init, preRenderMaze, renderAll };
})();
