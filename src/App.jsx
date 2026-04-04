import { useState, useRef, useCallback, useEffect, useMemo } from "react";

const API_URL = "";

const ALL_THEMES = [
  { id: "cyberpunk", name: "Cyberpunk Warrior", emoji: "\u26A1", accent: "#00f0ff", glow: "rgba(0,240,255,0.5)", bg: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)", style: "Video game", prompt: "cyberpunk warrior, neon city, glowing lights, chrome armor, futuristic, cinematic", tagline: "NEON STREETS. CHROME SKIN." },
  { id: "mughal", name: "Mughal Emperor", emoji: "\uD83D\uDC51", accent: "#DAA520", glow: "rgba(218,165,32,0.5)", bg: "linear-gradient(135deg, #1a0a00 0%, #4a2000 50%, #8B6914 100%)", style: "3D", prompt: "royal emperor, golden throne, jeweled crown, silk robes, ornate palace, warm lighting", tagline: "GOLDEN THRONES. BOW DOWN." },
  { id: "anime", name: "Anime Hero", emoji: "\uD83C\uDF38", accent: "#e91e8c", glow: "rgba(233,30,140,0.5)", bg: "linear-gradient(135deg, #1a0033 0%, #2d1b69 50%, #e91e8c 100%)", style: "Emoji", prompt: "anime hero, cherry blossom, dramatic wind, glowing aura, vibrant colors", tagline: "MAIN CHARACTER ENERGY." },
  { id: "viking", name: "Viking Legend", emoji: "\u2694\uFE0F", accent: "#7ba3c4", glow: "rgba(123,163,196,0.5)", bg: "linear-gradient(135deg, #0d1117 0%, #1a2332 50%, #2d4a5e 100%)", style: "Video game", prompt: "viking warrior, snowy mountains, fur armor, battle axe, stormy sky, epic", tagline: "FROST AND STEEL." },
  { id: "bollywood", name: "Bollywood Villain", emoji: "\uD83C\uDFAC", accent: "#ff2020", glow: "rgba(255,32,32,0.5)", bg: "linear-gradient(135deg, #1a0000 0%, #4a0000 50%, #8b0000 100%)", style: "3D", prompt: "bollywood star, dramatic red gold background, intense, designer suit, cinematic", tagline: "DIALOGUE THAT KILLS." },
  { id: "samurai", name: "Samurai Master", emoji: "\uD83C\uDF19", accent: "#c4a882", glow: "rgba(196,168,130,0.5)", bg: "linear-gradient(135deg, #0a0a0a 0%, #1a1510 50%, #2d2418 100%)", style: "3D", prompt: "samurai master, japanese temple, cherry blossom, katana, golden hour, cinematic", tagline: "THE WAY OF THE BLADE." },
  { id: "astronaut", name: "Space Explorer", emoji: "\uD83D\uDE80", accent: "#8b5cf6", glow: "rgba(139,92,246,0.5)", bg: "linear-gradient(135deg, #020024 0%, #090979 50%, #0d0d4a 100%)", style: "3D", prompt: "astronaut explorer, space station, earth in background, helmet reflection, cinematic, epic", tagline: "BEYOND THE STARS." },
];

const RARITIES = [
  { name: "Common", color: "#6b7280", particles: 0, shake: false },
  { name: "Rare", color: "#3b82f6", particles: 8, shake: false },
  { name: "Epic", color: "#a855f7", particles: 16, shake: true },
  { name: "Legendary", color: "#f59e0b", particles: 30, shake: true },
];

