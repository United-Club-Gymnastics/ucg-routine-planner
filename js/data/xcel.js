// UCG Xcel levels (UCG Women's Rules Policy v6.0 + USAG Xcel Code of Points 2022-2028
// event rules charts). Special Requirements are paraphrased from the Xcel charts.

// Value Parts required (highest first). A higher VP can fill a lower requirement.
export const XCEL_VP = {
  silver: ['A', 'A', 'A', 'A', 'A'],
  gold: ['A', 'A', 'A', 'A', 'A', 'A'],
  plat: ['B', 'A', 'A', 'A', 'A', 'A', 'A'],
  diamond: ['B', 'B', 'A', 'A', 'A', 'A', 'A'],
  sapphire: ['C', 'B', 'B', 'B', 'A', 'A', 'A'],
};

// Highest letter allowed per event without the 0.50 restricted-skill deduction,
// and how many of the top letter are allowed (Diamond: one D).
export const XCEL_LIMITS = {
  silver: { ub: { max: 'A' }, bb: { max: 'B', note: 'No B acro skills' }, fx: { max: 'B', note: 'No B acro skills; max one salto or aerial' } },
  gold: { ub: { max: 'B', note: 'No B giants or B releases with a bar change' }, bb: { max: 'B' }, fx: { max: 'B', note: 'No B twisting saltos' } },
  plat: { ub: { max: 'B', note: 'C exceptions: clear hip, stalder, or pike sole circle to handstand (no turn)' }, bb: { max: 'C', note: 'No C acro skills' }, fx: { max: 'C', note: 'No C acro skills' } },
  diamond: { ub: { max: 'D', maxCount: 1 }, bb: { max: 'D', maxCount: 1 }, fx: { max: 'D', maxCount: 1 } },
  // UCG Women's Rules II.B.1: no difficulty restrictions at Sapphire, no limit on Ds or Es.
  sapphire: { ub: { max: 'E' }, bb: { max: 'E' }, fx: { max: 'E' } },
};

export const XCEL_SR = {
  silver: {
    ub: ['Mount', 'Cast to at least 45° below horizontal (not mount or dismount)', '360° circling skill (not mount or dismount)', 'Dismount from low or high bar (no saltos)'],
    bb: ['At least a ½ turn on one foot', 'Jump or leap with at least a 90° split (not mount or dismount)', 'Acro element without flight', 'Dismount'],
    fx: ['Two directly connected acro elements, one with flight', '2nd acro pass: two directly connected elements, or one acro flight element', 'Dance passage: two different Group 1 elements, one a leap with at least a 90° split', 'At least a 1/1 turn on one foot'],
  },
  gold: {
    ub: ['Skill finishing in clear support at least at horizontal (not mount or dismount)', '360° circling skill (not mount or dismount)', 'Second 360° circling skill (same skill connected, a different one, or the same skill on the other bar)', 'Dismount from the high bar'],
    bb: ['At least a 1/1 turn on one foot', 'Two different Group 2 elements, one with at least a 120° split', 'Two acro elements, one through inverted vertical', 'Dismount'],
    fx: ['Two directly connected acro flight elements', '2nd acro pass: two connected acro flight elements, or an aerial or salto', 'Dance passage: two different Group 1 elements, one a leap with at least a 120° split', 'At least a 1/1 turn on one foot'],
  },
  plat: {
    ub: ['Skill finishing in clear support above horizontal (not mount or dismount)', '360° circling skill (not mount or dismount)', 'Kip', 'Dismount from the high bar (at least A)'],
    bb: ['At least a 1/1 turn on one foot', 'Dance series of two elements, and a leap or jump with at least a 120° split', 'Acro flight element or acro series, one skill through vertical (not mount or dismount)', 'Dismount'],
    fx: ['Two directly connected acro flight elements with an A or B salto', '2nd acro pass: two connected acro flight elements, or a B salto', 'Dance passage: two different Group 1 elements, one a leap with at least a 150° split', 'At least a 1/1 turn on one foot'],
  },
  diamond: {
    ub: ['Skill finishing in clear support at least 45° from vertical (not mount or dismount)', 'B or higher 360° circling skill (not mount or dismount)', 'Another B or higher skill: a turn, a 2nd circling skill, or a release', 'Salto or hecht dismount from the high bar (at least A), or any B dismount from the high bar'],
    bb: ['At least a 1/1 turn on one foot', 'Dance series of two elements, and a leap or jump with at least a 150° split', 'Acro series with one skill through vertical, and an acro flight element', 'Salto or aerial dismount'],
    fx: ['Two acro flight passes with two connected flight elements each, or one such pass and an isolated C salto', 'Two different saltos, one at least B', 'Dance passage: two different Group 1 elements, one a leap with at least a 150° split', 'B or higher turn on one foot'],
  },
  sapphire: {
    ub: ['B or higher skill finishing in clear support at vertical (not mount or dismount)', 'B or higher 360° circling skill (not mount or dismount)', 'B or higher turn, a different B 2nd circling skill, or a B release', 'B or higher dismount, or a C skill connected to an A salto dismount'],
    bb: ['At least a 1/1 turn on one foot', 'Dance series of two elements, and a leap or jump with a 180° split', 'Acro series with a flight skill (one skill through vertical, or a salto or aerial)', 'B or higher dismount, or an acro flight skill connected to an A salto or aerial dismount'],
    fx: ['Acro pass with two saltos', 'Three different saltos, one at least B', 'Dance passage: two different Group 1 elements, one a leap with a 180° split', 'B or higher turn on one foot'],
  },
};

