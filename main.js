const DATA_URL = "df_arabica_viz_clean.csv";
const WORLD_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const flavorFields = ["Aroma", "Flavor", "Aftertaste", "Acidity", "Body", "Balance"];
const countryCoords = {
  "Taiwan": [
    121.0,
    23.7
  ],
  "Guatemala": [
    -90.3,
    15.6
  ],
  "Colombia": [
    -74.3,
    4.6
  ],
  "Honduras": [
    -86.2,
    15.2
  ],
  "Thailand": [
    101.0,
    15.9
  ],
  "Ethiopia": [
    39.5,
    9.1
  ],
  "Brazil": [
    -51.9,
    -14.2
  ],
  "Costa Rica": [
    -84.1,
    9.9
  ],
  "Nicaragua": [
    -85.2,
    12.9
  ],
  "El Salvador": [
    -88.9,
    13.8
  ],
  "Tanzania, United Republic Of": [
    35.0,
    -6.3
  ],
  "United States (Hawaii)": [
    -155.5,
    19.7
  ],
  "Mexico": [
    -102.5,
    23.6
  ],
  "Peru": [
    -75.0,
    -9.2
  ],
  "Vietnam": [
    108.3,
    14.1
  ],
  "Laos": [
    102.5,
    19.9
  ],
  "Uganda": [
    32.3,
    1.4
  ],
  "Indonesia": [
    113.9,
    -0.8
  ],
  "Kenya": [
    37.9,
    0.3
  ],
  "Panama": [
    -80.8,
    8.5
  ],
  "Madagascar": [
    46.9,
    -18.8
  ],
  "Myanmar": [
    96.0,
    21.9
  ]
};

const metricLabels = {
  avgScore: "Average Score",
  medianScore: "Median Score",
  maxScore: "Max Score",
  sampleCount: "Sample Count",
  veryGoodRate: "% Very Good"
};

const state = {
  selectedCountries: new Set(),
  brushedIds: new Set(),
  mapMetric: "avgScore",
  radarMode: "raw",
  hideSmallSamples: false,
  showDataIssues: true,
  altitudeMin: null,
  altitudeMax: null,
  scoreThreshold: 78,
  selectedMethods: new Set(),
  selectedYears: new Set(),
  selectedVariety: "All"
};

let rawData = [];
let worldData = null;
let mapZoomBehavior = null;
let lastBrushSelection = null;
let suppressBrushUpdate = false;

const tooltip = d3.select("#tooltip");
const formatScore = d3.format(".2f");
const formatOne = d3.format(".1f");
const formatInt = d3.format(",d");

const methodColor = d3.scaleOrdinal()
  .domain(["Washed / Wet Family", "Natural / Dry Family", "Honey / Pulped Natural Family", "Anaerobic / Experimental", "Wet Hulling", "Other", "Unknown"])
  .range(["#3b7ea1", "#b66a3c", "#b4975a", "#8e5ea2", "#5d9a6c", "#9a9a9a", "#c7b8aa"]);

const countryColor = d3.scaleOrdinal(d3.schemeTableau10);

Promise.all([
  d3.csv(DATA_URL, parseRow),
  d3.json(WORLD_URL)
]).then(([data, world]) => {
  rawData = data.filter(d => Number.isFinite(d.totalScore));
  worldData = world;
  initializeState();
  buildControls();
  updateAll();
}).catch(error => {
  console.error(error);
  d3.select("body").append("div")
    .attr("class", "load-error")
    .text("Failed to load data. If you opened index.html by double-clicking, run a local server such as: python -m http.server 8000");
});

function parseRow(d, i) {
  const num = v => {
    const n = +v;
    return Number.isFinite(n) ? n : NaN;
  };
  const bool = v => String(v).toLowerCase() === "true" || String(v) === "1";
  return {
    ...d,
    __id: d.ID || String(i),
    country: d.Country_clean || d["Country of Origin"] || "Unknown",
    region: d.Region_clean || d.Region || "Unknown",
    farm: d["Farm Name"] || "Unknown farm",
    producer: d.Producer || "",
    variety: d.Variety_clean || d.Variety || "Unknown",
    method: d.Processing_Method_group || d["Processing Method"] || "Unknown",
    year: d.Harvest_Year_display || d["Harvest Year"] || "Unknown",
    altitude: num(d.Altitude_final),
    altitudeRaw: d.Altitude_raw || "",
    altitudeLow: bool(d.Altitude_flag_low),
    altitudeHigh: bool(d.Altitude_flag_high),
    altitudeSuspectFeet: bool(d.Altitude_flag_suspect_feet),
    totalScore: num(d["Total Cup Points"]),
    quality: d.Quality_Grade || "",
    Aroma: num(d.Aroma),
    Flavor: num(d.Flavor),
    Aftertaste: num(d.Aftertaste),
    Acidity: num(d.Acidity),
    Body: num(d.Body),
    Balance: num(d.Balance),
    Overall: num(d.Overall)
  };
}

