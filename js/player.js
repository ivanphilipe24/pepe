/**
 * ANTIGRAVITY — player.js
 * The Ghost protagonist: movement, flashlight, and dot collection.
 */

const Player = (() => {
  const SPEED = 4.0; // tiles/sec
  
  let row, col, x, y;
  let targetRow, targetCol;
  let moving;
  let dir = {name:'',dr:0,dc:0}, nextDir = {name:'',dr:0,dc:0};
  let flashlightFlicker = 1.0;
  let flashlightAngle = 0; // rotation offset
  
  const keys = { w:false, a:false, s:false, d:false };

  function init(){
    // Encontrar um ponto de spawn válido próximo ao centro
    let sr = 14, sc = 14;
    if(!GameMap.walkable(sr, sc, true)) {
        outer: for(let dist=1; dist<15; dist++) {
            for(let r=sr-dist; r<=sr+dist; r++) {
                for(let c=sc-dist; c<=sc+dist; c++) {
                    if(GameMap.walkable(r, c, true)) {
                        sr = r; sc = c;
                        break outer;
                    }
                }
            }
        }
    }
    
    row=sr; col=sc; x=col*GameMap.TILE+GameMap.TILE/2; y=row*GameMap.TILE+GameMap.TILE/2;
    targetRow=row; targetCol=col;
    moving=false;
    dir={name:'',dr:0,dc:0}; nextDir={name:'',dr:0,dc:0};
    
    document.addEventListener('keydown', _onKey);
    document.addEventListener('keyup', _onKey);
  }

  function _onKey(e){
    const h = e.type==='keydown';
    switch(e.code){
      case 'KeyW': case 'ArrowUp':    setDirection('up', h); break;
      case 'KeyS': case 'ArrowDown':  setDirection('down', h); break;
      case 'KeyA': case 'ArrowLeft':  setDirection('left', h); break;
      case 'KeyD': case 'ArrowRight': setDirection('right', h); break;
    }
  }

  function setDirection(dirName, isDown) {
    if (dirName === 'up')    { keys.w=isDown; if(isDown) nextDir={name:'up',   dr:-1, dc:0}; }
    if (dirName === 'down')  { keys.s=isDown; if(isDown) nextDir={name:'down', dr:1,  dc:0}; }
    if (dirName === 'left')  { keys.a=isDown; if(isDown) nextDir={name:'left', dr:0, dc:-1}; }
    if (dirName === 'right') { keys.d=isDown; if(isDown) nextDir={name:'right',dr:0,  dc:1}; }
  }

  function update(dt, isFlickerLevel){
    // Flicker logic
    if(isFlickerLevel){
      if(Math.random()<0.05) flashlightFlicker = Math.random()>0.5 ? 0 : 1;
      else flashlightFlicker = 1.0;
    } else { flashlightFlicker = 1.0; }
    
    // Slight jitter in angle for panic feel
    flashlightAngle = (Math.random()-0.5)*0.1;

    // Movement
    if(!moving){
      const canTurn = _canMove(nextDir);
      if(canTurn) dir = nextDir;
      
      if(dir.dr!==0 || dir.dc!==0){
        if(_canMove(dir)){
          targetRow = row+dir.dr;
          targetCol = col+dir.dc;
          if(targetCol<0) targetCol = GameMap.COLS-1;
          if(targetCol>=GameMap.COLS) targetCol = 0;
          moving = true;
        }
      }
    }

    if(moving){
      const tx = targetCol*GameMap.TILE+GameMap.TILE/2;
      const ty = targetRow*GameMap.TILE+GameMap.TILE/2;
      const dx=tx-x, dy=ty-y;
      const dist = Math.sqrt(dx*dx+dy*dy);
      const step = SPEED * GameMap.TILE * dt * (window.AdminState ? window.AdminState.speedMult : 1.0);

      if(dist <= step){
        // Arrived at tile
        x=tx; y=ty; row=targetRow; col=targetCol;
        moving=false;
        
        // Wrap tunnel
        const wrap = GameMap.wrapTunnel(row,col);
        if(wrap){ 
          row=wrap.r; col=wrap.c; 
          x=col*GameMap.TILE+GameMap.TILE/2; 
          y=row*GameMap.TILE+GameMap.TILE/2; 
        }
        
        // Collect dot
        const pts = GameMap.collectDot(row, col);
        if(pts>0){
          Audio.playCollect();
          return pts;
        }
      } else {
        x += (dx/dist)*step;
        y += (dy/dist)*step;
        Audio.playStep(true);
      }
    }
    if(!moving) Audio.stopSteps();
    return 0;
  }

  function _canMove(d){
    if(d.dr===0&&d.dc===0) return false;
    let nr=row+d.dr, nc=col+d.dc;
    if(nc<0) nc=GameMap.COLS-1; if(nc>=GameMap.COLS) nc=0;
    return GameMap.walkable(nr,nc,true);
  }

  function forcePos(fx, fy, frow, fcol, fdir, fangle, fflicker) {
    x = fx; y = fy; row = frow; col = fcol;
    if(fdir) dir = fdir;
    if(fangle !== undefined) flashlightAngle = fangle;
    if(fflicker !== undefined) flashlightFlicker = fflicker;
  }

  function syncPixels() {
    x = col * GameMap.TILE + GameMap.TILE / 2;
    y = row * GameMap.TILE + GameMap.TILE / 2;
  }

  return { init, update, getPos:()=>({row,col,x,y}), getDir:()=>dir, getFlicker:()=>flashlightFlicker, getAngle:()=>flashlightAngle, setDirection, forcePos, syncPixels };
})();
