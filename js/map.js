/**
 * ANTIGRAVITY — map.js
 * Classic Pac-Man maze data + collision / pathfinding utilities.
 *
 * Tile legend:
 *   0 = Wall   1 = Dot path   2 = Empty path   3 = Power pellet
 *   4 = Ghost-house interior   5 = Ghost-house door
 *   7 = Tunnel   8 = Outside (void)
 */

const GameMap = (() => {
  let COLS = 28;
  let ROWS = 31;
  const TILE = 24;

  // Tile constants
  const W = 0, D = 1, E = 2, P = 3, G = 4, DR = 5, T = 7, O = 8;

  // Classic Pac-Man maze (28 × 31)
  
  
  
  // MAP_1: O clássico 28x31
  const MAP_1 = [
      [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
      [W,D,D,D,D,D,D,D,D,D,D,D,D,W,W,D,D,D,D,D,D,D,D,D,D,D,D,W],
      [W,D,W,W,W,W,D,W,W,W,W,W,D,W,W,D,W,W,W,W,W,D,W,W,W,W,D,W],
      [W,P,W,W,W,W,D,W,W,W,W,W,D,W,W,D,W,W,W,W,W,D,W,W,W,W,P,W],
      [W,D,W,W,W,W,D,W,W,W,W,W,D,W,W,D,W,W,W,W,W,D,W,W,W,W,D,W],
      [W,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,W],
      [W,D,W,W,W,W,D,W,W,D,W,W,W,W,W,W,W,W,D,W,W,D,W,W,W,W,D,W],
      [W,D,D,D,D,D,D,W,W,D,D,D,D,W,W,D,D,D,D,W,W,D,D,D,D,D,D,W],
      [W,W,W,W,W,W,D,W,W,W,W,W,E,W,W,E,W,W,W,W,W,D,W,W,W,W,W,W],
      [O,O,O,O,O,W,D,W,W,W,W,W,E,W,W,E,W,W,W,W,W,D,W,O,O,O,O,O],
      [O,O,O,O,O,W,D,W,W,E,E,E,E,E,E,E,E,E,E,W,W,D,W,O,O,O,O,O],
      [O,O,O,O,O,W,D,W,W,E,W,W,W,DR,DR,W,W,W,E,W,W,D,W,O,O,O,O,O],
      [W,W,W,W,W,W,D,W,W,E,W,G,G,G,G,G,G,W,E,W,W,D,W,W,W,W,W,W],
      [T,E,E,E,E,E,D,E,E,E,W,G,G,G,G,G,G,W,E,E,E,D,E,E,E,E,E,T],
      [W,W,W,W,W,W,D,W,W,E,W,G,G,G,G,G,G,W,E,W,W,D,W,W,W,W,W,W],
      [O,O,O,O,O,W,D,W,W,E,W,W,W,W,W,W,W,W,E,W,W,D,W,O,O,O,O,O],
      [O,O,O,O,O,W,D,W,W,E,E,E,E,E,E,E,E,E,E,W,W,D,W,O,O,O,O,O],
      [O,O,O,O,O,W,D,W,W,E,W,W,W,W,W,W,W,W,E,W,W,D,W,O,O,O,O,O],
      [W,W,W,W,W,W,D,W,W,E,W,W,W,W,W,W,W,W,E,W,W,D,W,W,W,W,W,W],
      [W,D,D,D,D,D,D,D,D,D,D,D,D,W,W,D,D,D,D,D,D,D,D,D,D,D,D,W],
      [W,D,W,W,W,W,D,W,W,W,W,W,D,W,W,D,W,W,W,W,W,D,W,W,W,W,D,W],
      [W,P,D,D,W,W,D,D,D,D,D,D,D,E,E,D,D,D,D,D,D,D,W,W,D,D,P,W],
      [W,W,W,D,W,W,D,W,W,D,W,W,W,W,W,W,W,W,D,W,W,D,W,W,D,W,W,W],
      [W,D,D,D,D,D,D,W,W,D,D,D,D,W,W,D,D,D,D,W,W,D,D,D,D,D,D,W],
      [W,D,W,W,W,W,W,W,W,W,W,W,D,W,W,D,W,W,W,W,W,W,W,W,W,W,D,W],
      [W,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,W],
      [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
      [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
      [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
      [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
      [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
  ];
  
  // MAP_2: Narrow/Vertical 17x25
  const MAP_2 = [
    [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,D,D,D,D,D,W,W,D,D,D,D,D,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,D,W,W,W,D,W,W,D,W,W,W,D,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,P,W,W,W,D,W,W,D,W,W,W,P,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,D,D,D,D,D,D,D,D,D,D,D,D,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,D,W,W,D,W,W,W,W,W,D,W,D,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,D,D,D,D,D,W,W,D,D,D,D,D,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,W,W,W,D,D,W,W,D,D,W,W,W,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,W,W,W,D,E,W,W,E,D,W,W,W,W,W,W,W,W,W,W,W],
    [O,O,O,O,O,O,O,O,O,O,W,D,E,W,W,E,D,W,O,O,O,O,O,O,O,O,O,O],
    [O,O,O,O,O,O,O,O,O,O,W,D,E,E,E,E,D,W,O,O,O,O,O,O,O,O,O,O],
    [O,O,O,O,O,O,O,O,O,O,W,D,W,DR,DR,W,D,W,O,O,O,O,O,O,O,O,O,O],
    [W,W,W,W,W,W,W,W,W,W,W,D,W,G,G,W,D,W,W,W,W,W,W,W,W,W,W,W],
    [T,E,E,E,E,E,E,E,E,E,D,E,W,G,G,W,E,D,E,E,E,E,E,E,E,E,E,T],
    [W,W,W,W,W,W,W,W,W,W,W,D,W,G,G,W,D,W,W,W,W,W,W,W,W,W,W,W],
    [O,O,O,O,O,O,O,O,O,O,W,D,W,W,W,W,D,W,O,O,O,O,O,O,O,O,O,O],
    [O,O,O,O,O,O,O,O,O,O,W,D,E,E,E,E,D,W,O,O,O,O,O,O,O,O,O,O],
    [O,O,O,O,O,O,O,O,O,O,W,D,W,W,W,W,D,W,O,O,O,O,O,O,O,O,O,O],
    [W,W,W,W,W,W,W,W,W,W,W,D,W,W,W,W,D,W,W,W,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,D,D,D,D,D,W,W,D,D,D,D,D,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,D,W,W,W,D,W,W,D,W,W,W,D,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,P,D,D,W,D,E,E,D,W,D,D,P,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,W,W,D,W,D,W,W,D,W,D,W,W,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,D,D,D,D,D,W,W,D,D,D,D,D,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,D,W,W,W,W,W,W,W,W,W,W,D,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,D,D,D,D,D,D,D,D,D,D,D,D,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
];
  
  // MAP_3: Corredores cegos 15x29 (Even more vertical)
  const MAP_3 = [
    [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,W,W,D,D,D,W,W,D,D,D,W,W,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,W,W,D,W,D,W,W,D,W,D,W,W,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,W,W,D,W,D,D,D,D,W,D,W,W,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,W,W,P,W,W,W,W,W,W,P,W,W,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,W,W,D,D,D,D,D,D,D,D,W,W,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,W,W,D,W,W,D,W,W,D,W,W,W,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,W,W,D,W,W,D,W,W,D,W,W,W,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,W,W,D,W,D,D,D,D,D,W,W,W,W,W,W,W,W,W,W,W],
    [O,O,O,O,O,O,O,O,O,O,D,W,E,W,W,E,W,D,O,O,O,O,O,O,O,O,O,O],
    [W,W,W,W,W,W,W,W,W,W,D,E,E,DR,DR,E,E,D,W,W,W,W,W,W,W,W,W],
    [T,E,E,E,E,E,E,E,E,E,D,E,W,G,G,W,E,D,E,E,E,E,E,E,E,E,E,T],
    [W,W,W,W,W,W,W,W,W,W,D,E,W,G,G,W,E,D,W,W,W,W,W,W,W,W,W,W],
    [O,O,O,O,O,O,O,O,O,O,D,W,W,W,W,W,W,D,O,O,O,O,O,O,O,O,O,O],
    [O,O,O,O,O,O,O,O,O,O,D,D,D,D,D,D,D,D,O,O,O,O,O,O,O,O,O,O],
    [W,W,W,W,W,W,W,W,W,W,D,W,W,W,W,W,W,D,W,W,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,W,W,D,D,D,D,D,D,D,D,W,W,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,W,W,D,W,W,W,D,W,W,D,W,W,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,W,W,P,D,D,D,D,D,D,P,W,W,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,W,W,W,D,W,W,D,W,D,W,W,W,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,W,W,D,D,D,D,D,D,D,D,W,W,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,W,W,W,W,D,W,W,D,W,W,W,W,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,W,W,W,W,D,W,W,D,W,W,W,W,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,W,W,W,W,D,W,W,D,W,W,W,W,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,W,W,W,W,D,D,D,D,W,W,W,W,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
    [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
];
  
  // MAP_4: A Fome 28x25
  const MAP_4 = [
      [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
      [W,D,D,D,D,D,D,D,D,D,D,D,D,W,W,D,D,D,D,D,D,D,D,D,D,D,D,W],
      [W,D,W,W,W,D,W,W,W,W,W,W,D,W,W,D,W,W,W,W,W,W,D,W,W,W,D,W],
      [W,P,W,W,W,D,W,W,W,W,W,W,D,D,D,D,W,W,W,W,W,W,D,W,W,W,P,W],
      [W,D,D,D,D,D,D,D,D,D,D,D,D,W,W,D,D,D,D,D,D,D,D,D,D,D,D,W],
      [W,D,W,W,W,D,W,W,D,W,W,W,W,W,W,W,W,W,W,D,W,W,D,W,W,W,D,W],
      [W,D,W,W,W,D,W,W,D,D,D,D,D,W,W,D,D,D,D,D,W,W,D,W,W,W,D,W],
      [W,D,D,D,D,D,W,W,W,W,W,W,D,W,W,D,W,W,W,W,W,W,D,D,D,D,D,W],
      [W,W,W,W,W,D,W,W,W,W,W,W,D,W,W,D,W,W,W,W,W,W,D,W,W,W,W,W],
      [O,O,O,O,W,D,D,D,D,D,D,D,D,E,E,D,D,D,D,D,D,D,D,W,O,O,O,O],
      [O,O,O,O,W,D,W,W,W,W,E,W,W,DR,DR,W,W,E,W,W,W,W,D,W,O,O,O,O],
      [W,W,W,W,W,D,W,W,W,W,E,W,G,G,G,G,W,E,W,W,W,W,D,W,W,W,W,W],
      [T,E,E,E,E,D,E,E,E,E,E,W,G,G,G,G,W,E,E,E,E,E,D,E,E,E,E,T],
      [W,W,W,W,W,D,W,W,W,W,E,W,W,W,W,W,W,E,W,W,W,W,D,W,W,W,W,W],
      [O,O,O,O,W,D,W,W,W,W,E,E,E,E,E,E,E,E,W,W,W,W,D,W,O,O,O,O],
      [O,O,O,O,W,D,W,W,W,W,D,W,W,W,W,W,W,D,W,W,W,W,D,W,O,O,O,O],
      [W,W,W,W,W,D,D,D,D,D,D,D,D,W,W,D,D,D,D,D,D,D,D,W,W,W,W,W],
      [W,D,D,D,D,D,W,W,W,W,W,W,D,W,W,D,W,W,W,W,W,W,D,D,D,D,D,W],
      [W,D,W,W,W,D,W,W,W,W,W,W,D,W,W,D,W,W,W,W,W,W,D,W,W,W,D,W],
      [W,P,D,D,W,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,W,D,D,P,W],
      [W,W,W,D,W,D,W,W,W,W,D,W,W,W,W,W,W,D,W,W,W,W,D,W,D,W,W,W],
      [W,D,D,D,D,D,D,D,D,D,D,D,D,W,W,D,D,D,D,D,D,D,D,D,D,D,D,W],
      [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
      [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
      [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W]
  ];
  
  // MAP_5: Open Blood Maze 28x28 (Névoa de guerra atua aqui)
  const MAP_5 = [
      [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
      [W,P,D,D,D,D,D,D,D,D,D,D,D,W,W,D,D,D,D,D,D,D,D,D,D,D,P,W],
      [W,D,E,E,E,E,E,E,E,E,E,E,D,W,W,D,E,E,E,E,E,E,E,E,E,E,D,W],
      [W,D,E,W,W,W,E,W,W,W,W,E,D,W,W,D,E,W,W,W,W,E,W,W,W,E,D,W],
      [W,D,E,W,W,W,E,W,W,W,W,E,D,D,D,D,E,W,W,W,W,E,W,W,W,E,D,W],
      [W,D,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,D,W],
      [W,D,E,W,W,W,E,W,W,E,W,W,W,W,W,W,W,W,E,W,W,E,W,W,W,E,D,W],
      [W,D,E,E,E,E,E,W,W,E,E,E,E,W,W,E,E,E,E,W,W,E,E,E,E,E,D,W],
      [W,W,W,W,W,W,D,W,W,W,W,W,E,W,W,E,W,W,W,W,W,D,W,W,W,W,W,W],
      [O,O,O,O,O,W,D,W,W,E,E,E,E,E,E,E,E,E,E,W,W,D,W,O,O,O,O,O],
      [W,W,W,W,W,W,D,W,W,E,W,W,DR,DR,W,W,E,W,W,D,W,W,W,W,W,W],
      [T,E,E,E,E,E,D,E,E,E,W,G,G,G,G,W,E,E,E,D,E,E,E,E,E,T],
      [W,W,W,W,W,W,D,W,W,E,W,G,G,G,G,W,E,W,W,D,W,W,W,W,W,W],
      [O,O,O,O,O,W,D,W,W,E,W,W,W,W,W,W,E,W,W,D,W,O,O,O,O,O],
      [O,O,O,O,O,W,D,W,W,E,E,E,E,E,E,E,E,W,W,D,W,O,O,O,O,O],
      [W,W,W,W,W,W,D,W,W,E,W,W,W,W,W,W,E,W,W,D,W,W,W,W,W,W],
      [W,D,D,D,D,D,D,E,E,E,E,E,E,W,W,E,E,E,E,E,E,D,D,D,D,D,W],
      [W,D,W,W,W,W,D,W,W,W,W,W,E,W,W,E,W,W,W,W,W,D,W,W,W,W,D,W],
      [W,P,D,D,W,W,D,E,E,E,E,E,E,E,E,E,E,E,E,E,E,D,W,W,D,D,P,W],
      [W,W,W,D,W,W,D,E,W,W,W,W,W,W,W,W,W,W,W,W,E,D,W,W,D,W,W,W],
      [W,D,D,D,D,D,D,E,W,W,W,W,W,W,W,W,W,W,W,W,E,D,D,D,D,D,W],
      [W,D,E,E,E,E,E,E,E,E,E,E,E,W,W,E,E,E,E,E,E,E,E,E,E,E,D,W],
      [W,D,E,W,W,W,W,W,W,W,W,W,E,W,W,E,W,W,W,W,W,W,W,W,W,E,D,W],
      [W,D,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,D,W],
      [W,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,W],
      [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
      [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W]
  ];
  
  // MAP_6: Antigravity 28x28 (Vast emptiness)
  const MAP_6 = [
      [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
      [W,P,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,P,W],
      [W,E,W,E,E,E,W,E,E,E,E,E,W,W,W,W,E,E,E,E,E,W,E,E,E,W,E,W],
      [W,E,W,E,E,E,W,E,E,E,E,E,W,W,W,W,E,E,E,E,E,W,E,E,E,W,E,W],
      [W,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,W],
      [W,E,E,E,E,E,E,E,W,W,E,E,E,E,E,E,E,E,W,W,E,E,E,E,E,E,E,W],
      [W,E,E,W,W,W,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,W,W,W,E,E,W],
      [W,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,W],
      [W,W,W,W,W,W,E,E,E,E,E,E,W,W,W,W,E,E,E,E,E,E,W,W,W,W,W,W],
      [O,O,O,O,O,W,E,E,E,E,E,E,W,W,W,W,E,E,E,E,E,E,W,O,O,O,O,O],
      [W,W,W,W,W,W,E,E,E,E,W,W,DR,DR,W,W,E,E,E,E,E,W,W,W,W,W,W],
      [T,E,E,E,E,E,D,D,D,E,W,G,G,G,G,W,E,D,D,D,E,E,E,E,E,T],
      [W,W,W,W,W,W,E,E,E,E,W,W,W,W,W,W,E,E,E,E,E,W,W,W,W,W,W],
      [O,O,O,O,O,W,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,W,O,O,O,O,O],
      [O,O,O,O,O,W,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,W,O,O,O,O,O],
      [W,W,W,W,W,W,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,W,W,W,W,W,W],
      [W,E,E,E,E,E,E,E,E,E,E,E,W,W,W,W,E,E,E,E,E,E,E,E,E,E,E,W],
      [W,E,W,W,E,E,W,W,W,E,E,E,W,W,W,W,E,E,E,W,W,W,E,E,W,W,E,W],
      [W,P,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,P,W],
      [W,E,W,W,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,W,W,E,W],
      [W,E,E,E,E,E,E,W,W,W,E,E,E,E,E,E,E,E,W,W,W,E,E,E,E,E,E,W],
      [W,D,D,D,D,D,D,D,D,D,D,D,D,W,W,D,D,D,D,D,D,D,D,D,D,D,D,W],
      [W,E,E,W,W,W,E,E,E,E,E,E,E,W,W,E,E,E,E,E,E,E,W,W,W,E,E,W],
      [W,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,W],
      [W,P,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,P,W],
      [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
      [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W]
  ];
  
  const MAP_DATA = [MAP_1, MAP_2, MAP_3, MAP_4, MAP_5, MAP_6];


  let map;          // mutable copy per game
  let totalDots;
  let dotsLeft;

  /* ── helpers ────────────────────────────────────── */
  function isPath(v){ return v===D||v===E||v===P||v===G||v===DR||v===T; }

  function init(level = 0){
    const safeLevel = Math.min(level, MAP_DATA.length - 1);
    const baseMap = MAP_DATA[safeLevel];
    ROWS = baseMap.length;
    COLS = baseMap[0].length;
    map = baseMap.map(r => [...r]);
    totalDots = 0;
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
      if(map[r][c]===D||map[r][c]===P) totalDots++;
    }
    dotsLeft = totalDots;
  }

  function tile(r,c){
    if(r<0||r>=ROWS||c<0||c>=COLS) return W;
    return map[r][c];
  }

  function walkable(r,c,isPlayer){
    const t = tile(r,c);
    if(t===W||t===O) return false;
    if(t===DR) return !!isPlayer;   // only player goes through door
    return true;
  }

  function collectDot(r,c){
    const t = map[r][c];
    if(t===D){ map[r][c]=E; dotsLeft--; return 1; }
    if(t===P){ 
      map[r][c]=E; 
      dotsLeft--; 
      if(typeof Net !== 'undefined') Net.emitPowerActivated(); // Emissão Imediata!
      return 5; 
    }
    return 0;
  }

  function wrapTunnel(r,c){
    if(tile(r,c)===T){
      if(c<=0) return {r,c:COLS-1};
      if(c>=COLS-1) return {r,c:0};
    }
    return null;
  }

  function forceCollectDot(r, c) {
    if (map[r][c] === D || map[r][c] === P) {
      map[r][c] = E;
      dotsLeft--;
    }
  }

  /* ── BFS pathfinding ────────────────────────────── */
  function findPath(sr,sc,er,ec,isPlayer){
    const vis = new Set();
    const q = [{r:sr,c:sc,path:[]}];
    vis.add(sr*100+sc);
    const dirs = [{dr:-1,dc:0},{dr:1,dc:0},{dr:0,dc:-1},{dr:0,dc:1}];
    while(q.length){
      const {r,c,path} = q.shift();
      if(r===er&&c===ec) return path;
      for(const d of dirs){
        let nr=r+d.dr, nc=c+d.dc;
        if(nc<0) nc=COLS-1; if(nc>=COLS) nc=0;
        const k=nr*100+nc;
        if(!vis.has(k)&&walkable(nr,nc,isPlayer)){
          vis.add(k);
          q.push({r:nr,c:nc,path:[...path,{r:nr,c:nc}]});
        }
      }
    }
    return null;
  }

  /* ── scatter targets (corners) ─────────────────── */
  function randomOpenTile(excludeR,excludeC,radius){
    const cells=[];
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
      if(isPath(map[r][c])&&map[r][c]!==G&&map[r][c]!==DR){
        const d=Math.abs(r-excludeR)+Math.abs(c-excludeC);
        if(d>radius) cells.push({r,c});
      }
    }
    return cells.length? cells[Math.floor(Math.random()*cells.length)] : {r:1,c:1};
  }

  return {
    get COLS() { return COLS; },
    get ROWS() { return ROWS; },
    TILE,W,D,E,P,G,DR,T,O,
    init,tile,walkable,collectDot,wrapTunnel,findPath,
    isPath,randomOpenTile,forceCollectDot,
    getMap:()=>map,
    totalDots:()=>totalDots,
    dotsLeft:()=>dotsLeft,
  };
})();
