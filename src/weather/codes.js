// WMO weather-code mapping → localized description + icon key + alert derivation.
// Ported from the Tech Stack 3 build (same thresholds, same bilingual copy).
"use strict";

const INFO = {
  0: { labelKey: "clear", iconDay: "sun", iconNight: "moon" },
  1: { labelKey: "mainlyClear", iconDay: "sun", iconNight: "moon" },
  2: { labelKey: "partlyCloudy", iconDay: "cloudSun", iconNight: "cloudMoon" },
  3: { labelKey: "overcast", iconDay: "cloud", iconNight: "cloud" },
  45: { labelKey: "fog", iconDay: "cloudFog", iconNight: "cloudFog" },
  48: { labelKey: "fog", iconDay: "cloudFog", iconNight: "cloudFog" },
  51: { labelKey: "drizzle", iconDay: "cloudDrizzle", iconNight: "cloudDrizzle" },
  53: { labelKey: "drizzle", iconDay: "cloudDrizzle", iconNight: "cloudDrizzle" },
  55: { labelKey: "drizzle", iconDay: "cloudDrizzle", iconNight: "cloudDrizzle" },
  56: { labelKey: "freezingDrizzle", iconDay: "cloudDrizzle", iconNight: "cloudDrizzle" },
  57: { labelKey: "freezingDrizzle", iconDay: "cloudDrizzle", iconNight: "cloudDrizzle" },
  61: { labelKey: "rain", iconDay: "cloudRain", iconNight: "cloudRain" },
  63: { labelKey: "rain", iconDay: "cloudRain", iconNight: "cloudRain" },
  65: { labelKey: "rain", iconDay: "cloudRain", iconNight: "cloudRain" },
  66: { labelKey: "freezingRain", iconDay: "cloudRain", iconNight: "cloudRain" },
  67: { labelKey: "freezingRain", iconDay: "cloudRain", iconNight: "cloudRain" },
  71: { labelKey: "snow", iconDay: "cloudSnow", iconNight: "cloudSnow" },
  73: { labelKey: "snow", iconDay: "cloudSnow", iconNight: "cloudSnow" },
  75: { labelKey: "snow", iconDay: "cloudSnow", iconNight: "cloudSnow" },
  77: { labelKey: "snowGrains", iconDay: "cloudSnow", iconNight: "cloudSnow" },
  80: { labelKey: "rainShowers", iconDay: "cloudRain", iconNight: "cloudRain" },
  81: { labelKey: "rainShowers", iconDay: "cloudRain", iconNight: "cloudRain" },
  82: { labelKey: "rainShowers", iconDay: "cloudRain", iconNight: "cloudRain" },
  85: { labelKey: "snowShowers", iconDay: "cloudSnow", iconNight: "cloudSnow" },
  86: { labelKey: "snowShowers", iconDay: "cloudSnow", iconNight: "cloudSnow" },
  95: { labelKey: "thunderstorm", iconDay: "cloudLightning", iconNight: "cloudLightning" },
  96: { labelKey: "thunderstormHail", iconDay: "cloudHail", iconNight: "cloudHail" },
  99: { labelKey: "thunderstormHail", iconDay: "cloudHail", iconNight: "cloudHail" },
};

const FALLBACK = { labelKey: "unknown", iconDay: "cloud", iconNight: "cloud" };

function codeInfo(code) {
  return INFO[code] || FALLBACK;
}

function iconKeyFor(code, isDay) {
  const info = codeInfo(code);
  return isDay ? info.iconDay : info.iconNight;
}

// ---------------------------------------------------------------------------
// Alert derivation (Open-Meteo has no alert feed for Myanmar, so we derive
// severe-weather alerts from current conditions + daily forecast thresholds).
// ---------------------------------------------------------------------------

