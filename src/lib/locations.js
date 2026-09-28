// Myanmar locations dataset (ported). The views read via helpers below —
// nothing city-specific is hard-coded in page templates.
"use strict";

const MYANMAR_LOCATIONS = [
  { id: "yangon", nameEn: "Yangon", nameMy: "ရန်ကုန်", stateEn: "Yangon Region", stateMy: "ရန်ကုန်တိုင်းဒေသကြီး", lat: 16.8409, lon: 96.1735, aliases: ["Rangoon"] },
  { id: "mandalay", nameEn: "Mandalay", nameMy: "မန္တလေး", stateEn: "Mandalay Region", stateMy: "မန္တလေးတိုင်းဒေသကြီး", lat: 21.9588, lon: 96.0891 },
  { id: "naypyidaw", nameEn: "Naypyidaw", nameMy: "နေပြည်တော်", stateEn: "Naypyidaw Territory", stateMy: "နေပြည်တော် ကောင်စီနယ်မြေ", lat: 19.7633, lon: 96.0785, aliases: ["Nay Pyi Taw"] },
  { id: "bago", nameEn: "Bago", nameMy: "ပဲခူး", stateEn: "Bago Region", stateMy: "ပဲခူးတိုင်းဒေသကြီး", lat: 17.3229, lon: 96.4667, aliases: ["Pegu"] },
  { id: "mawlamyine", nameEn: "Mawlamyine", nameMy: "မော်လမြိုင်", stateEn: "Mon State", stateMy: "မွန်ပြည်နယ်", lat: 16.4908, lon: 97.6283, aliases: ["Moulmein"] },
  { id: "pathein", nameEn: "Pathein", nameMy: "ပုသိမ်", stateEn: "Ayeyarwady Region", stateMy: "ဧရာဝတီတိုင်းဒေသကြီး", lat: 16.7794, lon: 94.7321, aliases: ["Bassein"] },
  { id: "taunggyi", nameEn: "Taunggyi", nameMy: "တောင်ကြီး", stateEn: "Shan State", stateMy: "ရှမ်းပြည်နယ်", lat: 20.7891, lon: 97.0378 },
  { id: "sittwe", nameEn: "Sittwe", nameMy: "စစ်တွေ", stateEn: "Rakhine State", stateMy: "ရခိုင်ပြည်နယ်", lat: 20.1485, lon: 92.8966, aliases: ["Akyab"] },
  { id: "myitkyina", nameEn: "Myitkyina", nameMy: "မြစ်ကြီးနား", stateEn: "Kachin State", stateMy: "ကချင်ပြည်နယ်", lat: 25.3868, lon: 97.3948 },
  { id: "monywa", nameEn: "Monywa", nameMy: "မုံရွာ", stateEn: "Sagaing Region", stateMy: "စစ်ကိုင်းတိုင်းဒေသကြီး", lat: 22.1077, lon: 95.1354 },
  { id: "dawei", nameEn: "Dawei", nameMy: "ထားဝယ်", stateEn: "Tanintharyi Region", stateMy: "တနင်္သာရီတိုင်းဒေသကြီး", lat: 14.0833, lon: 98.2, aliases: ["Tavoy"] },
  { id: "hpaan", nameEn: "Hpa-An", nameMy: "ဘားအံ", stateEn: "Kayin State", stateMy: "ကရင်ပြည်နယ်", lat: 16.8891, lon: 97.6329, aliases: ["Pa-an"] },
];

const DEFAULT_LOCATION = MYANMAR_LOCATIONS[0];

/** Local substring search over EN + MM names and aliases (runs first, before geocoding). */
function searchLocalLocations(query, limit = 6) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];
  return MYANMAR_LOCATIONS.filter(
    (l) =>
      l.nameEn.toLowerCase().includes(q) ||
      l.nameMy.includes(String(query).trim()) ||
      (l.aliases || []).some((a) => a.toLowerCase().includes(q)),
  ).slice(0, limit);
}

function getLocationById(id) {
  return MYANMAR_LOCATIONS.find((l) => l.id === id);
}

function locationDisplayName(l, lang) {
  return lang === "my" ? l.nameMy : l.nameEn;
}

function locationHierarchy(l, lang) {
  const city = lang === "my" ? l.nameMy : l.nameEn;
  const state = lang === "my" ? l.stateMy : l.stateEn;
  return `${city} › ${state}`;
}

module.exports = {
  MYANMAR_LOCATIONS,
  DEFAULT_LOCATION,
  searchLocalLocations,
  getLocationById,
  locationDisplayName,
  locationHierarchy,
};
