# URL Sheet → CSV Converter (React + Vite)

**Features**
- URL validation (Google Sheets public or direct CSV)
- Progress bar from validation → fetch → parsing → conversion → done
- Dynamic URL column mapping (dropdown from sheet header)
- Download CSV filename format: `yyyy-mm-dd_hh-mm-ss.csv` (hour without leading zero)

## Run locally
```bash
npm i
npm run dev
```
Open the URL shown (e.g. http://localhost:5173). Paste your public Google Sheet link (or a CSV URL), map the URL column if needed, click **Run Conversion**, then **Download CSV**.
