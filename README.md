# Dementia Support Choices

A public website that presents the results of an Australian discrete choice experiment on dementia support programmes as tools for three groups. It has not yet been tested with families, carers or providers.

- **Families and carers** (`families.html`): plain-language information on programme types, a short exercise to work out what matters most, a printable summary with questions to ask providers, and national helplines.
- **Service providers and programme designers** (`plan.html`): build a programme from seven features and see predicted take-up with 95% intervals, a rating against all 1,536 designs the study allowed, a "What this means" summary that updates with every change, where the programme could improve (a traffic light for each feature with a one-click fix), how likely different people are to use it, and a side-by-side comparison.
- **Funders, policy makers and providers** (`value.html`): a screening comparison of stated value with running cost. Stated value is the area under each simulated person's acceptance curve from the fee to A$50, the highest fee in the study (a cautious, partial measure, not complete consumer surplus), plus fees paid; costs use the provider cost per participant per session the user enters. The result reports whether the 95% interval of the ratio is above 1, includes 1 or is below 1, in neutral colours, with the break-even running cost, sensitivity to running cost, fee and the share of stated value counted, and a comparison with a second programme.
- **Policy makers and funders** (`fees.html`): take-up and price sensitivity across fees from free to A$50 per session, switching between two programmes when a fee rises, travel distance by delivery mode, and who a programme will not reach.
- **Funders and policy makers** (`budget.html`): the programme design and fee with the highest stated value within a public budget, using CHSP national unit prices (funding benchmarks, not marginal costs), with a note on which features of the choice are robust.
- **Glossary** (`glossary.html`): plain-language explanations of every term. The same text opens from the (i) buttons beside results, with a sentence about the programme currently on screen.

All tool results come from one model, the mixed logit with a random constant for choosing no programme, which fitted the data far better than the alternatives. The supporting models (sequential, lived experience, latent class, piecewise cost) are reported on `research.html` only. Longer sections fold away (Show / Hide) to keep the tools uncluttered.

Every button and setting gives a short message at the bottom right of the screen, coloured as a traffic light with a word label (Good, Check, Caution, Done), saying what changed and what to do next. Each tool page shows a progress list of steps. Programmes in the planner and the benefit-cost page are stored in the page address, so a link can be copied and shared.

`research.html` describes the study, shows willingness to pay and relative importance, reports the supporting analyses, lists limitations and planned improvements, and checks on every load that the website reproduces the MATLAB results.

The site is static HTML, CSS and JavaScript. It has no build step, no external libraries, no cookies and no analytics. Fonts are served from the repository.

## Study

Genie MG, Mansfield E, Paolucci F. Public preferences for dementia support programmes and implications for service design in Australia: a discrete choice experiment. The University of Newcastle, 2026.

264 Australian adults, 24 March to 7 April 2025, eight dual-response choice tasks each. Funded by the National Health and Medical Research Council (G1401207). Approved by the University of Newcastle Human Research Ethics Committee (H-2023-0412).

## Repository layout

```
index.html, families.html, plan.html, value.html, fees.html, research.html, glossary.html
accessibility.html, privacy.html, 404.html
assets/css/site.css          layout, type and print styles
assets/js/engine.js          all model calculations (shared by the browser and the tests)
assets/js/charts.js          SVG charts with hover tooltips
assets/js/common.js          text size, loading, formatting, messages, (i) explanations, folding sections
assets/js/glossary.js        plain-language definitions used by the (i) buttons and glossary.html
assets/js/home.js, families.js, plan.js, value.js, fees.js, research.js   page code
assets/fonts/                Atkinson Hyperlegible and Source Serif 4 (SIL OFL)
assets/img/                  logo and favicon
data/model.json              comparison models (MNL, sequential, latent class) exported from MATLAB
data/model_v17.json          preferred model (mixed logit, piecewise fee), CHSP costs and check values
matlab/export_tool_json.m    script that writes data/model.json from the analysis results
matlab/export_tool_v17.m     script that writes data/model_v17.json (package stage 23.97)
tests/validate.mjs           checks the engine against the MATLAB results
.github/workflows/pages.yml  runs the tests, then deploys to GitHub Pages
```

## Deploy on GitHub Pages

1. Create a new repository on GitHub, for example `dementia-support-choices`, and push these files to the `main` branch:

   ```bash
   cd dementia-support-choices
   git init
   git add .
   git commit -m "Dementia Support Choices website"
   git branch -M main
   git remote add origin https://github.com/DrGenie/dementia-support-choices.git
   git push -u origin main
   ```

2. On GitHub, open **Settings > Pages** and under **Build and deployment** set **Source** to **GitHub Actions**.
3. The workflow in `.github/workflows/pages.yml` runs `npm test` and, if the checks pass, publishes the site. The address appears in the **Actions** run and in **Settings > Pages**, for example `https://drgenie.github.io/dementia-support-choices/`.

To use a custom domain, add it under **Settings > Pages > Custom domain** and create the DNS record GitHub shows.

## Run locally

The pages load `data/model.json`, so they must be served over HTTP rather than opened as files:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Update the model

1. In MATLAB, run the analysis package (stage 23.97 writes `outputs/tool/model_v17.json`; `export_tool_json` writes `model.json` for the comparison models).
2. Copy `model_v17.json` (and, if it changed, `model.json`) into `data/`.
3. Run `npm test` (Node 18 or later). `node tests/check_table.mjs > tool_check_v17.csv` writes the comparison used in the Online Appendix.

The `data/model_v17.json` in this release is the export of the final MATLAB run (R2024b, 17 October 2026; preferred model with 2,000 draws, log-likelihood -1,900.33). `npm test` passes all 72 checks against it.

## Tests

`npm test` checks that the browser engine reproduces values written by the package from the same estimates and simulated people: acceptance and welfare of the eight example programmes (to 0.000001), the fee table of the reference programme, the share who would not use it if free, diversion to no programme, provider costs under every cost scenario and the budget planner's choices; and, for the comparison models, logit take-up, retention, published willingness to pay, the size of the permitted design space and consumer surplus.

## Accessibility

Designed to WCAG 2.2 AA: large default text with a text size control, a typeface designed for low-vision readers, plain language, consistent navigation, full keyboard use with a visible focus indicator, charts with line patterns, labels and nearby text, and print styles for summaries. See `accessibility.html`.

## Licence

Code: MIT. Text and model estimates: CC BY 4.0. Fonts: SIL Open Font License 1.1. See `LICENSE` and `CITATION.cff`.

## Contact

Dr Mesfin Genie, Newcastle Business School, The University of Newcastle, mesfin.genie@newcastle.edu.au
