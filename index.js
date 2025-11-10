// dynamic footer year
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("year").textContent = new Date().getFullYear();
});

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

// firebase login
const firebaseConfig = {
  apiKey: "AIzaSyCglchne9dKGL8CJjSuZ70UONIFEYKDz14",
  authDomain: "pin-journey.firebaseapp.com",
  projectId: "pin-journey",
  storageBucket: "pin-journey.firebasestorage.app",
  messagingSenderId: "663523734493",
  appId: "1:663523734493:web:ac314b331d64c3c9ff7c34",
  measurementId: "G-K4XVZSWHKN",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

let currentUserId;

const provider = new firebase.auth.GoogleAuthProvider();

auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUserId = user.uid;
    console.log("Signed in as:", user.email);
    document.getElementById("login").style.display = "none";
    document.getElementById("logout").style.display = "block";

    loadVisitedStates();
  } else {
    console.log("No user signed in");
    document.getElementById("login").style.display = "block";
    document.getElementById("logout").style.display = "none";
  }
});

document.getElementById("login").addEventListener("click", async () => {
  try {
    const result = await auth.signInWithPopup(provider);
    currentUserId = result.user.uid;

    loadVisitedStates();
  } catch (err) {
    console.error("Login error:", err);
  }
});

document.getElementById("logout").addEventListener("click", () => {
  auth.signOut().then(() => {
    currentUserId = null;
    console.log("Logged out");
    document.getElementById("login").style.display = "block";
    document.getElementById("logout").style.display = "none";
  });
});

// get visited states and update stats function
async function loadVisitedStates() {
  const localData = JSON.parse(localStorage.getItem("visitedStates") || "[]");
  const localTime = Number(
    localStorage.getItem("visitedStatesLastUpdated") || 0
  );

  let cloudData = [];
  let cloudTime = 0;

  if (currentUserId) {
    try {
      const doc = await db.collection("users").doc(currentUserId).get();
      if (doc.exists) {
        const data = doc.data();
        cloudData = Array.isArray(data.visitedStates) ? data.visitedStates : [];
        cloudTime = data.lastUpdated || 0;
      }
    } catch (err) {
      console.error("Firestore load error:", err);
    }
  }

  if (cloudTime > localTime) {
    coloredStates.clear();
    cloudData.forEach((s) => coloredStates.add(s));
    localStorage.setItem("visitedStates", JSON.stringify(cloudData));
    localStorage.setItem("visitedStatesLastUpdated", cloudTime);
    console.log("Loaded from Firestore (newer data)");
  } else {
    coloredStates.clear();
    localData.forEach((s) => coloredStates.add(s));
    console.log("Loaded from LocalStorage (newer data)");
    if (currentUserId && cloudTime < localTime) {
      await saveVisitedStates();
    }
  }

  coloredCount = coloredStates.size;
}

