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
// CINEMATIC THEME PROMPTS
// Each has two versions:
//   kontext: for Flux Kontext Pro (image-to-image, keeps face)
//   stylized: for face-to-many (artistic transformation)
// ============================================
const THEMES = {
  cyberpunk: {
    kontext: "Transform this person into a cyberpunk warrior standing in a rain-soaked neon-lit Tokyo street at night. They are wearing futuristic chrome and black tactical armor with glowing cyan LED strips. Their face has subtle cybernetic implants near the temple. Massive holographic advertisements glow in the background in pink and blue. Rain reflects neon lights on the wet street. Cinematic, dramatic lighting, blade runner aesthetic, hyper detailed, 8k quality photograph",
    stylized: {
      style: "Video game",
      prompt: "cyberpunk warrior, full body, standing in neon rain city, chrome tactical armor with glowing cyan LEDs, massive holographic billboards, blade runner aesthetic, dramatic cinematic lighting, hyper detailed",
    },
  },
  mughal: {
    kontext: "Transform this person into a powerful Mughal emperor seated on an ornate golden throne inside the Diwan-i-Khas palace. They are wearing a magnificent brocade silk sherwani with gold embroidery, a jeweled turban with peacock feather and diamond ornament, and heavy gold necklaces with rubies and emeralds. The throne room has intricate marble inlay work, arched doorways with floral motifs, and warm candlelight casting golden shadows. Oil painting masterpiece style, Rembrandt lighting, ultra detailed, 8k",
    stylized: {
      style: "3D",
      prompt: "mughal emperor, ornate golden throne, jeweled turban with peacock feather, brocade silk sherwani with gold embroidery, marble palace with intricate inlay, warm candlelight, oil painting masterpiece, regal and powerful",
    },
  },
  anime: {
    kontext: "Transform this person into an anime hero standing on top of a Tokyo skyscraper at sunset. They are wearing a dramatic flowing black coat with red lining that billows in the wind. Cherry blossom petals swirl around them. The city stretches below with dramatic orange and purple sky. Their eyes have an intense anime-style glow. Studio Ghibli meets Attack on Titan art style, vibrant saturated colors, dramatic composition, detailed anime illustration",
    stylized: {
      style: "Emoji",
      prompt: "anime hero, standing on skyscraper rooftop, flowing black coat with red lining, cherry blossom petals swirling, sunset over tokyo, dramatic wind, vibrant colors, studio ghibli quality, detailed anime illustration",
    },
  },
  viking: {
    kontext: "Transform this person into a fearsome Viking warrior chieftain standing on a snowy cliff overlooking a fjord. They are wearing heavy bear fur cloak over chainmail armor, with a horned iron helmet. Their face has blue war paint in Norse patterns. They hold a massive battle axe. Behind them, a dragon-headed longship sits in the icy water. Overcast dramatic sky with rays of light breaking through clouds. Cinematic, epic composition, Lord of the Rings aesthetic, hyper detailed photograph",
    stylized: {
      style: "Video game",
      prompt: "viking warrior chieftain, bear fur cloak over chainmail, horned helmet, blue war paint, massive battle axe, snowy cliff overlooking fjord, longship in background, dramatic overcast sky, epic cinematic composition",
    },
  },
  bollywood: {
    kontext: "Transform this person into a powerful Bollywood villain making a dramatic entrance at a grand party. They are wearing a perfectly tailored midnight black bandhgala suit with gold buttons, a gold pocket square, and a heavy gold chain. They have a confident menacing smirk. The background is a lavish palace party with crystal chandeliers, red velvet curtains, and warm dramatic lighting. Slow-motion movie poster aesthetic, dramatic rim lighting, Sanjay Leela Bhansali cinematography style, 8k cinematic photograph",
    stylized: {
      style: "3D",
      prompt: "bollywood villain, black bandhgala suit with gold accents, gold chain, menacing confident expression, grand palace party background, crystal chandeliers, red velvet, dramatic rim lighting, cinematic movie poster",
    },
  },
  samurai: {
    kontext: "Transform this person into a legendary samurai master standing in a serene Japanese temple garden during golden hour. They are wearing full traditional samurai yoroi armor in black and gold with a red silk cord binding. A katana is sheathed at their side. Behind them, a traditional wooden temple with curved roofs, a koi pond with a stone bridge, and perfectly trimmed bonsai trees. Cherry blossom petals drift through warm golden light. Akira Kurosawa cinematography, painterly quality, hyper detailed 8k photograph",
    stylized: {
      style: "3D",
      prompt: "legendary samurai, full yoroi armor black and gold, red silk bindings, katana at side, japanese temple garden, koi pond, cherry blossoms, golden hour light, kurosawa cinematography, painterly and epic",
    },
  },
  astronaut: {
    kontext: "Transform this person into an astronaut explorer floating in space with Earth visible behind them through the visor of their helmet. They are wearing a detailed white NASA-style spacesuit with mission patches. The visor reflects the blue marble of Earth and distant stars. The International Space Station is partially visible in the background. The scene is lit by harsh sunlight creating dramatic contrast. Gravity movie aesthetic, photorealistic, IMAX quality, hyper detailed 8k photograph",
    stylized: {
      style: "3D",
      prompt: "astronaut floating in space, white NASA spacesuit with patches, earth reflection in visor, international space station background, harsh sun creating dramatic shadows, gravity movie aesthetic, photorealistic, epic",
    },
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
  for (let i = 0; i < 90; i++) {
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
  throw new Error("Timed out");
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

async function callReplicate(url, body) {
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
    const retry = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + REPLICATE_API_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const retryText = await retry.text();
    if (!retry.ok) throw new Error("Retry " + retry.status + ": " + retryText.substring(0, 200));
    return JSON.parse(retryText);
  }

  if (!response.ok) throw new Error("HTTP " + response.status + ": " + text.substring(0, 300));
  return JSON.parse(text);
}

// ============================================
// GENERATE CARD — Two-step pipeline
// Step 1: Try Flux Kontext Pro (best quality, keeps face)
// Step 2: Fallback to face-to-many (stylized)
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
  console.log("=== GENERATING: " + themeId.toUpperCase() + " ===");

  // ---- APPROACH 1: Flux Kontext Pro ----
  // Official model, best quality, does image editing that preserves face
  try {
    console.log("  [1/2] Flux Kontext Pro (cinematic transformation)...");

    const prediction = await callReplicate(
      "https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions",
      {
        input: {
          image: faceDataUri,
          prompt: theme.kontext,
          aspect_ratio: "3:4",
          safety_tolerance: 5,
          output_quality: 95,
        },
      }
    );

    if (prediction.error) throw new Error(prediction.error);
    console.log("    Prediction: " + prediction.id);

    let result = prediction;
    if (result.status !== "succeeded") {
      result = await pollPrediction(result.id);
    }

    const imageUrl = getImageUrl(result);
    if (!imageUrl) throw new Error("No image output");

    const outputName = await downloadImage(imageUrl);
    console.log("  SUCCESS with Flux Kontext Pro! " + outputName);

    return res.json({
      imageUrl: "/outputs/" + outputName,
      model: "flux-kontext-pro",
      quality: "cinematic",
    });

  } catch (err) {
    console.log("  Flux Kontext failed: " + err.message);
  }

  // ---- APPROACH 2: face-to-many (stylized) ----
  try {
    console.log("  [2/2] face-to-many (stylized)...");

    const prediction = await callReplicate(
      "https://api.replicate.com/v1/predictions",
      {
        version: "35cea9c3164d9fb7fbd48b51503eabdb39c9d04fdaef9a68f368bed8087ec5f9",
        input: {
          image: faceDataUri,
          style: theme.stylized.style,
          prompt: theme.stylized.prompt,
          negative_prompt: "nsfw, nude, blurry, low quality, deformed, ugly, bad anatomy, bad hands, cropped",
          lora_scale: 1,
          instant_id_strength: 0.8,
        },
      }
    );

    if (prediction.error) throw new Error(prediction.error);
    console.log("    Prediction: " + prediction.id);

    let result = prediction;
    if (result.status !== "succeeded") {
      result = await pollPrediction(result.id);
    }

    const imageUrl = getImageUrl(result);
    if (!imageUrl) throw new Error("No image output");

    const outputName = await downloadImage(imageUrl);
    console.log("  SUCCESS with face-to-many! " + outputName);

    return res.json({
      imageUrl: "/outputs/" + outputName,
      model: "face-to-many",
      quality: "stylized",
    });

  } catch (err) {
    console.log("  face-to-many failed: " + err.message);
  }

  console.log("  ALL APPROACHES FAILED");
  res.status(500).json({ error: "Generation failed. Check server logs." });
});

// ============================================
// DEBUG
// ============================================
app.get("/api/debug/test-token", async (req, res) => {
  try {
    const r = await fetch("https://api.replicate.com/v1/account", {
      headers: { Authorization: "Bearer " + REPLICATE_API_TOKEN },
    });
    res.json(await r.json());
  } catch (err) {
    res.json({ error: err.message });
  }
});

// ============================================
// START
// ============================================
app.listen(PORT, () => {
  console.log("");
  console.log("============================================");
  console.log("  FACEDROP Premium Pipeline v2.0");
  console.log("  Port: " + PORT);
  console.log("  Token: " + (REPLICATE_API_TOKEN !== "YOUR_TOKEN_HERE" ? "YES" : "MISSING"));
  console.log("");
  console.log("  Pipeline:");
  console.log("    1. Flux Kontext Pro (cinematic, face-preserving)");
  console.log("    2. face-to-many (stylized fallback)");
  console.log("============================================");
});