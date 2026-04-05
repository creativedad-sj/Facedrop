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
// THEME DEFINITIONS
// pulid_prompt: For Flux PuLID (no trigger words, just describe the scene)
// scene_prompt: For two-step pipeline (Flux generates scene without face)
// fallback_prompt: For face-to-many
// ============================================
const GENDER_WORDS = {
  male: { subject: "man", title: "king", honorific: "lord", adj: "handsome" },
  female: { subject: "woman", title: "queen", honorific: "lady", adj: "beautiful" },
  neutral: { subject: "person", title: "monarch", honorific: "sovereign", adj: "striking" }
};

const THEMES = {
  cyberpunk: { pulid: "portrait of a {{adj}} {{subject}} as a cyberpunk warrior in neon Tokyo, tactical chrome armor, glowing cyan LEDs, 8k", fallback_style: "Video game", fallback_prompt: "cyberpunk {{subject}}, neon city" },
  mughal: { pulid: "portrait of a {{adj}} Mughal {{title}} on a golden throne, silk sherwani, jeweled turban, 8k oil painting", fallback_style: "3D", fallback_prompt: "mughal {{title}}, palace" },
  anime: { pulid: "anime style portrait of a {{subject}} hero on a Tokyo rooftop, flowing coat, cherry blossoms, sunset", fallback_style: "Emoji", fallback_prompt: "anime hero {{subject}}" },
  viking: { pulid: "fierce Viking {{subject}} chieftain on a snowy cliff, bear fur cloak, blue war paint, battle axe, 8k photo", fallback_style: "Video game", fallback_prompt: "viking {{subject}}" },
  bollywood: { pulid: "bollywood villain {{subject}}, tailored black suit, gold chains, grand palace, 8k cinematic", fallback_style: "3D", fallback_prompt: "bollywood villain {{subject}}" },
  samurai: { pulid: "samurai master {{subject}} in Japanese garden, black gold armor, katana, cherry blossoms, 8k", fallback_style: "3D", fallback_prompt: "samurai {{subject}}" },
  astronaut: { pulid: "astronaut {{subject}} in white spacesuit, Earth reflection in visor, 8k photo", fallback_style: "3D", fallback_prompt: "astronaut {{subject}}" },
  pirate: { pulid: "pirate captain {{subject}} on storm-tossed ship, leather hat, gold hoop earring, 8k photo", fallback_style: "Video game", fallback_prompt: "pirate {{subject}}" },
  greek_god: { pulid: "ancient Greek {{title}} atop Mount Olympus, golden laurel wreath, glowing eyes, 8k", fallback_style: "3D", fallback_prompt: "greek god {{title}}" },
  steampunk: { pulid: "steampunk inventor {{subject}}, brass goggles, mechanical arm, 8k photo", fallback_style: "3D", fallback_prompt: "steampunk {{subject}}" },
  wasteland: { pulid: "wasteland survivor {{subject}}, Mad Max style, spiked armor, desert dunes, 8k", fallback_style: "Video game", fallback_prompt: "wasteland {{subject}}" },
  cyber_ninja: { pulid: "cyber-ninja {{subject}} in futuristic suit, glowing purple visor, 8k", fallback_style: "Video game", fallback_prompt: "cyber ninja {{subject}}" },
  vampire: { pulid: "gothic vampire {{honorific}} in candlelit cathedral, red cloak, pale skin, 8k", fallback_style: "3D", fallback_prompt: "vampire {{subject}}" },
  knight: { pulid: "noble knight {{subject}} in silver plate armor, medieval castle background, 8k photo", fallback_style: "3D", fallback_prompt: "knight {{subject}}" },
  forest_druid: { pulid: "mystical druid {{subject}} in glowing ancient forest, crown of antlers, 8k", fallback_style: "3D", fallback_prompt: "druid {{subject}}" },
  noir: { pulid: "1940s noir detective {{subject}} in trench coat, fedora, rainy street, B&W, 8k", fallback_style: "3D", fallback_prompt: "noir detective {{subject}}" },
  atlantis: { pulid: "underwater {{title}} of Atlantis, scale armor, trident, 8k", fallback_style: "3D", fallback_prompt: "atlantis {{title}}" },
  egyptian: { pulid: "ancient Egyptian {{title}}, gold headpiece, pyramids at sunset, 8k photo", fallback_style: "3D", fallback_prompt: "pharaoh {{subject}}" },
  cyber_hacker: { pulid: "tech hacker {{subject}}, holographic screens, glowing code, 8k", fallback_style: "Video game", fallback_prompt: "hacker {{subject}}" },
  ice_monarch: { pulid: "Ice {{title}} in palace of frozen glass, crown of ice, 8k", fallback_style: "3D", fallback_prompt: "ice king {{title}}" },
  wild_west: { pulid: "wild west outlaw {{subject}}, leather duster, cowboy hat, 8k", fallback_style: "3D", fallback_prompt: "cowboy {{subject}}" },
  gladiator: { pulid: "Roman gladiator {{subject}} in Colosseum, bronze chestplate, 8k", fallback_style: "Video game", fallback_prompt: "gladiator {{subject}}" },
  elven: { pulid: "ethereal elven {{subject}} in silver forest, long bow, 8k", fallback_style: "3D", fallback_prompt: "elf {{subject}}" },
  wizard: { pulid: "powerful wizard {{subject}} in star robes, staff with glowing gem, 8k", fallback_style: "3D", fallback_prompt: "wizard {{subject}}" },
  cyber_medic: { pulid: "futuristic cyber-medic {{subject}}, sleek armor, healing nanobots, 8k", fallback_style: "3D", fallback_prompt: "sci-fi doctor {{subject}}" },
  solarpunk: { pulid: "solarpunk architect {{subject}} in green city, vertical gardens, 8k", fallback_style: "3D", fallback_prompt: "solarpunk {{subject}}" },
  superhero: { pulid: "superhero {{subject}} in high-tech suit, hero pose, 8k cinematic", fallback_style: "Video game", fallback_prompt: "superhero {{subject}}" },
  monk: { pulid: "shaolin monk {{subject}} in orange robes, mountain peak, 8k", fallback_style: "3D", fallback_prompt: "monk {{subject}}" },
  racer: { pulid: "formula 1 racer {{subject}} in futuristic suit, race car background, 8k", fallback_style: "Video game", fallback_prompt: "racer {{subject}}" },
  sorcerer: { pulid: "dark sorcerer {{subject}}, purple flames, obsidian throne, 8k", fallback_style: "3D", fallback_prompt: "sorcerer {{subject}}" }
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
    if (result.status === "failed" || result.status === "canceled") {
      throw new Error(result.status + ": " + (result.error || "unknown"));
    }
  }
  throw new Error("Timed out after 3 min");
}

