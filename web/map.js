(function () {
  "use strict";

  var COLORS = {
    sage: "#2C5F2D",
    sageDark: "#173D18",
    sageBright: "#3E8E41",
    accent: "#D2780A",
    ink: "#2A2A26",
  };

  var map = L.map("map", {
    worldCopyJump: true,
    minZoom: 2,
    maxZoom: 15,
    zoomControl: true,
  }).setView([20, 0], 2);

  L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Esri, DeLorme, HERE &mdash; World Light Gray Base",
      maxZoom: 16,
      className: "basemap-tiles",
    }
  ).addTo(map);
  L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 16, className: "basemap-tiles" }
  ).addTo(map);

  var countryLayer = null;
  var markerLayer = L.layerGroup().addTo(map);
  var backBtn = document.getElementById("back-to-world");
  var subtitleEl = document.getElementById("header-subtitle");
  var missingListEl = document.getElementById("missing-coords-list");

  // ---- Custom crop-themed point symbols ------------------------------
  // No pin/teardrop shape -- the glyph itself sits centered directly on
  // the coordinate, the way a point symbol on a real map does. Tested =
  // solid leaf. Future = outlined sprout. Exactly one symbol per status,
  // per Dr. Laza's ask -- not a separate icon per crop.
  function leafGlyph() {
    return (
      '<path d="M15 5c5.6 2 9 7.3 6.5 13.5C19.3 24 15 25.5 15 25.5c0-.001-4.3-1.5-6.5-7C6 12.3 9.4 7 15 5z" ' +
      'fill="' +
      COLORS.sage +
      '" stroke="#FFFFFF" stroke-width="1.5"/>' +
      '<path d="M15 8.2v14.3" stroke="#FFFFFF" stroke-width="1" stroke-linecap="round" opacity="0.8"/>'
    );
  }

  function sproutGlyph() {
    var stem = "M15 21.5V11";
    var left = "M15 16c-3.6-.8-5.3-3.9-5-6.9";
    var right = "M15 16c3.6-.8 5.3-3.9 5-6.9";
    return (
      '<g fill="none" stroke="#FFFFFF" stroke-width="3.4" stroke-linecap="round">' +
      '<path d="' +
      stem +
      '"/><path d="' +
      left +
      '"/><path d="' +
      right +
      '"/></g>' +
      '<circle cx="15" cy="22.7" r="2.7" fill="#FFFFFF"/>' +
      '<g fill="none" stroke="' +
      COLORS.accent +
      '" stroke-width="1.8" stroke-linecap="round">' +
      '<path d="' +
      stem +
      '"/><path d="' +
      left +
      '"/><path d="' +
      right +
      '"/></g>' +
      '<circle cx="15" cy="22.7" r="1.8" fill="' +
      COLORS.accent +
      '"/>'
    );
  }

  function svgMarker(status, isExact, showRing) {
    var isTested = status === "Tested";
    var glyph = isTested ? leafGlyph() : sproutGlyph();
    var ring = "";
    if (showRing !== false) {
      ring =
        '<circle cx="15" cy="15" r="12.5" fill="none" stroke="' +
        COLORS.ink +
        '" stroke-width="1.2" opacity="0.5"' +
        (isExact ? "" : ' stroke-dasharray="2.6,2.2"') +
        "/>";
    }
    return (
      '<svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">' +
      ring +
      glyph +
      "</svg>"
    );
  }

  function markerIcon(status, isExact) {
    return L.divIcon({
      html: svgMarker(status, isExact),
      className: "trial-marker",
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -14],
    });
  }

  function populateLegendIcons() {
    var testedSlot = document.getElementById("legend-icon-tested");
    var futureSlot = document.getElementById("legend-icon-future");
    if (testedSlot) testedSlot.innerHTML = svgMarker("Tested", false, false);
    if (futureSlot) futureSlot.innerHTML = svgMarker("Future", false, false);
  }

  function fieldOrFallback(list) {
    return list && list.length ? list.join(", ") : "Not yet assigned";
  }

  function coordSourceLabel(site) {
    if (!site.coord_source) return "Approximate &mdash; source not recorded";
    var label = site.is_exact ? "Exact" : "Approximate";
    return label + " &mdash; " + site.coord_source;
  }

  function popupHtml(site) {
    var statusClass = site.status === "Tested" ? "tested" : "future";
    var locationBits = [site.city, site.county ? site.county + " Co." : null, site.state]
      .filter(Boolean)
      .join(", ");
    return (
      '<div class="site-popup">' +
      '<span class="status-badge ' +
      statusClass +
      '">' +
      site.status +
      "</span>" +
      "<h3>" +
      site.name +
      "</h3>" +
      '<div class="popup-row"><span class="label">Location:</span>' +
      (locationBits || "Not specified") +
      "</div>" +
      '<div class="popup-row"><span class="label">Crops:</span>' +
      fieldOrFallback(site.crops) +
      "</div>" +
      '<div class="popup-row"><span class="label">Soil type:</span>' +
      (site.soil_type || "Not yet assigned") +
      "</div>" +
      '<div class="popup-row"><span class="label">Treatments:</span>' +
      fieldOrFallback(site.treatments) +
      "</div>" +
      (site.trial_year
        ? '<div class="popup-row"><span class="label">Trial year:</span>' +
          site.trial_year +
          "</div>"
        : "") +
      '<div class="coord-note">' +
      coordSourceLabel(site) +
      "</div>" +
      "</div>"
    );
  }

  function renderMissingList(sites) {
    missingListEl.innerHTML = "";
    sites.forEach(function (s) {
      var li = document.createElement("li");
      li.innerHTML =
        '<span class="mc-name">' +
        s.name +
        " (" +
        s.status +
        ")</span>" +
        '<span class="mc-meta">' +
        [s.state, s.country].filter(Boolean).join(", ") +
        "</span>" +
        '<span class="mc-meta">' +
        (s.notes || "No coordinates in workbook yet") +
        "</span>";
      missingListEl.appendChild(li);
    });
  }

  function showWorldView() {
    markerLayer.clearLayers();
    backBtn.classList.add("hidden");
    map.setView([20, 0], 2);
  }

  function showCountrySites(countryGeojsonName, sites, fallbackBounds) {
    markerLayer.clearLayers();
    var countrySites = sites.filter(function (s) {
      return s.country_geojson_name === countryGeojsonName;
    });
    var siteLatLngs = [];
    countrySites.forEach(function (site) {
      var marker = L.marker([site.lat, site.lon], {
        icon: markerIcon(site.status, site.is_exact),
      });
      marker.bindPopup(popupHtml(site));
      marker.addTo(markerLayer);
      siteLatLngs.push([site.lat, site.lon]);
    });
    backBtn.classList.remove("hidden");
    // Zoom to the sites themselves, not the country's full geometry --
    // a country's official bounds (e.g. US incl. Alaska/Hawaii) can be far
    // larger than where its trial sites actually are.
    if (siteLatLngs.length === 1) {
      map.setView(siteLatLngs[0], 8);
    } else if (siteLatLngs.length > 1) {
      map.fitBounds(L.latLngBounds(siteLatLngs), { padding: [60, 60], maxZoom: 8 });
    } else if (fallbackBounds) {
      map.fitBounds(fallbackBounds, { padding: [40, 40], maxZoom: 6 });
    }
  }

  function init(data) {
    var highlightedNames = {};
    data.sites.forEach(function (s) {
      if (s.country_geojson_name) highlightedNames[s.country_geojson_name] = true;
    });

    subtitleEl.textContent =
      data.counts.total +
      " sites tracked · " +
      data.counts.mappable +
      " mapped · " +
      data.counts.missing_coords +
      " pending coordinates · " +
      Object.keys(highlightedNames).length +
      " countr" +
      (Object.keys(highlightedNames).length === 1 ? "y" : "ies") +
      " highlighted (more coming)";

    renderMissingList(data.sites_missing_coords);
    populateLegendIcons();

    fetch("countries.geojson")
      .then(function (r) {
        return r.json();
      })
      .then(function (geo) {
        countryLayer = L.geoJSON(geo, {
          style: function (feature) {
            var isHighlighted = !!highlightedNames[feature.properties.name];
            feature.__highlighted = isHighlighted;
            return isHighlighted
              ? { className: "country-highlighted", weight: 2 }
              : { className: "country-neutral", weight: 0.6, interactive: false };
          },
          onEachFeature: function (feature, layer) {
            if (!highlightedNames[feature.properties.name]) return;
            layer.on("click", function () {
              showCountrySites(feature.properties.name, data.sites, layer.getBounds());
            });
            layer.on("mouseover", function () {
              layer.setStyle({ fillOpacity: 0.32 });
            });
            layer.on("mouseout", function () {
              layer.setStyle({ fillOpacity: 0.16 });
            });
          },
        }).addTo(map);
      });

    backBtn.addEventListener("click", showWorldView);
  }

  fetch("sites.json")
    .then(function (r) {
      if (!r.ok) throw new Error("sites.json HTTP " + r.status);
      return r.json();
    })
    .then(init)
    .catch(function (err) {
      subtitleEl.textContent =
        "Could not load sites.json (" +
        err.message +
        "). If you opened this file directly, serve web/ over http:// instead (e.g. `python -m http.server`).";
    });
})();
