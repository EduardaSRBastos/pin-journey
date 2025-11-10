// dynamic footer year
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("year").textContent = new Date().getFullYear();
});

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