async function downloadImage(imageUrl) {
  const imgResponse = await fetch(imageUrl);
  const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
  if (!fs.existsSync("outputs")) fs.mkdirSync("outputs");
  const outputName = "card_" + Date.now() + ".jpg";
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
    if (!retry.ok) throw new Error("Retry failed " + retry.status + ": " + rt.substring(0, 200));
    return JSON.parse(rt);
  }
  if (!response.ok) throw new Error("HTTP " + response.status + ": " + text.substring(0, 300));
  return JSON.parse(text);
}

// ============================================
// GENERATE CARD — Three-tier face preservation
//
// TIER 1: Flux PuLID (single-step, explicit face embedding)
//   - Best face fidelity from a single selfie
//   - Uses PuLID contrastive alignment on FLUX.1
//   - start_step=0, id_weight=1.0 for max face preservation
//
// TIER 2: Two-step (Flux Kontext scene + codeplugtech face-swap)
//   - Generates cinematic scene, then swaps face onto it
//   - Highest raw face accuracy (~95%+)
//
// TIER 3: face-to-many (stylized fallback)
//   - Already proven to work
// ============================================
app.post("/api/generate-card", async (req, res) => {
  const { faceId, themeId, gender = "neutral" } = req.body; // Added gender
  if (!faceId || !themeId) return res.status(400).json({ error: "faceId and themeId required" });

  const theme = THEMES[themeId];
  if (!theme) return res.status(400).json({ error: "Unknown theme: " + themeId });

   // Placeholder logic
  const terms = GENDER_WORDS[gender];
  const processPrompt = (str) => {
    return str.replace(/{{subject}}/g, terms.subject)
              .replace(/{{title}}/g, terms.title)
              .replace(/{{honorific}}/g, terms.honorific)
              .replace(/{{adj}}/g, terms.adj);
  };

  const pulid_prompt = processPrompt(theme.pulid);
  const fallback_prompt = processPrompt(theme.fallback_prompt);

  const facePath = path.join("uploads", faceId);
  if (!fs.existsSync(facePath)) return res.status(404).json({ error: "Face not found" });

  const faceDataUri = fileToDataUri(facePath);

  console.log("");
  console.log("========================================");
  console.log("  GENERATING: " + themeId.toUpperCase());
  console.log("========================================");

  // =========================================
  // TIER 1: Flux PuLID — single-step face embedding
  // =========================================
  try {
    console.log("  [TIER 1] Flux PuLID (face embedding)...");
    console.log("    Using: bytedance/flux-pulid");
    console.log("    start_step=0, id_weight=1.0 (max face fidelity)");

    const prediction = await callModel(
      "https://api.replicate.com/v1/predictions",
      {
        version: "8baa7ef2255075b46f4d91cd238c21d31181b3e6a864463f967960bb0112525b",
        input: {
          main_face_image: faceDataUri,
          prompt: pulid_prompt,
          negative_prompt: "(lowres, low quality, worst quality:1.2), watermark, deformed, mutated, cross-eyed, ugly, disfigured, bad anatomy, bad hands, text",
          width: 768,
          height: 1024,
          num_steps: 20,
          start_step: 0,
          guidance_scale: 4,
          id_weight: 1.0,
          true_cfg: 1,
          max_sequence_length: 128,
          output_format: "png",
          output_quality: 95,
          num_outputs: 1,
        },
      }
    );

    if (prediction.error) throw new Error(prediction.error);
    console.log("    Prediction: " + prediction.id);

    let result = prediction;
    if (result.status !== "succeeded") {
      result = await pollPrediction(result.id, "PuLID");
    }

    const imageUrl = getImageUrl(result);
    if (!imageUrl) throw new Error("No output image");

    const outputName = await downloadImage(imageUrl);
    console.log("  TIER 1 SUCCESS! " + outputName);
    return res.json({ imageUrl: "/outputs/" + outputName, model: "flux-pulid", quality: "face-embedded" });

  } catch (err) {
    console.log("  TIER 1 FAILED: " + err.message);
  }

  // =========================================
  // TIER 2: Two-step — scene generation + face swap
  // =========================================
  try {
    console.log("  [TIER 2] Two-step pipeline...");

    // Step 2a: Generate cinematic scene with Flux Kontext Pro
    console.log("    Step 1: Generating scene with Flux Kontext Pro...");
    const sceneResult = await callModel(
      "https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions",
      {
        input: {
          prompt: theme.scene_prompt,
          aspect_ratio: "3:4",
          safety_tolerance: 5,
          output_quality: 95,
        },
      }
    );

    if (sceneResult.error) throw new Error("Scene: " + sceneResult.error);
    let scene = sceneResult;
    if (scene.status !== "succeeded") scene = await pollPrediction(scene.id, "Scene");

    const sceneUrl = getImageUrl(scene);
    if (!sceneUrl) throw new Error("No scene image");
    console.log("    Step 1 DONE — scene generated");

    // Step 2b: Swap face using codeplugtech/face-swap
    console.log("    Step 2: Swapping face with codeplugtech/face-swap...");
    const swapResult = await callModel(
      "https://api.replicate.com/v1/models/codeplugtech/face-swap/predictions",
      {
        input: {
          input_image: sceneUrl,
          swap_image: faceDataUri,
        },
      }
    );

    if (swapResult.error) throw new Error("Swap: " + swapResult.error);
    let swap = swapResult;
    if (swap.status !== "succeeded") swap = await pollPrediction(swap.id, "FaceSwap");

    const swapUrl = getImageUrl(swap);
    if (!swapUrl) throw new Error("No swap output");

    const outputName = await downloadImage(swapUrl);
    console.log("  TIER 2 SUCCESS! " + outputName);
    return res.json({ imageUrl: "/outputs/" + outputName, model: "flux+faceswap", quality: "cinematic-swap" });

  } catch (err) {
    const message = err.message || "Unknown error";
    console.log("  TIER 2 FAILED: " + message);
    if (message.includes("404")) {
      console.log("    Face-swap endpoint may be unavailable or the model path is invalid.");
    }
  }

  // =========================================
  // TIER 3: face-to-many (stylized fallback)
  // =========================================
  try {
    console.log("  [TIER 3] face-to-many (fallback)...");

    const prediction = await callModel(
      "https://api.replicate.com/v1/predictions",
      {
        version: "35cea9c3164d9fb7fbd48b51503eabdb39c9d04fdaef9a68f368bed8087ec5f9",
        input: {
          image: faceDataUri,
          style: theme.fallback_style,
          prompt: fallback_prompt,
          negative_prompt: "nsfw, nude, blurry, low quality, deformed, ugly, bad anatomy",
          instant_id_strength: 0.8,
        },
      }
    );

    if (prediction.error) throw new Error(prediction.error);
    let result = prediction;
    if (result.status !== "succeeded") result = await pollPrediction(result.id, "FaceToMany");

    const imageUrl = getImageUrl(result);
    if (!imageUrl) throw new Error("No output");

    const outputName = await downloadImage(imageUrl);
    console.log("  TIER 3 SUCCESS! " + outputName);
    return res.json({ imageUrl: "/outputs/" + outputName, model: "face-to-many", quality: "stylized" });

  } catch (err) {
    console.log("  TIER 3 FAILED: " + err.message);
  }

  console.log("  ALL TIERS FAILED");
  res.status(500).json({ error: "All generation methods failed" });
});

