"""Parse the WAG Xcel example routine workbook into a plain JSON list (no matching)."""
import json, re, sys
from collections import Counter
import openpyxl

src, out = sys.argv[1], sys.argv[2]
wb = openpyxl.load_workbook(src, data_only=True)
LEVELS = {'Xcel Silver': 'silver', 'Xcel Gold': 'gold', 'Xcel Platinum': 'plat', 'Xcel Diamond': 'diamond', 'Xcel Sapphire': 'sapphire'}
EVENTS = {'Uneven Bars': 'ub', 'Balance Beam': 'bb', 'Floor Exercise': 'fx'}

routines = []
problems = []
for ws in wb.worksheets:
    if ws.title not in LEVELS:
        print('skip tab', ws.title)
        continue
    level = LEVELS[ws.title]
    grid = {(c.row, c.column): c.value for row in ws.iter_rows() for c in row if c.value not in (None, '')}
    maxr = max(r for r, _ in grid)
    heads = sorted((r, EVENTS[v]) for (r, c), v in grid.items() if c == 1 and isinstance(v, str) and v.strip() in EVENTS)
    for k, (hr, ev) in enumerate(heads):
        end = heads[k + 1][0] if k + 1 < len(heads) else maxr + 1
        rr = next(r for r in range(hr + 1, end) if any(isinstance(grid.get((r, c)), str) and grid[(r, c)].startswith('Routine') for c in range(1, 40)))
        cols = sorted((c, int(re.search(r'\d+', grid[(rr, c)]).group())) for c in range(1, 40) if isinstance(grid.get((rr, c)), str) and grid[(rr, c)].startswith('Routine'))
        # The tally block ("A" / 5 ...) and "Bonus" end the routines.
        tally_rows = [r for r in range(rr + 1, end) if grid.get((r, 1)) in ('A', 'B', 'C', 'D', 'Bonus') and isinstance(grid.get((r, 2)), (int, float))]
        stop = tally_rows[0] if tally_rows else end
        for c, n in cols:
            skills = []
            for r in range(rr + 1, stop):
                v = grid.get((r, c))
                if not isinstance(v, str):
                    continue
                s = {'name': re.sub(r'\s+', ' ', v).strip()}
                if level in ('diamond', 'sapphire'):
                    s['letter'] = grid.get((r, c + 1))
                if level == 'sapphire' and isinstance(grid.get((r, c + 2)), (int, float)):
                    s['bonus'] = grid[(r, c + 2)]
                skills.append(s)
            if not skills:
                print('empty routine', level, ev, n)
                continue
            tally = {grid[(r, c)]: grid.get((r, c + 1)) for r in tally_rows if grid.get((r, c)) in ('A', 'B', 'C', 'D', 'Bonus')}
            if tally:
                got = Counter(s['letter'] for s in skills)
                for L in 'ABCD':
                    if L in tally and got.get(L, 0) != tally[L]:
                        problems.append(f'{level} {ev} R{n}: {L} sheet {tally[L]} parsed {got.get(L, 0)}')
                if 'Bonus' in tally:
                    b = round(sum(s.get('bonus', 0) for s in skills), 2)
                    if abs(b - tally['Bonus']) > 1e-9:
                        problems.append(f'{level} {ev} R{n}: bonus sheet {tally["Bonus"]} cells {b}')
            routines.append({'level': level, 'event': ev, 'n': n, 'skills': skills, **({'sheetBonus': tally['Bonus']} if 'Bonus' in tally else {})})

json.dump(routines, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(routines), 'routines', Counter((r['level']) for r in routines))
print('tally problems:', problems or 'none')