// save visited states function
async function saveVisitedStates() {
  const data = [...coloredStates];
  const timestamp = Date.now();

  localStorage.setItem("visitedStates", JSON.stringify(data));
  localStorage.setItem("visitedStatesLastUpdated", timestamp);

  if (currentUserId) {
    try {
      await db.collection("users").doc(currentUserId).set(
        {
          visitedStates: data,
          lastUpdated: timestamp,
        },
        { merge: true }
      );
      console.log("Saved to Firestore");
    } catch (err) {
      console.error("Firestore save error:", err);
    }
  }
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

// load and link continent, country, and state data, then initialize stats and map visuals
Promise.all([
  loadIsoToContinent(),
  fetch(
    "https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json"
  ).then((r) => r.json()),
  fetch("/assets/data/admin1.geojson").then((r) => r.json()),
]).then(([countryContinentMapLoaded, countries, adm1]) => {
  countryContinentMap = countryContinentMapLoaded;

  for (const [alias, canonical] of Object.entries(aliasMap)) {
    if (countryContinentMap[canonical]) {
      countryContinentMap[alias] = countryContinentMap[canonical];
    }
  }

  countriesData = countries;
  globalADM1Data = adm1;

  const uniqueSet = new Set();

  adm1.features.forEach((f) => {
    const country = f.properties.admin || f.properties.country || "Unknown";
    const stateName = f.properties.name || "Unknown";
    const uniqueKey = uniqueKeyForFeature(country, stateName);
    if (!uniqueSet.has(uniqueKey)) {
      uniqueSet.add(uniqueKey);

      const name = country.toLowerCase();
      const continent =
        countryContinentMap[name] ||
        countryContinentMap[name.replace("republic of", "").trim()] ||
        "Unknown";

      if (!countryStats[country])
        countryStats[country] = { total: 0, colored: 0 };
      if (!continentStats[continent])
        continentStats[continent] = { total: 0, colored: 0 };

      countryStats[country].total++;
      continentStats[continent].total++;
      totalStates++;
    }
  });

  loadVisitedStates().then(() => {
    recalculateStatsFromColoredStates();
    updateInfo();
    updateCountryMarkers();
    updateContinentMarkers();
  });
});

// renders visible states based on current map view and visited data
function renderStatesInView() {
  if (!globalADM1Data) return;

  const bounds = map.getBounds();

  const statesInView = globalADM1Data.features.filter((f) =>
    bounds.intersects(L.geoJSON(f).getBounds())
  );

  if (stateLayer) map.removeLayer(stateLayer);

  stateLayer = L.geoJSON(statesInView, {
    style: { color: "var(--main-color)", fillColor: "white", weight: 1 },
    onEachFeature: (feature, layer) => {
      const id = feature.properties.name;
      const country =
        feature.properties.admin || feature.properties.country || "Unknown";
      const name = country.toLowerCase();
      const continent =
        countryContinentMap[name] ||
        countryContinentMap[name.replace("republic of", "").trim()] ||
        "Unknown";

      const key = uniqueKeyForFeature(country, id);

      if (coloredStates.has(key)) {
        layer.setStyle({
          fillColor: continentData[continent].color || "blue",
        });

        if (!statePins[key]) {
          const center = turf.centroid(feature);
          const [lng, lat] = center.geometry.coordinates;
          const pin = L.marker([lat, lng], {
            icon: L.divIcon({
              className: "state-pin",
              html: "📍",
            }),
            interactive: false,
          }).addTo(map);
          statePins[key] = pin;
        }
      }

      layer.bindTooltip(id, {
        permanent: true,
        direction: "center",
        className: "state-label",
      });

      layer.on("click", () => {
        const stateName = feature.properties.name || "Unknown";
        const key = uniqueKeyForFeature(country, stateName);
        const isColored = coloredStates.has(key);

        if (!isColored) {
          const fillColor =
            (continentData[continent] && continentData[continent].color) ||
            "blue";
          layer.setStyle({ fillColor });
          coloredStates.add(key);
          coloredCount++;
          if (countryStats[country])
            countryStats[country].colored =
              (countryStats[country].colored || 0) + 1;
          if (continentStats[continent])
            continentStats[continent].colored =
              (continentStats[continent].colored || 0) + 1;

          const center = turf.centroid(feature);
          const [lng, lat] = center.geometry.coordinates;
          const pin = L.marker([lat, lng], {
            icon: L.divIcon({
              className: "state-pin",
              html: "📍",
            }),
            interactive: false,
          }).addTo(map);

          statePins[key] = pin;
        } else {
          layer.setStyle({ fillColor: "white" });
          coloredStates.delete(key);
          coloredCount = Math.max(0, coloredCount - 1);
          if (countryStats[country])
            countryStats[country].colored = Math.max(
              0,
              countryStats[country].colored - 1
            );
          if (continentStats[continent])
            continentStats[continent].colored = Math.max(
              0,
              continentStats[continent].colored - 1
            );

          if (statePins[key]) {
            map.removeLayer(statePins[key]);
            delete statePins[key];
          }
        }

        saveVisitedStates();
        recalculateStatsFromColoredStates();
        updateInfo();
        updateCountryMarkers();
        updateContinentMarkers();
      });
    },
  }).addTo(map);

  Object.entries(statePins).forEach(([key, pin]) => {
    const pos = pin.getLatLng();
    if (bounds.contains(pos)) {
      if (!map.hasLayer(pin)) map.addLayer(pin);
    } else if (map.hasLayer(pin)) {
      map.removeLayer(pin);
    }
  });
}

// refresh states and pins dynamically when moving
let moveTimeout;
map.on("moveend", () => {
  if (map.getZoom() >= 6) {
    clearTimeout(moveTimeout);
    moveTimeout = setTimeout(() => renderStatesInView(), 200);
  }
});

// handle zoom transitions between country and state views
map.on("zoomend", () => {
  const zoom = map.getZoom();
  updateContinentMarkers();
  updateCountryMarkers();

  if (zoom >= 6) {
    if (countryLayer) {
      map.removeLayer(countryLayer);
      countryLayer = null;
    }

    if (zoom >= 10) {
      if (!map.hasLayer(baseMap)) map.addLayer(baseMap);
      if (map.hasLayer(baseMapNoLabels)) map.removeLayer(baseMapNoLabels);
    } else {
      if (!map.hasLayer(baseMapNoLabels)) map.addLayer(baseMapNoLabels);
      if (map.hasLayer(baseMap)) map.removeLayer(baseMap);
    }

    renderStatesInView();
  } else {
    if (stateLayer) {
      map.removeLayer(stateLayer);
      stateLayer = null;
    }

    recalculateStatsFromColoredStates();
    updateCountryMarkers();
    updateContinentMarkers();

    Object.values(statePins).forEach((pin) => {
      if (map.hasLayer(pin)) map.removeLayer(pin);
    });

    if (!map.hasLayer(baseMap)) map.addLayer(baseMap);
    if (map.hasLayer(baseMapNoLabels)) map.removeLayer(baseMapNoLabels);

    if (!countriesData) return;

    if (countryLayer) map.removeLayer(countryLayer);

    if (map.getZoom() >= 3) {
      countryLayer = L.geoJSON(countriesData, {
        style: (feature) => {
          const countryName = feature.properties.name;
          const stat = countryStats[countryName] || { total: 0, colored: 0 };
          const continent =
            countryContinentMap[countryName.toLowerCase()] ||
            countryContinentMap[
              countryName.toLowerCase().replace("republic of", "").trim()
            ] ||
            "Unknown";

          let fillColor = "white";
          let fillOpacity = 0;
          if (stat && stat.total > 0) {
            const perc = stat.colored / stat.total;
            if (perc > 0) {
              fillColor =
                (continentData[continent] && continentData[continent].color) ||
                "blue";
              fillOpacity = perc >= 1 ? 1 : Math.max(0.2, perc);
            }
          }

          return {
            color: "var(--main-color)",
            fillColor,
            weight: 1,
            fillOpacity,
          };
        },
      }).addTo(map);
    }
  }
});
