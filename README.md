# Trial Locations Map

Interactive map of crop trial sites for Dr. Laza's lab. It starts on a world view, zooms into
each country with trials, then into each site to show its crops, soil type and treatments.

## Folder layout

```
trial-locations-map/
  data/
    sites.xlsx      One row per trial site. The single source of truth: edit data here only.
  scripts/          Converts sites.xlsx into the JSON the map reads (next step)
  web/              The Leaflet map: index.html, map.js, style.css (next step)
  exports/          Screenshots of the map for PowerPoint slides
```

## Adding or updating a site

1. Open `data/sites.xlsx`, go to the **Sites** tab and add or edit a row.
2. Yellow cells are missing data.
3. Rebuild the map data (command added once the script exists).

## Data status (Sept 28, 2026)

- 12 site rows so far: 6 tested (TX x3, FL x2, KS x1), 6 future (IL x2, MI x2, CA x1, NC x1).
- Coordinates are city or county placeholders; exact field GPS still needed.
- Crops, soil type and treatments per site still needed.
- The two other countries have not been given yet.