function initializeState() {
  const altExtent = d3.extent(rawData, d => d.altitude);
  state.altitudeMin = Math.floor(altExtent[0] / 50) * 50;
  state.altitudeMax = Math.ceil(altExtent[1] / 50) * 50;

  rawData.forEach(d => {
    if (d.method) state.selectedMethods.add(d.method);
    if (d.year) state.selectedYears.add(String(d.year));
  });
}

function buildControls() {
  const methods = Array.from(new Set(rawData.map(d => d.method))).sort();
  const years = Array.from(new Set(rawData.map(d => String(d.year)))).sort();
  const varieties = Array.from(new Set(rawData.map(d => d.variety))).sort();

  const methodWrap = d3.select("#methodFilters");
  methodWrap.selectAll("label")
    .data(methods)
    .join("label")
    .html(d => `<input type="checkbox" value="${escapeHtml(d)}" checked /> <span>${escapeHtml(d)}</span>`);
  methodWrap.selectAll("input").on("change", function() {
    state.selectedMethods = new Set(methodWrap.selectAll("input:checked").nodes().map(n => n.value));
    clearBrushOnly();
    updateAll();
  });

  const yearWrap = d3.select("#yearFilters");
  yearWrap.selectAll("label")
    .data(years)
    .join("label")
    .html(d => `<input type="checkbox" value="${escapeHtml(d)}" checked /> <span>${escapeHtml(d)}</span>`);
  yearWrap.selectAll("input").on("change", function() {
    state.selectedYears = new Set(yearWrap.selectAll("input:checked").nodes().map(n => n.value));
    clearBrushOnly();
    updateAll();
  });

  const varietySelect = d3.select("#varietyFilter");
  varietySelect.selectAll("option")
    .data(["All", ...varieties])
    .join("option")
    .attr("value", d => d)
    .text(d => d);
  varietySelect.on("change", function() {
    state.selectedVariety = this.value;
    clearBrushOnly();
    updateAll();
  });

  d3.select("#mapMetric").on("change", function() {
    state.mapMetric = this.value;
    updateAll();
  });

  const altMin = d3.select("#altitudeMin");
  const altMax = d3.select("#altitudeMax");
  [altMin, altMax].forEach(sel => sel
    .attr("min", state.altitudeMin)
    .attr("max", state.altitudeMax)
    .attr("step", 25)
  );
  altMin.property("value", state.altitudeMin);
  altMax.property("value", state.altitudeMax);
  altMin.on("input", function() {
    state.altitudeMin = Math.min(+this.value, state.altitudeMax - 25);
    this.value = state.altitudeMin;
    clearBrushOnly();
    updateAll();
  });
  altMax.on("input", function() {
    state.altitudeMax = Math.max(+this.value, state.altitudeMin + 25);
    this.value = state.altitudeMax;
    clearBrushOnly();
    updateAll();
  });

  d3.select("#scoreThreshold").on("input", function() {
    state.scoreThreshold = +this.value;
    clearBrushOnly();
    updateAll();
  });

  d3.select("#hideSmallSamples").on("change", function() {
    state.hideSmallSamples = this.checked;
    updateAll();
  });

  d3.select("#showDataIssues").on("change", function() {
    state.showDataIssues = this.checked;
    updateAll();
  });

  d3.select("#radarMode").on("change", function() {
    state.radarMode = this.value;
    updateRadar(getFilteredData());
  });

  d3.select("#clearCountries").on("click", () => {
    state.selectedCountries.clear();
    updateAll();
  });

  d3.select("#resetAll").on("click", resetAll);
  d3.select("#clearBrush").on("click", () => {
    clearBrushOnly();
    updateAll();
  });
  d3.select("#resetMapZoom").on("click", () => {
    const svg = d3.select("#mapSvg");
    if (mapZoomBehavior) svg.transition().duration(500).call(mapZoomBehavior.transform, d3.zoomIdentity);
  });
}

