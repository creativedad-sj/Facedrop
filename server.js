import express from "express";
import cors from "cors";
import multer from "multer";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use("/outputs", express.static("outputs"));

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || "YOUR_TOKEN_HERE";
const PORT = process.env.PORT || 3001;

// ============================================
// OPTIMIZED PuLID PARAMETERS (from official docs)
//
// KEY FINDINGS FROM RESEARCH:
//
// 1. true_cfg = 2 (was 1/disabled)
//    Official docs: "For stylized scenes, use true CFG
//    for higher ID similarity AND better style response"
//    This is the BIGGEST fix - enables real CFG process
//
// 2. id_weight = 1.5 (was 1.0)
//    Range is 0-3. Higher = stronger face identity.
//    1.5 gives strong identity without artifacts
//
// 3. start_step = 0 (keep at 0)
//    0 = max face fidelity, inserted from first step
//    Official: "For stylized images, set to 0-1"
//
// 4. guidance_scale = 3 (was 4)
//    Lower guidance = less aggressive prompt following
//    = more room for face identity preservation
//
// 5. ALL prompts must say "looking directly at camera"
//    and "front-facing portrait" - prevents face rotation
//    which causes identity loss
//
// 6. num_steps = 20 (keep, good balance)
// ============================================

function buildPrompt(template, gender) {
  const g = {
    male: { person: "a man", subject: "he", possessive: "his", title: "emperor", warrior: "warrior", villain: "villain", master: "master", explorer: "explorer", hero: "hero", desc: "a man with facial hair" },
    female: { person: "a woman", subject: "she", possessive: "her", title: "empress", warrior: "warrior queen", villain: "villainess", master: "master", explorer: "explorer", hero: "heroine", desc: "a woman" },
  };
  const words = g[gender] || g["male"];
  return template
    .replace(/{person}/g, words.person)
    .replace(/{subject}/g, words.subject)
    .replace(/{possessive}/g, words.possessive)
    .replace(/{title}/g, words.title)
    .replace(/{warrior}/g, words.warrior)
    .replace(/{villain}/g, words.villain)
    .replace(/{master}/g, words.master)
    .replace(/{explorer}/g, words.explorer)
    .replace(/{hero}/g, words.hero)
    .replace(/{desc}/g, words.desc);
}