function getTodayKey() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0"); }
function getDailyTheme() { const k = getTodayKey(); let h = 0; for (let i = 0; i < k.length; i++) { h = ((h << 5) - h) + k.charCodeAt(i); h |= 0; } return ALL_THEMES[Math.abs(h) % ALL_THEMES.length]; }
function getTimeUntilMidnight() { const n = new Date(), m = new Date(n); m.setHours(24,0,0,0); return m - n; }
function formatCountdown(ms) { const h = Math.floor(ms/3600000), m = Math.floor((ms%3600000)/60000), s = Math.floor((ms%60000)/1000); return String(h).padStart(2,"0") + ":" + String(m).padStart(2,"0") + ":" + String(s).padStart(2,"0"); }
function rollRarity(bonus) { const r = Math.random(), l = 0.05+(bonus*0.005), e = 0.15+(bonus*0.003); if(r<l) return 3; if(r<l+e) return 2; if(r<l+e+0.30) return 1; return 0; }
function ld(k,f) { try { const v = localStorage.getItem("fd_"+k); return v ? JSON.parse(v) : f; } catch { return f; } }
function sv(k,v) { try { localStorage.setItem("fd_"+k, JSON.stringify(v)); } catch {} }

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap');
:root { --fd: 'Orbitron', sans-serif; --fb: 'JetBrains Mono', monospace; }
@keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes slideUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}
@keyframes scaleIn{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:scale(1)}}
@keyframes sparkle{0%,100%{opacity:0;transform:scale(0) rotate(0)}50%{opacity:1;transform:scale(1) rotate(180deg)}}
@keyframes packGlow{0%,100%{box-shadow:0 0 20px rgba(255,255,255,.1)}50%{box-shadow:0 0 40px rgba(255,255,255,.2)}}
@keyframes cardFlip{0%{transform:perspective(800px) rotateY(0) scale(.9)}40%{transform:perspective(800px) rotateY(90deg) scale(.95)}70%{transform:perspective(800px) rotateY(180deg) scale(1.05)}100%{transform:perspective(800px) rotateY(180deg) scale(1)}}
@keyframes rarityPulse{0%{filter:brightness(1)}50%{filter:brightness(1.3)}100%{filter:brightness(1)}}
@keyframes legendaryBoom{0%{transform:scale(0);opacity:1}100%{transform:scale(5);opacity:0}}
@keyframes flash{0%{opacity:.7}100%{opacity:0}}
@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-4px)}40%{transform:translateX(4px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
@keyframes streakFire{0%,100%{text-shadow:0 0 4px rgba(255,140,0,.5)}50%{text-shadow:0 0 12px rgba(255,140,0,.8),0 0 20px rgba(255,60,0,.4)}}
@keyframes countPulse{0%,100%{color:#444}50%{color:#666}}
`;

function Particles({ color, count, on }) {
  if (!on || !count) return null;
  return Array.from({ length: count }).map((_, i) => {
    const a = (360/count)*i, d = 50+Math.random()*100, sz = 3+Math.random()*6, dur = .5+Math.random()*.8, del = Math.random()*.3;
    return <div key={i} style={{ position:"absolute",left:"50%",top:"50%",width:sz,height:sz,borderRadius:"50%",background:color,opacity:0,animation:"sparkle "+dur+"s ease "+del+"s forwards",transform:"translate("+Math.cos(a*Math.PI/180)*d+"px,"+Math.sin(a*Math.PI/180)*d+"px)",zIndex:20,pointerEvents:"none"}} />;
  });
}

function Countdown() {
  const [r, setR] = useState(getTimeUntilMidnight());
  useEffect(() => { const i = setInterval(() => setR(getTimeUntilMidnight()), 1000); return () => clearInterval(i); }, []);
  return (
    <div style={{ textAlign:"center", padding:"12px 0" }}>
      <div style={{ fontSize:8, fontFamily:"var(--fd)", letterSpacing:4, color:"#333", marginBottom:6 }}>NEXT DROP IN</div>
      <div style={{ fontSize:26, fontFamily:"var(--fd)", fontWeight:700, letterSpacing:4, color:"#fff", animation:"countPulse 2s ease infinite" }}>{formatCountdown(r)}</div>
    </div>
  );
}

function Streak({ n }) {
  if (n < 1) return null;
  return (
    <div style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"5px 12px", borderRadius:20, background:n>=7?"rgba(255,140,0,.12)":"rgba(255,255,255,.04)", border:"1px solid "+(n>=7?"rgba(255,140,0,.25)":"rgba(255,255,255,.06)") }}>
      <span style={{ fontSize:13, animation:n>=7?"streakFire 1.5s ease infinite":"none" }}>{n>=7?"\uD83D\uDD25":"\u26A1"}</span>
      <span style={{ fontSize:10, fontFamily:"var(--fd)", fontWeight:700, letterSpacing:2, color:n>=7?"#ff8c00":"#666" }}>{n} DAY{n>1?"S":""}</span>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState("home");
  const [face, setFace] = useState(() => ld("face", null));
  const [faceId, setFaceId] = useState(() => ld("fid", null));
  const [coll, setColl] = useState(() => ld("coll", []));
  const theme = useMemo(() => getDailyTheme(), []);
  const today = getTodayKey();
  const [claimed, setClaimed] = useState(() => ld("claim","") === today);
  const [streak, setStreak] = useState(() => ld("streak", 0));
  const [gen, setGen] = useState(false);
  const [phase, setPhase] = useState(0);
  const [rar, setRar] = useState(0);
  const [cardImg, setCardImg] = useState(null);
  const [msg, setMsg] = useState("");
  const [backend, setBackend] = useState("checking");
  const fileRef = useRef(null);

  useEffect(() => { fetch(API_URL+"/api/health").then(r=>r.json()).then(d=>setBackend(d.hasToken?"ai":"mock")).catch(()=>setBackend("off")); }, []);

  const MSGS = ["Scanning your face...","Entering the multiverse...","Painting your alter ego...","Rolling for rarity...","Adding dramatic flair...","Almost ready..."];
  useEffect(() => { if(!gen) return; let i=0; setMsg(MSGS[0]); const t=setInterval(()=>{i=(i+1)%MSGS.length;setMsg(MSGS[i]);},2500); return()=>clearInterval(t); }, [gen]);
  useEffect(() => { sv("coll", coll); }, [coll]);

  const uploadFace = useCallback(async (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setFace(ev.target.result); sv("face", ev.target.result); };
    reader.readAsDataURL(f);
    if (backend !== "off") {
      try { const fd = new FormData(); fd.append("face",f); const r = await fetch(API_URL+"/api/upload-face",{method:"POST",body:fd}); const d = await r.json(); setFaceId(d.faceId); sv("fid",d.faceId); } catch {}
    }
    setScreen("home");
  }, [backend]);

  const generate = useCallback(async () => {
    if (claimed) return;
    setGen(true); setScreen("reveal"); setPhase(0); setCardImg(null);
    const r = rollRarity(streak); setRar(r);
    setTimeout(() => setPhase(1), 300);

    let ai = null;
    if (backend === "ai" && faceId) {
      try {
        const res = await fetch(API_URL+"/api/generate-card",{ method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({faceId,themeId:theme.id}) });
        const data = await res.json();
        if (data.imageUrl) ai = API_URL + data.imageUrl;
      } catch {}
    }

    setCardImg(ai); setGen(false);
    setPhase(2);
    setTimeout(() => setPhase(3), 1200);
    setTimeout(() => setPhase(4), 2400);
    setTimeout(() => setPhase(5), 3200);
    setTimeout(() => setPhase(6), 4000);
  }, [claimed, streak, backend, faceId, theme]);

  const collect = useCallback(() => {
    setColl(prev => [{ theme, rarity:rar, image:cardImg||face, isAI:!!cardImg, date:today, id:Date.now() }, ...prev]);
    setClaimed(true); sv("claim", today);
    const prev = ld("claimDate","");
    const y = new Date(); y.setDate(y.getDate()-1);
    const yk = y.getFullYear()+"-"+String(y.getMonth()+1).padStart(2,"0")+"-"+String(y.getDate()).padStart(2,"0");
    const ns = prev===yk ? streak+1 : 1;
    setStreak(ns); sv("streak",ns); sv("claimDate",today);
    setScreen("collected");
    setTimeout(() => setScreen("home"), 2200);
  }, [theme, rar, cardImg, face, today, streak]);

  const share = useCallback(() => {
    const img = cardImg || face; if(!img) return;
    const a = document.createElement("a"); a.href = img; a.download = "facedrop_"+theme.id+"_"+today+".jpg"; a.click();
  }, [cardImg, face, theme, today]);

  const rarity = RARITIES[rar];
  const img = cardImg || face;
  const total = coll.length, legs = coll.filter(c=>c.rarity===3).length, epics = coll.filter(c=>c.rarity===2).length;

  return (
    <div style={{ minHeight:"100vh", background:"#06060a", color:"#fff", fontFamily:"var(--fb)", position:"relative", overflow:"hidden" }}>
      <style>{CSS}</style>
      <div style={{ position:"fixed",inset:0,background:"radial-gradient(ellipse at 20% 10%,rgba(100,50,255,.06) 0%,transparent 50%),radial-gradient(ellipse at 80% 90%,rgba(255,50,100,.04) 0%,transparent 50%)",pointerEvents:"none",zIndex:0 }} />

      {phase===5 && rar===3 && <div style={{ position:"fixed",inset:0,background:"radial-gradient(circle,rgba(255,200,0,.35),transparent)",animation:"flash .8s ease forwards",zIndex:100,pointerEvents:"none" }} />}

      <div style={{ position:"relative", zIndex:1, maxWidth:400, margin:"0 auto", padding:"16px" }}>
        {/* Header */}
        <div style={{ textAlign:"center", padding:"10px 0", marginBottom:12 }}>
          <h1 style={{ fontSize:18, fontFamily:"var(--fd)", fontWeight:900, letterSpacing:8, margin:0, background:"linear-gradient(90deg,#fff 0%,#555 50%,#fff 100%)", backgroundSize:"200% auto", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", animation:"shimmer 4s linear infinite" }}>FACEDROP</h1>
        </div>

        {/* Nav */}
        {face && screen!=="reveal" && screen!=="collected" && (
          <div style={{ display:"flex", gap:6, marginBottom:14 }}>
            {[{k:"home",l:"TODAY"},{k:"collection",l:"CARDS "+total},{k:"profile",l:"ME"}].map(t => (
              <button key={t.k} onClick={()=>setScreen(t.k)} style={{ flex:1, padding:"7px 0", background:screen===t.k?"rgba(255,255,255,.07)":"transparent", border:"1px solid "+(screen===t.k?"rgba(255,255,255,.1)":"rgba(255,255,255,.03)"), borderRadius:8, cursor:"pointer", color:screen===t.k?"#fff":"#333", fontSize:8, fontFamily:"var(--fd)", fontWeight:600, letterSpacing:3 }}>{t.l}</button>
            ))}
          </div>
        )}

        {/* HOME: No face */}
        {screen==="home" && !face && (
          <div style={{ textAlign:"center", paddingTop:60, animation:"slideUp .6s ease" }}>
            <div style={{ width:90,height:90,borderRadius:"50%",margin:"0 auto 24px",border:"2px solid rgba(255,255,255,.06)",display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(255,255,255,.02)" }}>
              <span style={{ fontSize:36 }}>{"\uD83C\uDFAD"}</span>
            </div>
            <h2 style={{ fontSize:14, fontFamily:"var(--fd)", fontWeight:600, letterSpacing:3, marginBottom:8 }}>YOUR FACE. ANY UNIVERSE.</h2>
            <p style={{ color:"#444", fontSize:11, lineHeight:1.7, maxWidth:260, margin:"0 auto 28px" }}>One selfie. A new you, every day. Collect rare cards of yourself.</p>
            <input ref={fileRef} type="file" accept="image/*" capture="user" style={{ display:"none" }} onChange={uploadFace} />
            <button onClick={()=>fileRef.current&&fileRef.current.click()} style={{ padding:"14px 40px", background:"#fff", color:"#000", border:"none", borderRadius:40, fontSize:10, fontFamily:"var(--fd)", fontWeight:800, letterSpacing:4, cursor:"pointer" }}>UPLOAD SELFIE</button>
          </div>
        )}

        {/* HOME: Has face */}
        {screen==="home" && face && (
          <div style={{ animation:"slideUp .4s ease" }}>
            <div style={{ textAlign:"center", marginBottom:14 }}><Streak n={streak} /></div>
            <div style={{ borderRadius:18, overflow:"hidden", background:theme.bg, border:"1px solid "+theme.accent+"22", position:"relative" }}>
              <div style={{ padding:"24px 20px 16px", textAlign:"center" }}>
                <div style={{ fontSize:8, fontFamily:"var(--fd)", letterSpacing:5, color:"rgba(255,255,255,.35)", marginBottom:6 }}>{new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"}).toUpperCase()}</div>
                <div style={{ fontSize:32, marginBottom:6 }}>{theme.emoji}</div>
                <h2 style={{ fontSize:16, fontFamily:"var(--fd)", fontWeight:800, letterSpacing:3, margin:"0 0 4px", color:"#fff" }}>{theme.name.toUpperCase()}</h2>
                <p style={{ fontSize:8, fontFamily:"var(--fd)", letterSpacing:4, color:theme.accent, margin:0 }}>{theme.tagline}</p>
              </div>
              <div style={{ padding:"0 20px 24px", textAlign:"center" }}>
                {claimed ? (
                  <div>
                    <div style={{ fontSize:9, fontFamily:"var(--fd)", letterSpacing:3, color:"rgba(255,255,255,.25)", marginBottom:12 }}>CLAIMED {"\u2713"}</div>
                    <Countdown />
                  </div>
                ) : (
                  <button onClick={generate} style={{ width:"100%", padding:"14px", background:"linear-gradient(135deg,"+theme.accent+","+theme.accent+"88)", color:"#000", border:"none", borderRadius:12, fontSize:11, fontFamily:"var(--fd)", fontWeight:800, letterSpacing:4, cursor:"pointer", boxShadow:"0 0 30px "+theme.glow }}>
                    {gen ? "GENERATING..." : "REVEAL TODAY'S CARD"}
                  </button>
                )}
                {!claimed && (
                  <div style={{ display:"flex", justifyContent:"center", gap:10, marginTop:14 }}>
                    {RARITIES.map((r,i) => (
                      <div key={i} style={{ textAlign:"center" }}>
                        <div style={{ width:7,height:7,borderRadius:"50%",background:r.color,margin:"0 auto 3px",boxShadow:"0 0 5px "+r.color+"55" }} />
                        <div style={{ fontSize:6, fontFamily:"var(--fd)", letterSpacing:2, color:"#333" }}>{r.name.toUpperCase()}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ textAlign:"center", marginTop:12 }}>
              <input ref={fileRef} type="file" accept="image/*" capture="user" style={{ display:"none" }} onChange={uploadFace} />
              <button onClick={()=>fileRef.current&&fileRef.current.click()} style={{ background:"none", border:"none", color:"#222", fontSize:8, fontFamily:"var(--fd)", letterSpacing:3, cursor:"pointer", padding:6 }}>CHANGE FACE</button>
            </div>

            {coll.length > 0 && (
              <div style={{ marginTop:16 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <span style={{ fontSize:8, fontFamily:"var(--fd)", letterSpacing:3, color:"#333" }}>RECENT</span>
                  <button onClick={()=>setScreen("collection")} style={{ background:"none", border:"none", color:theme.accent, fontSize:8, fontFamily:"var(--fd)", letterSpacing:2, cursor:"pointer" }}>VIEW ALL</button>
                </div>
                <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:4 }}>
                  {coll.slice(0,5).map(c => (
                    <div key={c.id} style={{ width:56, height:72, borderRadius:8, overflow:"hidden", flexShrink:0, border:"2px solid "+RARITIES[c.rarity].color+"33" }}>
                      <img src={c.image} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* REVEAL */}
        {screen==="reveal" && (
          <div style={{ textAlign:"center", paddingTop:16, minHeight:"70vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
            {(phase<=1||gen) && (
              <div style={{ animation:"scaleIn .5s ease" }}>
                <div style={{ width:190, height:270, borderRadius:16, margin:"0 auto", background:theme.bg, border:"2px solid "+theme.accent+"33", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:10, animation:"packGlow 2s ease infinite, float 3s ease-in-out infinite", position:"relative", overflow:"hidden" }}>
                  <div style={{ position:"absolute",inset:0,background:"linear-gradient(90deg,transparent,rgba(255,255,255,.05),transparent)",backgroundSize:"200% 100%",animation:"shimmer 2s linear infinite" }} />
                  <span style={{ fontSize:44, position:"relative" }}>{theme.emoji}</span>
                  <div style={{ fontSize:7, fontFamily:"var(--fd)", letterSpacing:4, color:"rgba(255,255,255,.3)", position:"relative" }}>{theme.name.toUpperCase()}</div>
                </div>
                <p style={{ color:"#444", fontSize:9, fontFamily:"var(--fb)", letterSpacing:3, marginTop:18, animation:"pulse 2s ease infinite" }}>{gen?msg.toUpperCase():"PREPARING..."}</p>
                {backend==="ai"&&gen && <p style={{ color:"#222",fontSize:8,letterSpacing:2,marginTop:6 }}>AI TAKES 15-45 SECONDS</p>}
              </div>
            )}

            {!gen && phase>=2 && (
              <div style={{ position:"relative", animation:phase===2?"cardFlip 1.2s ease forwards":"none" }}>
                {phase>=5 && <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none",zIndex:20 }}><Particles color={rarity.color} count={rarity.particles} on={true} /></div>}
                {phase>=5 && rar===3 && <div style={{ position:"absolute",left:"50%",top:"50%",width:40,height:40,borderRadius:"50%",border:"3px solid #f59e0b",transform:"translate(-50%,-50%)",animation:"legendaryBoom 1s ease forwards",zIndex:25,pointerEvents:"none" }} />}

                <div style={{ width:250, borderRadius:16, overflow:"hidden", border:(phase>=5?("3px solid "+rarity.color):"2px solid rgba(255,255,255,.08)"), boxShadow:phase>=5?("0 0 40px "+rarity.color+"44, 0 0 80px "+theme.glow):"0 8px 32px rgba(0,0,0,.5)", background:"#000", transition:"border .3s, box-shadow .5s", animation:(phase>=5&&rar>=2)?"shake .5s ease":(phase>=4?"rarityPulse 2s ease infinite":"none") }}>
                  <div style={{ position:"relative", width:"100%", aspectRatio:"3/4", overflow:"hidden" }}>
                    <img src={img} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", filter:phase===3?"blur(20px) brightness(.6)":"none", transition:"filter 1s ease" }} />
                    <div style={{ position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,.85) 0%,transparent 35%,transparent 75%,rgba(0,0,0,.3) 100%)" }} />
                    {cardImg && phase>=4 && <div style={{ position:"absolute",top:9,left:9,padding:"2px 7px",borderRadius:8,background:"rgba(0,255,136,.12)",border:"1px solid rgba(0,255,136,.25)",fontSize:6,fontFamily:"var(--fd)",fontWeight:700,letterSpacing:2,color:"#00ff88",animation:"scaleIn .3s ease" }}>AI</div>}
                    {phase>=5 && <div style={{ position:"absolute",top:9,right:9,padding:"3px 12px",borderRadius:16,background:rarity.color+"22",border:"1px solid "+rarity.color+"55",fontSize:8,fontFamily:"var(--fd)",fontWeight:800,letterSpacing:3,color:rarity.color,animation:"scaleIn .4s ease" }}>{rarity.name.toUpperCase()}</div>}
                    {phase>=4 && (
                      <div style={{ position:"absolute",bottom:0,left:0,right:0,padding:"14px",animation:"slideUp .5s ease" }}>
                        <div style={{ fontSize:7,fontFamily:"var(--fd)",letterSpacing:4,color:"rgba(255,255,255,.35)",marginBottom:3 }}>{today}</div>
                        <div style={{ fontSize:14,fontFamily:"var(--fd)",fontWeight:800,letterSpacing:3,color:"#fff",textShadow:"0 0 20px "+theme.glow }}>{theme.name.toUpperCase()}</div>
                        <div style={{ fontSize:18,marginTop:2 }}>{theme.emoji}</div>
                      </div>
                    )}
                  </div>
                  <div style={{ padding:"9px 12px",background:"rgba(255,255,255,.02)",borderTop:"1px solid rgba(255,255,255,.03)",display:"flex",justifyContent:"space-between" }}>
                    <span style={{ fontSize:7,fontFamily:"var(--fd)",letterSpacing:3,color:"#222" }}>FACEDROP</span>
                    <span style={{ fontSize:7,fontFamily:"var(--fb)",letterSpacing:2,color:"#222" }}>#{String(Math.floor(Math.random()*9999)).padStart(4,"0")}</span>
                  </div>
                </div>

                {phase>=6 && (
                  <div style={{ marginTop:14, display:"flex", flexDirection:"column", gap:7, animation:"slideUp .4s ease" }}>
                    <button onClick={collect} style={{ padding:"13px", background:"linear-gradient(135deg,"+rarity.color+","+theme.accent+")", color:"#000", border:"none", borderRadius:12, fontSize:10, fontFamily:"var(--fd)", fontWeight:800, letterSpacing:4, cursor:"pointer" }}>COLLECT</button>
                    <button onClick={share} style={{ padding:"9px", background:"rgba(255,255,255,.05)", color:"#555", border:"1px solid rgba(255,255,255,.06)", borderRadius:12, fontSize:8, fontFamily:"var(--fd)", letterSpacing:3, cursor:"pointer" }}>DOWNLOAD CARD</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* COLLECTED */}
        {screen==="collected" && (
          <div style={{ textAlign:"center", paddingTop:80, animation:"scaleIn .5s ease" }}>
            <div style={{ fontSize:52, marginBottom:10 }}>{rar===3?"\uD83C\uDF1F":rar===2?"\u2728":"\u2705"}</div>
            <h2 style={{ fontSize:14, fontFamily:"var(--fd)", fontWeight:700, letterSpacing:4, color:rarity.color }}>{rarity.name.toUpperCase()} COLLECTED!</h2>
            {streak>1 && <p style={{ fontSize:9,fontFamily:"var(--fd)",letterSpacing:3,color:"#444",marginTop:6 }}>{"\uD83D\uDD25"} {streak} DAY STREAK</p>}
          </div>
        )}

        {/* COLLECTION */}
        {screen==="collection" && (
          <div style={{ animation:"slideUp .4s ease" }}>
            <div style={{ textAlign:"center", marginBottom:16 }}>
              <h2 style={{ fontSize:13, fontFamily:"var(--fd)", fontWeight:700, letterSpacing:4, margin:"0 0 6px" }}>YOUR COLLECTION</h2>
              <div style={{ display:"flex", justifyContent:"center", gap:14 }}>
                <span style={{ fontSize:8,fontFamily:"var(--fd)",letterSpacing:2,color:"#444" }}>{total} CARDS</span>
                {legs>0 && <span style={{ fontSize:8,fontFamily:"var(--fd)",letterSpacing:2,color:"#f59e0b" }}>{legs} LEG</span>}
                {epics>0 && <span style={{ fontSize:8,fontFamily:"var(--fd)",letterSpacing:2,color:"#a855f7" }}>{epics} EPIC</span>}
              </div>
            </div>
            {coll.length===0 ? (
              <div style={{ textAlign:"center", paddingTop:60 }}><span style={{ fontSize:36,opacity:.12 }}>{"\uD83C\uDCB4"}</span><p style={{ color:"#1a1a1a",fontSize:9,fontFamily:"var(--fd)",letterSpacing:3,marginTop:10 }}>NO CARDS YET</p></div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8 }}>
                {coll.map((c,i) => {
                  const r = RARITIES[c.rarity];
                  return (
                    <div key={c.id} style={{ borderRadius:10, overflow:"hidden", border:"2px solid "+r.color+"30", background:"#0a0a0e", animation:"slideUp .3s ease "+(i*.04)+"s both" }}>
                      <div style={{ position:"relative", aspectRatio:"3/4", overflow:"hidden" }}>
                        <img src={c.image} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                        <div style={{ position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,.65) 0%,transparent 40%)" }} />
                        <div style={{ position:"absolute",top:4,right:4,width:6,height:6,borderRadius:"50%",background:r.color,boxShadow:"0 0 4px "+r.color }} />
                        {c.isAI && <div style={{ position:"absolute",top:4,left:4,fontSize:5,fontFamily:"var(--fd)",background:"rgba(0,255,136,.15)",color:"#00ff88",padding:"1px 4px",borderRadius:4,letterSpacing:1 }}>AI</div>}
                        <div style={{ position:"absolute",bottom:5,left:5,right:5 }}>
                          <div style={{ fontSize:8,fontFamily:"var(--fd)",fontWeight:700,letterSpacing:1,color:"#fff" }}>{c.theme.name.toUpperCase()}</div>
                          <div style={{ fontSize:6,fontFamily:"var(--fd)",color:r.color,letterSpacing:2,marginTop:1 }}>{r.name.toUpperCase()}</div>
                        </div>
                      </div>
                      <div style={{ padding:"5px 7px",display:"flex",justifyContent:"space-between",borderTop:"1px solid rgba(255,255,255,.02)" }}>
                        <span style={{ fontSize:6,fontFamily:"var(--fb)",color:"#222" }}>{c.date}</span>
                        <span style={{ fontSize:9 }}>{c.theme.emoji}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* PROFILE */}
        {screen==="profile" && (
          <div style={{ animation:"slideUp .4s ease" }}>
            <div style={{ textAlign:"center", marginBottom:20 }}>
              {face && <div style={{ width:64,height:64,borderRadius:"50%",margin:"0 auto 10px",overflow:"hidden",border:"2px solid rgba(255,255,255,.08)" }}><img src={face} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} /></div>}
              <Streak n={streak} />
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6, marginBottom:16 }}>
              {[{l:"TOTAL",v:total,c:"#fff"},{l:"LEGENDARY",v:legs,c:"#f59e0b"},{l:"EPIC",v:epics,c:"#a855f7"}].map(s => (
                <div key={s.l} style={{ textAlign:"center",padding:"14px 6px",background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.04)",borderRadius:10 }}>
                  <div style={{ fontSize:20,fontFamily:"var(--fd)",fontWeight:800,color:s.c }}>{s.v}</div>
                  <div style={{ fontSize:6,fontFamily:"var(--fd)",letterSpacing:3,color:"#333",marginTop:3 }}>{s.l}</div>
                </div>
              ))}
            </div>
            <div style={{ padding:"14px",borderRadius:10,background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.03)" }}>
              <div style={{ fontSize:8,fontFamily:"var(--fd)",letterSpacing:3,color:"#444",marginBottom:6 }}>STREAK BONUS</div>
              <div style={{ fontSize:10,fontFamily:"var(--fb)",color:"#666",lineHeight:1.6 }}>Each day adds +0.5% Legendary chance. Bonus: <span style={{ color:"#f59e0b" }}>+{(streak*.5).toFixed(1)}%</span></div>
            </div>
            <div style={{ marginTop:12,padding:"10px",borderRadius:10,background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.03)",display:"flex",alignItems:"center",gap:8 }}>
              <div style={{ width:5,height:5,borderRadius:"50%",background:backend==="ai"?"#00ff88":backend==="mock"?"#ffaa00":"#ff4444" }} />
              <span style={{ fontSize:7,fontFamily:"var(--fd)",letterSpacing:2,color:"#333" }}>{backend==="ai"?"AI ACTIVE":backend==="mock"?"MOCK MODE":"CSS MODE"}</span>
            </div>
          </div>
        )}

        <div style={{ height:40 }} />
      </div>
    </div>
  );
}