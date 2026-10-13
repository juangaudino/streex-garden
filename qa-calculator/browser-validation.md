# Rendered Calculator verification

Verification performed in the integrated browser against the working branch, not a physical iPhone. Calibration observations entered during QA are simulated measurements and are not agronomic validation.

## Executed workflows

- New Quick Mix: zero plants and unknown source EC; canonical searchable picker used to select Bibb Lettuce.
- Calibration: switched to an uncalibrated GH manufacturer recipe context; entered sample 4 L, before 0.20, after 1.10, actual Micro/Gro/Bloom 4/3/2 mL. Saving completed the workflow and immediately produced By EC doses.
- By EC: lettuce evidence 1.20–1.80; suggested point 1.35; calculated components 5.11/3.83/2.56 mL. Explicit target 1.20 changed them to 4.44/3.33/2.22. Changing preparation volume 4 → 10 L changed them to 11.11/8.33/5.56.
- Correct: current 0.80, target 1.20, actual 4 L produced 1.78/1.33/0.89 mL; 1.10 produced 0.44/0.33/0.22. Current 1.80 required dilution; bounded-capacity scenarios reject impossible additions. Recording actual partial doses advanced the measured current EC; remeasurement advanced the iteration.
- Top Up: actual 3 L at 0.80 + 1 L water at 0.20 produces approximate mixed EC 0.65, requiring 2.44/1.83/1.22 mL toward 1.20. Capacity must leave room for stock (4.1 L used for the valid fixture); 4 L exact capacity is rejected.
- Recipe: GH Grow week 2 at 4 L displays 3.80/3.59/2.75 mL and manufacturer EC 0.90–1.10. Bloom week 3 at 10 L displays 12.15/12.15/17.44 mL. Crops do not rewrite manufacturer doses.
- AeroGarden: verified 6/7-pod 8 mL, 9-pod first/second 8 mL and later 12 mL; no invented reservoir liters for the official dose.
- Multi-crop: canonical picker exercised with 1, 2, 3 and 5 identities, including common-range and non-overlap cases. Independent numerical assertions cover order independence and duplicates.
- Saved System: save/update through the text-name dialog, reload page, select saved card. Target 1.00, Top Up mode, capacity 4, actual remaining 3, added water 1, current EC 0.80, source 0.20 and calibration restore. The exact-capacity configuration is preserved but correctly blocked; it is not silently rewritten.
- EN → ES: mode labels, measured fields and composition limitation translated; proper cultivar/product names retained.

## Width measurements

The browser uses a 15 px desktop scrollbar in emulation. After fixing the Workbench's intrinsic grid minimum, document clientWidth equals scrollWidth at every tested size:

| Requested viewport | clientWidth | scrollWidth |
| --- | ---: | ---: |
| 375 × 667 | 360 | 360 |
| 390 × 844 | 375 | 375 |
| 430 × 932 | 415 | 415 |
| 844 × 390 | 829 | 829 |
| 768 × 1024 | 753 | 753 |
| 1440 × 900 | 1425 | 1425 |

Screenshots inspected for mobile and desktop. This evidence does not establish real iOS keyboard/PWA behavior or real measured nutrient response.

## Gates not substituted by software QA

- An empirical exact-formulation calibration is not available in the inspected repository/prototype. No coefficient was invented or imported as a real measurement.
- Physical iPhone acceptance remains User Zero's final gate.
- Full repository tests retain an unrelated Compare baseline failure; relevant Gardenpedia/Calculator tests pass.