// ============================================
// PROMPTS — ALL enforce front-facing, camera-looking
// This is critical for face preservation
// ============================================
const THEMES = {
  cyberpunk: {
    pulid: "close-up cinematic portrait of {desc} looking directly at the camera, as a cyberpunk {warrior}, wearing futuristic chrome and black tactical armor with glowing cyan LED strips on chest and shoulders, standing in a rain-soaked neon-lit Tokyo alley at night, massive holographic pink and blue advertisements glowing behind them, rain reflecting neon on wet street, blade runner cinematic lighting, dramatic, sharp focus on face, hyper detailed 8k photograph",
    scene: "a cinematic portrait of a cyberpunk {warrior} looking at camera, chrome tactical armor with cyan LEDs, neon Tokyo alley, holographic billboards, blade runner, dramatic lighting, 8k, portrait 3:4",
    fallback_style: "Video game",
    fallback: "cyberpunk warrior, neon rain city, chrome armor, cyan LEDs, blade runner, cinematic",
  },
  mughal: {
    pulid: "close-up cinematic portrait of {desc} looking directly at the camera, as a powerful Mughal {title} seated on an ornate golden throne in a grand palace, wearing magnificent brocade silk sherwani with heavy gold embroidery, jeweled turban with peacock feather and diamond ornament, heavy gold necklaces with rubies and emeralds, intricate marble inlay walls behind, warm golden candlelight, oil painting masterpiece, Rembrandt lighting, sharp focus on face, ultra detailed 8k",
    scene: "a Mughal {title} on golden throne looking at camera, jeweled turban, brocade silk sherwani, marble palace, candlelight, oil painting, 8k, portrait 3:4",
    fallback_style: "3D",
    fallback: "mughal emperor, golden throne, jeweled turban, brocade silk, marble palace, regal",
  },
  anime: {
    pulid: "close-up cinematic portrait of {desc} looking directly at the camera, as an anime {hero} standing on a Tokyo skyscraper rooftop at sunset, wearing a dramatic flowing black coat with red lining billowing in wind, cherry blossom petals swirling around, city stretching below with dramatic orange and purple sky, vibrant saturated colors, anime-inspired cinematic composition, sharp focus on face, detailed 8k",
    scene: "an anime {hero} on skyscraper rooftop looking at camera, black coat with red lining, cherry blossoms, sunset Tokyo, dramatic sky, vibrant anime style, 8k, portrait 3:4",
    fallback_style: "Emoji",
    fallback: "anime hero, skyscraper rooftop, flowing black coat, cherry blossoms, sunset, dramatic",
  },
  viking: {
    pulid: "close-up cinematic portrait of {desc} looking directly at the camera, as a fearsome Viking {warrior} standing on a snowy cliff overlooking a fjord, wearing heavy bear fur cloak over chainmail armor, blue war paint in Norse patterns on {possessive} cheekbones, holding a massive battle axe, dragon-headed longship in icy water below, dramatic overcast sky with golden rays, epic Lord of the Rings aesthetic, sharp focus on face, hyper detailed 8k photograph",
    scene: "a Viking {warrior} on snowy cliff looking at camera, bear fur cloak, chainmail, blue war paint, battle axe, fjord, longship, epic cinematic, 8k, portrait 3:4",
    fallback_style: "Video game",
    fallback: "viking warrior, bear fur cloak, chainmail, blue war paint, snowy cliff, fjord, epic",
  },
  bollywood: {
    pulid: "close-up cinematic portrait of {desc} looking directly at the camera, as a powerful Bollywood {villain} at a grand palace party, wearing perfectly tailored midnight black bandhgala suit with gold buttons, gold pocket square, heavy gold chain around neck, confident menacing expression, crystal chandeliers and red velvet curtains behind, warm dramatic rim lighting, Sanjay Leela Bhansali cinematography, sharp focus on face, 8k cinematic photograph",
    scene: "a Bollywood {villain} at palace party looking at camera, black bandhgala suit, gold chain, chandeliers, red velvet, rim lighting, cinematic, 8k, portrait 3:4",
    fallback_style: "3D",
    fallback: "bollywood villain, black bandhgala suit, gold chain, palace party, chandeliers, cinematic",
  },
  samurai: {
    pulid: "close-up cinematic portrait of {desc} looking directly at the camera, as a legendary samurai {master} standing in a serene Japanese temple garden during golden hour, wearing full traditional yoroi armor in black lacquer and gold with red silk cord binding, katana sheathed at {possessive} side, wooden temple with curved roofs behind, koi pond, cherry blossom petals in warm golden light, Akira Kurosawa cinematography, sharp focus on face, 8k photograph",
    scene: "a samurai {master} in temple garden looking at camera, yoroi armor black gold, red silk, katana, cherry blossoms, golden hour, Kurosawa, 8k, portrait 3:4",
    fallback_style: "3D",
    fallback: "samurai master, yoroi armor black gold, katana, temple garden, cherry blossoms, golden hour",
  },
  astronaut: {
    pulid: "close-up cinematic portrait of {desc} looking directly at the camera through a clear transparent helmet visor, as an {explorer} floating in space, wearing detailed white NASA-style spacesuit with mission patches, blue marble of Earth visible behind, International Space Station in background, harsh sunlight from right creating dramatic contrast, Gravity movie IMAX aesthetic, sharp focus on face visible through visor, photorealistic 8k photograph",
    scene: "an {explorer} in space looking at camera through visor, NASA spacesuit, Earth behind, ISS, dramatic sun, Gravity movie, 8k, portrait 3:4",
    fallback_style: "3D",
    fallback: "astronaut in space, NASA spacesuit, earth behind, ISS, dramatic sun, photorealistic",
  },
};

// ============================================
// HELPERS
// ============================================
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", hasToken: REPLICATE_API_TOKEN !== "YOUR_TOKEN_HERE" });
});

app.post("/api/upload-face", upload.single("face"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  const ext = path.extname(req.file.originalname) || ".jpg";
  const newPath = req.file.path + ext;
  fs.renameSync(req.file.path, newPath);
  console.log("Face uploaded:", newPath);
  res.json({ faceId: path.basename(newPath) });
});

function fileToDataUri(filePath) {
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === ".png" ? "image/png" : "image/jpeg";
  return "data:" + mime + ";base64," + buffer.toString("base64");
}

async function pollPrediction(predictionId, label) {
  const url = "https://api.replicate.com/v1/predictions/" + predictionId;
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const response = await fetch(url, { headers: { Authorization: "Bearer " + REPLICATE_API_TOKEN } });
    const result = await response.json();
    console.log("    [" + label + "] Poll #" + (i + 1) + ": " + result.status);
    if (result.status === "succeeded") return result;
    if (result.status === "failed" || result.status === "canceled") throw new Error(result.status + ": " + (result.error || "unknown"));
  }
  throw new Error("Timed out");
}

async function downloadImage(imageUrl) {
  const imgResponse = await fetch(imageUrl);
  const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
  if (!fs.existsSync("outputs")) fs.mkdirSync("outputs");
  const outputName = "card_" + Date.now() + "_" + Math.random().toString(36).substring(7) + ".png";
  fs.writeFileSync(path.join("outputs", outputName), imgBuffer);
  return outputName;
}

