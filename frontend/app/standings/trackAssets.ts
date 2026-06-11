interface TrackPoint {
  x: number;
  y: number;
}

interface TrackLabel {
  x: number;
  y: number;
  text: string;
  kind: 'corner' | 'sector';
}

export interface LocalTrackAsset {
  id: string;
  name: string;
  aliases: string[];
  points: TrackPoint[];
  labels: TrackLabel[];
}

function point(x: number, y: number): TrackPoint {
  return { x, y };
}

function normalizeTrackAlias(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/grand prix/g, 'gp')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const TRACK_ASSETS: LocalTrackAsset[] = [
  {
    id: 'bahrain',
    name: 'Bahrain International Circuit',
    aliases: ['bahrain gp', 'bahrain', 'sakhir'],
    points: [point(40, 150), point(34, 120), point(44, 84), point(72, 58), point(116, 52), point(148, 60), point(176, 44), point(198, 62), point(194, 108), point(170, 118), point(154, 146), point(118, 170), point(86, 174), point(66, 162), point(58, 182), point(42, 174), point(40, 150)],
    labels: [{ x: 78, y: 42, text: 'S1', kind: 'sector' }, { x: 190, y: 120, text: 'S2', kind: 'sector' }, { x: 80, y: 188, text: 'S3', kind: 'sector' }, { x: 52, y: 96, text: 'T1', kind: 'corner' }, { x: 176, y: 44, text: 'T4', kind: 'corner' }, { x: 154, y: 150, text: 'T10', kind: 'corner' }],
  },
  {
    id: 'jeddah',
    name: 'Jeddah Corniche Circuit',
    aliases: ['saudi arabian gp', 'saudi arabia gp', 'jeddah', 'saudi arabia'],
    points: [point(50, 176), point(38, 152), point(44, 122), point(66, 104), point(94, 92), point(136, 94), point(172, 82), point(188, 60), point(174, 42), point(138, 34), point(116, 48), point(94, 36), point(72, 52), point(66, 74), point(82, 94), point(104, 112), point(136, 122), point(164, 134), point(182, 158), point(170, 182), point(134, 186), point(92, 178), point(50, 176)],
    labels: [{ x: 74, y: 30, text: 'S1', kind: 'sector' }, { x: 194, y: 104, text: 'S2', kind: 'sector' }, { x: 88, y: 196, text: 'S3', kind: 'sector' }, { x: 58, y: 146, text: 'T1', kind: 'corner' }, { x: 182, y: 58, text: 'T13', kind: 'corner' }, { x: 168, y: 170, text: 'T27', kind: 'corner' }],
  },
  {
    id: 'melbourne',
    name: 'Albert Park Circuit',
    aliases: ['australian gp', 'australia gp', 'melbourne', 'albert park'],
    points: [point(34, 132), point(46, 88), point(86, 62), point(138, 58), point(178, 72), point(192, 104), point(182, 138), point(156, 158), point(118, 170), point(98, 192), point(74, 182), point(72, 150), point(48, 148), point(34, 132)],
    labels: [{ x: 92, y: 48, text: 'S1', kind: 'sector' }, { x: 198, y: 110, text: 'S2', kind: 'sector' }, { x: 94, y: 204, text: 'S3', kind: 'sector' }, { x: 46, y: 92, text: 'T1', kind: 'corner' }, { x: 186, y: 142, text: 'T9', kind: 'corner' }, { x: 70, y: 186, text: 'T13', kind: 'corner' }],
  },
  {
    id: 'suzuka',
    name: 'Suzuka Circuit',
    aliases: ['japanese gp', 'japan gp', 'suzuka', 'japan'],
    points: [point(64, 180), point(48, 154), point(58, 120), point(86, 100), point(120, 88), point(148, 70), point(144, 42), point(120, 30), point(88, 40), point(72, 68), point(90, 96), point(128, 118), point(162, 138), point(188, 160), point(176, 188), point(142, 182), point(126, 156), point(110, 134), point(88, 142), point(64, 180)],
    labels: [{ x: 114, y: 18, text: 'S1', kind: 'sector' }, { x: 194, y: 164, text: 'S2', kind: 'sector' }, { x: 64, y: 194, text: 'S3', kind: 'sector' }, { x: 52, y: 154, text: 'T1', kind: 'corner' }, { x: 130, y: 28, text: 'T7', kind: 'corner' }, { x: 126, y: 160, text: 'T16', kind: 'corner' }],
  },
  {
    id: 'shanghai',
    name: 'Shanghai International Circuit',
    aliases: ['chinese gp', 'china gp', 'shanghai', 'china'],
    points: [point(44, 142), point(38, 102), point(56, 70), point(92, 56), point(134, 56), point(164, 72), point(182, 102), point(174, 134), point(150, 146), point(118, 136), point(96, 118), point(84, 94), point(102, 82), point(132, 88), point(154, 110), point(150, 154), point(120, 176), point(78, 182), point(52, 168), point(44, 142)],
    labels: [{ x: 92, y: 44, text: 'S1', kind: 'sector' }, { x: 194, y: 112, text: 'S2', kind: 'sector' }, { x: 92, y: 194, text: 'S3', kind: 'sector' }, { x: 48, y: 96, text: 'T1', kind: 'corner' }, { x: 156, y: 106, text: 'T9', kind: 'corner' }, { x: 124, y: 178, text: 'T16', kind: 'corner' }],
  },
  {
    id: 'miami',
    name: 'Miami International Autodrome',
    aliases: ['miami gp', 'miami'],
    points: [point(50, 164), point(38, 128), point(54, 92), point(86, 70), point(124, 74), point(158, 60), point(186, 74), point(194, 112), point(182, 148), point(150, 170), point(114, 176), point(92, 154), point(74, 154), point(64, 176), point(50, 164)],
    labels: [{ x: 86, y: 56, text: 'S1', kind: 'sector' }, { x: 198, y: 116, text: 'S2', kind: 'sector' }, { x: 88, y: 188, text: 'S3', kind: 'sector' }, { x: 52, y: 130, text: 'T1', kind: 'corner' }, { x: 182, y: 80, text: 'T11', kind: 'corner' }, { x: 64, y: 182, text: 'T17', kind: 'corner' }],
  },
  {
    id: 'imola',
    name: 'Imola Circuit',
    aliases: ['emilia romagna gp', 'imola', 'emilia romagna'],
    points: [point(34, 138), point(42, 98), point(74, 66), point(116, 58), point(156, 70), point(188, 100), point(182, 138), point(148, 160), point(118, 154), point(96, 178), point(70, 172), point(56, 148), point(34, 138)],
    labels: [{ x: 76, y: 52, text: 'S1', kind: 'sector' }, { x: 194, y: 110, text: 'S2', kind: 'sector' }, { x: 86, y: 192, text: 'S3', kind: 'sector' }, { x: 46, y: 102, text: 'T1', kind: 'corner' }, { x: 176, y: 144, text: 'T9', kind: 'corner' }, { x: 92, y: 178, text: 'T17', kind: 'corner' }],
  },
  {
    id: 'monaco',
    name: 'Circuit de Monaco',
    aliases: ['monaco gp', 'monaco', 'monte carlo'],
    points: [point(54, 164), point(46, 132), point(58, 96), point(92, 70), point(126, 74), point(156, 62), point(176, 84), point(168, 114), point(142, 126), point(130, 152), point(110, 174), point(84, 178), point(68, 160), point(54, 164)],
    labels: [{ x: 90, y: 58, text: 'S1', kind: 'sector' }, { x: 182, y: 116, text: 'S2', kind: 'sector' }, { x: 96, y: 190, text: 'S3', kind: 'sector' }, { x: 52, y: 132, text: 'T1', kind: 'corner' }, { x: 154, y: 66, text: 'T6', kind: 'corner' }, { x: 114, y: 172, text: 'T18', kind: 'corner' }],
  },
  {
    id: 'montreal',
    name: 'Circuit Gilles Villeneuve',
    aliases: ['canadian gp', 'canada gp', 'montreal', 'gilles villeneuve'],
    points: [point(44, 146), point(56, 92), point(102, 60), point(158, 62), point(188, 94), point(182, 140), point(142, 170), point(90, 178), point(58, 166), point(44, 146)],
    labels: [{ x: 102, y: 48, text: 'S1', kind: 'sector' }, { x: 196, y: 110, text: 'S2', kind: 'sector' }, { x: 96, y: 190, text: 'S3', kind: 'sector' }, { x: 54, y: 96, text: 'T1', kind: 'corner' }, { x: 184, y: 140, text: 'T10', kind: 'corner' }, { x: 92, y: 176, text: 'T14', kind: 'corner' }],
  },
  {
    id: 'barcelona',
    name: 'Circuit de Barcelona-Catalunya',
    aliases: ['spanish gp', 'spain gp', 'barcelona', 'catalunya'],
    points: [point(38, 142), point(44, 102), point(78, 70), point(126, 62), point(172, 82), point(188, 122), point(176, 160), point(134, 178), point(92, 170), point(62, 152), point(38, 142)],
    labels: [{ x: 92, y: 48, text: 'S1', kind: 'sector' }, { x: 194, y: 122, text: 'S2', kind: 'sector' }, { x: 96, y: 190, text: 'S3', kind: 'sector' }, { x: 48, y: 106, text: 'T1', kind: 'corner' }, { x: 178, y: 94, text: 'T9', kind: 'corner' }, { x: 124, y: 178, text: 'T14', kind: 'corner' }],
  },
  {
    id: 'spielberg',
    name: 'Red Bull Ring',
    aliases: ['austrian gp', 'austria gp', 'spielberg', 'red bull ring'],
    points: [point(54, 168), point(42, 118), point(84, 76), point(152, 64), point(186, 92), point(176, 148), point(130, 176), point(82, 184), point(54, 168)],
    labels: [{ x: 82, y: 62, text: 'S1', kind: 'sector' }, { x: 192, y: 112, text: 'S2', kind: 'sector' }, { x: 90, y: 196, text: 'S3', kind: 'sector' }, { x: 42, y: 118, text: 'T1', kind: 'corner' }, { x: 184, y: 96, text: 'T3', kind: 'corner' }, { x: 132, y: 176, text: 'T10', kind: 'corner' }],
  },
  {
    id: 'silverstone',
    name: 'Silverstone Circuit',
    aliases: ['british gp', 'uk gp', 'great britain gp', 'silverstone'],
    points: [point(34, 136), point(42, 90), point(82, 58), point(132, 54), point(176, 74), point(190, 116), point(178, 154), point(146, 170), point(118, 158), point(96, 176), point(68, 166), point(52, 146), point(34, 136)],
    labels: [{ x: 92, y: 42, text: 'S1', kind: 'sector' }, { x: 196, y: 120, text: 'S2', kind: 'sector' }, { x: 92, y: 190, text: 'S3', kind: 'sector' }, { x: 40, y: 96, text: 'T1', kind: 'corner' }, { x: 172, y: 70, text: 'Maggots', kind: 'corner' }, { x: 98, y: 176, text: 'T18', kind: 'corner' }],
  },
  {
    id: 'hungaroring',
    name: 'Hungaroring',
    aliases: ['hungarian gp', 'hungary gp', 'budapest', 'hungaroring'],
    points: [point(44, 146), point(40, 108), point(62, 74), point(102, 60), point(150, 64), point(184, 92), point(188, 132), point(164, 162), point(124, 174), point(82, 170), point(54, 154), point(44, 146)],
    labels: [{ x: 100, y: 46, text: 'S1', kind: 'sector' }, { x: 194, y: 116, text: 'S2', kind: 'sector' }, { x: 98, y: 186, text: 'S3', kind: 'sector' }, { x: 46, y: 110, text: 'T1', kind: 'corner' }, { x: 186, y: 96, text: 'T4', kind: 'corner' }, { x: 82, y: 170, text: 'T13', kind: 'corner' }],
  },
  {
    id: 'spa',
    name: 'Spa-Francorchamps',
    aliases: ['belgian gp', 'belgium gp', 'spa', 'spa francorchamps'],
    points: [point(58, 178), point(42, 134), point(54, 88), point(98, 54), point(152, 48), point(184, 72), point(192, 122), point(176, 166), point(138, 182), point(98, 168), point(82, 146), point(58, 178)],
    labels: [{ x: 104, y: 36, text: 'S1', kind: 'sector' }, { x: 198, y: 122, text: 'S2', kind: 'sector' }, { x: 110, y: 194, text: 'S3', kind: 'sector' }, { x: 50, y: 132, text: 'La Source', kind: 'corner' }, { x: 150, y: 46, text: 'Les Combes', kind: 'corner' }, { x: 146, y: 184, text: 'Bus Stop', kind: 'corner' }],
  },
  {
    id: 'zandvoort',
    name: 'Circuit Zandvoort',
    aliases: ['dutch gp', 'netherlands gp', 'zandvoort', 'netherlands'],
    points: [point(52, 160), point(44, 120), point(58, 80), point(96, 56), point(144, 58), point(178, 88), point(182, 132), point(156, 166), point(112, 176), point(76, 172), point(52, 160)],
    labels: [{ x: 98, y: 42, text: 'S1', kind: 'sector' }, { x: 190, y: 116, text: 'S2', kind: 'sector' }, { x: 96, y: 188, text: 'S3', kind: 'sector' }, { x: 44, y: 122, text: 'T1', kind: 'corner' }, { x: 178, y: 90, text: 'T7', kind: 'corner' }, { x: 108, y: 176, text: 'T14', kind: 'corner' }],
  },
  {
    id: 'monza',
    name: 'Monza',
    aliases: ['italian gp', 'italy gp', 'monza', 'italia gp'],
    points: [point(42, 152), point(34, 96), point(82, 54), point(154, 50), point(192, 88), point(188, 146), point(144, 178), point(78, 182), point(42, 152)],
    labels: [{ x: 94, y: 38, text: 'S1', kind: 'sector' }, { x: 198, y: 116, text: 'S2', kind: 'sector' }, { x: 98, y: 196, text: 'S3', kind: 'sector' }, { x: 36, y: 96, text: 'T1', kind: 'corner' }, { x: 192, y: 88, text: 'Ascari', kind: 'corner' }, { x: 146, y: 178, text: 'Parabolica', kind: 'corner' }],
  },
  {
    id: 'baku',
    name: 'Baku City Circuit',
    aliases: ['azerbaijan gp', 'baku', 'azerbaijan'],
    points: [point(58, 182), point(40, 142), point(48, 92), point(92, 64), point(142, 68), point(178, 90), point(188, 138), point(166, 178), point(114, 184), point(82, 170), point(58, 182)],
    labels: [{ x: 92, y: 50, text: 'S1', kind: 'sector' }, { x: 194, y: 124, text: 'S2', kind: 'sector' }, { x: 108, y: 196, text: 'S3', kind: 'sector' }, { x: 42, y: 144, text: 'T1', kind: 'corner' }, { x: 174, y: 90, text: 'Castle', kind: 'corner' }, { x: 112, y: 184, text: 'T20', kind: 'corner' }],
  },
  {
    id: 'singapore',
    name: 'Marina Bay Street Circuit',
    aliases: ['singapore gp', 'singapore', 'marina bay'],
    points: [point(40, 152), point(38, 112), point(62, 76), point(104, 60), point(146, 66), point(178, 94), point(184, 138), point(164, 172), point(124, 182), point(84, 176), point(52, 162), point(40, 152)],
    labels: [{ x: 102, y: 46, text: 'S1', kind: 'sector' }, { x: 192, y: 122, text: 'S2', kind: 'sector' }, { x: 98, y: 194, text: 'S3', kind: 'sector' }, { x: 40, y: 112, text: 'T1', kind: 'corner' }, { x: 180, y: 94, text: 'T14', kind: 'corner' }, { x: 126, y: 180, text: 'T23', kind: 'corner' }],
  },
  {
    id: 'austin',
    name: 'Circuit of the Americas',
    aliases: ['united states gp', 'usa gp', 'austin', 'cota', 'united states'],
    points: [point(48, 176), point(40, 130), point(60, 84), point(100, 58), point(154, 54), point(184, 86), point(176, 132), point(148, 164), point(114, 170), point(92, 150), point(76, 174), point(48, 176)],
    labels: [{ x: 98, y: 44, text: 'S1', kind: 'sector' }, { x: 192, y: 112, text: 'S2', kind: 'sector' }, { x: 96, y: 188, text: 'S3', kind: 'sector' }, { x: 40, y: 130, text: 'T1', kind: 'corner' }, { x: 178, y: 88, text: 'T12', kind: 'corner' }, { x: 74, y: 176, text: 'T19', kind: 'corner' }],
  },
  {
    id: 'mexico',
    name: 'Autodromo Hermanos Rodriguez',
    aliases: ['mexico city gp', 'mexican gp', 'mexico gp', 'mexico city', 'mexico'],
    points: [point(40, 150), point(36, 100), point(74, 62), point(132, 58), point(178, 82), point(188, 130), point(170, 166), point(128, 180), point(84, 174), point(56, 154), point(40, 150)],
    labels: [{ x: 94, y: 44, text: 'S1', kind: 'sector' }, { x: 194, y: 120, text: 'S2', kind: 'sector' }, { x: 100, y: 192, text: 'S3', kind: 'sector' }, { x: 36, y: 100, text: 'T1', kind: 'corner' }, { x: 184, y: 84, text: 'T7', kind: 'corner' }, { x: 130, y: 178, text: 'Stadium', kind: 'corner' }],
  },
  {
    id: 'interlagos',
    name: 'Interlagos',
    aliases: ['sao paulo gp', 'brazilian gp', 'brazil gp', 'interlagos', 'sao paulo'],
    points: [point(52, 174), point(40, 132), point(54, 88), point(92, 62), point(146, 62), point(184, 90), point(188, 134), point(160, 166), point(116, 176), point(82, 164), point(52, 174)],
    labels: [{ x: 96, y: 48, text: 'S1', kind: 'sector' }, { x: 194, y: 118, text: 'S2', kind: 'sector' }, { x: 102, y: 190, text: 'S3', kind: 'sector' }, { x: 42, y: 130, text: 'Senna S', kind: 'corner' }, { x: 182, y: 92, text: 'T10', kind: 'corner' }, { x: 114, y: 176, text: 'Juncao', kind: 'corner' }],
  },
  {
    id: 'vegas',
    name: 'Las Vegas Strip Circuit',
    aliases: ['las vegas gp', 'vegas', 'las vegas'],
    points: [point(40, 150), point(42, 90), point(90, 58), point(162, 58), point(188, 86), point(184, 144), point(136, 176), point(74, 176), point(40, 150)],
    labels: [{ x: 98, y: 44, text: 'S1', kind: 'sector' }, { x: 194, y: 112, text: 'S2', kind: 'sector' }, { x: 96, y: 190, text: 'S3', kind: 'sector' }, { x: 42, y: 92, text: 'T1', kind: 'corner' }, { x: 184, y: 86, text: 'Strip', kind: 'corner' }, { x: 136, y: 176, text: 'T14', kind: 'corner' }],
  },
  {
    id: 'yas-marina',
    name: 'Yas Marina Circuit',
    aliases: ['abu dhabi gp', 'abu dhabi', 'yas marina'],
    points: [point(42, 162), point(38, 116), point(64, 74), point(116, 58), point(164, 70), point(190, 108), point(182, 152), point(146, 178), point(94, 182), point(56, 168), point(42, 162)],
    labels: [{ x: 100, y: 44, text: 'S1', kind: 'sector' }, { x: 196, y: 118, text: 'S2', kind: 'sector' }, { x: 98, y: 194, text: 'S3', kind: 'sector' }, { x: 40, y: 118, text: 'T1', kind: 'corner' }, { x: 186, y: 108, text: 'T9', kind: 'corner' }, { x: 144, y: 178, text: 'T16', kind: 'corner' }],
  },
  {
    id: 'losail',
    name: 'Lusail International Circuit',
    aliases: ['qatar gp', 'qatar', 'lusail'],
    points: [point(58, 168), point(44, 128), point(56, 82), point(92, 56), point(142, 58), point(178, 90), point(184, 138), point(160, 170), point(114, 180), point(78, 176), point(58, 168)],
    labels: [{ x: 96, y: 44, text: 'S1', kind: 'sector' }, { x: 194, y: 120, text: 'S2', kind: 'sector' }, { x: 96, y: 192, text: 'S3', kind: 'sector' }, { x: 46, y: 128, text: 'T1', kind: 'corner' }, { x: 180, y: 92, text: 'T10', kind: 'corner' }, { x: 116, y: 180, text: 'T16', kind: 'corner' }],
  },
];

export function findTrackAsset(trackHint: string) {
  const normalizedHint = normalizeTrackAlias(trackHint);
  if (!normalizedHint) return null;

  return (
    TRACK_ASSETS.find((asset) =>
      asset.aliases.some((alias) => normalizedHint.includes(normalizeTrackAlias(alias)) || normalizeTrackAlias(alias).includes(normalizedHint)),
    ) ?? null
  );
}
