import { useState, useRef, useMemo, useEffect } from "react";
import Papa from "papaparse";
import {
  Upload, Ticket, Film, Loader2, KeyRound, Globe2, ClipboardPaste,
  ChevronDown, ExternalLink, Search, SlidersHorizontal, X, Star,
  ArrowUpDown, Pencil
} from "lucide-react";

const REGIONS = [
  { code: "US", label: "United States" }, { code: "GB", label: "United Kingdom" },
  { code: "CA", label: "Canada" }, { code: "AU", label: "Australia" },
  { code: "IE", label: "Ireland" }, { code: "DE", label: "Germany" },
  { code: "FR", label: "France" }, { code: "ES", label: "Spain" },
  { code: "IT", label: "Italy" }, { code: "NL", label: "Netherlands" },
  { code: "SE", label: "Sweden" }, { code: "NO", label: "Norway" },
  { code: "DK", label: "Denmark" }, { code: "IN", label: "India" },
  { code: "JP", label: "Japan" }, { code: "BR", label: "Brazil" },
  { code: "MX", label: "Mexico" }, { code: "NZ", label: "New Zealand" },
  { code: "PL", label: "Poland" }, { code: "ZA", label: "South Africa" },
];

const REGION_LANG = {
  DE: "de-DE", FR: "fr-FR", ES: "es-ES", IT: "it-IT", NL: "nl-NL", SE: "sv-SE", NO: "nb-NO",
  DK: "da-DK", JP: "ja-JP", BR: "pt-BR", MX: "es-MX", PL: "pl-PL", GB: "en-GB",
};

// Lokale Speicherung der Bibliothek (nur im Browser dieses Geräts, nichts online)
const STORE_KEY = "gg_library_v2";
function loadLibrary() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE_KEY));
    if (d && Array.isArray(d.movies)) return d;
  } catch {}
  return null;
}

const SORT_FIELDS = [
  { key: "date", label: "Date added", defaultDir: "desc", dirLabels: ["Newest added", "Earliest added"] },
  { key: "year", label: "Release year", defaultDir: "desc", dirLabels: ["Newest first", "Earliest first"] },
  { key: "rating", label: "Average rating", defaultDir: "desc", dirLabels: ["Highest first", "Lowest first"] },
  { key: "title", label: "Title", defaultDir: "asc", dirLabels: ["A → Z", "Z → A"] },
];

// Nur diese Dienste werden angezeigt. Alles andere (Amazon-Channels etc.) wird ignoriert.
// Erkennung über TMDB-ID und/oder Name; Namen mit "channel" werden nie akzeptiert.
const SERVICES = [
  {
    key: "netflix", label: "Netflix", ids: [8, 1796], rx: /^netflix\b/i,
    url: (q) => `https://www.netflix.com/search?q=${q}`,
  },
  {
    key: "prime", label: "Amazon Prime Video", ids: [9, 2100], rx: /^amazon prime video/i,
    url: (q) => `https://www.primevideo.com/search/?phrase=${q}`,
  },
  {
    key: "mubi", label: "MUBI", ids: [11], rx: /^mubi\b/i,
    url: (q) => `https://mubi.com/en/search/films?query=${q}`,
  },
  {
    key: "ard", label: "ARD Mediathek", ids: [], rx: /^ard\b/i,
    url: (q) => `https://www.ardmediathek.de/suche/${q}`,
  },
  {
    key: "zdf", label: "ZDF Mediathek", ids: [], rx: /^zdf/i,
    url: (q) => `https://www.zdf.de/suche?q=${q}`,
  },
  {
    key: "arte", label: "ARTE", ids: [], rx: /^arte\b/i,
    url: (q, region) => `https://www.arte.tv/${region === "FR" ? "fr" : region === "DE" ? "de" : "en"}/search/?q=${q}`,
  },
];

