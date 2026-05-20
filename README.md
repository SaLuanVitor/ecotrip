# EcoTrip

**Viaje de forma mais sustentável**

EcoTrip calculates the carbon footprint of a trip between two locations and suggests more sustainable transportation options.

## Features

- Carbon footprint calculation for 7 transportation modes
- Interactive map with route visualization (Leaflet + OpenStreetMap)
- Double-click point selection on the map
- Clear points button to reset selections
- Mode-specific routing (walking, cycling, driving routes on map)
- Geocoding via Nominatim
- Routing via OSRM public API
- Emissions comparison across all modes with per-mode distance handling
- Carbon credits and offset cost estimation
- Trees required calculation
- Recommendation engine for sustainable choices
- PDF export via html2pdf.js
- Result card tooltips with contextual information
- Transport mode help text with contextual descriptions
- Responsive design (desktop, tablet, mobile)

## Transportation Modes

| Mode       | Emission Factor (kg CO₂e/km) |
|------------|------------------------------|
| Walking    | 0                            |
| Bicycle    | 0                            |
| Motorcycle | 0.103                        |
| Car        | 0.192                        |
| Bus        | 0.105                        |
| Truck      | 0.800                        |
| Airplane   | 0.255                        |

## Technologies

- HTML5
- CSS3 (Flexbox, Grid, Custom Properties)
- Vanilla JavaScript
- [Leaflet](https://leafletjs.com/) — interactive maps
- [OpenStreetMap](https://www.openstreetmap.org/) — map tiles
- [Nominatim](https://nominatim.org/) — geocoding
- [OSRM](https://project-osrm.org/) — route calculation
- [html2pdf.js](https://ekoopmans.github.io/html2pdf.js/) — PDF export

## Setup

No API keys required. Works immediately after cloning.

```bash
git clone https://github.com/SaLuanVitor/ecotrip.git
cd ecotrip
```

Serve with any static HTTP server:

```bash
# Python
python -m http.server 8000

# Node
npx serve .

# Or just open index.html directly (some features may require a server)
```

Open `http://localhost:8000` in your browser.

## Disclaimer

This project uses free public services. No API keys are required.

These services are suitable for educational projects and portfolio demonstrations.
For production or high-volume usage, self-hosted or commercial alternatives are recommended.

Please respect each service's usage policy:
- **Nominatim**: max 1 request/second, provide a contact email
- **OSRM**: rate-limited, no SLA
- **OpenStreetMap tiles**: usage subject to tile usage policy

## Deploy no GitHub Pages

1. Push the repository to GitHub:

   ```bash
   git clone https://github.com/SaLuanVitor/ecotrip.git
   ```

2. Push the code to the main branch:

   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

3. Open the repository Settings:
   https://github.com/SaLuanVitor/ecotrip/settings/pages

4. In the Pages section, set Source to: **GitHub Actions**

5. Save the configuration.

6. Every push to the main branch will automatically deploy the site.

7. The application will be available at:
   https://SaLuanVitor.github.io/ecotrip/

## Project Structure

```
ecotrip/
├── index.html
├── README.md
├── css/
│   └── style.css
├── js/
│   ├── config.js
│   ├── app.js
│   ├── map.js
│   ├── emissions.js
│   ├── comparison.js
│   └── utils.js
├── assets/
│   ├── logo.svg
│   └── icons/
└── screenshots/
```

## License

MIT
