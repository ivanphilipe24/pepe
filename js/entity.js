/**
 * ANTIGRAVITY — entity.js
 * The Entity (monstrous Pac-Man) — AI, movement, blood trail.
 */

const Entity = (() => {
  const DIRS = [
    {name:'up',   dr:-1,dc:0},
    {name:'down', dr:1, dc:0},
    {name:'left', dr:0, dc:-1},
    {name:'right',dr:0, dc:1},
  ];

  let row,col,targetRow,targetCol;
  let x,y;                         // pixel
  let dir;                         // current facing {name,dr,dc}
  let speed;                       // tiles/sec
  let moving;
  let pathInterval;
  let bloodTrail;                  // Set of "r,c"
  let mouthPhase;                  // 0-1 for animation
  let active;
  let chasing;                     // is actively chasing the player?
  let scatterTarget;

  let manualNextDir = {name:'',dr:0,dc:0};
  let manualDir = {name:'',dr:0,dc:0};
  let freezeTimer = 0; // Temporizador para o congelamento post-defeat
  let teleportEffectTimer = 0; // Para brilho visual pós-teleporte

  document.addEventListener('keydown', (e) => {
      switch(e.code){
          case 'KeyW': case 'ArrowUp':    manualNextDir={name:'up',dr:-1,dc:0}; break;
          case 'KeyS': case 'ArrowDown':  manualNextDir={name:'down',dr:1,dc:0}; break;
          case 'KeyA': case 'ArrowLeft':  manualNextDir={name:'left',dr:0,dc:-1}; break;
          case 'KeyD': case 'ArrowRight': manualNextDir={name:'right',dr:0,dc:1}; break;
      }
  });

  /* ── level settings ─────────────────────────────── */
  const LEVEL_PATH_IV = [1.8, 1.4, 1.0, 0.6, 1.2, 0.4];

  function init(level){
    const lvl = Math.min(level, LEVEL_PATH_IV.length-1);
    
    // Ponto de spawn dinâmico para a Entidade
    let sr = 1, sc = 1;
    if(!GameMap.walkable(sr, sc, false)) {
        outer: for(let r=1; r<GameMap.ROWS-1; r++) {
            for(let c=1; c<GameMap.COLS-1; c++) {
                if(GameMap.walkable(r, c, false)) {
                    sr = r; sc = c;
                    break outer;
                }
            }
        }
    }

    row=sr; col=sc;
    targetRow=row; targetCol=col;
    x=col*GameMap.TILE+GameMap.TILE/2;
    y=row*GameMap.TILE+GameMap.TILE/2;
    dir=DIRS[1]; // down
    
    // Aumenta a velocidade base (2.2) em 10% a cada fase (level)
    speed = 2.2 * Math.pow(1.10, level);
    
    // STALKER é 20% mais lento
    if(window.activeKillerClass === 'STALKER') speed *= 0.8;

    pathInterval = LEVEL_PATH_IV[lvl];
    pathTimer=0;
    moving=false;
    mouthPhase=0;
    bloodTrail=new Set();
    active=false;
    chasing=false;
    scatterTarget={r:1,c:26};
  }

  function activate(){ active=true; }

  function update(dt, playerRow, playerCol){
    if(!active) return;
    if(freezeTimer > 0){
        freezeTimer -= dt;
    }
    if(teleportEffectTimer > 0) {
        teleportEffectTimer -= dt;
    }
    if(freezeTimer > 0 && !moving) return; // Só para se estiver congelado E parado
    mouthPhase = (mouthPhase + dt * 6) % 2; // 0→1→2 cycle

    pathTimer += dt;

    if(!moving){
      // choose next tile
      if(pathTimer >= pathInterval){
        pathTimer = 0;
        _chooseTarget(playerRow, playerCol);
      }
      _tryMove(playerRow, playerCol);
    }

    if(moving){
      const tx = targetCol*GameMap.TILE+GameMap.TILE/2;
      const ty = targetRow*GameMap.TILE+GameMap.TILE/2;
      const dx = tx-x, dy = ty-y;
      const dist = Math.sqrt(dx*dx+dy*dy);
      const step = speed * GameMap.TILE * dt;

      if(dist <= step){
        x=tx; y=ty; row=targetRow; col=targetCol;
        moving=false;
        // blood
        bloodTrail.add(row+','+col);
        // tunnel
        const wrap = GameMap.wrapTunnel(row,col);
        if(wrap){ row=wrap.r; col=wrap.c; x=col*GameMap.TILE+GameMap.TILE/2; y=row*GameMap.TILE+GameMap.TILE/2; }
      } else {
        x += (dx/dist)*step;
        y += (dy/dist)*step;
      }
    }
  }

  function _chooseTarget(pr,pc){
    // Direct chase toward player
    const path = GameMap.findPath(row,col,pr,pc,false);
    if(path && path.length>0){
      chasing=true;
    } else {
      chasing=false;
      // scatter to random tile
      scatterTarget = GameMap.randomOpenTile(row,col,3);
    }
  }

  function _tryMove(pr,pc){
    let bestDir=null, bestDist=Infinity;
    let target;

    if(chasing){
      target={r:pr,c:pc};
    } else {
      target=scatterTarget;
    }

    // For direct path chase, use BFS first step
    if(chasing){
      const path = GameMap.findPath(row,col,pr,pc,false);
      if(path && path.length>0){
        const next=path[0];
        targetRow=next.r; targetCol=next.c;
        _setDirFromTarget();
        moving=true;
        return;
      }
    }

    // Fallback: greedy toward target
    for(const d of DIRS){
      const nr=row+d.dr;
      let nc=col+d.dc;
      if(nc<0) nc=GameMap.COLS-1; if(nc>=GameMap.COLS) nc=0;
      if(!GameMap.walkable(nr,nc,false)) continue;
      // don't reverse
      if(dir && d.dr===-dir.dr && d.dc===-dir.dc) continue;
      const dist = Math.abs(nr-target.r)+Math.abs(nc-target.c);
      if(dist<bestDist){ bestDist=dist; bestDir=d; }
    }
    if(bestDir){
      targetRow=row+bestDir.dr;
      targetCol=col+bestDir.dc;
      if(targetCol<0) targetCol=GameMap.COLS-1;
      if(targetCol>=GameMap.COLS) targetCol=0;
      dir=bestDir;
      moving=true;
    }
  }

  function _setDirFromTarget(){
    const dr=targetRow-row, dc=targetCol-col;
    for(const d of DIRS){
      if(d.dr===dr&&d.dc===dc){ dir=d; return; }
    }
  }

  function _canMove(d){
    if(d.dr===0&&d.dc===0) return false;
    let nr=row+d.dr, nc=col+d.dc;
    if(nc<0) nc=GameMap.COLS-1; if(nc>=GameMap.COLS) nc=0;
    return GameMap.walkable(nr,nc,true);
  }

  function updateManual(dt) {
      if(!active) return;
      if(freezeTimer > 0) {
          freezeTimer -= dt;
          return;
      }
      if(!moving){
          if(_canMove(manualNextDir)) manualDir = manualNextDir;
          if(manualDir.dr!==0 || manualDir.dc!==0){
              if(_canMove(manualDir)){
                  targetRow = row+manualDir.dr;
                  targetCol = col+manualDir.dc;
                  if(targetCol<0) targetCol = GameMap.COLS-1;
                  if(targetCol>=GameMap.COLS) targetCol = 0;
                  dir = manualDir;
                  moving = true;
              }
          }
      }

      if(moving){
          const tx = targetCol*GameMap.TILE+GameMap.TILE/2;
          const ty = targetRow*GameMap.TILE+GameMap.TILE/2;
          const dx=tx-x, dy=ty-y;
          const dist = Math.sqrt(dx*dx+dy*dy);
          const step = speed * 1.5 * GameMap.TILE * dt; // Killer is 50% faster in MP

          if(dist <= step){
              x=tx; y=ty; row=targetRow; col=targetCol;
              moving=false;
              bloodTrail.add(row+','+col);
              const wrap = GameMap.wrapTunnel(row,col);
              if(wrap){ row=wrap.r; col=wrap.c; x=col*GameMap.TILE+GameMap.TILE/2; y=row*GameMap.TILE+GameMap.TILE/2; }
          } else {
              x += (dx/dist)*step;
              y += (dy/dist)*step;
          }
      }
  }

  function forcePos(fx, fy, frow, fcol, fdir, fmouth) {
      x = fx; y = fy; row = frow; col = fcol;
      targetRow = frow; targetCol = fcol;
      moving = false;
      if(fdir) dir = fdir;
      if(fmouth !== undefined) mouthPhase = fmouth;
  }

  function forceHunting(pr, pc) {
      if(!active || freezeTimer > 0) return;
      chasing = true;
      pathTimer = pathInterval; // Força recálculo no próximo frame
      scatterTarget = {r: pr, c: pc}; // Garante que o fallback também aponte para o jogador
  }

  function freeze(ms) {
      freezeTimer = ms / 1000;
      teleportEffectTimer = 2.0; // 2 segundos de brilho
  }

  function calculateDash(blocks) {
      if(!active) return null;
      let r = row, c = col;
      // Procura o tile mais distante (até blocks) que seja "walkable",
      // permitindo pular paredes (atravessar paredes finas)
      for(let i = blocks; i >= 1; i--) {
          let tr = row + dir.dr * i;
          let tc = col + dir.dc * i;
          
          if(tc < 0) tc += GameMap.COLS;
          if(tc >= GameMap.COLS) tc -= GameMap.COLS;
          if(tr < 0 || tr >= GameMap.ROWS) continue; // Out of bounds vertical
          
          if(GameMap.walkable(tr, tc, false)) {
              return { 
                  r: tr, 
                  c: tc, 
                  x: tc * GameMap.TILE + GameMap.TILE / 2, 
                  y: tr * GameMap.TILE + GameMap.TILE / 2 
              };
          }
      }
      return null;
  }

  function animateMouth(dt) {
      mouthPhase = (mouthPhase + dt * 6) % 2;
  }

  /* ── getters ────────────────────────────────────── */
  function getPos(){ return {row,col,x,y}; }
  function getDir(){ return dir; }
  function getMouth(){ return Math.abs(mouthPhase-1); } // 0→1→0
  function getBlood(){ return bloodTrail; }
  function isFrozen() { return freezeTimer > 0; }
  function isTeleporting() { return teleportEffectTimer > 0; }
  function isActive(){ return active; }

  function syncPixels() {
      x = col * GameMap.TILE + GameMap.TILE / 2;
      y = row * GameMap.TILE + GameMap.TILE / 2;
  }

  return { init,activate,update,getPos,getDir,getMouth,getBlood,isActive, forcePos, updateManual, animateMouth, freeze, isFrozen, isTeleporting, syncPixels, forceHunting, calculateDash };
})();
