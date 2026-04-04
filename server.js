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
// scene_prompt: Used by Flux to generate the cinematic scene
// avatar_prompt: Used by Easel AI Avatars as single-step alternative
// ============================================
const THEMES = {
  cyberpunk: {
    scene_prompt: "A cinematic portrait of a lone cyberpunk warrior standing in a rain-soaked neon-lit Tokyo alley at night. They wear futuristic chrome and black tactical armor with glowing cyan LED accents. Massive holographic advertisements glow in pink and blue behind them. Rain reflects neon on the wet street. Blade runner aesthetic, dramatic volumetric lighting, ultra detailed cinematic photograph, 8k, portrait aspect ratio 3:4, face clearly visible looking at camera",
    avatar_prompt: "a cyberpunk warrior standing in neon rain-soaked Tokyo alley, chrome tactical armor with glowing cyan LEDs, holographic ads in background, blade runner cinematic lighting",
    gender: "male",
  },
  mughal: {
    scene_prompt: "A cinematic portrait of a powerful Mughal emperor seated on an ornate golden throne inside the Diwan-i-Khas palace. He wears a magnificent brocade silk sherwani with gold embroidery, a jeweled turban with peacock feather and diamond ornament, heavy gold necklaces with rubies and emeralds. Intricate marble inlay, arched doorways with floral motifs, warm candlelight casting golden shadows. Oil painting masterpiece, Rembrandt lighting, ultra detailed 8k, portrait aspect ratio 3:4, face clearly visible looking at camera",
    avatar_prompt: "a mughal emperor on golden throne, jeweled turban with peacock feather, brocade silk sherwani, marble palace with candlelight, regal oil painting style",
    gender: "male",
  },
  anime: {
    scene_prompt: "A cinematic portrait of an anime hero standing dramatically on a Tokyo skyscraper rooftop at sunset. They wear a flowing black coat with red lining billowing in the wind. Cherry blossom petals swirl around them. The city stretches below with dramatic orange and purple sky. Vibrant saturated colors, detailed anime-inspired illustration style, dramatic composition, 8k quality, portrait aspect ratio 3:4, face clearly visible looking at camera",
    avatar_prompt: "an anime hero on tokyo skyscraper rooftop at sunset, flowing black coat with red lining, cherry blossom petals, dramatic wind, vibrant anime style",
    gender: "male",
  },
  viking: {
    scene_prompt: "A cinematic portrait of a fearsome Viking warrior chieftain standing on a snowy cliff overlooking a fjord. He wears a heavy bear fur cloak over chainmail armor with a horned iron helmet. Blue war paint in Norse patterns on his face. He holds a massive battle axe. A dragon-headed longship sits in icy waters below. Dramatic overcast sky with rays of light breaking through clouds. Epic Lord of the Rings aesthetic, hyper detailed 8k photograph, portrait aspect ratio 3:4, face clearly visible looking at camera",
    avatar_prompt: "a viking warrior chieftain on snowy cliff over fjord, bear fur cloak, chainmail armor, horned helmet, blue war paint, battle axe, longship below, epic cinematic",
    gender: "male",
  },
  bollywood: {
    scene_prompt: "A cinematic portrait of a powerful Bollywood villain making a dramatic entrance at a grand palace party. He wears a perfectly tailored midnight black bandhgala suit with gold buttons, gold pocket square, and heavy gold chain. Confident menacing expression. Background shows lavish party with crystal chandeliers, red velvet curtains, warm dramatic rim lighting. Sanjay Leela Bhansali cinematography, slow motion movie poster aesthetic, 8k cinematic photograph, portrait aspect ratio 3:4, face clearly visible looking at camera",
    avatar_prompt: "a bollywood villain at grand palace party, black bandhgala suit with gold accents, crystal chandeliers, red velvet, dramatic cinematic rim lighting, movie poster style",
    gender: "male",
  },
  samurai: {
    scene_prompt: "A cinematic portrait of a legendary samurai master standing in a serene Japanese temple garden during golden hour. He wears full traditional yoroi armor in black and gold with red silk cord binding. A katana sheathed at his side. Behind him a traditional wooden temple with curved roofs, koi pond with stone bridge, perfectly trimmed bonsai. Cherry blossom petals drift through warm golden light. Akira Kurosawa cinematography, painterly quality, hyper detailed 8k, portrait aspect ratio 3:4, face clearly visible looking at camera",
    avatar_prompt: "a samurai master in japanese temple garden, full yoroi armor black and gold, katana at side, cherry blossoms, golden hour, kurosawa cinematography, painterly epic",
    gender: "male",
  },
  astronaut: {
    scene_prompt: "A cinematic portrait of an astronaut floating in space with Earth visible in the background. They wear a detailed white NASA-style spacesuit with mission patches. The visor reflects the blue marble of Earth and distant stars. The International Space Station partially visible behind them. Harsh sunlight creating dramatic contrast against the void of space. Gravity movie aesthetic, photorealistic IMAX quality, hyper detailed 8k, portrait aspect ratio 3:4, face visible through clear visor looking at camera",
    avatar_prompt: "an astronaut floating in space, white NASA spacesuit, earth reflection in visor, ISS in background, dramatic sun contrast, gravity movie aesthetic, photorealistic",
    gender: "male",
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

async function pollPrediction(predictionId) {
  const url = "https://api.replicate.com/v1/predictions/" + predictionId;
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const response = await fetch(url, {
      headers: { Authorization: "Bearer " + REPLICATE_API_TOKEN },
    });
    const result = await response.json();
    console.log("    Poll #" + (i + 1) + ": " + result.status);
    if (result.status === "succeeded") return result;
    if (result.status === "failed" || result.status === "canceled") {
      throw new Error(result.status + ": " + (result.error || "unknown"));
    }
  }
  throw new Error("Timed out after 4 min");
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

async function callReplicateModel(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + REPLICATE_API_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (response.status === 429) {
    console.log("    Rate limited, waiting 15s...");
    await new Promise((r) => setTimeout(r, 15000));
    const retry = await fetch(url, { method: "POST", headers: { Authorization: "Bearer " + REPLICATE_API_TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const rt = await retry.text();
    if (!retry.ok) throw new Error("Retry " + retry.status + ": " + rt.substring(0, 200));
    return JSON.parse(rt);
  }
  if (!response.ok) throw new Error("HTTP " + response.status + ": " + text.substring(0, 300));
  return JSON.parse(text);
}

// ============================================
// GENERATE CARD — Three approaches in priority order
//
// 1. TWO-STEP: Flux scene + Easel face-swap (best quality)
// 2. SINGLE-STEP: Easel AI Avatars (good quality, faster)
// 3. FALLBACK: face-to-many (stylized)
// ============================================
app.post("/api/generate-card", async (req, res) => {
  const { faceId, themeId } = req.body;

  if (!faceId || !themeId) return res.status(400).json({ error: "faceId and themeId required" });

  const theme = THEMES[themeId];
  if (!theme) return res.status(400).json({ error: "Unknown theme: " + themeId });

  const facePath = path.join("uploads", faceId);
  if (!fs.existsSync(facePath)) return res.status(404).json({ error: "Face not found" });

  const faceDataUri = fileToDataUri(facePath);
  console.log("");
  console.log("========================================");
  console.log("  GENERATING: " + themeId.toUpperCase());
  console.log("========================================");

  // ---- APPROACH 1: Two-step (Flux scene + face swap) ----
  try {
    console.log("  [APPROACH 1] Two-step pipeline");

    // Step 1: Generate cinematic scene with Flux
    console.log("  Step 1: Flux Kontext Pro — generating scene...");
    const sceneResult = await callReplicateModel(
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

    if (sceneResult.error) throw new Error("Flux error: " + sceneResult.error);
    let scene = sceneResult;
    if (scene.status !== "succeeded") scene = await pollPrediction(scene.id);

    const sceneUrl = getImageUrl(scene);
    if (!sceneUrl) throw new Error("No scene image");
    console.log("  Step 1 DONE - scene generated");

    // Step 2: Swap user's face onto the scene
    console.log("  Step 2: Easel face-swap — adding your face...");
    const swapResult = await callReplicateModel(
      "https://api.replicate.com/v1/models/easel/advanced-face-swap/predictions",
      {
        input: {
          target_image: sceneUrl,
          swap_image: faceDataUri,
          user_gender: theme.gender,
          hair_source: "target",
        },
      }
    );

    if (swapResult.error) throw new Error("Swap error: " + swapResult.error);
    let swap = swapResult;
    if (swap.status !== "succeeded") swap = await pollPrediction(swap.id);

    const swapUrl = getImageUrl(swap);
    if (!swapUrl) throw new Error("No swap output");

    const outputName = await downloadImage(swapUrl);
    console.log("  TWO-STEP SUCCESS! " + outputName);
    return res.json({ imageUrl: "/outputs/" + outputName, model: "flux+faceswap", quality: "cinematic" });

  } catch (err) {
    console.log("  Two-step FAILED: " + err.message);
  }

  // ---- APPROACH 2: Easel AI Avatars (single-step) ----
  try {
    console.log("  [APPROACH 2] Easel AI Avatars");
    const avatarResult = await callReplicateModel(
      "https://api.replicate.com/v1/models/easel/ai-avatars/predictions",
      {
        input: {
          prompt: theme.avatar_prompt,
          face_image: faceDataUri,
          user_gender: theme.gender,
        },
      }
    );

    if (avatarResult.error) throw new Error(avatarResult.error);
    let avatar = avatarResult;
    if (avatar.status !== "succeeded") avatar = await pollPrediction(avatar.id);

    const avatarUrl = getImageUrl(avatar);
    if (!avatarUrl) throw new Error("No avatar output");

    const outputName = await downloadImage(avatarUrl);
    console.log("  AVATAR SUCCESS! " + outputName);
    return res.json({ imageUrl: "/outputs/" + outputName, model: "easel-avatars", quality: "avatar" });

  } catch (err) {
    console.log("  Avatars FAILED: " + err.message);
  }

  // ---- APPROACH 3: face-to-many (stylized fallback) ----
  try {
    console.log("  [APPROACH 3] face-to-many (fallback)");
    const prediction = await callReplicateModel(
      "https://api.replicate.com/v1/predictions",
      {
        version: "35cea9c3164d9fb7fbd48b51503eabdb39c9d04fdaef9a68f368bed8087ec5f9",
        input: {
          image: faceDataUri,
          style: "3D",
          prompt: theme.avatar_prompt,
          negative_prompt: "nsfw, nude, blurry, low quality, deformed, ugly",
          instant_id_strength: 0.8,
        },
      }
    );

    if (prediction.error) throw new Error(prediction.error);
    let result = prediction;
    if (result.status !== "succeeded") result = await pollPrediction(result.id);

    const imageUrl = getImageUrl(result);
    if (!imageUrl) throw new Error("No output");

    const outputName = await downloadImage(imageUrl);
    console.log("  FALLBACK SUCCESS! " + outputName);
    return res.json({ imageUrl: "/outputs/" + outputName, model: "face-to-many", quality: "stylized" });

  } catch (err) {
    console.log("  Fallback FAILED: " + err.message);
  }

  console.log("  ALL APPROACHES FAILED");
  res.status(500).json({ error: "All generation methods failed" });
});

// Debug
app.get("/api/debug/test-token", async (req, res) => {
  try {
    const r = await fetch("https://api.replicate.com/v1/account", { headers: { Authorization: "Bearer " + REPLICATE_API_TOKEN } });
    res.json(await r.json());
  } catch (err) { res.json({ error: err.message }); }
});

// Start
app.listen(PORT, () => {
  console.log("");
  console.log("============================================");
  console.log("  FACEDROP Premium Pipeline v3.0");
  console.log("  Port: " + PORT);
  console.log("  Token: " + (REPLICATE_API_TOKEN !== "YOUR_TOKEN_HERE" ? "YES" : "MISSING"));
  console.log("");
  console.log("  Pipeline (in priority order):");
  console.log("    1. Flux scene + Easel face-swap (cinematic)");
  console.log("    2. Easel AI Avatars (single-step)");
  console.log("    3. face-to-many (stylized fallback)");
  console.log("============================================");
});