// Debug endpoints
app.get("/api/debug/test-token", async (req, res) => {
  try {
    const r = await fetch("https://api.replicate.com/v1/account", { headers: { Authorization: "Bearer " + REPLICATE_API_TOKEN } });
    res.json(await r.json());
  } catch (err) { res.json({ error: err.message }); }
});

// Test Flux PuLID specifically
app.get("/api/debug/test-pulid", async (req, res) => {
  try {
    const r = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: { Authorization: "Bearer " + REPLICATE_API_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({
        version: "8baa7ef2255075b46f4d91cd238c21d31181b3e6a864463f967960bb0112525b",
        input: {
          prompt: "portrait of a person, cinematic lighting",
          width: 512,
          height: 512,
          num_steps: 4,
          num_outputs: 1,
        },
      }),
    });
    const data = await r.json();
    res.json({ status: r.status, data: data });
  } catch (err) { res.json({ error: err.message }); }
});

// Start
app.listen(PORT, () => {
  console.log("");
  console.log("============================================");
  console.log("  FACEDROP v5.0 — Face Preservation Engine");
  console.log("  Port: " + PORT);
  console.log("  Token: " + (REPLICATE_API_TOKEN !== "YOUR_TOKEN_HERE" ? "YES" : "MISSING"));
  console.log("");
  console.log("  Three-tier pipeline:");
  console.log("    T1: Flux PuLID (face embedding, best fidelity)");
  console.log("    T2: Flux scene + codeplugtech face-swap");
  console.log("    T3: face-to-many (stylized fallback)");
  console.log("");
  console.log("  Debug: /api/debug/test-token");
  console.log("         /api/debug/test-pulid");
  console.log("============================================");
});