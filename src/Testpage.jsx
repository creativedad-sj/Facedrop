import { useState, useRef, useCallback } from "react";

const API_URL = "";

const THEMES = [
  { id: "cyberpunk", name: "Cyberpunk Warrior", emoji: "\u26A1" },
  { id: "mughal", name: "Mughal Emperor", emoji: "\uD83D\uDC51" },
  { id: "anime", name: "Anime Hero", emoji: "\uD83C\uDF38" },
  { id: "viking", name: "Viking Legend", emoji: "\u2694\uFE0F" },
  { id: "bollywood", name: "Bollywood Villain", emoji: "\uD83C\uDFAC" },
  { id: "samurai", name: "Samurai Master", emoji: "\uD83C\uDF19" },
  { id: "astronaut", name: "Space Explorer", emoji: "\uD83D\uDE80" },
];

export default function TestPage() {
  const [face, setFace] = useState(null);
  const [faceId, setFaceId] = useState(null);
  const [gender, setGender] = useState("male");
  const [results, setResults] = useState({});
  const [generating, setGenerating] = useState(null); // null, "all", or themeId
  const [allDone, setAllDone] = useState(false);
  const fileRef = useRef(null);

  const uploadFace = useCallback(async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => setFace(ev.target.result);
    reader.readAsDataURL(f);
    try {
      const fd = new FormData();
      fd.append("face", f);
      const r = await fetch(API_URL + "/api/upload-face", { method: "POST", body: fd });
      const d = await r.json();
      setFaceId(d.faceId);
    } catch (err) {
      alert("Upload failed: " + err.message);
    }
  }, []);

  const generateSingle = useCallback(async (themeId) => {
    if (!faceId) return alert("Upload face first");
    setGenerating(themeId);
    setResults(prev => ({ ...prev, [themeId]: { status: "generating" } }));
    try {
      const r = await fetch(API_URL + "/api/generate-test-single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ faceId, themeId, gender }),
      });
      const d = await r.json();
      setResults(prev => ({ ...prev, [themeId]: d }));
    } catch (err) {
      setResults(prev => ({ ...prev, [themeId]: { status: "failed", error: err.message } }));
    }
    setGenerating(null);
  }, [faceId, gender]);

  const generateAll = useCallback(async () => {
    if (!faceId) return alert("Upload face first");
    setGenerating("all");
    setAllDone(false);
    setResults({});

    // Mark all as generating
    const init = {};
    THEMES.forEach(t => init[t.id] = { status: "queued" });
    setResults(init);

    try {
      const r = await fetch(API_URL + "/api/generate-test-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ faceId, gender }),
      });
      const d = await r.json();
      setResults(d.results || {});
      setAllDone(true);
    } catch (err) {
      alert("Batch generation failed: " + err.message);
    }
    setGenerating(null);
  }, [faceId, gender]);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#fff", fontFamily: "'JetBrains Mono', 'Courier New', monospace", padding: 20 }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <h1 style={{ fontSize: 28, fontFamily: "'Orbitron', sans-serif", fontWeight: 800, letterSpacing: 6, margin: "0 0 8px" }}>FACEDROP TEST LAB</h1>
          <p style={{ color: "#888", fontSize: 14 }}>Upload a face, select gender, test all 7 themes</p>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap", alignItems: "center", justifyContent: "center" }}>
          {/* Face upload */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {face && (
              <div style={{ width: 48, height: 48, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(255,255,255,0.15)" }}>
                <img src={face} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={uploadFace} />
            <button onClick={() => fileRef.current && fileRef.current.click()} style={{
              padding: "10px 20px", background: face ? "rgba(255,255,255,0.08)" : "#fff",
              color: face ? "#aaa" : "#000", border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 10, fontSize: 12, fontFamily: "inherit", cursor: "pointer", fontWeight: 600,
            }}>{face ? "CHANGE FACE" : "UPLOAD FACE"}</button>
          </div>

          {/* Gender select */}
          <div style={{ display: "flex", gap: 6 }}>
            {["male", "female"].map(g => (
              <button key={g} onClick={() => setGender(g)} style={{
                padding: "10px 20px",
                background: gender === g ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.04)",
                border: "1px solid " + (gender === g ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.1)"),
                borderRadius: 10, color: gender === g ? "#818cf8" : "#888",
                fontSize: 12, fontFamily: "inherit", cursor: "pointer", fontWeight: 600,
                textTransform: "uppercase", letterSpacing: 2,
              }}>{g}</button>
            ))}
          </div>

          {/* Generate all button */}
          <button onClick={generateAll} disabled={!faceId || generating} style={{
            padding: "10px 24px",
            background: (!faceId || generating) ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: (!faceId || generating) ? "#555" : "#fff",
            border: "none", borderRadius: 10, fontSize: 13,
            fontFamily: "'Orbitron', sans-serif", fontWeight: 700, letterSpacing: 3,
            cursor: (!faceId || generating) ? "default" : "pointer",
          }}>
            {generating === "all" ? "GENERATING ALL..." : "GENERATE ALL 7"}
          </button>
        </div>

        {/* Status bar */}
        {generating === "all" && (
          <div style={{ textAlign: "center", marginBottom: 20, padding: 12, background: "rgba(99,102,241,0.1)", borderRadius: 10, border: "1px solid rgba(99,102,241,0.2)" }}>
            <p style={{ color: "#818cf8", fontSize: 13, margin: 0 }}>
              Generating all themes sequentially... This takes 3-5 minutes total.
              Watch the server terminal for progress.
            </p>
          </div>
        )}

        {allDone && (
          <div style={{ textAlign: "center", marginBottom: 20, padding: 12, background: "rgba(34,197,94,0.1)", borderRadius: 10, border: "1px solid rgba(34,197,94,0.2)" }}>
            <p style={{ color: "#22c55e", fontSize: 13, margin: 0 }}>All 7 themes generated!</p>
          </div>
        )}

        {/* Theme grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260, 1fr))", gap: 16 }}>
          {THEMES.map(theme => {
            const r = results[theme.id];
            const isGenerating = generating === theme.id || (generating === "all" && r && r.status === "queued");

            return (
              <div key={theme.id} style={{
                borderRadius: 14, overflow: "hidden",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid " + (r && r.status === "success" ? "rgba(34,197,94,0.3)" : r && r.status === "failed" ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.06)"),
              }}>
                {/* Image area */}
                <div style={{ aspectRatio: "3/4", background: "#111118", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                  {r && r.status === "success" && r.imageUrl ? (
                    <img src={API_URL + r.imageUrl} alt={theme.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : isGenerating || (r && r.status === "generating") ? (
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 32, marginBottom: 8, animation: "pulse 2s ease infinite" }}>{theme.emoji}</div>
                      <p style={{ color: "#666", fontSize: 11, letterSpacing: 2 }}>GENERATING...</p>
                    </div>
                  ) : r && r.status === "queued" ? (
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>{theme.emoji}</div>
                      <p style={{ color: "#444", fontSize: 11, letterSpacing: 2 }}>QUEUED</p>
                    </div>
                  ) : r && r.status === "failed" ? (
                    <div style={{ textAlign: "center", padding: 16 }}>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>{"\u274C"}</div>
                      <p style={{ color: "#ef4444", fontSize: 10, wordBreak: "break-word" }}>{r.error}</p>
                    </div>
                  ) : (
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 36, opacity: 0.15 }}>{theme.emoji}</div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                  <div>
                    <div style={{ fontSize: 12, fontFamily: "'Orbitron', sans-serif", fontWeight: 700, letterSpacing: 1 }}>{theme.name.toUpperCase()}</div>
                    {r && r.status === "success" && (
                      <div style={{ fontSize: 9, color: "#22c55e", letterSpacing: 2, marginTop: 2 }}>SUCCESS</div>
                    )}
                  </div>
                  <button onClick={() => generateSingle(theme.id)} disabled={!faceId || !!generating} style={{
                    padding: "6px 12px",
                    background: (!faceId || generating) ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.08)",
                    color: (!faceId || generating) ? "#333" : "#aaa",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 8, fontSize: 10, fontFamily: "inherit", cursor: (!faceId || generating) ? "default" : "pointer",
                  }}>
                    {generating === theme.id ? "..." : "TEST"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      </div>
    </div>
  );
}