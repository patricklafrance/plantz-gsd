export type CatalogEntry = {
  name: string; // common name (unique key for upsert) -> CareProfile.name
  species: string; // scientific name -> CareProfile.species
  wateringInterval: number; // days -> CareProfile.wateringInterval
  lightRequirement: string; // "low" | "medium" | "bright" -> CareProfile.lightRequirement
  notes: string; // brief care note -> CareProfile.notes
  category: string; // UI grouping only, not stored in DB
};

export const CATALOG_CATEGORIES = [
  "Succulents & Cacti",
  "Tropical",
  "Low Light",
  "Herbs & Edibles",
  "Flowering",
] as const;

export const catalogData: CatalogEntry[] = [
  // --- Succulents & Cacti (8 entries) ---
  {
    name: "Aloe Vera",
    species: "Aloe barbadensis",
    wateringInterval: 21,
    lightRequirement: "bright",
    notes:
      "Let soil dry completely between waterings. Thrives in bright, indirect light.",
    category: "Succulents & Cacti",
  },
  {
    name: "Jade Plant",
    species: "Crassula ovata",
    wateringInterval: 14,
    lightRequirement: "bright",
    notes: "Water when top inch of soil is dry. Can tolerate some direct sun.",
    category: "Succulents & Cacti",
  },
  {
    name: "Snake Plant",
    species: "Dracaena trifasciata",
    wateringInterval: 14,
    lightRequirement: "low",
    notes: "Extremely forgiving. Tolerates low light and infrequent watering.",
    category: "Succulents & Cacti",
  },
  {
    name: "Echeveria",
    species: "Echeveria elegans",
    wateringInterval: 14,
    lightRequirement: "bright",
    notes:
      "Water sparingly. Needs bright light to maintain compact rosette shape.",
    category: "Succulents & Cacti",
  },
  {
    name: "Haworthia",
    species: "Haworthiopsis attenuata",
    wateringInterval: 14,
    lightRequirement: "medium",
    notes:
      "Small and compact. Prefers bright indirect light but tolerates medium.",
    category: "Succulents & Cacti",
  },
  {
    name: "Christmas Cactus",
    species: "Schlumbergera bridgesii",
    wateringInterval: 10,
    lightRequirement: "medium",
    notes:
      "Water when top inch is dry. Blooms in winter with shorter daylight.",
    category: "Succulents & Cacti",
  },
  {
    name: "String of Pearls",
    species: "Senecio rowleyanus",
    wateringInterval: 14,
    lightRequirement: "bright",
    notes:
      "Let soil dry between waterings. Trailing plant, great for shelves.",
    category: "Succulents & Cacti",
  },
  {
    name: "Burro's Tail",
    species: "Sedum morganianum",
    wateringInterval: 14,
    lightRequirement: "bright",
    notes:
      "Handle gently — leaves drop easily. Water when soil is completely dry.",
    category: "Succulents & Cacti",
  },

  // --- Tropical (10 entries) ---
  {
    name: "Pothos",
    species: "Epipremnum aureum",
    wateringInterval: 10,
    lightRequirement: "low",
    notes: "Very forgiving. Tolerates low light and irregular watering.",
    category: "Tropical",
  },
  {
    name: "Monstera",
    species: "Monstera deliciosa",
    wateringInterval: 10,
    lightRequirement: "medium",
    notes:
      "Water when top 2 inches are dry. Loves humidity and bright indirect light.",
    category: "Tropical",
  },
  {
    name: "Fiddle Leaf Fig",
    species: "Ficus lyrata",
    wateringInterval: 10,
    lightRequirement: "bright",
    notes:
      "Consistent watering schedule. Sensitive to drafts and temperature changes.",
    category: "Tropical",
  },
  {
    name: "Bird of Paradise",
    species: "Strelitzia reginae",
    wateringInterval: 10,
    lightRequirement: "bright",
    notes: "Needs bright light for best growth. Water when top inch is dry.",
    category: "Tropical",
  },
  {
    name: "Rubber Plant",
    species: "Ficus elastica",
    wateringInterval: 10,
    lightRequirement: "medium",
    notes: "Wipe leaves to keep them glossy. Water when top inch is dry.",
    category: "Tropical",
  },
  {
    name: "Philodendron",
    species: "Philodendron hederaceum",
    wateringInterval: 7,
    lightRequirement: "medium",
    notes: "Fast-growing trailing vine. Tolerates various light conditions.",
    category: "Tropical",
  },
  {
    name: "Calathea",
    species: "Calathea ornata",
    wateringInterval: 7,
    lightRequirement: "medium",
    notes: "Loves humidity. Use filtered water — sensitive to minerals.",
    category: "Tropical",
  },
  {
    name: "Alocasia",
    species: "Alocasia amazonica",
    wateringInterval: 7,
    lightRequirement: "medium",
    notes: "Keep soil consistently moist but not soggy. Loves humidity.",
    category: "Tropical",
  },
  {
    name: "Croton",
    species: "Codiaeum variegatum",
    wateringInterval: 7,
    lightRequirement: "bright",
    notes: "Needs bright light for vibrant colors. Keep soil moist.",
    category: "Tropical",
  },
  {
    name: "Dieffenbachia",
    species: "Dieffenbachia seguine",
    wateringInterval: 7,
    lightRequirement: "medium",
    notes:
      "Water when top inch is dry. Toxic if ingested — keep from pets.",
    category: "Tropical",
  },

  // --- Low Light (8 entries) ---
  {
    name: "ZZ Plant",
    species: "Zamioculcas zamiifolia",
    wateringInterval: 21,
    lightRequirement: "low",
    notes:
      "Thrives on neglect. Water every 2-3 weeks. Tolerates very low light.",
    category: "Low Light",
  },
  {
    name: "Cast Iron Plant",
    species: "Aspidistra elatior",
    wateringInterval: 14,
    lightRequirement: "low",
    notes:
      "Nearly indestructible. Tolerates low light, drought, and temperature swings.",
    category: "Low Light",
  },
  {
    name: "Peace Lily",
    species: "Spathiphyllum wallisii",
    wateringInterval: 7,
    lightRequirement: "low",
    notes:
      "Droops when thirsty — a built-in watering reminder. Blooms in low light.",
    category: "Low Light",
  },
  {
    name: "Chinese Evergreen",
    species: "Aglaonema commutatum",
    wateringInterval: 10,
    lightRequirement: "low",
    notes: "Adaptable to various light levels. Water when top inch is dry.",
    category: "Low Light",
  },
  {
    name: "Parlor Palm",
    species: "Chamaedorea elegans",
    wateringInterval: 10,
    lightRequirement: "low",
    notes:
      "Compact palm that thrives in indirect light. Keep soil lightly moist.",
    category: "Low Light",
  },
  {
    name: "Dracaena",
    species: "Dracaena marginata",
    wateringInterval: 14,
    lightRequirement: "low",
    notes:
      "Tolerates low light. Let soil dry between waterings. Sensitive to fluoride.",
    category: "Low Light",
  },
  {
    name: "Spider Plant",
    species: "Chlorophytum comosum",
    wateringInterval: 7,
    lightRequirement: "medium",
    notes:
      "Easy care. Produces baby plants on runners. Tolerates various conditions.",
    category: "Low Light",
  },
  {
    name: "Boston Fern",
    species: "Nephrolepis exaltata",
    wateringInterval: 5,
    lightRequirement: "medium",
    notes:
      "Loves humidity. Keep soil consistently moist. Mist regularly.",
    category: "Low Light",
  },

  // --- Herbs & Edibles (7 entries) ---
  {
    name: "Basil",
    species: "Ocimum basilicum",
    wateringInterval: 3,
    lightRequirement: "bright",
    notes:
      "Needs 6+ hours of light. Keep soil moist. Pinch flowers to extend harvest.",
    category: "Herbs & Edibles",
  },
  {
    name: "Mint",
    species: "Mentha spicata",
    wateringInterval: 3,
    lightRequirement: "medium",
    notes: "Vigorous grower. Keep soil moist. Grows well in partial shade.",
    category: "Herbs & Edibles",
  },
  {
    name: "Rosemary",
    species: "Salvia rosmarinus",
    wateringInterval: 10,
    lightRequirement: "bright",
    notes:
      "Prefers dry conditions. Water only when soil is dry. Needs bright light.",
    category: "Herbs & Edibles",
  },
  {
    name: "Thyme",
    species: "Thymus vulgaris",
    wateringInterval: 10,
    lightRequirement: "bright",
    notes: "Drought-tolerant herb. Let soil dry between waterings.",
    category: "Herbs & Edibles",
  },
  {
    name: "Chives",
    species: "Allium schoenoprasum",
    wateringInterval: 5,
    lightRequirement: "bright",
    notes: "Easy to grow. Keep soil moist. Harvest by cutting from the base.",
    category: "Herbs & Edibles",
  },
  {
    name: "Parsley",
    species: "Petroselinum crispum",
    wateringInterval: 5,
    lightRequirement: "medium",
    notes: "Keep soil consistently moist. Grows well in partial shade.",
    category: "Herbs & Edibles",
  },
  {
    name: "Cilantro",
    species: "Coriandrum sativum",
    wateringInterval: 3,
    lightRequirement: "medium",
    notes: "Bolts quickly in heat. Succession plant for continuous harvest.",
    category: "Herbs & Edibles",
  },

  // --- Flowering (7 entries) ---
  {
    name: "Orchid",
    species: "Phalaenopsis amabilis",
    wateringInterval: 10,
    lightRequirement: "medium",
    notes:
      "Water when roots turn silver-green. Soak and drain method works best.",
    category: "Flowering",
  },
  {
    name: "African Violet",
    species: "Streptocarpus ionanthus",
    wateringInterval: 5,
    lightRequirement: "medium",
    notes: "Water from below to avoid leaf spots. Blooms reliably indoors.",
    category: "Flowering",
  },
  {
    name: "Anthurium",
    species: "Anthurium andraeanum",
    wateringInterval: 7,
    lightRequirement: "medium",
    notes: "Bright indirect light for best blooms. Water when top inch is dry.",
    category: "Flowering",
  },
  {
    name: "Hibiscus",
    species: "Hibiscus rosa-sinensis",
    wateringInterval: 5,
    lightRequirement: "bright",
    notes: "Needs bright light and consistent moisture for blooming.",
    category: "Flowering",
  },
  {
    name: "Jasmine",
    species: "Jasminum polyanthum",
    wateringInterval: 5,
    lightRequirement: "bright",
    notes: "Fragrant blooms. Needs bright light and cool nights to set buds.",
    category: "Flowering",
  },
  {
    name: "Begonia",
    species: "Begonia semperflorens",
    wateringInterval: 5,
    lightRequirement: "medium",
    notes: "Water when top inch is dry. Avoid wetting leaves.",
    category: "Flowering",
  },
  {
    name: "Cyclamen",
    species: "Cyclamen persicum",
    wateringInterval: 7,
    lightRequirement: "medium",
    notes:
      "Water from below. Prefers cool temperatures. Goes dormant in summer.",
    category: "Flowering",
  },
];