function getImageUrl(result) {
  if (typeof result.output === "string") return result.output;
  if (Array.isArray(result.output) && result.output.length > 0) return result.output[0];
  return null;
}

async function callModel(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + REPLICATE_API_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (response.status === 429) {
    console.log("    Rate limited, waiting 20s...");
    await new Promise((r) => setTimeout(r, 20000));
    const retry = await fetch(url, { method: "POST", headers: { Authorization: "Bearer " + REPLICATE_API_TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const rt = await retry.text();
    if (!retry.ok) throw new Error("Retry failed " + retry.status);
    return JSON.parse(rt);
  }
  if (!response.ok) throw new Error("HTTP " + response.status + ": " + text.substring(0, 300));
  return JSON.parse(text);
}

// ============================================
// Core PuLID generation (reusable)
// OPTIMIZED parameters for max face preservation
// ============================================
async function generateWithPuLID(faceDataUri, themeId, gender) {
  const theme = THEMES[themeId];
  const prompt = buildPrompt(theme.pulid, gender);

  console.log("    Parameters: start_step=0, id_weight=1.5, true_cfg=2, guidance=3");

  const prediction = await callModel(
    "https://api.replicate.com/v1/predictions",
    {
      version: "8baa7ef2255075b46f4d91cd238c21d31181b3e6a864463f967960bb0112525b",
      input: {
        main_face_image: faceDataUri,
        prompt: prompt,
        negative_prompt: "(lowres, low quality, worst quality:1.2), watermark, deformed, mutated, cross-eyed, ugly, disfigured, bad anatomy, bad hands, text, blurry, out of focus, face looking away, profile view, side view",
        width: 768,
        height: 1024,
        num_steps: 20,
        start_step: 0,        // 0 = max face fidelity (official recommendation for stylized)
        guidance_scale: 3,    // lower = less prompt aggression = better face preservation
        id_weight: 1.5,       // 1.5 = strong identity (range 0-3, was 1.0)
        true_cfg: 2,          // ENABLED! was 1 (disabled). Official: "use true CFG for stylized scenes"
        max_sequence_length: 128,
        output_format: "png",
        output_quality: 95,
        num_outputs: 1,
      },
    }
  );

  if (prediction.error) throw new Error(prediction.error);

  let result = prediction;
  if (result.status !== "succeeded") {
    result = await pollPrediction(result.id, "PuLID-" + themeId);
  }

  const imageUrl = getImageUrl(result);
  if (!imageUrl) throw new Error("No output image");

  return await downloadImage(imageUrl);
}

// ============================================
// GENERATE SINGLE CARD
// ============================================
app.post("/api/generate-card", async (req, res) => {
  const { faceId, themeId, gender = "male" } = req.body;
  if (!faceId || !themeId) return res.status(400).json({ error: "faceId and themeId required" });

  const theme = THEMES[themeId];
  if (!theme) return res.status(400).json({ error: "Unknown theme: " + themeId });

  const facePath = path.join("uploads", faceId);
  if (!fs.existsSync(facePath)) return res.status(404).json({ error: "Face not found" });

  const faceDataUri = fileToDataUri(facePath);

  console.log("");
  console.log("========================================");
  console.log("  GENERATING: " + themeId.toUpperCase() + " | " + gender);
  console.log("========================================");

  // TIER 1: Flux PuLID (optimized)
  try {
    console.log("  [TIER 1] Flux PuLID (optimized params)...");
    const outputName = await generateWithPuLID(faceDataUri, themeId, gender);
    console.log("  TIER 1 SUCCESS! " + outputName);
    return res.json({ imageUrl: "/outputs/" + outputName, model: "flux-pulid", quality: "face-embedded" });
  } catch (err) {
    console.log("  TIER 1 FAILED: " + err.message);
  }

  // TIER 2: Two-step (scene + face swap)
  try {
    console.log("  [TIER 2] Two-step pipeline...");
    const scenePrompt = buildPrompt(theme.scene, gender);

    console.log("    Step 1: Generating scene...");
    const sceneResult = await callModel(
      "https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions",
      { input: { prompt: scenePrompt, aspect_ratio: "3:4", safety_tolerance: 5, output_quality: 95 } }
    );
    if (sceneResult.error) throw new Error("Scene: " + sceneResult.error);
    let scene = sceneResult;
    if (scene.status !== "succeeded") scene = await pollPrediction(scene.id, "Scene");
    const sceneUrl = getImageUrl(scene);
    if (!sceneUrl) throw new Error("No scene");

    console.log("    Step 2: Face swap...");
    const swapResult = await callModel(
      "https://api.replicate.com/v1/models/codeplugtech/face-swap/predictions",
      { input: { input_image: sceneUrl, swap_image: faceDataUri } }
    );
    if (swapResult.error) throw new Error("Swap: " + swapResult.error);
    let swap = swapResult;
    if (swap.status !== "succeeded") swap = await pollPrediction(swap.id, "Swap");
    const swapUrl = getImageUrl(swap);
    if (!swapUrl) throw new Error("No swap output");

    const outputName = await downloadImage(swapUrl);
    console.log("  TIER 2 SUCCESS! " + outputName);
    return res.json({ imageUrl: "/outputs/" + outputName, model: "flux+faceswap", quality: "cinematic-swap" });
  } catch (err) {
    console.log("  TIER 2 FAILED: " + err.message);
  }

  // TIER 3: face-to-many
  try {
    console.log("  [TIER 3] face-to-many...");
    const prediction = await callModel("https://api.replicate.com/v1/predictions", {
      version: "35cea9c3164d9fb7fbd48b51503eabdb39c9d04fdaef9a68f368bed8087ec5f9",
      input: { image: faceDataUri, style: theme.fallback_style, prompt: theme.fallback, negative_prompt: "nsfw, nude, blurry, low quality, deformed", instant_id_strength: 0.8 },
    });
    if (prediction.error) throw new Error(prediction.error);
    let result = prediction;
    if (result.status !== "succeeded") result = await pollPrediction(result.id, "F2M");
    const imageUrl = getImageUrl(result);
    if (!imageUrl) throw new Error("No output");
    const outputName = await downloadImage(imageUrl);
    console.log("  TIER 3 SUCCESS! " + outputName);
    return res.json({ imageUrl: "/outputs/" + outputName, model: "face-to-many", quality: "stylized" });
  } catch (err) {
    console.log("  TIER 3 FAILED: " + err.message);
  }

  res.status(500).json({ error: "All tiers failed" });
});

// ============================================
// TEST ALL THEMES
// ============================================
app.post("/api/generate-test-all", async (req, res) => {
  const { faceId, gender = "male" } = req.body;
  if (!faceId) return res.status(400).json({ error: "faceId required" });

  const facePath = path.join("uploads", faceId);
  if (!fs.existsSync(facePath)) return res.status(404).json({ error: "Face not found" });

  const faceDataUri = fileToDataUri(facePath);
  const themeIds = Object.keys(THEMES);

  console.log("");
  console.log("============================================");
  console.log("  TEST ALL | Gender: " + gender);
  console.log("  Optimized: true_cfg=2, id_weight=1.5");
  console.log("============================================");

  const results = {};

  for (const themeId of themeIds) {
    console.log("  --- " + themeId.toUpperCase() + " ---");
    try {
      const outputName = await generateWithPuLID(faceDataUri, themeId, gender);
      results[themeId] = { status: "success", imageUrl: "/outputs/" + outputName };
      console.log("  " + themeId + " DONE!");
    } catch (err) {
      results[themeId] = { status: "failed", error: err.message };
      console.log("  " + themeId + " FAILED: " + err.message);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  res.json({ results });
});

// ============================================
// TEST SINGLE THEME
// ============================================
app.post("/api/generate-test-single", async (req, res) => {
  const { faceId, themeId, gender = "male" } = req.body;
  if (!faceId || !themeId) return res.status(400).json({ error: "faceId and themeId required" });

  const facePath = path.join("uploads", faceId);
  if (!fs.existsSync(facePath)) return res.status(404).json({ error: "Face not found" });

  const faceDataUri = fileToDataUri(facePath);

  console.log("  TEST: " + themeId + " | " + gender + " | Optimized params");
  try {
    const outputName = await generateWithPuLID(faceDataUri, themeId, gender);
    res.json({ status: "success", themeId, imageUrl: "/outputs/" + outputName });
  } catch (err) {
    res.status(500).json({ status: "failed", themeId, error: err.message });
  }
});

// Debug
app.get("/api/debug/test-token", async (req, res) => {
  try { const r = await fetch("https://api.replicate.com/v1/account", { headers: { Authorization: "Bearer " + REPLICATE_API_TOKEN } }); res.json(await r.json()); }
  catch (err) { res.json({ error: err.message }); }
});

app.listen(PORT, () => {
  console.log("");
  console.log("============================================");
  console.log("  FACEDROP v7.0 — Optimized Face Engine");
  console.log("  Port: " + PORT);
  console.log("  Token: " + (REPLICATE_API_TOKEN !== "YOUR_TOKEN_HERE" ? "YES" : "MISSING"));
  console.log("");
  console.log("  PuLID Optimizations:");
  console.log("    start_step: 0 (max face fidelity)");
  console.log("    id_weight:  1.5 (was 1.0)");
  console.log("    true_cfg:   2 (was 1/disabled)");
  console.log("    guidance:   3 (was 4)");
  console.log("    All prompts: front-facing, camera-looking");
  console.log("    Negative: profile view, side view blocked");
  console.log("============================================");
});