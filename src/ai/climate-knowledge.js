// Myanmar climate knowledge base — grounding context injected into every
// AI prompt. Values are approximate climatological normals (long-term
// averages), NOT live observations; prompts label them as such so the model
// never presents them as current measurements.
//
// Sources of truth: Myanmar Department of Meteorology and Hydrology (DMH)
// climatology, widely published normals for Yangon/Mandalay/Sittwe/Taunggyi/
// Myitkyina/Dawei. Seasons: summer Mar–May, southwest monsoon ~mid-May–Sep,
// winter (NE monsoon) Oct–Feb.
"use strict";

const ZONES = [
  {
    id: "rakhine",
    en: "Rakhine coast (Sittwe)", my: "ရခိုင်ကမ်းရိုးတန်း (စစ်တွေ)",
    descEn: "Very wet coastal strip facing the Bay of Bengal; heaviest monsoon rainfall in Myanmar.",
    descMy: "ဘင်္ဂလားပင်လယ်အော်ကို မျက်နှာမူထားသော ကမ်းရိုးတန်း — မြန်မာ့မိုးအများဆုံးဒေသ။",
    // monthly mean temp °C (Jan..Dec)
    temp: [21, 23, 26.5, 29, 29, 28, 27.5, 27.5, 28, 28, 26, 22.5],
    // monthly rainfall mm (Jan..Dec)
    rain: [5, 5, 15, 50, 400, 1100, 1300, 1100, 550, 250, 70, 15],
  },
  {
    id: "delta",
    en: "Ayeyarwady delta (Yangon/Pathein)", my: "ဧရာဝတီမြစ်ဝကျွန်းပေါ် (ရန်ကုန်/ပုသိမ်)",
    descEn: "Hot, humid delta; long monsoon with frequent urban flooding in Yangon.",
    descMy: "ပူပြင်းစိုစွတ်သော မြစ်ဝကျွန်းပေါ် — ရန်ကုန်တွင် မိုးရေလျှံမှု မကြာခဏ။",
    temp: [25.5, 26.5, 28.5, 30, 29, 27.5, 27, 27, 27.5, 28, 27, 25.5],
    rain: [5, 5, 15, 40, 300, 550, 600, 550, 380, 180, 60, 10],
  },
  {
    id: "dryzone",
    en: "Central dry zone (Mandalay/Sagaing/Magway)", my: "အလယ်ပိုင်းမိုးနည်းရပ်ဝန်း (မန္တလေး/စစ်ကိုင်း/မကွေး)",
    descEn: "Rain-shadow zone; Myanmar's hottest region (40–43°C in Apr), drought-prone.",
    descMy: "မိုးရိပ်ဒေသ — မြန်မာ့အပူဆုံးဒေသ (ဧပြီတွင် ၄၀–၄၃°C)၊ မိုးခေါင်တတ်သည်။",
    temp: [21.5, 24, 28.5, 32, 31.5, 30, 30.5, 30, 29.5, 28, 24.5, 21.5],
    rain: [5, 5, 10, 30, 90, 80, 60, 90, 130, 120, 40, 10],
  },
  {
    id: "shan",
    en: "Shan plateau / eastern highlands (Taunggyi)", my: "ရှမ်းကုန်းပြင်မြင့် (တောင်ကြီး)",
    descEn: "Highland (~1400m); mild year-round, cool winter nights, moderate monsoon.",
    descMy: "ကုန်းပြင်မြင့် (~၁၄၀၀မီတာ) — တစ်နှစ်ပတ်လုံး အေးမြပြီး ဆောင်းညများ ပိုအေး။",
    temp: [14, 16, 19.5, 22, 21.5, 20.5, 20, 20, 20, 19.5, 17, 14.5],
    rain: [10, 10, 20, 60, 170, 170, 200, 230, 190, 150, 70, 20],
  },
  {
    id: "north",
    en: "Northern mountains (Myitkyina/Putao)", my: "မြောက်ပိုင်းတောင်တန်း (မြစ်ကြီးနား/ပူတာအို)",
    descEn: "Wet and cooler; Himalayan foothills, heavy orographic monsoon rain.",
    descMy: "စိုစွတ်အေးမြသော တောင်တန်း — မိုးများစွာရွာသွန်းသည်။",
    temp: [16.5, 19, 23, 26.5, 27.5, 28, 28, 28, 27.5, 25.5, 21.5, 17.5],
    rain: [10, 20, 30, 60, 180, 400, 450, 400, 280, 150, 40, 15],
  },
  {
    id: "tanintharyi",
    en: "Tanintharyi coast (Dawei/Myeik)", my: "တနင်္သာရီကမ်းရိုးတန်း (ထားဝယ်/မြိတ်)",
    descEn: "Very wet southern coast; earliest monsoon onset, long rainy season.",
    descMy: "တောင်ပိုင်းကမ်းရိုးတန်း — မိုးဦးအစောဆုံး၊ မိုးရာသီရှည်။",
    temp: [25, 26.5, 28, 29, 28, 27, 26.5, 26.5, 27, 27.5, 27, 25.5],
    rain: [10, 10, 30, 120, 500, 900, 1100, 1000, 700, 350, 80, 20],
  },
];