function deriveAlerts({ current, daily, areaName }) {
  const now = new Date().toISOString();
  const alerts = [];
  const push = (a) => alerts.push({ ...a, areas: [areaName], source: "open-meteo-derived", updatedAt: now });

  // Thunderstorm from current WMO code
  if ([95, 96, 99].includes(current.weatherCode)) {
    const severe = current.weatherCode !== 95;
    push({
      id: `thunderstorm-${current.observedAt.slice(0, 10)}`,
      title: { my: "မိုးကြိုးမုန်တိုင်း အန္တရာယ်", en: "Thunderstorm risk" },
      severity: severe ? "warning" : "watch",
      startsAt: current.observedAt,
      endsAt: null,
      description: {
        my: "မိုးကြိုးမုန်တိုင်း အခြေအနေ တွေ့ရှိရသည်။ လျှပ်စီးလက်ခြင်း၊ လေပြင်းတိုက်ခြင်းနှင့် ရုတ်တရက် မိုးသည်းထန်စွာ ရွာခြင်းတို့ ဖြစ်နိုင်သည်။",
        en: "Thunderstorm conditions detected. Expect lightning, gusty winds and sudden heavy rain.",
      },
      safetyActions: [
        { my: "လျှပ်စီးလက်နေစဉ် အိမ်တွင်း၌နေပြီး ပြတင်းပေါက်များနှင့် ဝေးဝေးနေပါ", en: "Stay indoors and away from windows during lightning" },
        { my: "အရေးကြီးလျှပ်စစ်ပစ္စည်းများ ပလပ်ဖြုတ်ထားပါ", en: "Unplug sensitive electronics" },
        { my: "လွင်ပြင်၊ သစ်ပင်ကြီးများနှင့် သတ္တုအဆောက်အဦးများကို ရှောင်ပါ", en: "Avoid open fields, tall trees and metal structures" },
      ],
    });
  }

  // Rainfall / flood risk from daily sums (next 3 days)
  const rain3 = daily.slice(0, 3).map((d) => d.precipitationMm || 0);
  const maxRain = Math.max(0, ...rain3);
  if (maxRain >= 100) {
    push({
      id: `flood-${(daily[0] && daily[0].date) || "today"}`,
      title: { my: "ရေကြီးနိုင်ခြေ", en: "Flood risk" },
      severity: "warning",
      startsAt: daily[0] ? `${daily[0].date}T00:00:00` : null,
      endsAt: null,
      description: {
        my: `မိုးအလွန်သည်းထန်စွာ ရွာမည်ဟု မျှော်လင့်ရသည် (၃ ရက်အတွင်း ${Math.round(maxRain)} မီလီမီတာခန့်)။ နိမ့်သောနေရာများ ရေကြီးနိုင်ခြေ ရှိသည်။`,
        en: `Very heavy rainfall expected (around ${Math.round(maxRain)} mm in 3 days). Risk of flooding in low-lying areas.`,
      },
      safetyActions: [
        { my: "ရေတက်လာပါက မြင့်သောနေရာသို့ ရွှေ့ပါ", en: "Move to higher ground if water rises" },
        { my: "သောက်ရေနှင့် အရေးကြီးပစ္စည်းများ ပြင်ဆင်ထားပါ", en: "Prepare drinking water and essentials" },
        { my: "ဒေသဆိုင်ရာ အာဏာပိုင်များ၏ ညွှန်ကြားချက်ကို လိုက်နာပါ", en: "Follow local authority instructions" },
      ],
    });
  } else if (maxRain >= 50) {
    push({
      id: `heavyrain-${(daily[0] && daily[0].date) || "today"}`,
      title: { my: "မိုးသည်းထန်စွာ ရွာမည်", en: "Heavy rain" },
      severity: "watch",
      startsAt: daily[0] ? `${daily[0].date}T00:00:00` : null,
      endsAt: null,
      description: {
        my: `မိုးသည်းထန်စွာ ရွာမည်ဟု မျှော်လင့်ရသည် (${Math.round(maxRain)} မီလီမီတာခန့်)။ နိမ့်သောနေရာများ ရေကြီးနိုင်သည်။`,
        en: `Heavy rainfall expected (around ${Math.round(maxRain)} mm). Low-lying areas may flood.`,
      },
      safetyActions: [
        { my: "ရေမြုပ်နေသော လမ်းများကို ရှောင်ပါ — ရေထဲသို့ ယာဉ်မောင်းမဝင်ပါနှင့်", en: "Avoid flooded roads — never drive through floodwater" },
        { my: "အဖိုးတန်ပစ္စည်းများကို မြင့်သောနေရာသို့ ရွှေ့ပါ", en: "Move valuables to higher ground" },
      ],
    });
  } else if (maxRain >= 25) {
    push({
      id: `rain-${(daily[0] && daily[0].date) || "today"}`,
      title: { my: "မိုးသည်းထန်စွာ ရွာမည်", en: "Heavy rain" },
      severity: "advisory",
      startsAt: daily[0] ? `${daily[0].date}T00:00:00` : null,
      endsAt: null,
      description: {
        my: `မိုးများစွာ ရွာမည်ဟု မျှော်လင့်ရသည် (${Math.round(maxRain)} မီလီမီတာခန့်)။`,
        en: `Significant rainfall expected (around ${Math.round(maxRain)} mm).`,
      },
      safetyActions: [
        { my: "အိမ်ပတ်ဝန်းကျင် ရေမြောင်းများ ပိတ်ဆို့မနေစေရန် စစ်ဆေးပါ", en: "Keep drains around your home clear" },
      ],
    });
  }

  // Heat from daily max (next 2 days)
  const maxTemp = Math.max(current.temperatureC, ...daily.slice(0, 2).map((d) => d.highC));
  if (maxTemp >= 40) {
    push({
      id: `heat-${(daily[0] && daily[0].date) || "today"}`,
      title: { my: "အပူလွန်ကဲခြင်း", en: "Extreme heat" },
      severity: "warning",
      startsAt: null,
      endsAt: null,
      description: {
        my: `အပူချိန် အန္တရာယ်ရှိလောက်အောင် မြင့်နေသည် (${Math.round(maxTemp)}°C ခန့်)။ နေ့လယ်ပိုင်း အပြင်ထွက်လုပ်ကိုင်ခြင်း ရှောင်ပါ။`,
        en: `Dangerously high temperatures (around ${Math.round(maxTemp)}°C). Avoid outdoor work at midday.`,
      },
      safetyActions: [
        { my: "ရေကို ပုံမှန်သောက်ပါ၊ အရက်ရှောင်ပါ", en: "Drink water regularly, avoid alcohol" },
        { my: "၁၁:၀၀–၁၅:၀၀ အတွင်း အရိပ်တွင် အနားယူပါ", en: "Rest in shade during 11:00–15:00" },
        { my: "သက်ကြီးရွယ်အိုများနှင့် ကလေးများကို ဂရုစိုက်ပါ", en: "Check on elderly people and children" },
      ],
    });
  } else if (maxTemp >= 37) {
    push({
      id: `heat-${(daily[0] && daily[0].date) || "today"}`,
      title: { my: "ရာသီဥတုပူပြင်းခြင်း", en: "Hot weather" },
      severity: "advisory",
      startsAt: null,
      endsAt: null,
      description: {
        my: `အပူချိန်မြင့်နေသည် (${Math.round(maxTemp)}°C ခန့်)။ ရေများများသောက်ပြီး အရိပ်တွင်နေပါ။`,
        en: `High temperatures (around ${Math.round(maxTemp)}°C). Stay hydrated and seek shade.`,
      },
      safetyActions: [
        { my: "ရေကို ပုံမှန်သောက်ပါ", en: "Drink water regularly" },
        { my: "နေ့လယ်ပိုင်း အရိပ်တွင်နေပါ", en: "Seek shade at midday" },
      ],
    });
  }

  // Strong wind from daily max wind (next 2 days)
  const maxWind = Math.max(current.windKmh, ...daily.slice(0, 2).map((d) => d.windKmh));
  if (maxWind >= 75) {
    push({
      id: `wind-${(daily[0] && daily[0].date) || "today"}`,
      title: { my: "လေပြင်းတိုက်မည်", en: "Strong winds" },
      severity: "warning",
      startsAt: null,
      endsAt: null,
      description: {
        my: `လေပြင်းတိုက်မည်ဟု မျှော်လင့်ရသည် (${Math.round(maxWind)} ကီလိုမီတာ/နာရီခန့်)။ အပြင်ရှိ ပစ္စည်းများကို ခိုင်အောင်ထားပါ။`,
        en: `Strong winds expected (around ${Math.round(maxWind)} km/h). Secure loose objects outdoors.`,
      },
      safetyActions: [
        { my: "ခေါင်မိုး၊ ဆိုင်းဘုတ်နှင့် လွင့်နိုင်သောပစ္စည်းများကို ခိုင်အောင်ထားပါ", en: "Secure roofs, signs and loose objects" },
        { my: "လေပြင်းတိုက်နေစဉ် ခရီးသွားခြင်း ရှောင်ပါ", en: "Avoid travel during gusts" },
      ],
    });
  } else if (maxWind >= 50) {
    push({
      id: `wind-${(daily[0] && daily[0].date) || "today"}`,
      title: { my: "လေပြင်းတိုက်မည်", en: "Strong winds" },
      severity: "watch",
      startsAt: null,
      endsAt: null,
      description: {
        my: `လေတိုက်နှုန်း မြင့်နေသည် (${Math.round(maxWind)} ကီလိုမီတာ/နာရီခန့်)။`,
        en: `Windy conditions (${Math.round(maxWind)} km/h).`,
      },
      safetyActions: [
        { my: "သစ်ပင်အိုကြီးများနှင့် ဓာတ်တိုင်များနှင့် ဝေးဝေးနေပါ", en: "Stay clear of old trees and power lines" },
      ],
    });
  }

  // Unusual cold
  const minTemp = Math.min(current.temperatureC, ...daily.slice(0, 2).map((d) => d.lowC));
  if (minTemp <= 8) {
    push({
      id: `cold-${(daily[0] && daily[0].date) || "today"}`,
      title: { my: "ပုံမှန်ထက် အေးနေသည်", en: "Unusually cold" },
      severity: "advisory",
      startsAt: null,
      endsAt: null,
      description: {
        my: `ဤဒေသအတွက် ပုံမှန်ထက် အပူချိန်နိမ့်နေသည် (${Math.round(minTemp)}°C ခန့်)။`,
        en: `Unusually low temperatures for this area (around ${Math.round(minTemp)}°C).`,
      },
      safetyActions: [
        { my: "နွေးထွေးသော အဝတ်များ ဝတ်ဆင်ပါ", en: "Wear warm layers" },
        { my: "သီးနှံနှင့် မွေးမြူရေးတိရစ္ဆာန်များကို အအေးဒဏ်မှ ကာကွယ်ပါ", en: "Protect crops and livestock from chill" },
      ],
    });
  }

  return alerts;
}

module.exports = { codeInfo, iconKeyFor, deriveAlerts };
