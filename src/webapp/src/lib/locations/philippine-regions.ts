type PhilippineHierarchy = {
  province?: string;
  region: string;
};

// Sourced from the repository's bundled PSA PSGC Q2 2026 hierarchy.
const PROVINCES_BY_REGION: Record<string, readonly string[]> = {
  "National Capital Region (NCR)": [],
  "Cordillera Administrative Region (CAR)": [
    "Abra", "Apayao", "Benguet", "Ifugao", "Kalinga", "Mountain Province",
  ],
  "Region I (Ilocos Region)": ["Ilocos Norte", "Ilocos Sur", "La Union", "Pangasinan"],
  "Region II (Cagayan Valley)": ["Batanes", "Cagayan", "Isabela", "Nueva Vizcaya", "Quirino"],
  "Region III (Central Luzon)": ["Aurora", "Bataan", "Bulacan", "Nueva Ecija", "Pampanga", "Tarlac", "Zambales"],
  "Region IV-A (CALABARZON)": ["Batangas", "Cavite", "Laguna", "Quezon", "Rizal"],
  "MIMAROPA Region": ["Marinduque", "Occidental Mindoro", "Oriental Mindoro", "Palawan", "Romblon"],
  "Region V (Bicol Region)": ["Albay", "Camarines Norte", "Camarines Sur", "Catanduanes", "Masbate", "Sorsogon"],
  "Region VI (Western Visayas)": ["Aklan", "Antique", "Capiz", "Guimaras", "Iloilo"],
  "Negros Island Region (NIR)": ["Negros Occidental", "Negros Oriental", "Siquijor"],
  "Region VII (Central Visayas)": ["Bohol", "Cebu"],
  "Region VIII (Eastern Visayas)": ["Biliran", "Eastern Samar", "Leyte", "Northern Samar", "Samar", "Southern Leyte"],
  "Region IX (Zamboanga Peninsula)": ["Sulu", "Zamboanga Sibugay", "Zamboanga del Norte", "Zamboanga del Sur"],
  "Region X (Northern Mindanao)": ["Bukidnon", "Camiguin", "Lanao del Norte", "Misamis Occidental", "Misamis Oriental"],
  "Region XI (Davao Region)": ["Davao de Oro", "Davao del Norte", "Davao del Sur", "Davao Occidental", "Davao Oriental"],
  "Region XII (SOCCSKSARGEN)": ["Cotabato", "Sarangani", "South Cotabato", "Sultan Kudarat"],
  "Region XIII (Caraga)": ["Agusan del Norte", "Agusan del Sur", "Dinagat Islands", "Surigao del Norte", "Surigao del Sur"],
  "Bangsamoro Autonomous Region In Muslim Mindanao (BARMM)": [
    "Basilan", "Lanao del Sur", "Maguindanao del Norte", "Maguindanao del Sur", "Tawi-Tawi",
  ],
};

const NCR_CITIES = new Set([
  "caloocan", "las pinas", "makati", "malabon", "mandaluyong", "manila", "marikina",
  "muntinlupa", "navotas", "paranaque", "pasay", "pasig", "pateros", "quezon city",
  "san juan", "taguig", "valenzuela",
]);

function normalize(value?: string) {
  return value
    ?.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^province of\s+|\s+province$/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const HIERARCHY_BY_NAME = new Map<string, PhilippineHierarchy>();

for (const [region, provinces] of Object.entries(PROVINCES_BY_REGION)) {
  HIERARCHY_BY_NAME.set(normalize(region) ?? "", { region });
  for (const province of provinces) {
    HIERARCHY_BY_NAME.set(normalize(province) ?? "", { province, region });
  }
}

for (const [alias, hierarchy] of Object.entries({
  "Metro Manila": { region: "National Capital Region (NCR)" },
  "Metropolitan Manila": { region: "National Capital Region (NCR)" },
  NCR: { region: "National Capital Region (NCR)" },
  CALABARZON: { region: "Region IV-A (CALABARZON)" },
  "Region IV-A": { region: "Region IV-A (CALABARZON)" },
  "Compostela Valley": { province: "Davao de Oro", region: "Region XI (Davao Region)" },
  "North Cotabato": { province: "Cotabato", region: "Region XII (SOCCSKSARGEN)" },
  Maguindanao: { region: "Bangsamoro Autonomous Region In Muslim Mindanao (BARMM)" },
})) {
  HIERARCHY_BY_NAME.set(normalize(alias) ?? "", hierarchy);
}

export function canonicalPhilippineHierarchy({
  city,
  province,
  region,
}: {
  city?: string;
  province?: string;
  region?: string;
}): PhilippineHierarchy | null {
  for (const candidate of [province, region]) {
    const hierarchy = HIERARCHY_BY_NAME.get(normalize(candidate) ?? "");
    if (hierarchy) return hierarchy;
  }

  return NCR_CITIES.has(normalize(city) ?? "")
    ? { region: "National Capital Region (NCR)" }
    : null;
}