const SEASONS = {
  en: [
    "Summer / hot season (Mar–May): hottest in central dry zone (Mandalay 40–43°C in April); pre-monsoon thunderstorms; first Bay of Bengal cyclone window (Apr–May).",
    "Southwest monsoon (approx mid-May–Sep): onset typically mid-May in the south, advancing north; peak rain Jun–Aug on western/southern coasts; withdrawal early–mid Oct.",
    "Winter / NE monsoon (Oct–Feb): cool and dry; coldest Dec–Jan (Shan plateau single digits °C at night, occasional frost above 1500m); second cyclone window (Oct–Nov).",
  ],
  my: [
    "နွေရာသီ (မတ်–မေ): အလယ်ပိုင်းမိုးနည်းရပ်ဝန်းတွင် အပူဆုံး (ဧပြီတွင် မန္တလေး ၄၀–၄၃°C)၊ မိုးဦးမုန်တိုင်းများ၊ ဆိုင်ကလုန်းရာသီပထမပိုင်း (ဧပြီ–မေ)။",
    "အနောက်တောင်မုတ်သုန်မိုး (~မေလယ်–စက်တင်ဘာ): တောင်ပိုင်းတွင် မေလယ်ခန့်စတင်၍ မြောက်သို့ရွေ့၊ ဇွန်–ဩဂုတ်တွင် အနောက်/တောင်ကမ်းရိုးတန်းများ မိုးအများဆုံး၊ အောက်တိုဘာအစောပိုင်းတွင် ဆုတ်။",
    "ဆောင်းရာသီ / အရှေ့မြောက်မုတ်သုန် (အောက်တိုဘာ–ဖေဖော်ဝါရီ): အေးမြခြောက်သွေ့၊ ဒီဇင်ဘာ–ဇန်နဝါရီတွင် အအေးဆုံး၊ ဆိုင်ကလုန်းရာသီဒုတိယပိုင်း (အောက်တိုဘာ–နိုဝင်ဘာ)။",
  ],
};