function resetAll() {
  state.selectedCountries.clear();
  state.brushedIds.clear();
  state.mapMetric = "avgScore";
  state.radarMode = "raw";
  state.hideSmallSamples = false;
  state.showDataIssues = true;
  state.scoreThreshold = 78;
  state.selectedVariety = "All";
  state.selectedMethods = new Set(rawData.map(d => d.method));
  state.selectedYears = new Set(rawData.map(d => String(d.year)));

  const altExtent = d3.extent(rawData, d => d.altitude);
  state.altitudeMin = Math.floor(altExtent[0] / 50) * 50;
  state.altitudeMax = Math.ceil(altExtent[1] / 50) * 50;

  d3.select("#mapMetric").property("value", state.mapMetric);
  d3.select("#radarMode").property("value", state.radarMode);
  d3.select("#hideSmallSamples").property("checked", false);
  d3.select("#showDataIssues").property("checked", true);
  d3.select("#scoreThreshold").property("value", state.scoreThreshold);
  d3.select("#varietyFilter").property("value", "All");
  d3.select("#altitudeMin").property("value", state.altitudeMin);
  d3.select("#altitudeMax").property("value", state.altitudeMax);
  d3.selectAll("#methodFilters input").property("checked", true);
  d3.selectAll("#yearFilters input").property("checked", true);
  updateAll();
}

function clearBrushOnly() {
  state.brushedIds.clear();
  lastBrushSelection = null;
}

function getFilteredData() {
  return rawData.filter(d => {
    if (!state.selectedMethods.has(d.method)) return false;
    if (!state.selectedYears.has(String(d.year))) return false;
    if (state.selectedVariety !== "All" && d.variety !== state.selectedVariety) return false;
    if (!Number.isFinite(d.altitude)) return false;
    if (d.altitude < state.altitudeMin || d.altitude > state.altitudeMax) return false;
    if (d.totalScore < state.scoreThreshold) return false;
    return true;
  });
}

function updateAll() {
  const data = getFilteredData();
  d3.select("#altitudeLabel").text(`${formatInt(state.altitudeMin)}–${formatInt(state.altitudeMax)} m`);
  d3.select("#scoreLabel").text(`≥ ${formatOne(state.scoreThreshold)}`);
  d3.select("#selectedCountries").text(state.selectedCountries.size ? Array.from(state.selectedCountries).join(", ") : "None");

  updateMap(data);
  updateRadar(data);
  updateScatter(data);
}

function aggregateCountries(data) {
  const grouped = d3.rollups(
    data,
    values => {
      const methods = d3.rollups(values, v => v.length, d => d.method).sort((a,b) => d3.descending(a[1], b[1]));
      return {
        country: values[0].country,
        values,
        sampleCount: values.length,
        avgScore: d3.mean(values, d => d.totalScore),
        medianScore: d3.median(values, d => d.totalScore),
        maxScore: d3.max(values, d => d.totalScore),
        veryGoodRate: values.filter(d => d.totalScore >= 85).length / values.length,
        avgAltitude: d3.mean(values, d => d.altitude),
        mainMethod: methods.length ? methods[0][0] : "Unknown"
      };
    },
    d => d.country
  ).map(d => d[1]);

  grouped.forEach(d => {
    const coords = countryCoords[d.country];
    d.lon = coords ? coords[0] : null;
    d.lat = coords ? coords[1] : null;
  });
  return grouped.filter(d => d.lon !== null && d.lat !== null);
}

