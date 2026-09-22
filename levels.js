/* Hand-authored geometry and reward routes; generation only assembles safe encounters. */
(function (root) {
  "use strict";
  const FLOOR = 625, ONE_WAY_FROM_NIGHT = 7;
  const THEMES = {
    quarter: { name: "Old Quarter", sky: 0x41303e, stone: 0x293742, trim: 0x8b9e98, motif: "city" },
    roofs: { name: "The High Roofs", sky: 0x303657, stone: 0x2c2d44, trim: 0xb1a0bb, motif: "spires" },
    gardens: { name: "Hollow Gardens", sky: 0x233e3a, stone: 0x293b36, trim: 0x9aad7c, motif: "trees" },
    canals: { name: "Drowned Canals", sky: 0x203b4f, stone: 0x243d49, trim: 0x8bb9c3, motif: "water" },
    market: { name: "Blood Market", sky: 0x50333c, stone: 0x41313a, trim: 0xd5a680, motif: "awnings" },
    cathedral: { name: "Cathedral Ward", sky: 0x443450, stone: 0x323344, trim: 0xc4b18b, motif: "spires" },
    catacombs: { name: "The Catacombs", sky: 0x171a24, stone: 0x34323c, trim: 0xd0bc8f, motif: "crypts", underground: true },
    sewers: { name: "The Undercity", sky: 0x11252b, stone: 0x263d3f, trim: 0x8bc2ac, motif: "tunnels", underground: true },
  };
  const ferry = (x, y, w, range, period) => [x, y, w, { motion: { axis: "x", range, period, phase: -Math.PI / 2 } }];
  const lift = (x, y, w, range, period) => [x, y, w, { motion: { axis: "y", range, period, phase: Math.PI / 2 } }];
  const cracked = (x, y, w) => [x, y, w, { crumble: true }];
  const bonus = (x, y, w) => [x, y, w, { bonus: true }];
  // Decks: [left, top, width, optional properties]. Reward groups: [deck, count, dirt each].
  // Each encounter has two reward plans. Empty decks, rich caches and trails are intentional.
  const ENCOUNTERS = {
    lanterns: { name: "LANTERN COURT", width: 900, skin: "brick", decks: [[230,565,220],[550,510,180]], gaps: [], key: 1, rewards: [[[0,3,1],[1,1,6]],[[0,1,5],[1,4,1]]], power: [1], heals: [0], mirror: false },
    balconies: { name: "THE BALCONY CLIMB", width: 1190, skin: "brick", decks: [[210,535,140],[395,435,110],[560,345,200],[805,430,120],[970,530,90]], gaps: [[340,645]], key: 2, rewards: [[[0,2,1],[2,1,7]],[[1,3,1],[3,1,6]]], power: [2,3], heals: [4] },
    sunken: { name: "SUNKEN LANE", width: 1080, skin: "beam", decks: [[200,585,130],[455,560,100],[680,600,220]], gaps: [[280,440]], key: 1, rewards: [[[0,4,1],[2,1,5]],[[1,1,6],[2,3,1]]], power: [1], heals: [2] },
    carriage: { name: "CARRIAGE HOUSE", width: 1270, skin: "brick", decks: [[210,545,230],[500,470,240],[830,545,250]], gaps: [[410,460]], key: 1, rewards: [[[1,1,8],[2,2,1]],[[0,3,1],[2,1,7]]], power: [0,2], heals: [1] },
    wells: { name: "THE OLD WELLS", width: 1060, skin: "stone", decks: [[220,575,86],[370,525,145],[625,585,90],[800,540,90]], gaps: [[265,160],[520,165]], key: 2, rewards: [[[1,3,1],[3,1,6]],[[0,1,5],[2,4,1]]], power: [1,3], heals: [2] },
    sidecourt: { name: "HIDDEN COURTYARD", width: 1070, skin: "brick", decks: [[215,550,210],[465,485,260],[755,565,130],bonus(535,390,140)], gaps: [[400,390]], key: 1, detour: [0,1,3,1,2], rewards: [[[0,3,1],[3,1,8]],[[2,2,1],[3,2,4]]], power: [3], heals: [2] },

    chimneys: { name: "CHIMNEY TEETH", width: 1260, skin: "brick", decks: [[210,535,120],[390,475,70],[545,395,110],[725,395,80],[865,465,150],[1065,540,80]], gaps: [[285,770]], key: 3, rewards: [[[1,1,3],[4,1,7]],[[0,2,1],[2,1,8]]], power: [2,4], heals: [5] },
    terraces: { name: "LONG TERRACES", width: 1470, skin: "brick", decks: [[200,550,260],[535,500,120],[710,450,330],[1135,530,120]], gaps: [[405,785]], key: 2, rewards: [[[0,5,1],[2,1,6]],[[1,1,5],[3,4,1]]], power: [2], heals: [3] },
    valley: { name: "ROOFLINE VALLEY", width: 1260, skin: "brick", decks: [[210,540,150],[410,455,120],[590,550,100],[770,470,140],[965,550,110]], gaps: [[320,695]], key: 2, rewards: [[[1,1,5],[3,1,5]],[[0,3,1],[2,1,6]]], power: [1,3], heals: [2] },
    attics: { name: "ATTIC WINDOWS", width: 1330, skin: "beam", decks: [[200,555,140],[390,465,190],[635,365,120],[810,455,180],[1080,550,90]], gaps: [[310,805]], key: 2, rewards: [[[1,2,1],[2,1,8]],[[0,4,1],[3,1,6]]], power: [2], heals: [4] },
    spires: { name: "THE NARROW SPIRES", width: 1110, skin: "stone", decks: [[210,560,65],[350,485,65],[485,410,90],[640,475,75],[785,550,95]], gaps: [[245,610]], key: 2, rewards: [[[0,1,3],[3,1,7]],[[1,1,5],[4,1,5]]], power: [2,3], heals: [4] },
    scaffolds: { name: "HANGING SCAFFOLDS", width: 1510, skin: "beam", decks: [[200,550,140],[420,500,190],[695,500,210],[1000,530,160],[1270,580,80],bonus(740,405,120)], gaps: [[295,1010]], key: 2, detour: [0,1,2,5,2,3,4], rewards: [[[1,4,1],[5,1,8]],[[3,3,1],[5,1,9]]], power: [5], heals: [4] },

    roots: { name: "LOW ROOTS", width: 1010, skin: "branch", decks: [[215,585,110],[400,555,150],[620,600,90],[780,560,80]], gaps: [[285,165],[580,230]], key: 2, rewards: [[[0,3,1],[3,1,6]],[[1,4,1],[2,1,5]]], power: [1], heals: [3] },
    gravestones: { name: "FALLING GRAVESTONES", width: 1190, skin: "stone", decks: [cracked(220,570,80),cracked(350,525,110),cracked(520,580,80),cracked(680,515,100),[850,575,130]], gaps: [[270,650]], key: 2, rewards: [[[1,1,4],[4,1,6]],[[0,1,3],[3,1,7]]], power: [4], heals: [4] },
    boughs: { name: "THE HIGH BOUGHS", width: 1370, skin: "branch", decks: [[220,550,130],[410,470,210],[675,395,150],[925,480,130],[1150,560,80]], gaps: [[315,880]], key: 2, rewards: [[[0,2,1],[2,1,8]],[[1,3,1],[3,1,7]]], power: [2], heals: [4] },
    overgrowth: { name: "OVERGROWN ARCH", width: 1140, skin: "branch", decks: [[215,580,220],[525,530,110],[715,570,200]], gaps: [[380,390]], key: 1, rewards: [[[0,5,1],[2,1,5]],[[1,1,6],[2,4,1]]], power: [1], heals: [2] },
    brokenroots: { name: "ROOTS & RUBBLE", width: 1490, skin: "branch", decks: [[200,565,140],cracked(430,545,100),[650,465,140],cracked(890,540,95),[1115,580,200]], gaps: [[315,905]], key: 2, rewards: [[[1,1,5],[4,3,1]],[[0,2,1],[2,1,7]]], power: [2], heals: [4] },
    gardenwell: { name: "THE WISHING WELL", width: 1290, skin: "stone", decks: [[210,555,170],[455,490,140],[670,570,90],[870,500,120],[1065,580,70],bonus(465,400,115)], gaps: [[325,760]], key: 3, detour: [0,1,5,1,2,3,4], rewards: [[[2,1,3],[5,1,9]],[[0,3,1],[5,2,4]]], power: [5], heals: [4] },

    crossing: { name: "FERRY CROSSING", width: 1060, skin: "pier", decks: [ferry(440,585,100,120,5.5),[755,535,135]], gaps: [[310,355]], key: 0, rewards: [[[0,3,1],[1,1,6]],[[0,1,6],[1,3,1]]], power: [1], heals: [1], water: true },
    locklift: { name: "THE LOCK LIFT", width: 1190, skin: "pier", decks: [[220,575,140],lift(480,545,120,45,4.6),[650,480,165],[910,570,100]], gaps: [[325,655]], key: 1, rewards: [[[0,3,1],[2,1,7]],[[1,1,6],[3,3,1]]], power: [2], heals: [3], water: true },
    doubleferry: { name: "TWO BOATS HOME", width: 1490, skin: "pier", decks: [[210,575,100],ferry(445,580,100,90,5),[710,535,140],ferry(1035,560,120,100,5.8),[1270,570,85]], gaps: [[280,1030]], key: 3, rewards: [[[1,1,5],[2,3,1]],[[2,1,6],[3,3,1]]], power: [2,4], heals: [4], water: true },
    cargo: { name: "CARGO HOIST", width: 1340, skin: "pier", decks: [[215,555,150],lift(485,525,145,45,4),[725,470,200],[1040,560,110]], gaps: [[315,780]], key: 1, rewards: [[[0,4,1],[2,1,6]],[[1,1,6],[3,4,1]]], power: [2], heals: [3], water: true },
    spillway: { name: "SPILLWAY STONES", width: 1240, skin: "stone", decks: [[225,585,80],[405,540,140],[615,585,90],[805,520,110],[1000,580,70]], gaps: [[260,780]], key: 3, rewards: [[[1,2,1],[3,1,7]],[[0,1,3],[2,1,6]]], power: [3], heals: [4], water: true },
    moonferry: { name: "MOONLIT BARGE", width: 1350, skin: "pier", decks: [[220,560,210],ferry(670,565,120,120,5.2),[960,535,190]], gaps: [[375,650]], key: 1, rewards: [[[0,4,1],[2,1,6]],[[1,1,7],[2,3,1]]], power: [2], heals: [0], water: true },

    tents: { name: "THE CANOPY ROAD", width: 1240, skin: "awning", decks: [[220,560,240],[515,500,170],[780,555,260]], gaps: [], key: 1, rewards: [[[0,4,1],[2,1,6]],[[1,1,7],[2,3,1]]], power: [1], heals: [2], hunter: true },
    marketstair: { name: "STACKED STALLS", width: 1170, skin: "awning", decks: [[210,585,100],[350,535,90],[500,465,210],[760,520,120],[950,580,80]], gaps: [[300,680]], key: 2, rewards: [[[0,1,3],[2,1,7]],[[1,2,1],[3,1,7]]], power: [2], heals: [4], hunter: true },
    arcade: { name: "COVERED ARCADE", width: 1370, skin: "awning", decks: [[220,540,270],[580,540,280],[950,540,220],bonus(665,445,120)], gaps: [[430,610]], key: 1, detour: [0,1,3,1,2], rewards: [[[0,4,1],[3,1,8]],[[2,3,1],[3,1,9]]], power: [3], heals: [2], hunter: true },
    bunting: { name: "ABOVE THE BUNTING", width: 1390, skin: "awning", decks: [[220,550,130],[435,465,170],[660,390,150],[880,475,210],[1170,560,80]], gaps: [[310,900]], key: 2, rewards: [[[1,3,1],[2,1,7]],[[0,2,1],[3,1,8]]], power: [2], heals: [4], hunter: true },
    warehouse: { name: "THE WAREHOUSE RUN", width: 1540, skin: "beam", decks: [[220,575,170],[490,515,250],[850,555,110],[1040,475,260],[1360,560,80]], gaps: [[350,1030]], key: 3, rewards: [[[1,5,1],[3,1,6]],[[0,3,1],[2,1,7]]], power: [3], heals: [2], hunter: true },
    backalleys: { name: "BACK-ALLEY CACHE", width: 990, skin: "brick", decks: [[220,575,130],[470,560,110],[730,575,85],bonus(490,465,120)], gaps: [[310,210],[630,130]], key: 1, detour: [0,1,3,1,2], rewards: [[[0,3,1],[3,1,8]],[[2,2,1],[3,1,9]]], power: [3], heals: [2], hunter: true },

    cloister: { name: "THE CLOISTER", width: 1200, skin: "stone", decks: [[230,545,160],[455,470,160],[715,545,260]], gaps: [], key: 1, rewards: [[[0,3,1],[2,1,6]],[[1,1,7],[2,3,1]]], power: [1], heals: [2], crosses: [650], priest: true },
    pillars: { name: "SEVEN PILLARS", width: 1350, skin: "stone", decks: [[220,575,75],[350,500,95],[510,420,80],[655,500,65],[800,430,100],[975,510,80],[1125,580,70]], gaps: [[260,910]], key: 4, rewards: [[[1,1,3],[4,1,7]],[[2,1,6],[5,1,4]]], power: [4], heals: [6], priest: true },
    belllift: { name: "BELL-TOWER HOIST", width: 1470, skin: "beam", decks: [[220,550,130],[420,455,160],lift(675,435,130,60,5),[925,395,140],[1150,490,90],[1290,580,65]], gaps: [[295,1050]], key: 2, rewards: [[[1,3,1],[3,1,7]],[[0,2,1],[2,1,8]]], power: [3], heals: [5], priest: true },
    nave: { name: "THE EMPTY NAVE", width: 1430, skin: "stone", decks: [[215,565,240],[520,485,310],[905,555,230],[1220,590,65]], gaps: [[390,865]], key: 1, rewards: [[[0,5,1],[2,1,5]],[[1,1,8],[3,2,1]]], power: [1], heals: [2], priest: true },
    reliquary: { name: "THE RELIQUARY", width: 1290, skin: "stone", decks: [[220,555,150],[430,465,130],[640,415,140],[850,495,160],[1090,570,80],bonus(645,345,120)], gaps: [[325,800]], key: 2, detour: [0,1,2,5,2,3,4], rewards: [[[1,2,1],[5,1,9]],[[3,3,1],[5,1,8]]], power: [5], heals: [4], priest: true },
    ossuary: { name: "THE OSSUARY", width: 1470, skin: "stone", decks: [cracked(220,580,100),[410,540,180],cracked(670,470,130),[920,545,180],[1230,580,60]], gaps: [[275,990]], key: 2, rewards: [[[1,4,1],[3,1,6]],[[0,1,4],[2,1,6]]], power: [3], heals: [4], crosses: [1330], priest: true },

    descent: { name: "THE BURIED STAIR", width: 1230, skin: "bone", decks: [[220,545,145],[425,460,150],[650,390,170],[895,480,125],[1060,570,70]], gaps: [[325,760]], key: 2, rewards: [[[0,3,1],[2,1,8]],[[1,1,6],[3,3,1]]], power: [2], heals: [4] },
    niches: { name: "ROWS OF THE DEAD", width: 1310, skin: "bone", decks: [[215,575,90],[375,510,100],[540,440,145],[755,525,95],[970,570,140]], gaps: [[265,760]], key: 2, rewards: [[[1,1,5],[4,4,1]],[[0,2,1],[2,1,8]]], power: [2], heals: [4] },
    vault: { name: "THE SUNKEN VAULT", width: 1380, skin: "bone", decks: [[210,560,250],[555,580,110],[760,515,240],[1100,575,90]], gaps: [[395,775]], key: 2, rewards: [[[0,4,1],[2,1,7]],[[1,1,6],[3,3,1]]], power: [2], heals: [0] },
    bonebridge: { name: "BONE BRIDGE", width: 1400, skin: "bone", decks: [[205,570,120],cracked(390,515,115),cracked(570,470,130),cracked(765,525,110),[940,555,140],[1170,585,70]], gaps: [[285,920]], key: 2, rewards: [[[1,1,4],[4,1,7]],[[0,3,1],[3,1,7]]], power: [4], heals: [5] },
    buriallift: { name: "THE BURIAL HOIST", width: 1460, skin: "bone", decks: [[210,560,160],[435,480,150],lift(660,465,140,40,4.8),[905,410,160],[1140,510,150]], gaps: [[335,925]], key: 2, rewards: [[[1,4,1],[3,1,8]],[[0,3,1],[2,1,7]]], power: [3], heals: [4] },
    urns: { name: "THE URN GALLERY", width: 1220, skin: "bone", decks: [[220,570,80],[355,485,90],[510,420,100],[675,490,95],[845,565,140]], gaps: [[270,635]], key: 2, rewards: [[[0,1,3],[3,1,7]],[[1,1,5],[4,1,6]]], power: [2], heals: [4], priest: true },
    tombcache: { name: "THE FORGOTTEN OFFERING", width: 1440, skin: "bone", decks: [[220,560,160],[450,490,290],[830,540,180],[1130,585,105],bonus(530,395,125)], gaps: [[335,855]], key: 1, detour: [0,1,4,1,2,3], rewards: [[[0,3,1],[4,1,9]],[[2,3,1],[4,2,5]]], power: [4], heals: [3] },
    vigil: { name: "THE LAST VIGIL", width: 1350, skin: "bone", decks: [[210,545,270],[550,455,150],[765,535,220],[1100,585,75]], gaps: [[420,715]], key: 1, rewards: [[[0,4,1],[2,1,7]],[[1,1,8],[3,2,1]]], power: [1], heals: [2], crosses: [1200] },

    sluice: { name: "THE LOWER SLUICE", width: 1240, skin: "pipe", decks: [[215,580,155],[440,540,165],[700,585,100],[905,545,125]], gaps: [[320,650]], key: 1, rewards: [[[0,4,1],[3,1,7]],[[1,1,7],[2,3,1]]], power: [1], heals: [3], water: true, vents: [1090] },
    conduit: { name: "PIPE ORGAN", width: 1350, skin: "pipe", decks: [[220,555,145],[435,475,135],[635,405,180],[885,490,150],[1120,575,80]], gaps: [[325,820]], key: 2, rewards: [[[1,3,1],[2,1,8]],[[0,4,1],[3,1,7]]], power: [2], heals: [4], water: true },
    sump: { name: "SUMP FERRY", width: 1320, skin: "pipe", decks: [[210,575,190],ferry(595,585,125,100,5.3),[855,540,170],[1130,585,70]], gaps: [[345,850]], key: 1, rewards: [[[0,4,1],[2,1,7]],[[1,1,7],[3,3,1]]], power: [2], heals: [3], water: true },
    piston: { name: "PUMP-ROOM PISTON", width: 1440, skin: "pipe", decks: [[215,570,135],lift(470,540,145,40,4.4),[715,490,185],[995,570,180]], gaps: [[310,790]], key: 1, rewards: [[[0,4,1],[2,1,8]],[[1,1,8],[3,3,1]]], power: [2], heals: [3], water: true, vents: [1250] },
    drains: { name: "BROKEN DRAINS", width: 1390, skin: "pipe", decks: [[210,575,125],cracked(410,550,110),[650,490,160],cracked(890,555,115),[1140,580,90]], gaps: [[290,880]], key: 2, rewards: [[[1,1,4],[4,1,7]],[[0,3,1],[2,1,8]]], power: [2], heals: [4], water: true },
    cistern: { name: "THE DEEP CISTERN", width: 1550, skin: "pipe", decks: [[220,580,100],ferry(490,580,120,75,5.2),[740,525,150],ferry(1085,570,120,80,5.6),[1340,580,65]], gaps: [[280,1100]], key: 3, rewards: [[[1,1,6],[2,3,1]],[[2,1,7],[3,3,1]]], power: [2], heals: [4], water: true },
    smugglers: { name: "SMUGGLERS' POCKET", width: 1450, skin: "pipe", decks: [[210,570,160],[435,510,310],[840,560,185],[1165,585,95],bonus(525,415,140)], gaps: [[315,900]], key: 1, detour: [0,1,4,1,2,3], rewards: [[[0,4,1],[4,1,9]],[[2,3,1],[4,2,5]]], power: [4], heals: [3], water: true, hunter: true },
    outfall: { name: "THE SEALED OUTFALL", width: 1330, skin: "pipe", decks: [[210,575,220],[510,520,160],[765,560,210],[1120,585,65]], gaps: [[365,790]], key: 1, rewards: [[[0,4,1],[2,1,7]],[[1,1,8],[3,3,1]]], power: [1], heals: [2], water: true, vents: [1180] },
  };
  const CAMPAIGN = [
    { name: "First Blood", theme: "quarter", seconds: 112, keys: 1, sections: ["lanterns","balconies","sunken","carriage","wells","sidecourt"] },
    { name: "Above the Streets", theme: "roofs", seconds: 146, keys: 2, sections: ["terraces","chimneys","valley","attics","spires","scaffolds","arcade"] },
    { name: "Roots & Ruin", theme: "gardens", seconds: 144, keys: 2, sections: ["roots","gravestones","boughs","overgrowth","brokenroots","gardenwell","wells"] },
    { name: "Still Water", theme: "canals", seconds: 160, keys: 2, sections: ["crossing","locklift","spillway","doubleferry","moonferry","cargo","roots"] },
    { name: "The Price of Blood", theme: "market", seconds: 156, keys: 2, sections: ["tents","marketstair","backalleys","arcade","bunting","warehouse","carriage","terraces"] },
    { name: "The Bells Toll", theme: "cathedral", seconds: 162, keys: 2, sections: ["cloister","pillars","belllift","nave","reliquary","ossuary","chimneys","cargo"] },
    { name: "Graveyard Shift", theme: "quarter", seconds: 148, keys: 3, sections: ["wells","sidecourt","lanterns","carriage","backalleys","brokenroots","valley","cloister"] },
    { name: "Gutter Crown", theme: "roofs", seconds: 162, keys: 3, sections: ["chimneys","spires","attics","scaffolds","valley","moonferry","belllift","bunting"] },
    { name: "The Forgotten", theme: "catacombs", seconds: 154, keys: 3, sections: ["descent","niches","vault","bonebridge","buriallift","urns","tombcache","vigil"] },
    { name: "Undertow", theme: "sewers", seconds: 168, keys: 3, sections: ["sluice","conduit","sump","piston","drains","cistern","smugglers","outfall"] },
    { name: "The Procession", theme: "cathedral", seconds: 176, keys: 3, sections: ["pillars","cloister","belllift","nave","reliquary","ossuary","attics","marketstair","boughs"] },
    { name: "The Longest Night", theme: "cathedral", seconds: 190, keys: 3, sections: ["chimneys","doubleferry","gravestones","bunting","cargo","reliquary","scaffolds","brokenroots","pillars","nave"] },
  ];
  const HINTS = {
    brick: "Read the roofline. Every landing is different.", beam: "Mind the gaps between the beams.",
    branch: "Follow the branches. Watch the low landings.", stone: "Short ledges. Line up your next jump.",
    awning: "Take the canopies. Hunt for high caches.", pier: "Ride the platforms. Wait for your landing.",
    bone: "Follow the tomb ledges. The crypt is your only refuge.", pipe: "Stay above the drains. Time the next crossing.",
  };
  function random(seed) {
    let state = (seed >>> 0) || 1;
    return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  }
  function shuffle(array, rng) {
    for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; }
    return array;
  }
  function nightSettings(night = 1) {
    const n = Number.isFinite(night) ? Math.max(1, Math.floor(night)) : 1;
    const chapter = (n - 1) % CAMPAIGN.length, cycle = Math.floor((n - 1) / CAMPAIGN.length), spec = CAMPAIGN[chapter];
    return { night: n, chapter, cycle, variant: chapter, oneWay: n >= ONE_WAY_FROM_NIGHT, duration: spec.seconds - Math.min(28, cycle * 7), speed: Math.min(1.55, 1 + chapter * 0.03 + cycle * 0.07) };
  }
  function sectionAt(level, x) { return level.sections.find((s) => x < s.end) || level.sections[level.sections.length - 1]; }
  function buildLevel(night = 1, seed = 1) {
    const settings = nightSettings(night), spec = CAMPAIGN[settings.chapter], rng = random((seed >>> 0) + settings.night * 7919);
    const types = spec.sections.slice();
    if (settings.night > 1) types.splice(1, types.length - 2, ...shuffle(types.slice(1, -1), rng));
    const platforms = [], gaps = [], pickups = [], hazards = [], humans = [], sections = [], checkpoints = [80];
    const keySections = settings.chapter === 0 ? [1] : Array.from({ length: spec.keys }, (_, i) => Math.floor((i + 1) * types.length / (spec.keys + 1)));
    const powerSections = settings.night === 1 ? [1,3] : shuffle(types.map((_,i) => i), rng).slice(0, 2);
    const healingSections = shuffle(types.map((_,i) => i), rng).slice(0, Math.ceil(types.length / 2));
    const platform = (x, y, w, extra = {}) => {
      const p = { id: platforms.length, x, y, baseX: x, baseY: y, w, h: 16, active: true, crumbleTime: 0, respawn: 0, ...extra };
      if (p.motion) { const m = p.motion; p[m.axis] += Math.sin(m.phase) * m.range; }
      platforms.push(p); return p;
    };
    const pickup = (kind, x, y, value = 1, extra = {}) => {
      const p = { id: pickups.length, kind, x, y, value, active: true, ...extra }; pickups.push(p); return p;
    };
    const person = (x, behavior, radius = 30) => humans.push({ id: humans.length, x, y: FLOOR - 38, w: 24, h: 38, min: x - radius, max: x + radius, direction: rng() > 0.5 ? 1 : -1, behavior, state: "human", stunned: 0, cooldown: 1.4 + rng(), windup: 0, phase: rng() * 3.8 });
    let start = 0;
    types.forEach((type, index) => {
      const e = ENCOUNTERS[type], mirrored = e.mirror !== false && (settings.chapter >= 6 || (settings.chapter > 0 && rng() < 0.35));
      const approach = settings.night === 1 ? 0 : Math.floor(rng() * 3) * 35;
      const end = start + e.width + approach;
      const xPoint = (x) => start + approach + (mirrored ? e.width - x : x);
      const section = { type, start, end, name: e.name, hint: HINTS[e.skin], index, mirrored, route: [], detour: [] };
      if (e.water) section.hint = "Water below. Wait for the next landing.";
      if (e.decks.some(d => d[3]?.crumble)) section.hint = "Cracked ledges collapse. Keep moving.";
      if (e.decks.some(d => d[3]?.motion?.axis === "y")) section.hint = "Ride the lift. Jump when the heights line up.";
      if (e.detour) section.hint = "High caches reward an extra climb.";
      if (e.vents) section.hint = "Garlic vents pulse. Cross when the fumes clear.";
      sections.push(section); checkpoints.push(start + 80);
      const decks = e.decks.map(([x,y,w,extra = {}]) => platform(xPoint(mirrored ? x + w : x), y, w, { skin: e.skin, section: index, ...extra, ...(extra.motion ? { motion: { ...extra.motion, phase: extra.motion.axis === "x" && mirrored ? Math.PI / 2 : extra.motion.phase } } : {}) }));
      let order = decks.map((p,i) => i).filter(i => !decks[i].bonus);
      if (mirrored) order.reverse();
      section.route = order.map(i => decks[i].id);
      section.detour = e.detour ? (mirrored ? e.detour.slice().reverse() : e.detour).map(i => decks[i].id) : section.route.slice();
      for (const [x,w] of e.gaps) gaps.push({ x: xPoint(mirrored ? x + w : x), width: w, water: !!e.water });
      const anchored = (kind, deckIndex, value = 1, fraction = 0.5, offsetY = -25) => {
        const p = decks[deckIndex], offsetX = p.w * fraction;
        return pickup(kind, p.x + offsetX, p.y + offsetY, value, { deckId: p.id, ...(p.motion ? { platform: p.id, offsetX, offsetY } : {}) });
      };
      if (keySections.includes(index)) section.keyId = anchored("key", e.key, 1, 0.5, -27).id;
      const plan = e.rewards[settings.night === 1 ? 0 : Math.floor(rng() * e.rewards.length)];
      for (const [deckIndex, count, value] of plan) for (let j = 0; j < count; j++) {
        const q = count === 1 ? (deckIndex === e.key && section.keyId !== undefined ? 0.22 : 0.5) : 0.15 + 0.7 * j / (count - 1);
        anchored("dirt", deckIndex, value, q);
      }
      if (powerSections.includes(index)) anchored("iv", e.power[Math.floor(rng() * e.power.length)], 1, 0.78, -32);
      if (healingSections.includes(index)) anchored("syringe", e.heals[Math.floor(rng() * e.heals.length)], 1, 0.2, -29);
      person(start + 140, ["wander", "flee", "brave"][index % 3]);
      if (e.hunter || ((settings.chapter >= 6 || settings.cycle) && index % 3 === 2 && !e.priest)) person(end - 115, "hunter");
      // Leave a clear landing before the priest's aura so ground combat is a choice.
      if (e.priest || (settings.chapter === 2 && index === types.length - 1)) person(end - 65, "priest", 15);
      for (const x of e.crosses || []) hazards.push({ kind: "cross", x: xPoint(x), y: FLOOR - 57, w: 34, h: 114, pulse: true, period: 3.8 + rng() * 0.6, phase: rng() * 3.8 });
      for (const x of e.vents || []) hazards.push({ kind: "garlic", visual: "vent", x: xPoint(x), y: FLOOR - 46, w: 44, h: 92, pulse: true, period: 4.4, phase: rng() * 4.4 });
      if (index % 3 === 0 && !e.priest) hazards.push({ kind: "garlic", x: end - 90, y: FLOOR - 18, w: 26, h: 36 });
      start = end;
    });
    const width = start + 450;
    gaps.sort((a,b) => a.x - b.x);
    let edge = 0;
    for (const g of gaps) { platform(edge, FLOOR, g.x - edge, { ground: true, h: 120 }); edge = g.x + g.width; }
    platform(edge, FLOOR, width - edge, { ground: true, h: 120 });
    const contracts = [
      { key: "turned", target: Math.min(5, 2 + Math.floor(settings.chapter / 4)), reward: 14, title: "Turn humans" },
      { key: "dirt", target: 32 + Math.floor(settings.chapter / 3) * 8, reward: 14, title: "Collect grave dirt" },
      settings.chapter % 2 ? { key: "time", target: Math.round(settings.duration * 0.65), reward: 18, title: "Seconds to spare" } : { key: "untouched", target: 0, reward: 18, title: "Lose no coffins" },
    ];
    const gates = settings.oneWay ? sections.slice(1).map((section) => ({ x: section.start, checkpoint: section.start + 80, keyIds: sections.slice(0,section.index).filter(s => s.keyId !== undefined).map(s => s.keyId) })) : [];
    return { ...settings, seed: seed >>> 0, name: spec.name, themeKey: spec.theme, theme: THEMES[spec.theme], width, platforms, gaps, pickups, hazards, humans, sections, checkpoints, gates, contracts, requiredKeys: spec.keys, crypt: { x: width - 110, y: FLOOR } };
  }
  const api = { FLOOR, ONE_WAY_FROM_NIGHT, CAMPAIGN, THEMES, ENCOUNTERS, HINTS, nightSettings, sectionAt, buildLevel };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.VampLevels = api;
})(typeof window !== "undefined" ? window : this);
