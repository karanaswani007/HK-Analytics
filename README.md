# HK Analytics

**HK SoftTech** — Raw Data In. Intelligent Insights Out.

Upload a CSV or Excel file. HK Analytics profiles, cleans, and studies it, then delivers a dashboard, evidence-backed insights, an AI Analyst, and a Power BI project (`.pbip`) — never a fake `.pbix`.

## What it does

1. Load CSV / XLSX / XLS with encoding detection and size checks
2. Profile types, missingness, identifiers, duplicates
3. Clean with a logged pipeline (outliers flagged, not deleted)
4. EDA, correlations, and group tests (association ≠ causation)
5. Ranked insights from computed statistics
6. Compact dashboard and KPI cards
7. AI Analyst grounded in those numbers
8. Downloads: cleaned CSV/Excel, JSON packs, Power BI `.pbip` zip

## Notes

- Analysis runs in the browser session. Files are not written to a public directory.
- The AI Analyst uses Gemini 3.5 Flash-Lite through Google's free tier when a server-side key is configured; without a key, the rest of the product still works.
- Asking the AI Analyst sends the question and relevant analytics context to Google Gemini. Free-tier data may be used by Google to improve its products; do not send sensitive data through the analyst.
- Power BI export is a project folder (TMDL + PBIR + cleaned CSV). Open `HK_Analytics.pbip` in Power BI Desktop and refresh from `data/cleaned-data.csv` if prompted.

## Local setup

Use Node.js 22.12 or newer and run `npm install`. Copy `.env.example` to `.env` and set `GEMINI_API_KEY` only if you want the AI Analyst. Create a free-tier Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey). `DATABASE_URL` is optional; without it, the app uses its local database fallback. `.env` is loaded by the dev, build, preview, and migration commands and is excluded from Git.

For deployment, configure server-side secrets in the hosting provider rather than committing `.env`. Set `GEMINI_API_KEY` to enable AI Analyst responses; configure `DATABASE_URL` only when deploying with PostgreSQL-backed migrations.