function updateMap(data) {
  const svg = d3.select("#mapSvg");
  const width = 980, height = 470;
  svg.selectAll("*").remove();

  const g = svg.append("g");
  const projection = d3.geoNaturalEarth1().fitSize([width, height], {type: "Sphere"});
  const path = d3.geoPath(projection);
  const countries = topojson.feature(worldData, worldData.objects.countries).features;

  g.append("path")
    .datum({type: "Sphere"})
    .attr("fill", "#f2eadf")
    .attr("stroke", "#ded3c5")
    .attr("d", path);

  g.selectAll(".map-country")
    .data(countries)
    .join("path")
    .attr("class", "map-country")
    .attr("d", path);

  const stats = aggregateCountries(data)
    .filter(d => !state.hideSmallSamples || d.sampleCount >= 5);

  const metric = state.mapMetric;
  const values = stats.map(d => metric === "veryGoodRate" ? d[metric] * 100 : d[metric]).filter(Number.isFinite);
  const extent = values.length ? d3.extent(values) : [0, 1];
  const color = d3.scaleSequential(d3.interpolateYlOrBr).domain(extent[0] === extent[1] ? [extent[0] - 1, extent[1] + 1] : extent);
  const radius = d3.scaleSqrt()
    .domain([1, d3.max(stats, d => d.sampleCount) || 1])
    .range([5, 30]);

  const brushedCountries = new Set(
    data.filter(d => state.brushedIds.has(d.__id)).map(d => d.country)
  );

  g.selectAll(".origin-bubble")
    .data(stats, d => d.country)
    .join("circle")
    .attr("class", "origin-bubble")
    .attr("transform", d => `translate(${projection([d.lon, d.lat])})`)
    .attr("r", d => radius(d.sampleCount))
    .attr("fill", d => color(metric === "veryGoodRate" ? d[metric] * 100 : d[metric]))
    .attr("stroke", d => {
      if (state.selectedCountries.has(d.country)) return "#2a2118";
      if (brushedCountries.has(d.country)) return "#b61d1d";
      return "#fffdf8";
    })
    .attr("stroke-dasharray", d => d.sampleCount < 5 ? "4 2" : null)
    .attr("opacity", d => {
      if (state.selectedCountries.size && !state.selectedCountries.has(d.country)) return 0.42;
      return d.sampleCount < 5 ? 0.66 : 0.9;
    })
    .on("mouseenter", (event, d) => showTooltip(event, countryTooltip(d)))
    .on("mousemove", moveTooltip)
    .on("mouseleave", hideTooltip)
    .on("click", (event, d) => {
      if (state.selectedCountries.has(d.country)) state.selectedCountries.delete(d.country);
      else state.selectedCountries.add(d.country);
      updateAll();
    });

  g.selectAll(".country-label")
    .data(stats.filter(d => d.sampleCount >= 8 || state.selectedCountries.has(d.country)))
    .join("text")
    .attr("class", "country-label")
    .attr("x", d => projection([d.lon, d.lat])[0] + radius(d.sampleCount) + 4)
    .attr("y", d => projection([d.lon, d.lat])[1] + 3)
    .text(d => d.country.replace(", United Republic Of", ""));

  mapZoomBehavior = d3.zoom()
    .scaleExtent([1, 7])
    .on("zoom", event => g.attr("transform", event.transform));

  svg.call(mapZoomBehavior);

  updateMapLegend(values, metric, color, stats);
}

function updateMapLegend(values, metric, color, stats) {
  const label = metricLabels[metric];
  const min = d3.min(values) ?? 0, max = d3.max(values) ?? 1;
  const html = `
    <span class="legend-item"><span class="legend-swatch" style="background:${color(min)}"></span>Low ${label}</span>
    <span class="legend-item"><span class="legend-swatch" style="background:${color(max)}"></span>High ${label}</span>
    <span class="legend-item">Bubble size = sample count</span>
    <span class="legend-item">${stats.length} visible countries</span>
  `;
  d3.select("#mapLegend").html(html);
}

function countryTooltip(d) {
  const metric = state.mapMetric === "veryGoodRate"
    ? `${formatOne(d.veryGoodRate * 100)}%`
    : state.mapMetric === "sampleCount"
      ? formatInt(d.sampleCount)
      : formatScore(d[state.mapMetric]);

  return `
    <strong>${escapeHtml(d.country)}</strong><br/>
    Samples: ${formatInt(d.sampleCount)}<br/>
    Average score: ${formatScore(d.avgScore)}<br/>
    Median score: ${formatScore(d.medianScore)}<br/>
    Max score: ${formatScore(d.maxScore)}<br/>
    Very good ≥85: ${formatOne(d.veryGoodRate * 100)}%<br/>
    Average altitude: ${Number.isFinite(d.avgAltitude) ? formatInt(d.avgAltitude) + " m" : "N/A"}<br/>
    Main method: ${escapeHtml(d.mainMethod)}<br/>
    Current metric: ${metric}
  `;
}

