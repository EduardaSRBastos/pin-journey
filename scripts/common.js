// map zoom and size values
const map = L.map("map", {
  minZoom: 2.1,
  maxZoom: 15,
  zoomControl: true,
}).setView([20, 0], 2);

map.setMaxBounds([
  [-90, -180],
  [90, 180],
]);

map.options.maxBoundsViscosity = 1.0;

// maps images layout
const baseMap = L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  {
    attribution: "&copy; OSM",
    subdomains: "abcd",
    maxZoom: 15,
    noWrap: true,
    bounds: [
      [-90, -180],
      [90, 180],
    ],
  }
).addTo(map);

const baseMapNoLabels = L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png",
  {
    attribution: "&copy; OSM",
    subdomains: "abcd",
    maxZoom: 11,
    noWrap: true,
    bounds: [
      [-90, -180],
      [90, 180],
    ],
  }
);

// global variables
let coloredCount = 0;
let totalStates = 0;
let stateLayer = null;
let globalADM1Data = null;
let countriesData = null;
let countryLayer = null;
let countryContinentMap = {};
let continentMarkers = [];
let countryMarkers = [];

const coloredStates = new Set();
const statePins = {};
const countryStats = {};
const continentStats = {};

// continents info
const continentData = {
  Africa: { name: "Africa", lat: 3, lng: 23, color: "#e69552ff" },
  Europe: { name: "Europe", lat: 52, lng: 5, color: "#61a1f4ff" },
  Asia: { name: "Asia", lat: 36, lng: 66, color: "#3ac445ff" },
  "North America": {
    name: "North America",
    lat: 41,
    lng: -101,
    color: "#b13333ff",
  },
  "South America": {
    name: "South America",
    lat: -23,
    lng: -65,
    color: "#f4f261ff",
  },
  Oceania: { name: "Oceania", lat: -31, lng: 132, color: "#61f4e8ff" },
  Antarctica: { name: "Antarctica", lat: -75, lng: 0, color: "#6170f4ff" },
};

// countries name mapping
const aliasMap = {
  "united states of america": "united states",
  taiwan: "china",
  "french southern and antarctic lands": "french southern territories",
  "the bahamas": "bahamas",
  "democratic republic of the congo": "the democratic republic of congo",
  "republic of the congo": "congo",
  "northern cyprus": "cyprus",
  fiji: "fiji islands",
  "guinea bissau": "guinea-bissau",
  kosovo: "serbia",
  macedonia: "north macedonia",
  somaliland: "somalia",
  swaziland: "eswatini",
  "united republic of tanzania": "tanzania",
  "west bank": "palestine",
};

// world percentage function
function updateInfo() {
  const percentage = totalStates
    ? ((coloredCount / totalStates) * 100).toFixed(1)
    : 0;
  document.getElementById("info").innerText = `World: ${percentage}%`;
}

// create a key with country and state names function
function uniqueKeyForFeature(countryName, stateName) {
  return `${countryName}::${stateName}`.toLowerCase();
}

// continents label function
function updateContinentMarkers() {
  continentMarkers.forEach((m) => map.removeLayer(m));
  continentMarkers = [];

  if (map.getZoom() === 2.1) {
    Object.values(continentData).forEach((c) => {
      const stat = continentStats[c.name] || { total: 0, colored: 0 };
      const perc = stat.total
        ? ((stat.colored / stat.total) * 100).toFixed(1)
        : 0;

      const marker = L.marker([c.lat, c.lng], {
        icon: L.divIcon({
          className: "continent-label",
          html: `<div style="font-family:'Elms Sans',sans-serif;padding:3px 6px;font-weight:bold;color:gray;font-size:16px;">${perc}%</div>`,
        }),
        interactive: false,
      }).addTo(map);

      continentMarkers.push(marker);
    });
  }
}

// countries label function
function updateCountryMarkers() {
  countryMarkers.forEach((m) => map.removeLayer(m));
  countryMarkers = [];

  if (!countriesData || (map.getZoom() !== 4 && map.getZoom() !== 5)) return;

  countriesData.features.forEach((f) => {
    let point = turf.pointOnSurface(f);

    const id = f.properties.name;
    const bbox = turf.bbox(f);
    const visualCenter = [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
    const blended = turf.midpoint(point, turf.point(visualCenter));
    const latlng = [
      blended.geometry.coordinates[1],
      blended.geometry.coordinates[0],
    ];
    const stat = countryStats[id] || { total: 0, colored: 0 };
    const perc = stat.total
      ? ((stat.colored / stat.total) * 100).toFixed(0)
      : 0;
    const marker = L.marker(latlng, {
      icon: L.divIcon({
        className: "country-label",
        html: `<div style="
          font-family:'Elms Sans',sans-serif;
          font-weight:bold;
          font-size:14px;
          text-align:center;
          white-space:nowrap;
          background:none;
          transform: translate(-50%, -50%);
        ">${id}<br>${perc}%</div>`,
      }),
      interactive: false,
    }).addTo(map);

    countryMarkers.push(marker);
  });
}

// mapping list of countries and their continents function
async function loadIsoToContinent() {
  const res = await fetch(
    "https://raw.githubusercontent.com/samayo/country-json/master/src/country-by-continent.json"
  );
  const data = await res.json();
  const map = {};
  data.forEach((c) => {
    if (c.country && c.continent) {
      map[c.country.toLowerCase()] = c.continent;
    }
  });
  return map;
}

// calculate visited states stats function
function recalculateStatsFromColoredStates() {
  for (const country in countryStats) {
    countryStats[country].colored = 0;
  }
  for (const continent in continentStats) {
    continentStats[continent].colored = 0;
  }

  coloredStates.forEach((key) => {
    const [country, state] = key.split("::");
    const name = country.toLowerCase();
    const continent =
      countryContinentMap[name] ||
      countryContinentMap[name.replace("republic of", "").trim()] ||
      "Unknown";

    const countryKey = Object.keys(countryStats).find(
      (k) => k.toLowerCase() === country
    );

    if (countryKey) {
      countryStats[countryKey].colored =
        (countryStats[countryKey].colored || 0) + 1;
    }

    if (continentStats[continent])
      continentStats[continent].colored =
        (continentStats[continent].colored || 0) + 1;
  });
}
