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
// GENDER MAPPING
// ============================================
const getGenderTerms = (gender) => {
  const mapping = {
    male: { subject: "man", title: "king", honorific: "lord", adj: "handsome", pronoun: "he" },
    female: { subject: "woman", title: "queen", honorific: "lady", adj: "beautiful", pronoun: "she" },
    neutral: { subject: "person", title: "monarch", honorific: "sovereign", adj: "striking", pronoun: "they" }
  };
  return mapping[gender] || mapping.neutral;
};

// ============================================
// THEME DEFINITIONS (30 THEMES)
// ============================================
const THEME_TEMPLATES = {
  cyberpunk: {
    pulid: "portrait of a {{adj}} {{subject}} as a cyberpunk warrior in neon Tokyo, tactical chrome armor, glowing cyan LEDs, 8k photograph",
    scene: "cinematic portrait of a cyberpunk {{subject}} in neon Tokyo, tactical armor, 8k, face visible",
    fallback_style: "Video game", fallback_prompt: "cyberpunk {{subject}}, neon city, chrome armor"
  },
  mughal: {
    pulid: "portrait of a {{adj}} Mughal {{title}} on a golden throne, silk sherwani, jeweled turban, palace interior, 8k oil painting",
    scene: "Mughal {{title}} on golden throne, marble palace, candlelight, 8k",
    fallback_style: "3D", fallback_prompt: "mughal {{title}}, golden palace, royal"
  },
  anime: {
    pulid: "anime style portrait of a {{subject}} hero on a Tokyo rooftop, flowing coat, cherry blossoms, sunset, vibrant colors",
    scene: "anime hero {{subject}} on rooftop, sunset, cherry blossoms, 8k",
    fallback_style: "Emoji", fallback_prompt: "anime hero {{subject}}, rooftop, sunset"
  },
  viking: {
    pulid: "portrait of a fierce Viking {{subject}} chieftain on a snowy cliff, bear fur cloak, blue war paint, battle axe, 8k photo",
    scene: "Viking chieftain {{subject}} on snowy cliff, fur cloak, 8k",
    fallback_style: "Video game", fallback_prompt: "viking warrior {{subject}}, snow, fjord"
  },
  bollywood: {
    pulid: "bollywood movie poster of a powerful {{subject}} villain, tailored black suit, gold chains, grand palace, dramatic lighting",
    scene: "bollywood {{subject}} villain in palace, dramatic lighting, 8k",
    fallback_style: "3D", fallback_prompt: "bollywood style {{subject}}, dramatic, regal"
  },
  samurai: {
    pulid: "legendary samurai {{subject}} in Japanese garden, black and gold yoroi armor, katana, cherry blossoms, golden hour, 8k",
    scene: "samurai {{subject}} in garden, gold armor, 8k",
    fallback_style: "3D", fallback_prompt: "samurai {{subject}}, armor, katana"
  },
  astronaut: {
    pulid: "astronaut {{subject}} in white spacesuit, Earth reflection in visor, ISS background, cinematic 8k photograph",
    scene: "astronaut {{subject}} in space, Earth behind, 8k",
    fallback_style: "3D", fallback_prompt: "astronaut {{subject}}, space, earth"
  },
  pirate: {
    pulid: "portrait of a {{adj}} pirate captain {{subject}} on a storm-tossed ship, leather hat, gold hoop earring, holding a telescope, lightning flash, 8k",
    scene: "pirate captain {{subject}} on deck of ship, stormy sea, cinematic 8k",
    fallback_style: "Video game", fallback_prompt: "pirate {{subject}}, stormy sea, captain"
  },
  greek_god: {
    pulid: "ancient Greek {{title}} {{subject}} atop Mount Olympus, white silk robes, golden laurel wreath, glowing eyes, lightning in hand, marble pillars, 8k",
    scene: "Greek {{title}} on Olympus, golden aura, marble palace, 8k",
    fallback_style: "3D", fallback_prompt: "greek god {{subject}}, olympus, lightning"
  },
  steampunk: {
    pulid: "steampunk inventor {{subject}} in Victorian London, brass goggles, leather vest, mechanical arm, copper pipes and steam, 8k photo",
    scene: "steampunk {{subject}} inventor, clockwork background, 8k",
    fallback_style: "3D", fallback_prompt: "steampunk {{subject}}, goggles, gears"
  },
  wasteland: {
    pulid: "post-apocalyptic survivor {{subject}} in Mad Max style, spiked armor, sand-covered face, desert dunes, rusted car background, 8k",
    scene: "wasteland survivor {{subject}} in desert, rusted armor, 8k",
    fallback_style: "Video game", fallback_prompt: "post-apocalyptic {{subject}}, desert, spikes"
  },
  cyber_ninja: {
    pulid: "cyber-ninja {{subject}} in futuristic suit, glowing purple visor, twin katanas, rain-slicked city rooftop, 8k cinematic",
    scene: "cyber ninja {{subject}}, neon rooftop, 8k",
    fallback_style: "Video game", fallback_prompt: "cyber ninja {{subject}}, glowing visor"
  },
  vampire: {
    pulid: "gothic vampire {{honorific}} {{subject}} in a candlelit cathedral, velvet red cloak, pale skin, ornate gothic jewelry, 8k oil painting",
    scene: "vampire {{subject}} in gothic cathedral, red velvet, 8k",
    fallback_style: "3D", fallback_prompt: "vampire {{subject}}, gothic, cathedral"
  },
  knight: {
    pulid: "noble knight {{subject}} in polished silver plate armor, blue cape, holding a broadsword, medieval castle background, 8k photograph",
    scene: "knight {{subject}} in silver armor, castle courtyard, 8k",
    fallback_style: "3D", fallback_prompt: "knight {{subject}}, armor, sword"
  },
  forest_druid: {
    pulid: "mystical druid {{subject}} in a glowing ancient forest, crown of antlers, moss-covered robes, swirling green magic, 8k fantasy photo",
    scene: "druid {{subject}} in magical forest, green glow, 8k",
    fallback_style: "3D", fallback_prompt: "forest druid {{subject}}, magic, nature"
  },
  noir: {
    pulid: "1940s noir detective {{subject}} in a trench coat and fedora, smoking a cigar, rainy street corner, black and white cinematic film style, 8k",
    scene: "noir detective {{subject}} in rain, black and white, 8k",
    fallback_style: "3D", fallback_prompt: "noir detective {{subject}}, 1940s style"
  },
  atlantis: {
    pulid: "royal underwater {{title}} {{subject}} of Atlantis, shimmering scale armor, trident, glowing jellyfish, coral palace, 8k",
    scene: "underwater {{title}} {{subject}}, coral palace, 8k",
    fallback_style: "3D", fallback_prompt: "atlantis {{subject}}, trident, underwater"
  },
  egyptian: {
    pulid: "ancient Egyptian {{title}} {{subject}}, gold nemes headpiece, heavy kohl eyeliner, desert pyramids at sunset, 8k cinematic photo",
    scene: "Egyptian {{title}} {{subject}} by pyramids, sunset, 8k",
    fallback_style: "3D", fallback_prompt: "egyptian pharaoh {{subject}}, gold"
  },
  cyber_hacker: {
    pulid: "tech hacker {{subject}} in a dark room full of holographic screens, hoodie, glowing code reflecting on face, futuristic vibe, 8k",
    scene: "hacker {{subject}} with holograms, neon code, 8k",
    fallback_style: "Video game", fallback_prompt: "hacker {{subject}}, green code"
  },
  ice_monarch: {
    pulid: "Ice {{title}} {{subject}} in a palace of frozen glass, crown of jagged ice, fur-lined blue robes, snowflakes in air, 8k hyper-detailed",
    scene: "ice {{title}} {{subject}} in frozen palace, snow, 8k",
    fallback_style: "3D", fallback_prompt: "ice king {{subject}}, frozen"
  },
  wild_west: {
    pulid: "wild west outlaw {{subject}}, leather duster coat, cowboy hat, dusty saloon background, warm sunset light, 8k photograph",
    scene: "cowboy {{subject}} outlaw in desert town, 8k",
    fallback_style: "3D", fallback_prompt: "wild west {{subject}}, cowboy"
  },
  gladiator: {
    pulid: "Roman gladiator {{subject}} in the Colosseum, bronze chestplate, leather sandals, holding a shield, cheering crowd, 8k photo",
    scene: "gladiator {{subject}} in arena, roman style, 8k",
    fallback_style: "Video game", fallback_prompt: "gladiator {{subject}}, arena"
  },
  elven: {
    pulid: "ethereal elven {{subject}} in a silver forest, flowing white robes, long bow, glowing pendant, lord of the rings style, 8k",
    scene: "elven {{subject}} in silver forest, magic light, 8k",
    fallback_style: "3D", fallback_prompt: "elf {{subject}}, fantasy forest"
  },
  wizard: {
    pulid: "powerful wizard {{subject}} in star-patterned robes, wooden staff with glowing gem, ancient library background, floating books, 8k",
    scene: "wizard {{subject}} in library, magical sparks, 8k",
    fallback_style: "3D", fallback_prompt: "wizard {{subject}}, magic staff"
  },
  cyber_medic: {
    pulid: "futuristic cyber-medic {{subject}}, white sleek armor with red cross, glowing healing nanobots, sci-fi hospital, 8k",
    scene: "cyber medic {{subject}} in sci-fi lab, 8k",
    fallback_style: "3D", fallback_prompt: "sci-fi doctor {{subject}}, futuristic"
  },
  solarpunk: {
    pulid: "solarpunk architect {{subject}} in a city covered in vertical gardens, white linen clothing, golden sunlight, drones, 8k",
    scene: "solarpunk city and {{subject}}, green nature, 8k",
    fallback_style: "3D", fallback_prompt: "solarpunk {{subject}}, green city"
  },
  superhero: {
    pulid: "superhero {{subject}} in a high-tech suit, cape fluttering, standing on a skyscraper ledge, heroic pose, 8k cinematic",
    scene: "superhero {{subject}} on skyscraper, epic sky, 8k",
    fallback_style: "Video game", fallback_prompt: "superhero {{subject}}, comic style"
  },
  monk: {
    pulid: "shaolin monk {{subject}} in orange robes, performing a kick on a mountain peak, clouds below, cinematic martial arts style, 8k",
    scene: "martial arts monk {{subject}} on mountain, 8k",
    fallback_style: "3D", fallback_prompt: "monk {{subject}}, mountain peak"
  },
  racer: {
    pulid: "formula 1 racer {{subject}} in a futuristic glowing suit, holding a helmet, sleek race car in background, motion blur, 8k",
    scene: "f1 racer {{subject}} by futuristic car, 8k",
    fallback_style: "Video game", fallback_prompt: "racer {{subject}}, fast car"
  },
  sorcerer: {
    pulid: "dark sorcerer {{subject}} in shadows, purple flames in hands, dark obsidian throne, demonic runes, 8k cinematic photo",
    scene: "dark sorcerer {{subject}} with purple fire, 8k",
    fallback_style: "3D", fallback_prompt: "dark magic {{subject}}, sorcerer"
  }
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
    console.log(`    [${label}] Poll #${i + 1}: ${result.status}`);
    if (result.status === "succeeded") return result;
    if (result.status === "failed" || result.status === "canceled") throw new Error(result.error || "failed");
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

async function callModel(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + REPLICATE_API_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("HTTP " + response.status);
  return await response.json();
}

// ============================================
// MAIN GENERATION
// ============================================
app.post("/api/generate-card", async (req, res) => {
  const { faceId, themeId, gender = "neutral" } = req.body;
  if (!faceId || !themeId) return res.status(400).json({ error: "Missing params" });

  const template = THEME_TEMPLATES[themeId];
  if (!template) return res.status(400).json({ error: "Unknown theme" });

  const terms = getGenderTerms(gender);
  const facePath = path.join("uploads", faceId);
  const faceDataUri = fileToDataUri(facePath);

  // Helper to replace placeholders
  const fill = (str) => str.replace(/{{subject}}/g, terms.subject)
                           .replace(/{{title}}/g, terms.title)
                           .replace(/{{honorific}}/g, terms.honorific)
                           .replace(/{{adj}}/g, terms.adj);

  console.log(`\n--- GEN: ${themeId} | GENDER: ${gender} ---`);

  // TIER 1: Flux PuLID
  try {
    const prediction = await callModel("https://api.replicate.com/v1/predictions", {
      version: "8baa7ef2255075b46f4d91cd238c21d31181b3e6a864463f967960bb0112525b",
      input: {
        main_face_image: faceDataUri,
        prompt: fill(template.pulid),
        width: 768, height: 1024, num_steps: 20, start_step: 0, id_weight: 1.0, output_format: "jpg"
      },
    });

    let result = prediction;
    if (result.status !== "succeeded") result = await pollPrediction(result.id, "PuLID");

    const out = await downloadImage(result.output[0] || result.output);
    return res.json({ imageUrl: "/outputs/" + out, model: "pulid" });
  } catch (err) {
    console.log("Tier 1 Failed, trying Tier 3 Fallback...");
  }

  // TIER 3 Fallback (Face-to-Many)
  try {
    const prediction = await callModel("https://api.replicate.com/v1/predictions", {
      version: "35cea9c3164d9fb7fbd48b51503eabdb39c9d04fdaef9a68f368bed8087ec5f9",
      input: {
        image: faceDataUri,
        style: template.fallback_style,
        prompt: fill(template.fallback_prompt),
        instant_id_strength: 0.8,
      },
    });

    let result = prediction;
    if (result.status !== "succeeded") result = await pollPrediction(result.id, "Fallback");

    const out = await downloadImage(result.output[0] || result.output);
    return res.json({ imageUrl: "/outputs/" + out, model: "face-to-many" });
  } catch (err) {
    res.status(500).json({ error: "All tiers failed" });
  }
});

app.listen(PORT, () => console.log(`FaceDrop Server on ${PORT}`));