function updateRadar(data) {
  const svg = d3.select("#radarSvg");
  const width = 980, height = 520;
  svg.selectAll("*").remove();

  const cx = 645, cy = 248, radius = 142;
  const angleStep = (Math.PI * 2) / flavorFields.length;
  const color = countryColor;

  const brushedData = state.brushedIds.size ? data.filter(d => state.brushedIds.has(d.__id)) : [];
  const sourceData = brushedData.length ? brushedData : data;

  const globalAverage = Object.fromEntries(flavorFields.map(f => [f, d3.mean(data, d => d[f])]));
  const globalOverall = d3.mean(data, d => d.Overall);
  const countryStats = aggregateFlavorByCountry(sourceData);

  let shown = [];
  if (state.selectedCountries.size) {
    shown = countryStats.filter(d => state.selectedCountries.has(d.country));
  } else if (brushedData.length) {
    shown = countryStats.sort((a,b) => d3.descending(a.sampleCount, b.sampleCount)).slice(0, 5);
  } else {
    shown = aggregateCountries(data)
      .sort((a,b) => d3.descending(a.sampleCount, b.sampleCount))
      .slice(0, 5)
      .map(c => countryStats.find(d => d.country === c.country))
      .filter(Boolean);
  }
  shown = shown.slice(0, 5);

  const radarMode = state.radarMode;
  const rawMin = 6.5, rawMax = 9.0;
  const diffValues = [];
  shown.forEach(c => flavorFields.forEach(f => diffValues.push(c[f] - globalAverage[f])));
  const diffAbs = Math.max(0.2, d3.max(diffValues.map(Math.abs)) || 0.4);
  const diffDomain = [-Math.ceil(diffAbs * 10) / 10, Math.ceil(diffAbs * 10) / 10];

  const r = radarMode === "raw"
    ? d3.scaleLinear().domain([rawMin, rawMax]).range([0, radius])
    : d3.scaleLinear().domain(diffDomain).range([0, radius]);

  const overallBars = [
    {label: "Global average", value: globalOverall, color: "#777", dashed: true},
    ...shown.map(d => ({label: d.country, value: d.Overall, color: color(d.country), dashed: false}))
  ];
  const barArea = {x: 54, y: 122, width: 220, rowHeight: 30};
  const overallScale = d3.scaleLinear().domain([6.5, 9.0]).range([0, barArea.width]);

  const overallGroup = svg.append("g").attr("transform", `translate(${barArea.x}, ${barArea.y})`);
  overallGroup.append("text")
    .attr("x", 0)
    .attr("y", -52)
    .attr("fill", "#5f2e1d")
    .attr("font-size", 13)
    .attr("font-weight", 800)
    .text("Overall");

  overallGroup.append("text")
    .attr("x", 0)
    .attr("y", -32)
    .attr("fill", "#776d62")
    .attr("font-size", 11)
    .text("Independent summary score");

  overallGroup.selectAll(".overall-guide")
    .data([6.5, 7.0, 7.5, 8.0, 8.5, 9.0])
    .join("line")
    .attr("x1", d => overallScale(d))
    .attr("x2", d => overallScale(d))
    .attr("y1", -6)
    .attr("y2", overallBars.length * barArea.rowHeight - 6)
    .attr("stroke", "#efe4d4")
    .attr("stroke-width", 1);

  overallGroup.selectAll(".overall-tick")
    .data([6.5, 7.0, 7.5, 8.0, 8.5, 9.0])
    .join("text")
    .attr("class", "radar-ring-label")
    .attr("x", d => overallScale(d))
    .attr("y", -18)
    .attr("text-anchor", "middle")
    .text(d => d.toFixed(1));

  const overallItem = overallGroup.selectAll(".overall-row")
    .data(overallBars)
    .join("g")
    .attr("class", "overall-row")
    .attr("transform", (d, i) => `translate(0, ${24 + i * barArea.rowHeight})`);

  overallItem.append("text")
    .attr("x", 0)
    .attr("y", -8)
    .attr("fill", "#5f5348")
    .attr("font-size", 11)
    .attr("font-weight", 700)
    .text(d => d.label);

  overallItem.append("line")
    .attr("x1", 0)
    .attr("x2", d => overallScale(d.value))
    .attr("y1", 7)
    .attr("y2", 7)
    .attr("stroke", d => d.color)
    .attr("stroke-width", 7)
    .attr("stroke-linecap", "round")
    .attr("stroke-dasharray", d => d.dashed ? "6 4" : null);

  overallItem.append("circle")
    .attr("cx", d => overallScale(d.value))
    .attr("cy", 7)
    .attr("r", 4)
    .attr("fill", d => d.color)
    .attr("stroke", "#fffdf8")
    .attr("stroke-width", 1.5);

  overallItem.append("text")
    .attr("x", d => overallScale(d.value) + 10)
    .attr("y", 11)
    .attr("fill", "#5f5348")
    .attr("font-size", 11)
    .text(d => formatScore(d.value));

  const radialPoint = (field, value) => {
    const a = flavorFields.indexOf(field) * angleStep - Math.PI / 2;
    const rr = r(value);
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
  };

  const line = d3.line()
    .x(d => d[0])
    .y(d => d[1])
    .curve(d3.curveLinearClosed);

  const rings = radarMode === "raw" ? [6.5, 7.0, 7.5, 8.0, 8.5, 9.0] : d3.ticks(diffDomain[0], diffDomain[1], 5);
  svg.append("g")
    .selectAll(".radar-grid")
    .data(rings)
    .join("path")
    .attr("class", "radar-grid")
    .attr("d", value => line(flavorFields.map(f => radialPoint(f, value))));

  svg.append("g")
    .selectAll(".radar-ring-label")
    .data(rings)
    .join("text")
    .attr("class", "radar-ring-label")
    .attr("x", cx + 5)
    .attr("y", d => cy - r(d) - 2)
    .text(d => radarMode === "raw" ? d.toFixed(1) : (d > 0 ? "+" : "") + d.toFixed(1));

  const axes = svg.append("g");
  axes.selectAll(".radar-axis")
    .data(flavorFields)
    .join("line")
    .attr("class", "radar-axis")
    .attr("x1", cx)
    .attr("y1", cy)
    .attr("x2", f => radialPoint(f, radarMode === "raw" ? rawMax : diffDomain[1])[0])
    .attr("y2", f => radialPoint(f, radarMode === "raw" ? rawMax : diffDomain[1])[1]);

  axes.selectAll(".radar-axis-label")
    .data(flavorFields)
    .join("text")
    .attr("class", "radar-axis-label")
    .attr("x", f => {
      const a = flavorFields.indexOf(f) * angleStep - Math.PI / 2;
      return cx + Math.cos(a) * (radius + 34);
    })
    .attr("y", f => {
      const a = flavorFields.indexOf(f) * angleStep - Math.PI / 2;
      return cy + Math.sin(a) * (radius + 34);
    })
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .text(f => f);

  if (radarMode === "raw") {
    svg.append("path")
      .attr("class", "radar-average")
      .attr("d", line(flavorFields.map(f => radialPoint(f, globalAverage[f]))));
  } else {
    svg.append("path")
      .attr("class", "radar-average")
      .attr("d", line(flavorFields.map(f => radialPoint(f, 0))));
  }

  const countryGroup = svg.append("g");
  countryGroup.selectAll(".radar-country-area")
    .data(shown)
    .join("path")
    .attr("class", "radar-country-area")
    .attr("fill", d => color(d.country))
    .attr("stroke", d => color(d.country))
    .attr("d", d => {
      const points = flavorFields.map(f => {
        const value = radarMode === "raw" ? d[f] : d[f] - globalAverage[f];
        return radialPoint(f, value);
      });
      return line(points);
    });

  const nodeData = shown.flatMap(c => flavorFields.map(f => ({
    country: c.country,
    field: f,
    value: c[f],
    diff: c[f] - globalAverage[f],
    global: globalAverage[f],
    sampleCount: c.sampleCount
  })));

  countryGroup.selectAll(".radar-node")
    .data(nodeData)
    .join("circle")
    .attr("class", "radar-node")
    .attr("r", 4)
    .attr("fill", d => color(d.country))
    .attr("cx", d => radialPoint(d.field, radarMode === "raw" ? d.value : d.diff)[0])
    .attr("cy", d => radialPoint(d.field, radarMode === "raw" ? d.value : d.diff)[1])
    .on("mouseenter", (event, d) => showTooltip(event, radarTooltip(d)))
    .on("mousemove", moveTooltip)
    .on("mouseleave", hideTooltip);

  const legendData = [
    {name: "Global average", color: "#777", dashed: true},
    ...shown.map(d => ({name: d.country, color: color(d.country)}))
  ];
  const legendColumns = 3;
  const legendColumnWidth = 260;
  const legendRowHeight = 24;
  const legendRows = Math.ceil(legendData.length / legendColumns);
  const legendWidth = legendColumns * legendColumnWidth;
  const legendStartX = (width - legendWidth) / 2;
  const legendStartY = 456;
  const legend = svg.append("g").attr("transform", `translate(${legendStartX}, ${legendStartY})`);
  const legendItem = legend.selectAll("g")
    .data(legendData)
    .join("g")
    .attr("transform", (d, i) => `translate(${(i % legendColumns) * legendColumnWidth},${Math.floor(i / legendColumns) * legendRowHeight})`)
    .style("cursor", d => d.name === "Global average" ? "default" : "pointer")
    .on("click", (event, d) => {
      if (d.name === "Global average") return;
      if (state.selectedCountries.has(d.name)) state.selectedCountries.delete(d.name);
      else state.selectedCountries.add(d.name);
      updateAll();
    });

  legendItem.append("line")
    .attr("x1", 0)
    .attr("x2", 18)
    .attr("y1", 0)
    .attr("y2", 0)
    .attr("stroke", d => d.color)
    .attr("stroke-width", 3)
    .attr("stroke-dasharray", d => d.dashed ? "5 4" : null);

  legendItem.append("text")
    .attr("x", 24)
    .attr("y", 4)
    .attr("font-size", 11)
    .attr("fill", "#66594e")
    .text(d => d.name);

  const status = brushedData.length
    ? `Radar uses brushed subset: ${brushedData.length} samples. Scale: ${radarMode === "raw" ? "6.5–9.0, not zero-based" : "difference from current global average"}.`
    : `Radar compares selected or top countries. Scale: ${radarMode === "raw" ? "6.5–9.0, not zero-based" : "difference from current global average"}.`;
  d3.select("#radarStatus").text(status);
}

