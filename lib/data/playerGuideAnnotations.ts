export type PlayerGuideBox = {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type PlayerGuideImageAnnotations = {
  size: { width: number; height: number };
  boxes: PlayerGuideBox[];
};

export const PLAYER_GUIDE_ANNOTATIONS: Record<string, PlayerGuideImageAnnotations> = {
  "/player-guide/01-setup.png": {
    size: { width: 2712, height: 2442 },
    boxes: [
      { id: 1, x: 2360, y: 60, w: 280, h: 90 },
      { id: 2, x: 180, y: 280, w: 2350, h: 1060 },
      { id: 3, x: 210, y: 1250, w: 260, h: 90 },
      { id: 4, x: 500, y: 1250, w: 260, h: 90 },
      { id: 5, x: 180, y: 1380, w: 2350, h: 580 },
      { id: 6, x: 70, y: 2120, w: 2570, h: 260 }
    ]
  },
  "/player-guide/02-add-players.png": {
    size: { width: 2712, height: 3294 },
    boxes: [
      { id: 1, x: 2360, y: 60, w: 280, h: 90 },
      { id: 2, x: 190, y: 260, w: 2340, h: 880 },
      { id: 3, x: 190, y: 1160, w: 2340, h: 880 },
      { id: 4, x: 190, y: 1980, w: 560, h: 90 },
      { id: 5, x: 550, y: 1980, w: 560, h: 90 },
      { id: 6, x: 190, y: 2200, w: 2340, h: 520 },
      { id: 7, x: 70, y: 2940, w: 2570, h: 260 }
    ]
  },
  "/player-guide/03-board-overview.png": {
    size: { width: 2712, height: 3886 },
    boxes: [
      { id: 1, x: 2320, y: 40, w: 340, h: 90 },
      { id: 2, x: 170, y: 160, w: 1600, h: 1350 },
      { id: 3, x: 1780, y: 180, w: 900, h: 620 },
      { id: 4, x: 1780, y: 820, w: 900, h: 1200 },
      { id: 5, x: 170, y: 1520, w: 1600, h: 420 },
      { id: 6, x: 170, y: 1960, w: 1600, h: 720 },
      { id: 7, x: 1780, y: 2060, w: 900, h: 620 },
      { id: 8, x: 70, y: 2720, w: 2610, h: 520 },
      { id: 9, x: 1780, y: 2720, w: 900, h: 520 },
      { id: 10, x: 70, y: 3260, w: 2570, h: 560 }
    ]
  },
  "/player-guide/04-roll-and-actions.png": {
    size: { width: 2712, height: 3886 },
    boxes: [
      { id: 1, x: 2300, y: 40, w: 360, h: 90 },
      { id: 2, x: 170, y: 160, w: 1600, h: 1350 },
      { id: 3, x: 1800, y: 180, w: 880, h: 740 },
      { id: 4, x: 1800, y: 940, w: 880, h: 1120 },
      { id: 5, x: 210, y: 1520, w: 780, h: 200 },
      { id: 6, x: 1000, y: 1520, w: 780, h: 200 },
      { id: 7, x: 170, y: 1740, w: 1600, h: 900 },
      { id: 8, x: 1780, y: 2720, w: 900, h: 520 },
      { id: 9, x: 70, y: 3260, w: 2570, h: 560 }
    ]
  },
  "/player-guide/05-card-modal.png": {
    size: { width: 2712, height: 3886 },
    boxes: [
      { id: 1, x: 2280, y: 40, w: 380, h: 90 },
      { id: 2, x: 170, y: 160, w: 1600, h: 1350 },
      { id: 3, x: 240, y: 1730, w: 1500, h: 800 },
      { id: 4, x: 380, y: 2350, w: 600, h: 160 },
      { id: 5, x: 1040, y: 2350, w: 600, h: 160 },
      { id: 6, x: 70, y: 3260, w: 2570, h: 560 }
    ]
  },
  "/player-guide/06-market-response-window.png": {
    size: { width: 2712, height: 3886 },
    boxes: [
      { id: 1, x: 2300, y: 40, w: 360, h: 90 },
      { id: 2, x: 170, y: 160, w: 1600, h: 1350 },
      { id: 3, x: 1800, y: 180, w: 880, h: 740 },
      { id: 4, x: 1800, y: 940, w: 880, h: 1120 },
      { id: 5, x: 150, y: 1600, w: 1700, h: 900 },
      { id: 6, x: 394, y: 2150, w: 446, h: 110 },
      { id: 7, x: 971, y: 2150, w: 649, h: 110 },
      { id: 8, x: 70, y: 2720, w: 2570, h: 540 }
    ]
  },
  "/player-guide/07-joint-venture-section.png": {
    size: { width: 748, height: 746 },
    boxes: [
      { id: 1, x: 30, y: 140, w: 688, h: 90 },
      { id: 2, x: 30, y: 240, w: 688, h: 170 },
      { id: 3, x: 30, y: 420, w: 340, h: 90 },
      { id: 4, x: 378, y: 420, w: 340, h: 90 },
      { id: 5, x: 30, y: 520, w: 688, h: 100 },
      { id: 6, x: 30, y: 630, w: 688, h: 95 }
    ]
  },
  "/player-guide/08-player-loan-section.png": {
    size: { width: 748, height: 602 },
    boxes: [
      { id: 1, x: 40, y: 30, w: 300, h: 80 },
      { id: 2, x: 60, y: 170, w: 630, h: 110 },
      { id: 3, x: 60, y: 300, w: 630, h: 110 },
      { id: 4, x: 60, y: 430, w: 380, h: 110 },
      { id: 5, x: 460, y: 430, w: 230, h: 110 },
      { id: 6, x: 114, y: 550, w: 576, h: 52 }
    ]
  },
  "/player-guide/09-replay-import-section.png": {
    size: { width: 748, height: 264 },
    boxes: [
      { id: 1, x: 40, y: 40, w: 300, h: 80 },
      { id: 2, x: 250, y: 40, w: 374, h: 80 },
      { id: 3, x: 620, y: 40, w: 120, h: 80 },
      { id: 4, x: 40, y: 120, w: 708, h: 144 }
    ]
  },
  "/player-guide/10-balance-sheet-panel.png": {
    size: { width: 748, height: 1018 },
    boxes: [
      { id: 1, x: 30, y: 40, w: 330, h: 140 },
      { id: 2, x: 430, y: 40, w: 280, h: 140 },
      { id: 3, x: 30, y: 190, w: 710, h: 270 },
      { id: 4, x: 30, y: 460, w: 710, h: 450 },
      { id: 5, x: 30, y: 910, w: 710, h: 108 }
    ]
  },
  "/player-guide/11-game-log-panel.png": {
    size: { width: 1668, height: 1066 },
    boxes: [
      { id: 1, x: 30, y: 40, w: 300, h: 80 },
      { id: 2, x: 1160, y: 50, w: 220, h: 70 },
      { id: 3, x: 1400, y: 50, w: 220, h: 70 },
      { id: 4, x: 40, y: 150, w: 1560, h: 250 },
      { id: 5, x: 40, y: 420, w: 1560, h: 250 },
      { id: 6, x: 90, y: 310, w: 260, h: 60 }
    ]
  }
};

