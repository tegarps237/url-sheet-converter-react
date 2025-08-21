import React, { useMemo, useState } from "react"

export default function App() {
  const [sheetUrl, setSheetUrl] = useState("")
  const [rows, setRows] = useState([])
  const [error, setError] = useState("")
  const [progress, setProgress] = useState(0)
  const [header, setHeader] = useState([])
  const [urlCol, setUrlCol] = useState("B")
  const [validated, setValidated] = useState(false)

  function bump(p){ setProgress(p) }

  function validateUrl(u){
    try {
      const ur = new URL(u)
      if (!/^https?:/.test(ur.protocol)) return "URL must start with http(s)."
      if (!(ur.hostname.includes("docs.google.com") && ur.pathname.includes("/spreadsheets/")) && !ur.pathname.endsWith(".csv")) {
        return "Provide a public Google Sheets link or a direct CSV URL."
      }
      return ""
    } catch {
      return "Invalid URL format."
    }
  }

  async function handleProbeHeader(csvExportUrl){
    const res = await fetch(csvExportUrl, { mode: "cors" })
    if (!res.ok) throw new Error(`CSV request failed (${res.status}).`)
    const text = await res.text()
    const matrix = parseCsv(text)
    const head = matrix[0] || []
    setHeader(head)
    let urlIdx = head.findIndex(h => String(h).trim().toLowerCase() === "url")
    if (urlIdx === -1) {
      const candidate = (matrix[1] || []).findIndex(cell => /https?:\/\//i.test(String(cell)))
      if (candidate !== -1) urlIdx = candidate
    }
    if (urlIdx === -1) urlIdx = 1
    setUrlCol(indexToCol(urlIdx))
    return matrix
  }

  async function handleConvert(){
    setError("")
    setRows([])
    setValidated(false)
    setProgress(0)

    bump(10)
    if (!sheetUrl.trim()) { setError("Paste a Google Sheets link first."); return }
    const vmsg = validateUrl(sheetUrl.trim())
    if (vmsg){ setError(vmsg); return }
    setValidated(true)

    bump(25)
    const csvUrl = toGoogleCsvExportUrl(sheetUrl.trim())

    try {
      bump(45)
      const matrix = await handleProbeHeader(csvUrl)
      bump(65)

      const colIdx = colToIndex(urlCol)
      const urls = matrix.slice(1).map(r => (r[colIdx] || "").toString().trim()).filter(Boolean)

      bump(82)
      const converted = urls.map((u, idx) => {
        const meta = extractMetaFromUrl(u)
        return { no: idx + 1, url: u, domain: meta.domain, kanal: meta.kanal, id: meta.id, title: meta.title }
      })

      bump(96)
      setRows(converted)
      bump(100)
    } catch(e){
      setError(e.message || "Something went wrong while processing.")
      bump(0)
    }
  }

  const csvOutput = useMemo(() => {
    const header = ["#", "URL", "Domain", "Channel", "ID", "Title"]
    const body = rows.map(r => [r.no, r.url, r.domain, r.kanal, r.id, r.title])
    return toCsv([header, ...body])
  }, [rows])

  function handleDownload(){
    if (!rows.length) return
    const filename = buildTimestampFilename()
    const blob = new Blob(["\ufeff" + csvOutput], { type: "text/csv;charset=utf-8;" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(a.href)
  }

  const validationOk = validated
  return (
    <div className="container">
      <div className="header">
        <div className="logo">CSV</div>
        <div>
          <h1 className="title">URL Sheet → CSV Converter</h1>
          <p className="subtitle">Paste a public Google Sheets link (or CSV URL), map the URL column, then export.</p>
        </div>
      </div>

      <div className="card card-pad">
        <div className="row">
          <input
            className="input"
            type="url"
            placeholder="https://docs.google.com/spreadsheets/d/<ID>/edit#gid=<GID>"
            value={sheetUrl}
            onChange={e => setSheetUrl(e.target.value)}
          />
          <button className="btn btn-primary" onClick={handleConvert}>Run Conversion</button>
          <button className="btn btn-ghost" onClick={handleDownload} disabled={!rows.length}>Download CSV</button>
        </div>

        <div className="mt4 controls">
          <span className="badge">
            <span className={`dot${validationOk ? "" : " off"}`}></span>
            Validation: {validationOk ? "OK" : "Pending"}
          </span>

          <span className="small">URL column mapping</span>
          <select className="select" value={urlCol} onChange={(e)=>setUrlCol(e.target.value)}>
            {header.length ? header.map((h, i) => (
              <option value={indexToCol(i)} key={i}>{indexToCol(i)} — {String(h || "(empty)")}</option>
            )) : [...Array(8)].map((_,i)=>(
              <option value={indexToCol(i)} key={i}>{indexToCol(i)}</option>
            ))}
          </select>

          <span className="small">(Default guesses the column named “URL” or column B)</span>
        </div>

        <div className="mt4 progress-wrap">
          <div className="progress" aria-label="progress">
            <div className="bar" style={{width: `${progress}%`}} />
          </div>
          <div className="small">{progress}%</div>
        </div>

        {error && <div className="mt4 error">{error}</div>}
      </div>

      <div className="card card-pad mt6">
        <div className="controls">
          <div className="small">Rows: {rows.length}</div>
        </div>
        <div className="mt4 table-wrap">
          <table className="table">
            <thead>
              <tr>
                {["#","URL","Domain","Channel","ID","Title"].map(h => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} className="small">No data yet. Paste a sheet link and click <b>Run Conversion</b>.</td></tr>
              ) : rows.map(r => (
                <tr key={r.no}>
                  <td>{r.no}</td>
                  <td><a target="_blank" rel="noreferrer" href={r.url}>{r.url}</a></td>
                  <td>{r.domain}</td>
                  <td>{r.kanal}</td>
                  <td>{r.id}</td>
                  <td>{r.title}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="footer">Timestamped filename format: <code>yyyy-mm-dd_hh-mm-ss.csv</code></div>
    </div>
  )
}

// --- helpers ---
function toGoogleCsvExportUrl(url){
  try{
    const u = new URL(url)
    if (u.hostname.includes("docs.google.com") && u.pathname.includes("/spreadsheets/d/")){
      const parts = u.pathname.split("/").filter(Boolean)
      const idIndex = parts.findIndex(p => p === "d")
      const sheetId = idIndex !== -1 ? parts[idIndex+1] : parts[parts.length-1]
      const gid = u.hash.includes("gid=") ? new URLSearchParams(u.hash.replace(/^#/,'')).get("gid") : u.searchParams.get("gid")
      const base = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`
      return gid ? `${base}&gid=${gid}` : base
    }
    return url
  }catch{ return url }
}

function buildTimestampFilename(){
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth()+1).padStart(2,"0")
  const dd = String(d.getDate()).padStart(2,"0")
  const hh = String(d.getHours())
  const min = String(d.getMinutes()).padStart(2,"0")
  const ss = String(d.getSeconds()).padStart(2,"0")
  return `${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}.csv`
}

function extractMetaFromUrl(input){
  try{
    const u = new URL(input)
    const domain = u.hostname.replace(/^www\./,"")
    const segs = u.pathname.split("/").filter(Boolean)
    const kanal = segs[0] || ""
    const idSeg = segs.find(s => /^\d+$/.test(s))
    const id = idSeg || ""
    let raw = segs[segs.length-1] || ""
    try{ raw = decodeURIComponent(raw) }catch{}
    raw = raw.replace(/\.[a-zA-Z0-9]+$/, "")
    if (/^\d+$/.test(raw) && segs.length>=2) raw = segs[segs.length-2] || ""
    const title = raw.replace(/[-_]+/g," ").replace(/\s+/g," ").trim().toLowerCase()
    return { domain, kanal, id, title }
  }catch{ return { domain:"", kanal:"", id:"", title:"" } }
}

function toCsv(matrix){
  return matrix.map(row => row.map(csvEscape).join(",")).join("\r\n")
}
function csvEscape(val){
  if (val === null || val === undefined) return ""
  const s = String(val)
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g,'""') + '"'
  return s
}

function parseCsv(text){
  const rows = []
  let i=0, field="", inQuotes=false, row=[]
  while(i<text.length){
    const c = text[i]
    if (inQuotes){
      if (c === '"'){
        if (text[i+1] === '"'){ field+='"'; i+=2; continue }
        else { inQuotes=false; i++; continue }
      } else { field+=c; i++; continue }
    } else {
      if (c === '"'){ inQuotes=true; i++; continue }
      if (c === ','){ row.push(field); field=""; i++; continue }
      if (c === '\n'){ row.push(field); rows.push(row); row=[]; field=""; i++; continue }
      if (c === '\r'){ if (text[i+1] === '\n'){ row.push(field); rows.push(row); row=[]; field=""; i+=2; continue } row.push(field); rows.push(row); row=[]; field=""; i++; continue }
      field += c; i++; continue
    }
  }
  row.push(field); rows.push(row)
  if (rows.length && rows[rows.length-1].length===1 && rows[rows.length-1][0]==="") rows.pop()
  return rows
}

function indexToCol(i){
  let s = ""
  i = i|0
  while (i >= 0){
    s = String.fromCharCode((i % 26) + 65) + s
    i = Math.floor(i/26) - 1
  }
  return s
}
function colToIndex(col){
  let i = 0
  for (let c of col.toUpperCase()){
    i = i*26 + (c.charCodeAt(0)-64)
  }
  return i - 1
}