const NOTES = {
  en: [
    "Bay of Bengal cyclone seasons: Apr–May (pre-monsoon, often the strongest) and Oct–Nov (post-monsoon). Notable landfalls: Nargis (May 2008, Ayeyarwady delta), Giri (Oct 2010, Rakhine), Mocha (May 2023, Rakhine). Storm surge is the main killer in the low-lying delta.",
    "El Niño: typically weaker southwest monsoon, hotter summer, drought risk in the central dry zone (e.g. record heat 2016). La Niña: wetter monsoon, elevated flood/landslide risk, stronger late-season cyclones possible.",
    "Agricultural calendar: monsoon paddy transplanted Jun–Jul, harvested Nov–Dec; irrigated summer paddy Jan–Apr; dry-zone pulses/oilseeds (sesame, groundnut, pigeon pea) sown with early monsoon or grown on residual moisture in winter (Nov–Feb).",
    "Flood hotspots: Ayeyarwady/Chindwin river basins (Jul–Sep), Yangon urban flash floods, Rakhine/Tanintharyi coastal flooding during monsoon peaks and cyclone landfalls.",
    "Heat risk: central dry zone Apr–May heatwaves (heat index can exceed 45°C); advise midday rest, hydration for outdoor workers.",
  ],
  my: [
    "ဘင်္ဂလားပင်လယ်အော် ဆိုင်ကလုန်းရာသီ: ဧပြီ–မေ (မိုးဦးကြို၊ အပြင်းထန်ဆုံး) နှင့် အောက်တိုဘာ–နိုဝင်ဘာ (မိုးနှောင်းပိုင်း)။ ထင်ရှားသော ဝင်ရောက်မှုများ: နာဂစ် (မေ ၂၀၀၈၊ ဧရာဝတီမြစ်ဝကျွန်းပေါ်)၊ ဂီရိ (အောက်တိုဘာ ၂၀၁၀၊ ရခိုင်)၊ မိုခါ (မေ ၂၀၂၃၊ ရခိုင်)။ မြစ်ဝကျွန်းပေါ်အနိမ့်ပိုင်းတွင် မုန်တိုင်းဒီရေလျှံမှုက အဓိကအန္တရာယ်။",
    "အယ်လ်နီညို: အနောက်တောင်မုတ်သုန်အားနည်း၊ နွေပိုပူ၊ အလယ်ပိုင်းမိုးခေါင်နိုင်ခြေ (ဥပမာ ၂၀၁၆ အပူချိန်စံချိန်)။ လာနီညာ: မိုးပိုများ၊ ရေကြီး/မြေပြိုအန္တရာယ်မြင့်၊ ရာသီနှောင်းဆိုင်ကလုန်းများ အားကောင်းနိုင်။",
    "စိုက်ပျိုးရေးပြက္ခဒိန်: မိုးစပါးကို ဇွန်–ဇူလိုင်တွင် ရွှေ့စိုက်၊ နိုဝင်ဘာ–ဒီဇင်ဘာတွင် ရိတ်; ရေသွင်းနွေစပါး ဇန်နဝါရီ–ဧပြီ; မိုးနည်းရပ်ဝန်းပဲမျိုးစုံ/ဆီထွက်သီးနှံ (နှမ်း၊ မြေပဲ၊ ပဲစဉ်းငုံ) ကို မိုးဦးတွင်စိုက် သို့မဟုတ် ဆောင်းတွင် အစိုဓာတ်ကျန်ဖြင့် စိုက်။",
    "ရေကြီးတတ်သောဒေသများ: ဧရာဝတီ/ချင်းတွင်းမြစ်ဝှမ်း (ဇူလိုင်–စက်တင်ဘာ)၊ ရန်ကုန်မြို့တွင်းရေလျှံ၊ မုတ်သုန်အမြင့်ဆုံးကာလနှင့် ဆိုင်ကလုန်းဝင်ချိန်တွင် ရခိုင်/တနင်္သာရီကမ်းရိုးတန်း။",
    "အပူအန္တရာယ်: ဧပြီ–မေတွင် အလယ်ပိုင်းအပူလှိုင်း (heat index ၄၅°C ကျော်နိုင်)၊ အပြင်လုပ်သားများ နေ့လယ်နားရန်၊ ရေများများသောက်ရန် အကြံပြု။",
  ],
};

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_MY = ["ဇန်", "ဖေ", "မတ်", "ဧပြီ", "မေ", "ဇွန်", "ဇူလိုင်", "ဩဂုတ်", "စက်", "အောက်", "နို", "ဒီဇင်"];

/** Compact grounding block for AI prompts (both languages). */
function toPromptText() {
  const lines = [];
  lines.push("MYANMAR CLIMATE KNOWLEDGE (approximate climatological normals — long-term averages, not live data):");
  lines.push("");
  lines.push("Seasons:");
  SEASONS.en.forEach((s) => lines.push("- " + s));
  lines.push("");
  lines.push("Climate zones — monthly mean temperature (°C) and rainfall (mm), Jan..Dec:");
  for (const z of ZONES) {
    lines.push(`* ${z.en} / ${z.my}: ${z.descEn}`);
    lines.push(`  tempC: [${z.temp.join(", ")}]`);
    lines.push(`  rainMm: [${z.rain.join(", ")}]`);
  }
  lines.push("");
  lines.push("Key notes:");
  NOTES.en.forEach((n) => lines.push("- " + n));
  return lines.join("\n");
}

module.exports = { ZONES, SEASONS, NOTES, MONTHS_EN, MONTHS_MY, toPromptText };
