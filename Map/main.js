mapboxgl.accessToken = MAPBOX_TOKEN;

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/light-v11', 
    center: [0, 40], // starting position [lng, lat]
    zoom: 2.5         
});

map.on('load', () => {

    // Add the countries layer
    map.addLayer({
        id: 'countries',
        type: 'fill',
        source: {
            type: 'vector',
            url: 'mapbox://mapbox.country-boundaries-v1'
        },
        'source-layer': 'country_boundaries',
        paint: {
            'fill-color': '#d3d3d3',  // default gray fill
            'fill-opacity': 0.3
        }
    });

    // Add a border layer for countries
    map.addLayer({
        id: 'countries-border',
        type: 'line',
        source: {
            type: 'vector',
            url: 'mapbox://mapbox.country-boundaries-v1'
        },
        'source-layer': 'country_boundaries',
        paint: {
            'line-color': '#888888',
            'line-width': 0.5
        }
    });

    // Hover effect — highlight country
    map.on('mousemove', 'countries', (e) => {
        map.setPaintProperty('countries', 'fill-color', [
            'case',
            ['==', ['get', 'iso_3166_1'], e.features[0].properties.iso_3166_1],
            '#aaaaaa',  // hovered country color
            '#d3d3d3'   // default color
        ]);
        map.getCanvas().style.cursor = 'pointer';
    });

    // Reset when mouse leaves
    map.on('mouseleave', 'countries', () => {
        map.setPaintProperty('countries', 'fill-color', '#d3d3d3');
        map.getCanvas().style.cursor = '';
    });

    // Click on a country
    map.on('click', 'countries', (e) => {
        const country = e.features[0].properties;
        console.log(country); // see what data is available
        openPanel(country);
    });

});

function openPanel(country) {
    document.getElementById('country-name').innerText = country.name_en;
    document.getElementById('panel').classList.remove('hidden');
    // later: draw your chart here based on country
}

function closePanel() {
    document.getElementById('panel').classList.add('hidden');
}