function aggregateFlavorByCountry(data) {
  return d3.rollups(data, values => {
    const result = {country: values[0].country, sampleCount: values.length};
    flavorFields.forEach(f => result[f] = d3.mean(values, d => d[f]));
    result.Overall = d3.mean(values, d => d.Overall);
    return result;
  }, d => d.country).map(d => d[1]);
}

function radarTooltip(d) {
  return `
    <strong>${escapeHtml(d.country)} · ${escapeHtml(d.field)}</strong><br/>
    Average: ${formatScore(d.value)}<br/>
    Global average: ${formatScore(d.global)}<br/>
    Difference: ${d.diff >= 0 ? "+" : ""}${formatScore(d.diff)}<br/>
    Samples: ${formatInt(d.sampleCount)}<br/>
    <span style="color:#ffe1b8">Radar scale is truncated to improve readability.</span>
  `;
}

function updateScatter(data) {
  const svg = d3.select("#scatterSvg");
  const width = 980, height = 460;
  const margin = {top: 22, right: 26, bottom: 58, left: 68};
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  svg.selectAll("*").remove();

  const plot = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const clean = data.filter(d => Number.isFinite(d.altitude) && Number.isFinite(d.totalScore));
  if (!clean.length) {
    plot.append("text")
      .attr("x", innerW / 2)
      .attr("y", innerH / 2)
      .attr("text-anchor", "middle")
      .attr("fill", "#776d62")
      .text("No samples match the current filters.");
    d3.select("#scatterLegend").html("");
    return;
  }

  const x = d3.scaleLinear()
    .domain(d3.extent(clean, d => d.altitude)).nice()
    .range([0, innerW]);
  const y = d3.scaleLinear()
    .domain([Math.max(76, d3.min(clean, d => d.totalScore) - 0.5), Math.min(91, d3.max(clean, d => d.totalScore) + 0.5)]).nice()
    .range([innerH, 0]);

  const altitudeBands = [
    [0, 800, "below 800m"],
    [800, 1200, "800–1200m"],
    [1200, 1600, "1200–1600m"],
    [1600, 2000, "1600–2000m"],
    [2000, 2600, "above 2000m"]
  ];

  plot.selectAll(".alt-band")
    .data(altitudeBands)
    .join("rect")
    .attr("x", d => x(Math.max(d[0], x.domain()[0])))
    .attr("width", d => Math.max(0, x(Math.min(d[1], x.domain()[1])) - x(Math.max(d[0], x.domain()[0]))))
    .attr("y", 0)
    .attr("height", innerH)
    .attr("fill", (d, i) => i % 2 ? "#fbf4ea" : "#f4ebdf")
    .attr("opacity", 0.55);

  plot.append("g")
    .attr("class", "grid")
    .call(d3.axisLeft(y).ticks(6).tickSize(-innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  plot.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x).ticks(8));

  plot.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).ticks(6));

  plot.append("text")
    .attr("x", innerW / 2)
    .attr("y", innerH + 42)
    .attr("text-anchor", "middle")
    .attr("fill", "#66594e")
    .attr("font-size", 12)
    .text("Altitude_final (meters)");

  plot.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerH / 2)
    .attr("y", -45)
    .attr("text-anchor", "middle")
    .attr("fill", "#66594e")
    .attr("font-size", 12)
    .text("Total Cup Points");

  plot.selectAll(".band-label")
    .data(altitudeBands.filter(d => x(d[0]) >= -50 && x(d[0]) <= innerW))
    .join("text")
    .attr("x", d => x(Math.max(d[0], x.domain()[0])) + 8)
    .attr("y", 16)
    .attr("fill", "#9b8e80")
    .attr("font-size", 10)
    .text(d => d[2]);

  const selectedCountries = state.selectedCountries;
  const brushedActive = state.brushedIds.size > 0;

  plot.append("g")
    .selectAll(".scatter-point")
    .data(clean, d => d.__id)
    .join("circle")
    .attr("class", "scatter-point")
    .attr("cx", d => x(d.altitude))
    .attr("cy", d => y(d.totalScore))
    .attr("r", d => state.showDataIssues && hasAltitudeIssue(d) ? 5.2 : 4.3)
    .attr("fill", d => methodColor(d.method))
    .attr("stroke", d => {
      if (state.showDataIssues && hasAltitudeIssue(d)) return "#b61d1d";
      if (selectedCountries.has(d.country)) return "#2a2118";
      return "#fffdf8";
    })
    .attr("stroke-width", d => selectedCountries.has(d.country) ? 2.3 : state.showDataIssues && hasAltitudeIssue(d) ? 2 : 1)
    .attr("stroke-dasharray", d => state.showDataIssues && hasAltitudeIssue(d) ? "3 2" : null)
    .attr("opacity", d => {
      if (brushedActive && !state.brushedIds.has(d.__id)) return 0.12;
      if (selectedCountries.size && !selectedCountries.has(d.country)) return 0.22;
      return 0.82;
    })
    .on("mouseenter", (event, d) => showTooltip(event, sampleTooltip(d)))
    .on("mousemove", moveTooltip)
    .on("mouseleave", hideTooltip);

  const brush = d3.brush()
    .extent([[0, 0], [innerW, innerH]])
    .on("end", event => {
      if (suppressBrushUpdate) return;
      const selection = event.selection;
      if (!selection) {
        state.brushedIds.clear();
        lastBrushSelection = null;
        updateAll();
        return;
      }
      const [[x0, y0], [x1, y1]] = selection;
      const ids = clean
        .filter(d => {
          const px = x(d.altitude);
          const py = y(d.totalScore);
          return px >= x0 && px <= x1 && py >= y0 && py <= y1;
        })
        .map(d => d.__id);
      state.brushedIds = new Set(ids);
      lastBrushSelection = selection;
      updateAll();
    });

  const brushG = plot.append("g").attr("class", "brush").call(brush);
  if (lastBrushSelection) {
    suppressBrushUpdate = true;
    brushG.call(brush.move, lastBrushSelection);
    suppressBrushUpdate = false;
  }

  const methods = Array.from(new Set(clean.map(d => d.method))).sort();
  d3.select("#scatterLegend").html(methods.map(m => `
    <span class="legend-item"><span class="legend-swatch" style="background:${methodColor(m)}"></span>${escapeHtml(m)}</span>
  `).join("") + (state.brushedIds.size ? `<span class="legend-item"><strong>${state.brushedIds.size}</strong> brushed samples</span>` : ""));
}