// Xcel vault chart (through Aug 2025). gold: allowed at Gold (10.0, or 9.5 with
// the alternative springboard); plat/diamond/sapphire: start value, or null if not allowed.
export const XCEL_VAULTS = [
  { code: '1.101', name: 'Handspring', gold: true, plat: 9.8, diamond: 9.5, sapphire: 9.2 },
  { code: '1.102', name: 'Handspring ½ twist off', gold: true, plat: 9.9, diamond: 9.6, sapphire: 9.4 },
  { code: '1.103', name: 'Yamashita', gold: true, plat: 9.8, diamond: 9.5, sapphire: 9.2 },
  { code: '1.104', name: 'Yamashita ½ twist off', gold: true, plat: 9.9, diamond: 9.6, sapphire: 9.4 },
  { code: '1.105', name: '½ twist on ½ twist off, or ¼ on ¾ off', gold: true, plat: 9.9, diamond: 9.7, sapphire: 9.4 },
  { code: '1.106', name: '¼–½ twist on, repulsion off (land facing the table)', gold: true, plat: 9.7, diamond: 9.5, sapphire: 9.2 },
  { code: '1.108', name: '¼ twist on ¼ twist off (land facing away)', gold: true, plat: 9.7, diamond: 9.5, sapphire: 9.0 },
  { code: '1.109', name: 'Handspring onto board – handspring on, repulsion off', diamond: 9.5, sapphire: 9.3 },
  { code: '1.110', name: 'Handspring onto board – handspring on, ½ turn off', diamond: 9.7, sapphire: 9.5 },
  { code: '1.111', name: 'Handspring onto board – ¼–½ turn on, repulsion off', diamond: 9.5, sapphire: 9.3 },
  { code: '1.201', name: 'Handspring 1/1 twist', gold: true, plat: 10.0, diamond: 10.0, sapphire: 9.6 },
  { code: '1.202', name: 'Handspring 1½ twist', diamond: 10.0, sapphire: 9.8 },
  { code: '1.203', name: 'Yamashita 1/1 twist', gold: true, plat: 10.0, diamond: 10.0, sapphire: 9.6 },
  { code: '1.205', name: '½ twist on 1½ twist off, or ¼ on 1¾ off', diamond: 10.0, sapphire: 9.8 },
  { code: '1.206', name: '½ twist on 1/1 twist off, or ¼ on 1¼ off', gold: true, plat: 10.0, diamond: 9.9, sapphire: 9.6 },
  { code: '1.207', name: '1/1 twist on, handspring or Yamashita off', gold: true, plat: 10.0, diamond: 10.0, sapphire: 9.6 },
  { code: '1.208', name: '1/1 twist on ½ twist off', gold: true, plat: 10.0, diamond: 10.0, sapphire: 9.8 },
  { code: '1.209', name: 'Handspring onto board – handspring on, 1/1 turn off', diamond: 10.0, sapphire: 9.7 },
  { code: '1.211', name: 'Handspring onto board – ½ on ½ off, or ¼ on ¾ off', diamond: 9.7, sapphire: 9.5 },
  { code: '1.301', name: 'Handspring 2/1 twist off', diamond: 10.0, sapphire: 10.0 },
  { code: '1.306', name: '½ twist on 2/1 twist off, or ¼ on 2¼ off', diamond: 10.0, sapphire: 10.0 },
  { code: '1.307', name: '1/1 twist on 1/1 twist off', sapphire: 10.0 },
  { code: '1.311', name: 'Handspring onto board – ½ on 1/1 off, or ¼ on 1¼ off', diamond: 10.0, sapphire: 9.7 },
  { code: '3.201', name: 'Tsukahara back tuck', diamond: 10.0, sapphire: 9.9 },
  { code: '3.303', name: 'Tsukahara back pike', diamond: 10.0, sapphire: 10.0 },
  { code: '3.304', name: 'Tsukahara back layout', diamond: 10.0, sapphire: 10.0 },
  { code: '4.101', name: 'Round-off, flic-flac on, repulsion off', plat: 9.8, diamond: 9.6, sapphire: 9.2 },
  { code: '4.102', name: 'Round-off, flic-flac on, repulsion ½ twist off', plat: 9.9, diamond: 9.8, sapphire: 9.4 },
  { code: '4.201', name: 'Round-off, flic-flac on, 1/1 twist off', plat: 10.0, diamond: 10.0, sapphire: 9.6 },
  { code: '4.202', name: 'Round-off, flic-flac on, 1½ twist off (Allen)', diamond: 10.0, sapphire: 9.8 },
  { code: '4.203', name: 'Round-off, flic-flac on, back tuck', diamond: 10.0, sapphire: 9.9 },
  { code: '4.301', name: 'Round-off, flic-flac on, 2/1 twist off', sapphire: 10.0 },
  { code: '4.304', name: 'Round-off, flic-flac on, back pike', diamond: 10.0, sapphire: 10.0 },
  { code: '4.305', name: 'Round-off, flic-flac on, back layout', diamond: 10.0, sapphire: 10.0 },
  { code: '5.101', name: 'Round-off, flic-flac ½ on, handspring', diamond: 9.8, sapphire: 9.4 },
  { code: '5.102', name: 'Round-off, flic-flac ½ on, ½ twist off', diamond: 9.9, sapphire: 9.6 },
  { code: '5.107', name: 'Round-off, flic-flac 1/1 on, ½ twist off', sapphire: 9.8 },
  { code: '5.108', name: 'Round-off, flic-flac 1/1 on, repulsion off', sapphire: 9.7 },
  { code: '5.201', name: 'Round-off, flic-flac ½ on, 1/1 twist off', diamond: 10.0, sapphire: 9.8 },
  { code: '5.202', name: 'Round-off, flic-flac ½ on, 1½ twist off', diamond: 10.0, sapphire: 10.0 },
  { code: '5.207', name: 'Round-off, flic-flac 1/1 on, 1/1 twist off', sapphire: 10.0 },
  { code: '5.312', name: 'Round-off, flic-flac ½ on, 2/1 twist off', diamond: 10.0, sapphire: 10.0 },
];

// Silver vaults are done over a mat stack.
export const XCEL_SILVER_VAULTS = [
  { code: 'S1', name: 'Handspring over the sideways mat stack', sv: 10.0 },
  { code: 'S2', name: '¼–½ turn on, repulsion off to feet (land facing the mat stack)', sv: 10.0 },
];
