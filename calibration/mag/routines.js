// Judge practice for UCG MAG (calibration/mag/): the routines and their answer key.
// From last season's "NAIGC MAG 2026 EXAMPLE ROUTINE EVALUATIONS" doc (DOC_URL), brought up to the
// 2026-28 UCG MAG rules: each skill is the UCG CoP / WG skill it is (skillId; its value and element
// group are this year's, checked against the catalog in tests/calibration-mag.test.mjs), or keeps
// the doc's value where there's no clear match (skillId null). The start value, neutral deductions
// and final score are worked out by the planner's MAG scoring (key.js), not stored here.
//
// Each routine: id (level-event), level (dev | int | adv), event, the video (youtube or drive id),
// and the doc's scoring:
//   rows   the skills in order: name (as the doc gives it), skillId and label (the listed skill and
//          its name in the skill list), letter, eg (0 = none), nr (not recognized: a repetition or
//          the judges' call, see why), ded (the execution deductions as the doc lists them), e
//          (their total), why (the doc's comments)
//   lines  deductions that aren't a skill: { kind: execution | neutral, what, v, why, rule } (rule:
//          a neutral deduction the planner's scoring takes itself, shown but not added again)
//   options the planner's bonus and requirement options this routine earns (eventOptions in
//          js/scoring/mag.js); stick the stuck-landing bonus; e the execution total
//   vault  (vault only) the vault's id in the MAG vault table
//   last   last season's figures as the doc gives them (eg, d, bonus, sv, nd, e, final)
export const DOC_URL = 'https://docs.google.com/document/d/1YGC1ddwzKQ_ayggNT8hNjDQQgbBPcqCih2R5BX0cXgc/edit';
export const ROUTINES = [
 {
  "id": "dev-fx",
  "level": "dev",
  "event": "fx",
  "youtube": "P_xa5MvEPr0",
  "rows": [
   {
    "name": "Cartwheel",
    "label": "Cartwheel",
    "skillId": "UCG-FX-cartwheel",
    "letter": "Sub-A",
    "eg": 0,
    "ded": "0.1",
    "e": 0.1,
    "why": "Step"
   },
   {
    "name": "Straight arm back roll to prone",
    "label": "Straight arm backward roll to prone",
    "skillId": "UCG-FX-straight-arm-backward-roll-to-prone",
    "letter": "Sub-A",
    "eg": 0,
    "ded": "",
    "e": 0,
    "why": ""
   },
   {
    "name": "L Hold",
    "label": "L-sit (2 s.)",
    "skillId": "UCG-FX-l-sit-2-s",
    "letter": "A",
    "eg": 0,
    "ded": "0.1",
    "e": 0.1,
    "why": "Simple step to corner"
   },
   {
    "name": "Dive Roll",
    "label": "Dive roll",
    "skillId": "WG-FX-II-7",
    "letter": "A",
    "eg": 2,
    "ded": "",
    "e": 0,
    "why": ""
   },
   {
    "name": "Handstand half pirouette",
    "label": "Handstand pirouette, ½ or full",
    "skillId": "WG-FX-I-31",
    "letter": "A",
    "eg": 1,
    "ded": "0.1, 0.1",
    "e": 0.2,
    "why": "Body position, incomplete turn"
   },
   {
    "name": "Stag Leap",
    "skillId": null,
    "letter": "",
    "eg": 0,
    "nr": true,
    "ded": "0.1, 0.1",
    "e": 0.2,
    "why": "Not in the UCG CoP, knee bend, lack of artistry"
   },
   {
    "name": "Round Off",
    "label": "Round-off (stuck, rebound, or connected to other acro)",
    "skillId": "UCG-FX-round-off-stuck-rebound-or-connected-to-other-acro",
    "letter": "A",
    "eg": 0,
    "ded": "0.1, 0.1",
    "e": 0.2,
    "why": "Steps, balance"
   }
  ],
  "stick": 0,
  "options": {},
  "lines": [],
  "e": 0.8,
  "notes": [
   "Note: Except for scale / leap requirement, FIG neutral deductions still apply"
  ],
  "last": {
   "eg": 1,
   "d": 0.6,
   "bonus": 0,
   "sv": 11.6,
   "nd": 0,
   "e": 0.8,
   "final": 10.8
  }
 },
 {
  "id": "int-fx",
  "level": "int",
  "event": "fx",
  "youtube": "OkTig22qyeg",
  "rows": [
   {
    "name": "Front Tuck",
    "label": "Front tuck or pike, optional ½ twist",
    "skillId": "WG-FX-II-13",
    "letter": "A",
    "eg": 2,
    "ded": "0.1",
    "e": 0.1,
    "why": "Step"
   },
   {
    "name": "Cartwheel",
    "label": "Cartwheel",
    "skillId": "UCG-FX-cartwheel",
    "letter": "Sub-A",
    "eg": 0,
    "ded": "",
    "e": 0,
    "why": ""
   },
   {
    "name": "Stag Leap",
    "skillId": null,
    "letter": "",
    "eg": 0,
    "nr": true,
    "ded": "0.1",
    "e": 0.1,
    "why": "Not in the UCG CoP, imbalance"
   },
   {
    "name": "Dive Roll",
    "label": "Dive roll",
    "skillId": "WG-FX-II-7",
    "letter": "A",
    "eg": 2,
    "ded": "",
    "e": 0,
    "why": ""
   },
   {
    "name": "Handstand Half Pirouette",
    "label": "Handstand pirouette, ½ or full",
    "skillId": "WG-FX-I-31",
    "letter": "A",
    "eg": 1,
    "ded": "0.1",
    "e": 0.1,
    "why": "Lack of artistry in transition"
   },
   {
    "name": "Round Off",
    "label": "Round-off (stuck, rebound, or connected to other acro)",
    "skillId": "UCG-FX-round-off-stuck-rebound-or-connected-to-other-acro",
    "letter": "A",
    "eg": 0,
    "ded": "",
    "e": 0,
    "why": ""
   },
   {
    "name": "Back Tuck",
    "label": "Salto backwards tucked or piked",
    "skillId": "WG-FX-III-1",
    "letter": "A",
    "eg": 3,
    "ded": "0.1, 0.1",
    "e": 0.2,
    "why": "Steps"
   }
  ],
  "stick": 0,
  "options": {},
  "lines": [],
  "e": 0.5,
  "notes": [
   "Note: Except for scale / leap requirement, FIG neutral deductions still apply"
  ],
  "last": {
   "eg": 1.1,
   "d": 0.6,
   "bonus": 0,
   "sv": 11.7,
   "nd": 0,
   "e": 0.5,
   "final": 11.2
  }
 },
 {
  "id": "adv-fx",
  "level": "adv",
  "event": "fx",
  "drive": "1u3wajrYm_WEMn8l1hboUG1gMewOhkfJt",
  "rows": [
   {
    "name": "Round Off",
    "label": "Round-off (stuck, rebound, or connected to other acro)",
    "skillId": "UCG-FX-round-off-stuck-rebound-or-connected-to-other-acro",
    "letter": "A",
    "eg": 0,
    "ded": "",
    "e": 0,
    "why": ""
   },
   {
    "name": "Back Handspring",
    "label": "Back handspring",
    "skillId": "WG-FX-III-13",
    "letter": "A",
    "eg": 3,
    "ded": "",
    "e": 0,
    "why": ""
   },
   {
    "name": "Double Back Tucked",
    "label": "Double back tuck",
    "skillId": "WG-FX-III-3",
    "letter": "C",
    "eg": 3,
    "ded": "0.4",
    "e": 0.4,
    "why": "0.3 Hop, 0.1 Lack of artistry in transition."
   },
   {
    "name": "Front Handspring",
    "label": "Forward handspring or flyspring",
    "skillId": "WG-FX-II-1",
    "letter": "A",
    "eg": 2,
    "ded": "",
    "e": 0,
    "why": ""
   },
   {
    "name": "Front 1/1 Layout",
    "label": "Front layout full or 1½ twist",
    "skillId": "WG-FX-IV-3",
    "letter": "C",
    "eg": 4,
    "ded": "1.0",
    "e": 1,
    "why": "0.1 Knee bend, 0.1 Legs apart, 0.5 Low landing (Hips below knees), 0.3 Step"
   },
   {
    "name": "V-Sit",
    "label": "V-sit",
    "skillId": "WG-FX-I-2",
    "letter": "B",
    "eg": 1,
    "ded": "",
    "e": 0,
    "why": ""
   },
   {
    "name": "V-Sit Press to Handstand",
    "label": "V-sit then press to handstand",
    "skillId": "WG-FX-I-9",
    "letter": "C",
    "eg": 1,
    "ded": "0.7",
    "e": 0.7,
    "why": "0.1 Knee bend, 0.1 Feet Brushing Ground, 0.5 No recognition of press: No momentary stop in final Handstand position. Press Credit taken away but initial V may still be given",
    "nr": true
   },
   {
    "name": "½ Pirouette",
    "label": "Handstand pirouette, ½ or full",
    "skillId": "WG-FX-I-31",
    "letter": "A",
    "eg": 1,
    "ded": "",
    "e": 0,
    "why": ""
   },
   {
    "name": "Round Off",
    "label": "Round-off (stuck, rebound, or connected to other acro)",
    "skillId": "UCG-FX-round-off-stuck-rebound-or-connected-to-other-acro",
    "letter": "A",
    "eg": 0,
    "ded": "",
    "e": 0,
    "why": "Simple Repetition",
    "nr": true
   },
   {
    "name": "Back Layout",
    "label": "Back layout or whip back",
    "skillId": "WG-FX-III-2",
    "letter": "B",
    "eg": 3,
    "ded": "0.1",
    "e": 0.1,
    "why": "Leg bend"
   },
   {
    "name": "Cross Split",
    "label": "Cross or side split (stop required)",
    "skillId": "WG-FX-I-55",
    "letter": "A",
    "eg": 1,
    "ded": "",
    "e": 0,
    "why": ""
   },
   {
    "name": "Straddle Planche",
    "label": "Straddle planche",
    "skillId": "WG-FX-I-25",
    "letter": "A",
    "eg": 1,
    "ded": "0.1",
    "e": 0.1,
    "why": "(Not recognized due to max one strength element) 0.1 Hold angle",
    "nr": true
   },
   {
    "name": "Straddle Planche Press to Handstand",
    "label": "Straddle planche press to handstand",
    "skillId": "WG-FX-I-32",
    "letter": "B",
    "eg": 1,
    "ded": "0.5",
    "e": 0.5,
    "why": "0.5 No recognition of press: No momentary stop in final Handstand position. Press Credit taken away but initial Straddle planche may still be given",
    "nr": true
   },
   {
    "name": "½ Pirouette",
    "label": "Handstand pirouette, ½ or full",
    "skillId": "WG-FX-I-31",
    "letter": "A",
    "eg": 1,
    "ded": "",
    "e": 0,
    "why": "Simple Repetition",
    "nr": true
   },
   {
    "name": "Front ½ Piked",
    "label": "Front tuck or pike, optional ½ twist",
    "skillId": "WG-FX-II-13",
    "letter": "A",
    "eg": 2,
    "ded": "0.9",
    "e": 0.9,
    "why": "0.1 Leg bend, 0.1 Legs apart, 0.5 Uncontrolled momentary landing 0.1 simple steps, 0.1 Pause 2 sec. or more in corner"
   },
   {
    "name": "Back Handspring",
    "label": "Back handspring",
    "skillId": "WG-FX-III-13",
    "letter": "A",
    "eg": 3,
    "ded": "",
    "e": 0,
    "why": "Simple Repetition",
    "nr": true
   },
   {
    "name": "Back 2/1 Layout",
    "label": "Back layout 1½ or double twist",
    "skillId": "WG-FX-IV-9",
    "letter": "C",
    "eg": 4,
    "ded": "0.5",
    "e": 0.5,
    "why": "0.1 Off axis, 0.1 legs apart, 0.3 step"
   }
  ],
  "stick": 0,
  "options": {},
  "lines": [
   {
    "kind": "neutral",
    "what": "Same diagonal used 3 times in a row",
    "v": 0.3,
    "why": ""
   },
   {
    "kind": "neutral",
    "what": "No balance or leap element",
    "v": 0.3,
    "why": "",
    "rule": "balance"
   }
  ],
  "e": 4.2,
  "notes": [],
  "last": {
   "eg": 1.6,
   "d": 1.6,
   "bonus": 0,
   "sv": 13.2,
   "nd": 0.6,
   "e": 4.2,
   "final": 8.4
  }
 },
 {
  "id": "dev-ph",
  "level": "dev",
  "event": "ph",
  "youtube": "oOk4IZOtGiU",
  "rows": [
   {
    "name": "Single Leg Stockli",
    "label": "Single leg Stockli",
    "skillId": "UCG-PH-single-leg-stockli",
    "letter": "A",
    "eg": 0,
    "ded": "0.3, 0.3",
    "e": 0.6,
    "why": "Arm bend, Use of strength"
   },
   {
    "name": "Scissor Hop",
    "label": "Scissor forward with travel sideways (also with 1/2 t.)",
    "skillId": "WG-PH-I-2",
    "letter": "B",
    "eg": 1,
    "ded": "0.1, 0.1",
    "e": 0.2,
    "why": "Knee bend, Rhythm"
   },
   {
    "name": "Single Leg Travel",
    "label": "Single leg travel",
    "skillId": "UCG-PH-single-leg-travel",
    "letter": "A",
    "eg": 0,
    "ded": "0.1, 0.1, 0.1",
    "e": 0.3,
    "why": "Knee bend, leg cut height"
   },
   {
    "name": "Scissor",
    "label": "Scissor forward",
    "skillId": "WG-PH-I-1",
    "letter": "A",
    "eg": 1,
    "ded": "0.3, 0.1, 0.1, 0.1",
    "e": 0.6,
    "why": "Pause, knee bend, leg cut height"
   },
   {
    "name": "False Scissor",
    "label": "False scissor",
    "skillId": "UCG-PH-false-scissor",
    "letter": "A",
    "eg": 0,
    "ded": "0.1, 0.1, 0.1",
    "e": 0.3,
    "why": "Height, knee bend, hitting horse"
   },
   {
    "name": "½ Circle Dismount",
    "label": "½ Circle Dismount",
    "skillId": "UCG-PH-circle-dismount",
    "letter": "Sub-A",
    "eg": 0,
    "ded": "0.1",
    "e": 0.1,
    "why": "Knee bend"
   }
  ],
  "stick": 0,
  "options": {},
  "lines": [],
  "e": 2.1,
  "notes": [
   "Note: Any number of empty swings allowed for Developmental. For PH, that includes single leg swings",
   "Note: The ½ circle dismount does not follow the MDP clarification regarding the flank off that it must come from a circling skill"
  ],
  "last": {
   "eg": 0.5,
   "d": 0.7,
   "bonus": 0,
   "sv": 11.2,
   "nd": 0,
   "e": 2.2,
   "final": 9
  }
 },
 {
  "id": "int-ph",
  "level": "int",
  "event": "ph",
  "youtube": "lAJLPhhrXwg",
  "rows": [
   {
    "name": "Single Leg Stockli",
    "label": "Single leg Stockli",
    "skillId": "UCG-PH-single-leg-stockli",
    "letter": "A",
    "eg": 0,
    "ded": "0.1, 0.1",
    "e": 0.2,
    "why": "Knee bend, rhythm"
   },
   {
    "name": "Scissor",
    "label": "Scissor forward",
    "skillId": "WG-PH-I-1",
    "letter": "A",
    "eg": 1,
    "ded": "0.1",
    "e": 0.1,
    "why": "Knee bend"
   },
   {
    "name": "Scissor Hop",
    "label": "Scissor forward with travel sideways (also with 1/2 t.)",
    "skillId": "WG-PH-I-2",
    "letter": "B",
    "eg": 1,
    "ded": "0.3, 0.1",
    "e": 0.4,
    "why": "Rhythm, knee bend"
   },
   {
    "name": "Single Leg Travel",
    "label": "Single leg travel",
    "skillId": "UCG-PH-single-leg-travel",
    "letter": "A",
    "eg": 0,
    "ded": "0.1, 0.1, 0.1",
    "e": 0.3,
    "why": "Leg cut height, rhythm, knee bend"
   },
   {
    "name": "Circle",
    "label": "Any circle or flair in side support (Thomas)",
    "skillId": "WG-PH-II-1",
    "letter": "A",
    "eg": 2,
    "ded": "0.1, 0.1",
    "e": 0.2,
    "why": "Pike, knee bend"
   },
   {
    "name": "Circle ½ dismount",
    "label": "½ Circle Dismount",
    "skillId": "UCG-PH-circle-dismount",
    "letter": "Sub-A",
    "eg": 0,
    "ded": "",
    "e": 0,
    "why": ""
   }
  ],
  "stick": 0,
  "options": {},
  "lines": [
   {
    "kind": "execution",
    "what": "Leg Cuts",
    "v": 0.6,
    "why": "Height"
   }
  ],
  "e": 1.8,
  "notes": [],
  "last": {
   "eg": 0.8,
   "d": 0.7,
   "bonus": 0,
   "sv": 11.5,
   "nd": 0,
   "e": 1.8,
   "final": 9.7
  }
 },
 {
  "id": "adv-ph",
  "level": "adv",
  "event": "ph",
  "drive": "11AlWnttf_GWG1LYRzKfn3gqzAnfWtDxr",
  "rows": [
   {
    "name": "Full Scissor Travel Down",
    "label": "Double scissor fwd. (¼ t. fwd. a. ¼ t. bwd.) with travel sideways",
    "skillId": "WG-PH-I-9",
    "letter": "C",
    "eg": 1,
    "ded": "0.2",
    "e": 0.2,
    "why": "0.1 Amplitude, 0.1 Contact with Horse"
   },
   {
    "name": "Mikulak",
    "label": "Double front scissor, end to end (Mikulak)",
    "skillId": "WG-PH-I-10",
    "letter": "D",
    "eg": 1,
    "ded": "0.6",
    "e": 0.6,
    "why": "0.1 Leg Bend, 0.5 Contact with horse Per FIG, full support with leg prior to finishing element results in 0.5 and non recognition.",
    "nr": true
   },
   {
    "name": "Half Scissor Travel Up",
    "label": "Scissor forward with travel sideways (also with 1/2 t.)",
    "skillId": "WG-PH-I-2",
    "letter": "B",
    "eg": 1,
    "ded": "0.2",
    "e": 0.2,
    "why": "2x 0.1 Amplitude on Scissor/leg cut"
   },
   {
    "name": "Full Scissor Forward w/ Travel and ½ Turn",
    "label": "Double Scissor fwd with travel swd. and ½ turn",
    "skillId": "UCG-PH-double-scissor-fwd-with-travel-swd-and-turn",
    "letter": "D",
    "eg": 1,
    "ded": "0.3",
    "e": 0.3,
    "why": "0.1 Leg bend, 0.1 Contact with horse, 0.1 Momentary Stop (Rhythm)"
   },
   {
    "name": "Circle",
    "label": "Any circle or flair in side support (Thomas)",
    "skillId": "WG-PH-II-1",
    "letter": "A",
    "eg": 2,
    "ded": "0.4",
    "e": 0.4,
    "why": "0.3 Leg cut in amplitude, 0.1 Circle Extension"
   },
   {
    "name": "3/3 Side Travel Over Both Pommels with Hop",
    "label": "Full side travel over both pommels",
    "skillId": "WG-PH-III-4",
    "letter": "D",
    "eg": 3,
    "ded": "0.3",
    "e": 0.3,
    "why": "0.1 Contact with horse, 0.1 leg bend, 0.1 Circle Extension"
   },
   {
    "name": "Schwabenflanke",
    "label": "Schwabenflank",
    "skillId": "WG-PH-II-73",
    "letter": "A",
    "eg": 2,
    "ded": "0.3",
    "e": 0.3,
    "why": "0.1 circle extension, 0.1 Contact with horse, 0.1 arm bend"
   },
   {
    "name": "Circle Handstand 3/3 Travel w/ 270°",
    "label": "Circle or flair through handstand dismount, 450°+ turn or 3/3 travel (min. 270° turn)",
    "skillId": "WG-PH-IV-20b",
    "letter": "C",
    "eg": 4,
    "ded": "0.6",
    "e": 0.6,
    "why": "0.1 Contact with horse, 0.1 Circle Extension, 0.3 Swing with Strength, 0.1 Feet"
   }
  ],
  "stick": 0,
  "options": {},
  "lines": [],
  "e": 2.9,
  "notes": [],
  "last": {
   "eg": 1.6,
   "d": 1.8,
   "bonus": 0,
   "sv": 13.4,
   "nd": 0,
   "e": 2.9,
   "final": 10.5
  }
 },
 {
  "id": "dev-sr",
  "level": "dev",
  "event": "sr",
  "youtube": "wmPVrcZKRYw",
  "rows": [
   {
    "name": "Muscle up",
    "label": "Muscle up",
    "skillId": "UCG-SR-muscle-up",
    "letter": "A",
    "eg": 0,
    "ded": "",
    "e": 0,
    "why": ""
   },
   {
    "name": "Press to shoulderstand",
    "label": "Pike press to shoulderstand (2 s.)",
    "skillId": "UCG-SR-pike-press-to-shoulderstand-2-s",
    "letter": "A",
    "eg": 0,
    "ded": "",
    "e": 0,
    "why": "Not required to start from L"
   },
   {
    "name": "L -Sit",
    "label": "L-sit or straddle L-sit",
    "skillId": "WG-SR-II-1",
    "letter": "A",
    "eg": 2,
    "ded": "",
    "e": 0,
    "why": ""
   },
   {
    "name": "Forward roll from support",
    "label": "Forward roll down from support to swing",
    "skillId": "WG-SR-I-7",
    "letter": "A",
    "eg": 1,
    "ded": "0.1, 0.1",
    "e": 0.2,
    "why": "Rhythm, knee bend on back swing"
   },
   {
    "name": "German Hang",
    "label": "German hang (2 s.)",
    "skillId": "UCG-SR-german-hang-2-s",
    "letter": "Sub-A",
    "eg": 0,
    "ded": "0.1",
    "e": 0.1,
    "why": "Swing of rings"
   },
   {
    "name": "Back Pike",
    "label": "Salto bwd. piked or straight also with ½",
    "skillId": "WG-SR-IV-25",
    "letter": "A",
    "eg": 4,
    "ded": "0.3, 0.1",
    "e": 0.4,
    "why": "Step, Leg separation back swing"
   }
  ],
  "stick": 0,
  "options": {},
  "lines": [],
  "e": 0.7,
  "notes": [
   "Note: Any number of empty swings allowed for Developmental."
  ],
  "last": {
   "eg": 1.5,
   "d": 0.6,
   "bonus": 0,
   "sv": 12.1,
   "nd": 0,
   "e": 0.7,
   "final": 11.4
  }
 },
 {
  "id": "int-sr",
  "level": "int",
  "event": "sr",
  "youtube": "1wd5CMEFAh8",
  "rows": [
   {
    "name": "Inlocate",
    "label": "Inlocate, piked or straight",
    "skillId": "WG-SR-I-37",
    "letter": "A",
    "eg": 1,
    "ded": "0.1",
    "e": 0.1,
    "why": "Body Position"
   },
   {
    "name": "Back uprise",
    "label": "Back uprise to support",
    "skillId": "WG-SR-I-31",
    "letter": "A",
    "eg": 1,
    "ded": "0.3",
    "e": 0.3,
    "why": "Arm Bend"
   },
   {
    "name": "L - sit",
    "label": "L-sit or straddle L-sit",
    "skillId": "WG-SR-II-1",
    "letter": "A",
    "eg": 2,
    "ded": "0.1, 0.1",
    "e": 0.2,
    "why": "Swing, Unsteadiness"
   },
   {
    "name": "German hang",
    "label": "German hang (2 s.)",
    "skillId": "UCG-SR-german-hang-2-s",
    "letter": "Sub-A",
    "eg": 0,
    "ded": "0.1",
    "e": 0.1,
    "why": "Swing"
   },
   {
    "name": "Dislocate",
    "label": "Back dislocate, piked or straight",
    "skillId": "WG-SR-I-25",
    "letter": "A",
    "eg": 1,
    "ded": "",
    "e": 0,
    "why": ""
   },
   {
    "name": "Back Layout",
    "label": "Salto bwd. piked or straight also with ½",
    "skillId": "WG-SR-IV-25",
    "letter": "A",
    "eg": 4,
    "ded": "",
    "e": 0,
    "why": ""
   }
  ],
  "stick": 0,
  "options": {},
  "lines": [],
  "e": 0.7,
  "notes": [],
  "last": {
   "eg": 0.9,
   "d": 0.6,
   "bonus": 0,
   "sv": 11.5,
   "nd": 0,
   "e": 0.7,
   "final": 10.8
  }
 },
 {
  "id": "adv-sr",
  "level": "adv",
  "event": "sr",
  "drive": "1EmudfdMr6NOPrBLeu4rAplqUn6pXr6UT",
  "rows": [
   {
    "name": "Back Uprise Straddle Planche",
    "label": "Back uprise to straddle planche",
    "skillId": "WG-SR-III-68",
    "letter": "B",
    "eg": 3,
    "ded": "0.6",
    "e": 0.6,
    "why": "0.3 Swing to high position, 0.3 final hold position"
   },
   {
    "name": "Maltese",
    "label": "Maltese (Hirondelle)",
    "skillId": "WG-SR-II-10",
    "letter": "D",
    "eg": 2,
    "ded": "0.6",
    "e": 0.6,
    "why": "0.3 Body angle, 0.3 Short Hold *One time bonus of 0.3 awarded for strength skill of value C or higher."
   },
   {
    "name": "Dislocate",
    "label": "Back dislocate, piked or straight",
    "skillId": "WG-SR-I-25",
    "letter": "A",
    "eg": 1,
    "ded": "",
    "e": 0,
    "why": ""
   },
   {
    "name": "Dislocate",
    "label": "Back dislocate, piked or straight",
    "skillId": "WG-SR-I-25",
    "letter": "A",
    "eg": 1,
    "ded": "",
    "e": 0,
    "why": "Simple Repetition",
    "nr": true
   },
   {
    "name": "Swing to HS Backwards",
    "label": "Forward swing or back giant to handstand",
    "skillId": "WG-SR-I-75",
    "letter": "C",
    "eg": 1,
    "ded": "0.4",
    "e": 0.4,
    "why": "0.3 Arm bend on swing, 0.1 HS instability"
   },
   {
    "name": "Front Giant",
    "label": "Back uprise or front giant to handstand",
    "skillId": "WG-SR-I-81",
    "letter": "C",
    "eg": 1,
    "ded": "0.3",
    "e": 0.3,
    "why": "0.1 arm bend, 0.1 leg bend, 0.1 swinging of cables"
   },
   {
    "name": "Back Uprise",
    "label": "Back uprise to support",
    "skillId": "WG-SR-I-31",
    "letter": "A",
    "eg": 1,
    "ded": "",
    "e": 0,
    "why": ""
   },
   {
    "name": "L - Sit",
    "label": "L-sit or straddle L-sit",
    "skillId": "WG-SR-II-1",
    "letter": "A",
    "eg": 2,
    "ded": "0.3",
    "e": 0.3,
    "why": "Short Hold"
   },
   {
    "name": "Straight Arm Bent Body Press HS",
    "label": "Handstand press: bent-arm straight or straight-arm piked",
    "skillId": "WG-SR-II-26",
    "letter": "B",
    "eg": 2,
    "ded": "0.4",
    "e": 0.4,
    "why": "0.3 Bent Arms, 0.1 HS instability"
   },
   {
    "name": "Swing down from HS and Salto Bwd Stretched",
    "label": "From support swing forward (any entry), back salto dismount piked or stretched",
    "skillId": "UCG-SR-uprise-bwd-or-swing-down-from-handstand-and-salto-bwd-piked-",
    "letter": "B",
    "eg": 4,
    "ded": "0.1",
    "e": 0.1,
    "why": "Small step"
   }
  ],
  "stick": 0,
  "options": {
   "strength": true
  },
  "lines": [],
  "e": 2.7,
  "notes": [],
  "last": {
   "eg": 1.5,
   "d": 1.8,
   "bonus": 0.3,
   "sv": 13.6,
   "nd": 0,
   "e": 2.7,
   "final": 10.9
  }
 },
 {
  "id": "dev-vt",
  "level": "dev",
  "event": "vt",
  "drive": "1JbQ0huzoFUZhoScFMHfC2iGZN5kWA5GB",
  "vault": "201",
  "name": "Front Handspring",
  "stick": 0.1,
  "ded": "0.3, 0.1",
  "why": "Lack of rise, not passing through vertical",
  "e": 0.4,
  "notes": [
   "Note: vault does not need to be flipping to receive stick bonus"
  ],
  "last": {
   "eg": null,
   "d": 1.2,
   "bonus": 0.1,
   "sv": 11.3,
   "nd": 0,
   "e": 0.4,
   "final": 10.9
  }
 },
 {
  "id": "int-vt",
  "level": "int",
  "event": "vt",
  "youtube": "iw-cMRsmPng",
  "vault": "501",
  "name": "Round Off",
  "stick": 0.1,
  "ded": "0.3, 0.1",
  "why": "Height, unsteadiness in landing",
  "e": 0.4,
  "notes": [],
  "last": {
   "eg": null,
   "d": 1.2,
   "bonus": 0.1,
   "sv": 11.3,
   "nd": 0,
   "e": 0.4,
   "final": 10.9
  }
 },
 {
  "id": "adv-vt",
  "level": "adv",
  "event": "vt",
  "drive": "1aILxB3R83R4dorjGzUbjap00TDzguyzO",
  "vault": "313",
  "name": "Tsukahara Straight",
  "stick": 0,
  "ded": "0.7",
  "why": "0.1 Pre-Flight Legs Apart, 0.1 Body Alignment, 0.1 Bent Legs, 0.1 Feet apart, 0.3 Step",
  "e": 0.7,
  "notes": [],
  "last": {
   "eg": null,
   "d": 2.8,
   "bonus": 0,
   "sv": 12.8,
   "nd": 0,
   "e": 0.7,
   "final": 12.1
  }
 },
 {
  "id": "dev-pb",
  "level": "dev",
  "event": "pb",
  "youtube": "9KwgcAB9v00",
  "rows": [
   {
    "name": "Kip",
    "label": "Glide kip",
    "skillId": "WG-PB-III-73",
    "letter": "A",
    "eg": 3,
    "ded": "0.1, 0.1",
    "e": 0.2,
    "why": "Arm bend, Knee bend"
   },
   {
    "name": "L Sit",
    "label": "L-sit hold",
    "skillId": "WG-PB-II-7",
    "letter": "A",
    "eg": 2,
    "ded": "0.1",
    "e": 0.1,
    "why": "Knee bend"
   },
   {
    "name": "Shoulderstand",
    "label": "Press to shoulderstand (2 s.)",
    "skillId": "UCG-PB-press-to-shoulderstand-2-s",
    "letter": "A",
    "eg": 0,
    "ded": "0.3, 0.5",
    "e": 0.8,
    "why": "Lowering legs, no hold (credit still given)"
   },
   {
    "name": "Forward Roll",
    "label": "Forward roll to upper arm from shoulderstand, L, or support swing bwd",
    "skillId": "UCG-PB-forward-roll-to-upper-arm-from-shoulderstand-l-or-support-sw",
    "letter": "Sub-A",
    "eg": 0,
    "ded": "0.1",
    "e": 0.1,
    "why": "Bent legs on swing"
   },
   {
    "name": "Front Uprise",
    "label": "Front uprise to support",
    "skillId": "WG-PB-I-1",
    "letter": "A",
    "eg": 1,
    "ded": "0.3, 0.1",
    "e": 0.4,
    "why": "Height, knee bend"
   },
   {
    "name": "Flank Dismount",
    "label": "Flank dismount from at least 45° above horizontal",
    "skillId": "UCG-PB-flank-dismount-from-at-least-45-above-horizontal",
    "letter": "Sub-A",
    "eg": 0,
    "ded": "0.1",
    "e": 0.1,
    "why": "Leg separation (Note: 45 deg above horizontal required)"
   }
  ],
  "stick": 0.1,
  "options": {},
  "lines": [],
  "e": 1.7,
  "notes": [
   "Note: Any number of empty swings allowed for Developmental.",
   "Note: Stick bonus can be given for a non- EG IV A"
  ],
  "last": {
   "eg": 1.5,
   "d": 0.6,
   "bonus": 0.1,
   "sv": 12.1,
   "nd": 0,
   "e": 1.7,
   "final": 10.4
  }
 },
 {
  "id": "int-pb",
  "level": "int",
  "event": "pb",
  "youtube": "eOOFV1BmwEs",
  "rows": [
   {
    "name": "Kip",
    "label": "Glide kip",
    "skillId": "WG-PB-III-73",
    "letter": "A",
    "eg": 3,
    "ded": "0.1, 0.1",
    "e": 0.2,
    "why": "Arm bend, leg drop into L"
   },
   {
    "name": "L",
    "label": "L-sit hold",
    "skillId": "WG-PB-II-7",
    "letter": "A",
    "eg": 2,
    "ded": "",
    "e": 0,
    "why": ""
   },
   {
    "name": "Shoulderstand",
    "label": "Press to shoulderstand (2 s.)",
    "skillId": "UCG-PB-press-to-shoulderstand-2-s",
    "letter": "A",
    "eg": 0,
    "ded": "0.1",
    "e": 0.1,
    "why": "Strength with swing"
   },
   {
    "name": "Front Uprise",
    "label": "Front uprise to support",
    "skillId": "WG-PB-I-1",
    "letter": "A",
    "eg": 1,
    "ded": "0.1, 0.1",
    "e": 0.2,
    "why": "Knee bend, height"
   },
   {
    "name": "Handstand",
    "label": "Any swing to handstand",
    "skillId": "WG-PB-II-1",
    "letter": "A",
    "eg": 2,
    "ded": "",
    "e": 0,
    "why": ""
   },
   {
    "name": "Back Pike",
    "label": "Back pike or layout, optional ½ twist",
    "skillId": "WG-PB-IV-19",
    "letter": "A",
    "eg": 4,
    "ded": "0.1, 0.1, 0.1",
    "e": 0.3,
    "why": "Indistinct position, knee bend, lack of prep"
   }
  ],
  "stick": 0.1,
  "options": {},
  "lines": [],
  "e": 0.8,
  "notes": [
   "Note: No deduction for change of direction from swing handstand"
  ],
  "last": {
   "eg": 1.4,
   "d": 0.6,
   "bonus": 0.1,
   "sv": 12.1,
   "nd": 0,
   "e": 0.8,
   "final": 11.3
  }
 },
 {
  "id": "adv-pb",
  "level": "adv",
  "event": "pb",
  "drive": "1cjt9FfGN9aRCMRF86gPGgnqlBM1IceBY",
  "rows": [
   {
    "name": "Felge to hang",
    "label": "Felge with travel to hang",
    "skillId": "WG-PB-III-115",
    "letter": "A",
    "eg": 3,
    "ded": "",
    "e": 0,
    "why": ""
   },
   {
    "name": "Glide Kip",
    "label": "Glide kip",
    "skillId": "WG-PB-III-73",
    "letter": "A",
    "eg": 3,
    "ded": "",
    "e": 0,
    "why": ""
   },
   {
    "name": "L-Sit",
    "label": "L-sit hold",
    "skillId": "WG-PB-II-7",
    "letter": "A",
    "eg": 2,
    "ded": "0.4",
    "e": 0.4,
    "why": "0.1 Foot Angle, 0.3 Short Hold"
   },
   {
    "name": "Cast to Upper Arm",
    "label": "Cast to upper arm hang",
    "skillId": "WG-PB-III-97",
    "letter": "A",
    "eg": 3,
    "ded": "",
    "e": 0,
    "why": ""
   },
   {
    "name": "Back uprise Straddle cut to bent arm Support",
    "label": "Back uprise, straddle cut or flank, bent-arm support",
    "skillId": "WG-PB-I-61",
    "letter": "A",
    "eg": 1,
    "ded": "0.2",
    "e": 0.2,
    "why": "0.1 Leg Bend, 0.1 Toe Flex"
   },
   {
    "name": "Swing HS",
    "label": "Any swing to handstand",
    "skillId": "WG-PB-II-1",
    "letter": "A",
    "eg": 2,
    "ded": "0.5",
    "e": 0.5,
    "why": "0.1 Knee bend, 0.1 Feet Apart, 0.1 x 2 Steps, 0.1 Uncontrolled Momentary Hold"
   },
   {
    "name": "Front Uprise",
    "label": "Front uprise to support",
    "skillId": "WG-PB-I-1",
    "letter": "A",
    "eg": 1,
    "ded": "0.1",
    "e": 0.1,
    "why": "Low body angle"
   },
   {
    "name": "Front Layout 1/2",
    "label": "Front pike or layout, optional ½ twist",
    "skillId": "WG-PB-IV-1",
    "letter": "A",
    "eg": 4,
    "ded": "0.5",
    "e": 0.5,
    "why": "0.1 Chest Down, 0.1 Body position, 0.3 Step"
   }
  ],
  "stick": 0,
  "options": {},
  "lines": [],
  "e": 1.7,
  "notes": [
   "Note: There is no deduction for change of direction from a HS at any UCG level"
  ],
  "last": {
   "eg": 1.2,
   "d": 0.8,
   "bonus": 0,
   "sv": 12,
   "nd": 0,
   "e": 1.7,
   "final": 10.3
  }
 },
 {
  "id": "dev-hb",
  "level": "dev",
  "event": "hb",
  "youtube": "TXesc5Rb80o",
  "rows": [
   {
    "name": "Pullover",
    "label": "Pull Over",
    "skillId": "UCG-HB-pull-over",
    "letter": "Sub-A",
    "eg": 0,
    "ded": "",
    "e": 0,
    "why": ""
   },
   {
    "name": "Cast to Horizontal",
    "label": "Cast to Horizontal",
    "skillId": "UCG-HB-cast-to-horizontal",
    "letter": "Sub-A",
    "eg": 0,
    "ded": "0.1",
    "e": 0.1,
    "why": "Height"
   },
   {
    "name": "Back Hipcircle",
    "label": "Backward Hip Circle",
    "skillId": "UCG-HB-backward-hip-circle",
    "letter": "Sub-A",
    "eg": 0,
    "ded": "0.1, 0.1",
    "e": 0.2,
    "why": "Rhythm, arm bend"
   },
   {
    "name": "Back Uprise",
    "label": "Back uprise to support",
    "skillId": "UCG-HB-back-uprise-to-support",
    "letter": "A",
    "eg": 0,
    "ded": "0.3, 0.1",
    "e": 0.4,
    "why": "Rhythm, leg separation"
   },
   {
    "name": "Kip to Support",
    "label": "Kip to support",
    "skillId": "UCG-HB-kip-to-support",
    "letter": "A",
    "eg": 0,
    "ded": "0.1, 0.1",
    "e": 0.2,
    "why": "Arm bend, leg separation"
   },
   {
    "name": "Back Pike",
    "label": "Salto bwd. piked or str. also with ½ or 1/1 t",
    "skillId": "WG-HB-IV-25",
    "letter": "A",
    "eg": 4,
    "ded": "0.1",
    "e": 0.1,
    "why": "Lack of prep"
   }
  ],
  "stick": 0.1,
  "options": {},
  "lines": [],
  "e": 1,
  "notes": [
   "Note: Any number of empty swings allowed at Developmental"
  ],
  "last": {
   "eg": 0.5,
   "d": 0.6,
   "bonus": 0.1,
   "sv": 11.2,
   "nd": 0,
   "e": 0.9,
   "final": 10.3
  }
 },
 {
  "id": "int-hb",
  "level": "int",
  "event": "hb",
  "youtube": "2keQH9G2-0w",
  "rows": [
   {
    "name": "Pullover",
    "label": "Pull Over",
    "skillId": "UCG-HB-pull-over",
    "letter": "Sub-A",
    "eg": 0,
    "ded": "0.1",
    "e": 0.1,
    "why": "Pause / Rhythm"
   },
   {
    "name": "¾ Front Giant",
    "label": "3/4 Forward Giant hop out",
    "skillId": "UCG-HB-3-4-forward-giant-hop-out",
    "letter": "A",
    "eg": 0,
    "ded": "0.3, 0.1, 0.1",
    "e": 0.5,
    "why": "Height / Angle, bent arms, bent arms on hop out"
   },
   {
    "name": "Half Turn",
    "label": "Swing to 1/2 turn, also with hop, also to support",
    "skillId": "UCG-HB-swing-to-1-2-turn-also-with-hop-also-to-support",
    "letter": "Sub-A",
    "eg": 0,
    "ded": "0.1, 0.1",
    "e": 0.2,
    "why": "Rhythm, leg separation"
   },
   {
    "name": "Kip to Support",
    "label": "Kip to support",
    "skillId": "UCG-HB-kip-to-support",
    "letter": "A",
    "eg": 0,
    "ded": "0.3, 0.1, 0.1",
    "e": 0.5,
    "why": "Arm bend, pause, leg separation"
   },
   {
    "name": "Cast to Horizontal",
    "label": "Cast to Horizontal",
    "skillId": "UCG-HB-cast-to-horizontal",
    "letter": "Sub-A",
    "eg": 0,
    "ded": "0.1",
    "e": 0.1,
    "why": "Arm bend"
   },
   {
    "name": "Back Pike",
    "label": "Salto bwd. piked or str. also with ½ or 1/1 t",
    "skillId": "WG-HB-IV-25",
    "letter": "A",
    "eg": 4,
    "ded": "",
    "e": 0,
    "why": ""
   }
  ],
  "stick": 0.1,
  "options": {},
  "lines": [],
  "e": 1.4,
  "notes": [
   "Note: Kip to Support vs Kip EG III – Kip with stop before cast receives non-EG A. Kip to continuous cast receives A and EG III (Same as MDP)"
  ],
  "last": {
   "eg": 0.3,
   "d": 0.6,
   "bonus": 0.1,
   "sv": 11,
   "nd": 0,
   "e": 1.3,
   "final": 9.7
  }
 },
 {
  "id": "adv-hb",
  "level": "adv",
  "event": "hb",
  "drive": "1piiGMEEMgOQObRurnLb2UyJaJSSbUJ9t",
  "rows": [
   {
    "name": "Back Uprise Rear Vault",
    "label": "Back uprise, rear vault ¼ turn to hang",
    "skillId": "WG-HB-II-32",
    "letter": "B",
    "eg": 2,
    "ded": "0.4",
    "e": 0.4,
    "why": "0.1 Feet apart, 0.1 Incomplete turn before hang, 0.1 Asynchronous release of hands, 0.1 Amplitude"
   },
   {
    "name": "Kip Handstand",
    "label": "Kip to handstand",
    "skillId": "WG-HB-III-1",
    "letter": "A",
    "eg": 3,
    "ded": "0.1",
    "e": 0.1,
    "why": "Knee bend"
   },
   {
    "name": "Front Giant",
    "label": "Front giant",
    "skillId": "WG-HB-I-13",
    "letter": "A",
    "eg": 1,
    "ded": "",
    "e": 0,
    "why": ""
   },
   {
    "name": "½ Pirouette",
    "label": "½ turn through handstand",
    "skillId": "WG-HB-I-19",
    "letter": "A",
    "eg": 1,
    "ded": "0.6",
    "e": 0.6,
    "why": "0.1 Feet apart, 0.1 leg bend, 0.1 Additional hand placement, 0.3 Angle past HS"
   },
   {
    "name": "Back Giant",
    "label": "Back giant",
    "skillId": "WG-HB-I-31",
    "letter": "A",
    "eg": 1,
    "ded": "0.2",
    "e": 0.2,
    "why": "2 x 0.1 Additional Hand placements"
   },
   {
    "name": "Back Giant ½ Turn",
    "label": "Backward ½ turn through handstand",
    "skillId": "WG-HB-I-37",
    "letter": "A",
    "eg": 1,
    "ded": "0.6",
    "e": 0.6,
    "why": "0.1 arm bend, 0.5 Angle past HS"
   },
   {
    "name": "Front Giant",
    "label": "Front giant",
    "skillId": "WG-HB-I-13",
    "letter": "A",
    "eg": 1,
    "ded": "0.8",
    "e": 0.8,
    "why": "0.5 Arm bend, 0.3 leg bend",
    "nr": true
   },
   {
    "name": "½ Pirouette",
    "label": "½ turn through handstand",
    "skillId": "WG-HB-I-19",
    "letter": "A",
    "eg": 1,
    "ded": "0.4",
    "e": 0.4,
    "why": "Simple Repetition 0.3 Angle past HS, 0.1 feet apart",
    "nr": true
   },
   {
    "name": "Back Giant(s)",
    "label": "Back giant",
    "skillId": "WG-HB-I-31",
    "letter": "A",
    "eg": 1,
    "ded": "0.1",
    "e": 0.1,
    "why": "Simple Repetition 0.1 Hand movement",
    "nr": true
   },
   {
    "name": "Back Layout",
    "label": "Salto bwd. piked or str. also with ½ or 1/1 t",
    "skillId": "WG-HB-IV-25",
    "letter": "A",
    "eg": 4,
    "ded": "0.4",
    "e": 0.4,
    "why": "0.1 Toe point, 0.3 Step"
   }
  ],
  "stick": 0,
  "options": {},
  "lines": [
   {
    "kind": "execution",
    "what": "Mount",
    "v": 0.3,
    "why": "Maximum of 3 swings/movements prior to 1st skill"
   }
  ],
  "e": 3.9,
  "notes": [],
  "last": {
   "eg": 1.2,
   "d": 0.8,
   "bonus": 0,
   "sv": 12,
   "nd": 0,
   "e": 3.9,
   "final": 8.1
  }
 }
];