function hasAltitudeIssue(d) {
  return d.altitudeLow || d.altitudeHigh || d.altitudeSuspectFeet;
}

function sampleTooltip(d) {
  const flavor = flavorFields.map(f => `${f}: ${formatScore(d[f])}`).join(" · ");
  const issue = hasAltitudeIssue(d)
    ? `<br/><span style="color:#ffb4a8">Altitude warning: ${d.altitudeLow ? "low " : ""}${d.altitudeHigh ? "high " : ""}${d.altitudeSuspectFeet ? "suspect feet " : ""}</span><br/>Original altitude: ${escapeHtml(d.altitudeRaw || "N/A")}`
    : "";
  return `
    <strong>${escapeHtml(d.farm)}</strong><br/>
    Country: ${escapeHtml(d.country)}<br/>
    Region: ${escapeHtml(d.region)}<br/>
    Variety: ${escapeHtml(d.variety)}<br/>
    Method: ${escapeHtml(d.method)}<br/>
    Altitude: ${formatInt(d.altitude)} m${issue}<br/>
    Total score: ${formatScore(d.totalScore)}<br/>
    Quality grade: ${escapeHtml(d.quality)}<br/>
    <span style="color:#ffe1b8">${flavor}</span>
  `;
}

function showTooltip(event, html) {
  tooltip.html(html)
    .style("opacity", 1)
    .attr("aria-hidden", "false");
  moveTooltip(event);
}

function moveTooltip(event) {
  const pad = 16;
  const node = tooltip.node();
  const rect = node.getBoundingClientRect();
  let x = event.clientX + 16;
  let y = event.clientY + 14;
  if (x + rect.width > window.innerWidth - pad) x = event.clientX - rect.width - 16;
  if (y + rect.height > window.innerHeight - pad) y = event.clientY - rect.height - 16;
  tooltip.style("left", x + "px").style("top", y + "px");
}

function hideTooltip() {
  tooltip.style("opacity", 0).attr("aria-hidden", "true");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