function serviceFor(p) {
  const name = p.provider_name || "";
  if (/channel|\bplus\b/i.test(name)) return null; // keine Amazon-Channels, kein "ARD Plus"
  return SERVICES.find((sv) => sv.ids.includes(p.provider_id) || sv.rx.test(name)) || null;
}

// flatrate + free + ads zusammenführen, auf die Wunschdienste reduzieren, pro Dienst nur ein Eintrag
function pickServices(regionData) {
  const all = [...(regionData.flatrate || []), ...(regionData.free || []), ...(regionData.ads || [])];
  const seen = new Map();
  all.forEach((p) => {
    const sv = serviceFor(p);
    if (sv && !seen.has(sv.key)) seen.set(sv.key, { key: sv.key, label: sv.label, logo_path: p.logo_path });
  });
  return SERVICES.map((sv) => seen.get(sv.key)).filter(Boolean);
}

function PosterTile({ movie, onOpen }) {
  const streaming = movie.status === "found" && movie.services?.length > 0;
  return (
    <button
      onClick={() => onOpen(movie)}
      className="group relative aspect-[2/3] rounded-sm overflow-hidden bg-[#111111] text-left focus:outline-none focus:ring-2 focus:ring-[#FFFFFF] transition"
    >
      {movie.poster_path ? (
        <img
          src={`https://image.tmdb.org/t/p/w342${movie.poster_path}`}
          alt=""
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-[#777777] px-2 text-center">
          <Film className="w-6 h-6" />
          <span className="text-[10px] font-mono leading-tight">{movie.name}</span>
        </div>
      )}


      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-2">
        <p className="text-[12px] font-medium leading-tight text-white line-clamp-2">{movie.name}</p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] font-mono text-[#CFCFCF]">{movie.year || "—"}</span>
          {typeof movie.voteAverage === "number" && movie.voteAverage > 0 && (
            <span className="text-[10px] font-mono text-[#FFFFFF] flex items-center gap-0.5">
              <Star className="w-2.5 h-2.5 fill-[#FFFFFF]" /> {movie.voteAverage.toFixed(1)}
            </span>
          )}
        </div>
        {streaming && (
          <div className="flex gap-1 mt-1.5">
            {movie.services.map((sv) => (
              <img
                key={sv.key}
                src={`https://image.tmdb.org/t/p/w45${sv.logo_path}`}
                alt={sv.label}
                title={sv.label}
                className="w-4 h-4 rounded-[3px]"
              />
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

function DetailModal({ movie, region, onClose }) {
  if (!movie) return null;
  const q = encodeURIComponent(movie.localTitle || movie.name);
  const services = movie.services || [];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onClick={onClose}
    >
      <div
        className="border border-[#333333] rounded-lg max-w-lg w-full overflow-hidden flex"
        style={{ backgroundColor: "#0D0D0D" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-32 shrink-0" style={{ backgroundColor: "#111111" }}>
          {movie.poster_path ? (
            <img src={`https://image.tmdb.org/t/p/w342${movie.poster_path}`} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[#777777]"><Film className="w-6 h-6" /></div>
          )}
        </div>
        <div className="p-4 flex-1 min-w-0 relative">
          <button onClick={onClose} className="absolute top-3 right-3 text-[#888888] hover:text-white">
            <X className="w-4 h-4" />
          </button>
          <h3 className="font-[Oswald] uppercase text-lg pr-6 leading-tight">{movie.name}</h3>
          <div className="flex items-center gap-3 mt-1 text-xs font-mono text-[#B3B3B3]">
            <span>{movie.year || "—"}</span>
            {typeof movie.voteAverage === "number" && movie.voteAverage > 0 && (
              <span className="flex items-center gap-0.5 text-[#FFFFFF]"><Star className="w-3 h-3 fill-[#FFFFFF]" /> {movie.voteAverage.toFixed(1)}</span>
            )}
          </div>

          <div className="mt-4">
            <p className="text-[11px] font-mono uppercase tracking-wide text-[#888888] mb-1.5">Available on</p>
            {services.length ? (
              <div className="flex flex-col gap-2">
                {services.map((sv) => {
                  const def = SERVICES.find((x) => x.key === sv.key);
                  return (
                    <a
                      key={sv.key}
                      href={def.url(q, region)}
                      target="_blank" rel="noreferrer"
                      className="flex items-center justify-between gap-2 bg-[#111111] border border-[#333333] hover:border-[#FFFFFF] rounded-md px-2.5 py-2 transition"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <img src={`https://image.tmdb.org/t/p/w45${sv.logo_path}`} className="w-5 h-5 rounded-[4px]" alt="" />
                        <span className="text-sm truncate">{sv.label}</span>
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-[#888888] shrink-0" />
                    </a>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-[#888888] font-mono">Not on any of your services.</p>
            )}
          </div>

          {movie.tmdbId && (
            <div className="mt-4 flex flex-col gap-1.5">
              {movie.watchLink && (
                <a
                  href={movie.watchLink}
                  target="_blank" rel="noreferrer"
                  className="text-xs text-[#FFFFFF] hover:underline inline-flex items-center gap-1"
                >
                  Direct links on TMDB <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <a
                href={`https://www.themoviedb.org/movie/${movie.tmdbId}`}
                target="_blank" rel="noreferrer"
                className="text-xs text-[#B3B3B3] hover:underline inline-flex items-center gap-1"
              >
                View on TMDB <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ReelCheck() {
  const [apiKey, setApiKey] = useState(() => {
    try { return localStorage.getItem("reelcheck_tmdb_key") || ""; } catch { return ""; }
  });
  const [region, setRegion] = useState(() => {
    try { return localStorage.getItem("reelcheck_region") || "DE"; } catch { return "DE"; }
  });

  useEffect(() => {
    try { if (apiKey) localStorage.setItem("reelcheck_tmdb_key", apiKey); } catch {}
  }, [apiKey]);

  useEffect(() => {
    try { localStorage.setItem("reelcheck_region", region); } catch {}
  }, [region]);
  const [saved] = useState(loadLibrary);
  const [checkedRegion, setCheckedRegion] = useState(saved?.region || "DE");
  const [checkedAt, setCheckedAt] = useState(saved?.at || null);

  // Browser bitten, den lokalen Speicher nicht automatisch zu löschen
  useEffect(() => {
    try { navigator.storage?.persist?.(); } catch {}
  }, []);

  const [mode, setMode] = useState("csv");
  const [pasteText, setPasteText] = useState("");
  const [fileName, setFileName] = useState(saved?.fileName || "");
  const [parsedTitles, setParsedTitles] = useState(saved?.titles || []);
  const [movies, setMovies] = useState(saved?.movies || []);
  const [status, setStatus] = useState(saved?.movies?.length ? "done" : "idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setErrorMsg] = useState("");
  const [showSetup, setShowSetup] = useState(!saved?.movies?.length);
  const fileInputRef = useRef(null);

  // library controls
  const [search, setSearch] = useState("");
  const [freeOnly, setFreeOnly] = useState(true);
  const [disabledServices, setDisabledServices] = useState(() => new Set());
  const [sortField, setSortField] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [activeMovie, setActiveMovie] = useState(null);

  const handleFile = (file) => {
    if (!file) return;
    setFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const rows = res.data;
        const keys = Object.keys(rows[0] || {});
        const nameKey = keys.find((k) => /name|title/i.test(k)) || "Name";
        const yearKey = keys.find((k) => /year/i.test(k));
        const dateKey = keys.find((k) => /^date$/i.test(k.trim())) || keys.find((k) => /added/i.test(k));
        const titles = rows
          .map((r) => ({
            name: (r[nameKey] || "").trim(),
            year: yearKey ? (r[yearKey] || "").trim() : "",
            dateAdded: dateKey ? (r[dateKey] || "").trim() : "",
          }))
          .filter((t) => t.name);
        setParsedTitles(titles);
        setErrorMsg("");
      },
      error: (err) => setErrorMsg("Couldn't parse that CSV: " + err.message),
    });
  };

  const handlePasteParse = () => {
    const lines = pasteText.split("\n").map((l) => l.trim()).filter(Boolean);
    const titles = lines.map((line) => {
      const m = line.match(/^(.*?)[\s(]+(\d{4})\)?\s*$/);
      if (m) return { name: m[1].trim(), year: m[2], dateAdded: "" };
      return { name: line, year: "", dateAdded: "" };
    });
    setParsedTitles(titles);
    setErrorMsg("");
  };

  // TMDB issues two kinds of keys: a short v3 "API Key" (goes in ?api_key=) and a
  // long v4 "Read Access Token" (a JWT, goes in an Authorization: Bearer header).
  // Auto-detect which one was pasted so either works.
  async function tmdbFetch(url, key) {
    const isV4 = key.includes(".") && key.length > 60;
    let finalUrl = url;
    const opts = {};
    if (isV4) {
      opts.headers = { Authorization: `Bearer ${key}`, accept: "application/json" };
    } else {
      finalUrl += (url.includes("?") ? "&" : "?") + "api_key=" + encodeURIComponent(key);
    }

    let res;
    try {
      res = await fetch(finalUrl, opts);
    } catch (networkErr) {
      // fetch() itself threw — this is a network/CORS failure, not TMDB rejecting the key
      throw new Error(
        `Verbindung zu TMDB ist fehlgeschlagen (${networkErr.message || "Netzwerkfehler"}). ` +
        `Das liegt meistens an CORS oder der Internetverbindung, nicht am Key selbst.`
      );
    }

    let data;
    try { data = await res.json(); } catch { data = {}; }

    if (!res.ok || data.success === false) {
      throw new Error(
        `TMDB hat geantwortet (Status ${res.status}) mit: "${data.status_message || "kein Grund angegeben"}". ` +
        `Key-Typ erkannt als ${isV4 ? "v4 Read Access Token" : "v3 API Key"}.`
      );
    }
    return data;
  }

  async function searchAndFetch(t, key, region) {
    const searchUrl = new URL("https://api.themoviedb.org/3/search/movie");
    searchUrl.searchParams.set("query", t.name);
    searchUrl.searchParams.set("language", REGION_LANG[region] || "en-US");
    if (t.year) searchUrl.searchParams.set("year", t.year);
    let sData = await tmdbFetch(searchUrl.toString(), key);
    let match = sData.results && sData.results[0];
    if (!match && t.year) {
      searchUrl.searchParams.delete("year");
      sData = await tmdbFetch(searchUrl.toString(), key);
      match = sData.results && sData.results[0];
    }
    if (!match) return { ...t, status: "not_found" };

    const pData = await tmdbFetch(`https://api.themoviedb.org/3/movie/${match.id}/watch/providers`, key);
    const regionData = (pData.results && pData.results[region]) || {};
    return {
      ...t,
      year: t.year || (match.release_date ? match.release_date.slice(0, 4) : ""),
      status: "found",
      tmdbId: match.id,
      poster_path: match.poster_path,
      voteAverage: match.vote_average,
      localTitle: match.title || t.name,
      watchLink: regionData.link || null,
      services: pickServices(regionData),
    };
  }

  async function runCheck() {
    if (!apiKey) return setErrorMsg("Trag zuerst deinen TMDB API Key oben ein.");
    if (parsedTitles.length === 0) return setErrorMsg("Lade zuerst eine Watchlist — CSV hochladen oder Titel einfügen.");
    setErrorMsg("");
    setStatus("checking");
    setMovies([]);
    setDisabledServices(new Set());
    setProgress({ done: 0, total: parsedTitles.length });

    // Validate the key with one cheap call before burning through the whole list,
    // so a bad key fails fast with a clear message instead of silently returning
    // "not found" for every single movie.
    try {
      await tmdbFetch("https://api.themoviedb.org/3/configuration", apiKey);
    } catch (e) {
      setErrorMsg("TMDB hat den Key abgelehnt: " + e.message);
      setStatus("idle");
      return;
    }

    const results = new Array(parsedTitles.length);
    let idx = 0;
    async function worker() {
      while (idx < parsedTitles.length) {
        const myIdx = idx++;
        try {
          results[myIdx] = await searchAndFetch(parsedTitles[myIdx], apiKey, region);
        } catch {
          results[myIdx] = { ...parsedTitles[myIdx], status: "not_found" };
        }
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    }
    await Promise.all(new Array(5).fill(0).map(worker));
    const at = Date.now();
    setMovies(results);
    setCheckedRegion(region);
    setCheckedAt(at);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ movies: results, titles: parsedTitles, fileName, region, at }));
    } catch {}
    setStatus("done");
    setShowSetup(false);
  }

  // Immer alle Wunschdienste zeigen (mit Anzahl Treffer), Logo aus den Ergebnissen
  const services = useMemo(() => {
    return SERVICES.map((sv) => {
      let count = 0, logo_path = null;
      movies.forEach((m) => {
        const hit = (m.services || []).find((x) => x.key === sv.key);
        if (hit) { count++; logo_path = logo_path || hit.logo_path; }
      });
      return { key: sv.key, label: sv.label, count, logo_path };
    });
  }, [movies]);

  const toggleService = (id) => {
    setDisabledServices((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // true if a movie streams on at least one currently-enabled service
  const matchesServices = (m) => {
    if (m.status !== "found") return false;
    return (m.services || []).some((sv) => !disabledServices.has(sv.key));
  };

  const visibleMovies = useMemo(() => {
    let list = movies.filter((m) => {
      if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (freeOnly && !matchesServices(m)) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      let av, bv;
      if (sortField === "date") { av = a.dateAdded || ""; bv = b.dateAdded || ""; }
      else if (sortField === "year") { av = parseInt(a.year) || 0; bv = parseInt(b.year) || 0; }
      else if (sortField === "rating") { av = a.voteAverage ?? -1; bv = b.voteAverage ?? -1; }
      else { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [movies, search, sortField, sortDir, freeOnly, disabledServices, services]);

  const freeCount = movies.filter(matchesServices).length;

  return (
    <div className="min-h-screen" style={{ fontFamily: "'Inter', sans-serif", backgroundColor: "#000000", color: "#FFFFFF" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        html, body { background-color: #000000 !important; margin: 0; padding: 0; }
        body { padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }
        .font-mono { font-family: 'IBM Plex Mono', monospace; }
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        input, select, textarea { color: #FFFFFF; background-color: #111111; }
        select option { background-color: #111111; color: #FFFFFF; }
        input::placeholder, textarea::placeholder { color: #888888; opacity: 1; }
      `}</style>

      {/* Hero */}
      <header className="relative border-b border-[#333333] px-6 py-8 overflow-hidden">
        <div className="max-w-6xl mx-auto relative">
          <h1 className="text-5xl sm:text-6xl uppercase text-[#FFFFFF]" style={{ fontFamily: "'Oswald', sans-serif", letterSpacing: "0.03em" }}>
            Guter Geschmack
          </h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Setup panel */}
        {showSetup ? (
          <section className="bg-[#0D0D0D] border border-[#333333] rounded-lg p-6 space-y-6">
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium mb-2">
                  <KeyRound className="w-4 h-4 text-[#FFFFFF]" /> TMDB API key
                </label>
                <input
                  type="text" value={apiKey} onChange={(e) => setApiKey(e.target.value.trim())}
                  placeholder="Paste your key"
                  spellCheck={false}
                  className="w-full bg-[#111111] border border-[#333333] rounded-md px-3 py-2 text-sm font-mono outline-none focus:border-[#FFFFFF] focus:ring-1 focus:ring-[#FFFFFF]"
                />
                <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer" className="text-xs text-[#FFFFFF] hover:underline inline-flex items-center gap-1 mt-1.5">
                  Get a free key at themoviedb.org <ExternalLink className="w-3 h-3" />
                </a>
                <p className="text-[11px] text-[#888888] mt-1">Wird lokal in deinem Browser gespeichert — nur einmal nötig.</p>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium mb-2">
                  <Globe2 className="w-4 h-4 text-[#FFFFFF]" /> Streaming region
                </label>
                <div className="relative">
                  <select value={region} onChange={(e) => setRegion(e.target.value)} className="w-full appearance-none bg-[#111111] border border-[#333333] rounded-md px-3 py-2 text-sm outline-none focus:border-[#FFFFFF] focus:ring-1 focus:ring-[#FFFFFF]">
                    {REGIONS.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-3 top-2.5 text-[#888888] pointer-events-none" />
                </div>
              </div>
            </div>

            <div>
              <div className="flex gap-2 mb-3">
                <button onClick={() => setMode("csv")} className={`px-3 py-1.5 text-xs font-mono rounded-md border ${mode === "csv" ? "bg-[#FFFFFF] text-[#111111] border-[#FFFFFF]" : "border-[#333333] text-[#B3B3B3]"}`}>Upload CSV</button>
                <button onClick={() => setMode("paste")} className={`px-3 py-1.5 text-xs font-mono rounded-md border ${mode === "paste" ? "bg-[#FFFFFF] text-[#111111] border-[#FFFFFF]" : "border-[#333333] text-[#B3B3B3]"}`}>Paste titles</button>
              </div>

              {mode === "csv" ? (
                <div>
                  <button onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-dashed border-[#333333] hover:border-[#FFFFFF] transition-colors rounded-md py-8 flex flex-col items-center gap-2 text-[#B3B3B3]">
                    <Upload className="w-5 h-5" />
                    <span className="text-sm">{fileName || "Click to choose your Letterboxd watchlist CSV"}</span>
                    <span className="text-[11px] text-[#888888]">Settings → Import & Export → Export Data on letterboxd.com</span>
                  </button>
                  <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder={"One movie per line, e.g.\nThe Thing (1982)\nParis, Texas 1984"} rows={6} className="w-full bg-[#111111] border border-[#333333] rounded-md px-3 py-2 text-sm outline-none focus:border-[#FFFFFF] focus:ring-1 focus:ring-[#FFFFFF] font-mono" />
                  <button onClick={handlePasteParse} className="text-xs font-mono px-3 py-1.5 rounded-md border border-[#333333] text-[#B3B3B3] hover:border-[#FFFFFF] inline-flex items-center gap-1.5">
                    <ClipboardPaste className="w-3.5 h-3.5" /> Load titles
                  </button>
                </div>
              )}
              {parsedTitles.length > 0 && <p className="text-xs text-[#FFFFFF] mt-2 font-mono">{parsedTitles.length} titles loaded</p>}
            </div>

            {error && (
              <p className="text-sm font-medium border-l-2 border-[#FFFFFF] pl-3 py-1 bg-[#111111]">{error}</p>
            )}

            <button onClick={runCheck} disabled={status === "checking"} className="inline-flex items-center gap-2 bg-[#FFFFFF] text-[#111111] font-medium px-5 py-2.5 rounded-md hover:brightness-110 disabled:opacity-50 transition">
              {status === "checking" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ticket className="w-4 h-4" />}
              {status === "checking" ? `Checking ${progress.done}/${progress.total}…` : "Build my library"}
            </button>

            {status === "checking" && (
              <div className="w-full h-1.5 bg-[#333333] rounded-full overflow-hidden">
                <div className="h-full bg-[#FFFFFF] transition-all" style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }} />
              </div>
            )}
          </section>
        ) : (
          <button onClick={() => setShowSetup(true)} className="w-full flex items-center justify-between bg-[#0D0D0D] border border-[#333333] rounded-lg px-4 py-2.5 text-sm text-[#B3B3B3] hover:border-[#FFFFFF] transition">
            <span className="font-mono">{movies.length} titles · {REGIONS.find((r) => r.code === checkedRegion)?.label}{checkedAt ? ` · ${new Date(checkedAt).toLocaleDateString("de-DE")}` : ""}</span>
            <span className="inline-flex items-center gap-1.5 text-[#FFFFFF]"><Pencil className="w-3.5 h-3.5" /> Edit setup</span>
          </button>
        )}

        {/* Library */}
        {status === "done" && (
          <section className="space-y-4">
            {/* toolbar */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#888888]" />
                  <input
                    value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your library…"
                    className="w-full bg-[#0D0D0D] border border-[#333333] rounded-md pl-8 pr-3 py-2 text-sm outline-none focus:border-[#FFFFFF]"
                  />
                </div>

                <div className="relative">
                  <select
                    value={sortField}
                    onChange={(e) => {
                      const f = SORT_FIELDS.find((s) => s.key === e.target.value);
                      setSortField(f.key); setSortDir(f.defaultDir);
                    }}
                    className="appearance-none bg-[#0D0D0D] border border-[#333333] rounded-md pl-3 pr-8 py-2 text-sm outline-none focus:border-[#FFFFFF]"
                  >
                    {SORT_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-[#888888] pointer-events-none" />
                </div>

                <button
                  onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                  className="flex items-center gap-1.5 bg-[#0D0D0D] border border-[#333333] rounded-md px-3 py-2 text-xs font-mono text-[#B3B3B3] hover:border-[#FFFFFF]"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  {SORT_FIELDS.find((f) => f.key === sortField).dirLabels[sortDir === SORT_FIELDS.find((f) => f.key === sortField).defaultDir ? 0 : 1]}
                </button>

                <label className="flex items-center gap-2 text-xs font-mono text-[#B3B3B3] bg-[#0D0D0D] border border-[#333333] rounded-md px-3 py-2 cursor-pointer select-none">
                  <input type="checkbox" checked={freeOnly} onChange={(e) => setFreeOnly(e.target.checked)} className="accent-[#FFFFFF]" />
                  Only streamable
                  <span className="text-[#FFFFFF]">({freeCount})</span>
                </label>
              </div>

              {movies.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-wide text-[#888888] flex items-center gap-1"><SlidersHorizontal className="w-3 h-3" /> Services</span>
                  {services.map((s) => {
                    const on = !disabledServices.has(s.key);
                    return (
                      <button
                        key={s.key}
                        onClick={() => toggleService(s.key)}
                        className={`flex items-center gap-1.5 rounded-full pl-1 pr-2.5 py-1 text-xs border transition ${on ? "border-[#FFFFFF] bg-[#FFFFFF]/10 text-[#FFFFFF]" : "border-[#333333] text-[#777777] grayscale"}`}
                      >
                        {s.logo_path && <img src={`https://image.tmdb.org/t/p/w45${s.logo_path}`} alt="" className="w-4 h-4 rounded-full" />}
                        {s.label} <span className="text-[#888888]">{s.count}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* poster grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {visibleMovies.map((m, i) => (
                <PosterTile key={m.name + i} movie={m} onOpen={setActiveMovie} />
              ))}
            </div>

            {visibleMovies.length === 0 && (
              <p className="text-sm text-[#888888] font-mono py-12 text-center">Nothing matches these filters.</p>
            )}
          </section>
        )}
      </main>

      <DetailModal movie={activeMovie} region={checkedRegion} onClose={() => setActiveMovie(null)} />

      <footer className="px-6 pb-6 pt-10 text-center text-[10px] font-mono" style={{ color: "#555555" }}>
        v.01 - CCAA 2026
      </footer>

    </div>
  );
}
