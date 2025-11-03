import fs from "fs";
import path from "path";

const mapPath = path.join(process.cwd(), "lib", "categoryMap.json");
const categoryMap = JSON.parse(fs.readFileSync(mapPath, "utf8"));

export { categoryMap };


// Extra keywords per category for stronger SEO
const categoryExtraKeywords = {
  nature: ["scenery", "landscape", "forest", "mountain", "lake", "river", "sunset", "sunrise", "outdoors"],
  vehicles: ["car", "truck", "transport", "automobile", "bus", "motorcycle", "highway", "speed", "racing"],
  animals: ["wildlife", "pets", "zoo", "forest", "bird", "cat", "dog", "cute animals", "nature"],
  beach: ["ocean", "sand", "sun", "summer", "vacation", "tropical", "resort", "seashore"],
  food: ["cuisine", "meal", "restaurant", "dishes", "delicious", "fresh", "gourmet", "recipe"],
  technology: ["gadgets", "devices", "AI", "computer", "laptop", "smartphone", "innovation", "electronics"],
  photo: ["photo", "image", "stock", "HD", "wallpaper", "download", "background"]
};

// -----------------------------
// Tokenize filename
// -----------------------------
function tokenizeFilename(filename) {
  let name = filename.replace(/\.[^/.]+$/, "").toLowerCase();

  // Remove trailing numbers (001, 002, etc.) for SEO
  name = name.replace(/[- ]?\(?\d+\)?$/, "");

  return name
    .replace(/[_\s]+/g, "-")
    .split("-")
    .map(w => w.trim())
    .filter(Boolean);
}

// -----------------------------
// Detect category from words
// -----------------------------
function detectCategory(words) {
  for (const w of words) {
    if (categoryMap[w]) return categoryMap[w];
  }
  for (const w of words) {
    const singular = w.replace(/s$/, "");
    if (categoryMap[singular]) return categoryMap[singular];
  }
  return "photo";
}

// -----------------------------
// Capitalize first letter
// -----------------------------
function capitalize(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// -----------------------------
// Generate SEO from filename
// -----------------------------
export function generateSEOFromFilename(filename) {
  const words = tokenizeFilename(filename);
  const mainCategory = detectCategory(words);

  // Keywords for SEO
  const extras = categoryExtraKeywords[mainCategory] || [];
  const genericExtras = [
    "HD wallpaper",
    "4K wallpaper",
    "free stock photo",
    "background image",
    "desktop wallpaper",
    "photography",
    "free download",
    "high resolution",
    "beautiful",
    "creative"
  ];

  const tags = Array.from(new Set([...words, ...extras, ...genericExtras])).slice(0, 30);

  // Title
  const title = `${capitalize(words.join(" ")) || "HD Wallpaper"} | Free ${capitalize(mainCategory)} Background Images Download`;

  // SEO-friendly Description
  const description = `Download free high-quality ${words.join(" ") || "HD"} ${mainCategory} wallpapers and background images. Perfect for desktops, laptops, mobile devices, and creative projects. Explore stunning ${mainCategory} images with vibrant colors, professional photography, and high resolution. Free to download and use for personal and commercial projects. Enhance your device with beautiful ${mainCategory} photos online.`;

  // Alt Text
  const alt = `Free ${words.join(" ") || "HD"} ${mainCategory} wallpaper and background photo in high resolution.`;

  return {
    title,
    description,
    alt,
    tags,
    category: mainCategory
  };
}
