const supabase       = require('../supabaseClient');
const axios          = require('axios');
const NodeGeocoder   = require('node-geocoder');

// OpenStreetMap fallback
const fallbackGeocoder = NodeGeocoder({ provider: 'openstreetmap' });

/**
 * POST /geocode
 * Extracts location_name via Gemini (regex fallback),
 * then geocodes via Google Maps (OSM fallback),
 * caches result in Supabase.
 */
exports.geocode = async (req, res) => {
  try {
    const { description } = req.body;
    if (!description) {
      return res.status(400).json({ error: 'description is required' });
    }

    const cacheKey = `geocode_${description.replace(/[^a-zA-Z0-9]/g, '_')}`;
    // 1️⃣ Check cache
    const { data: cached } = await supabase
      .from('cache')
      .select('value, expires_at')
      .eq('key', cacheKey)
      .single();
    if (cached && new Date(cached.expires_at) > new Date()) {
      return res.json(cached.value);
    }

    // 2️⃣ Gemini extraction
    let location_name;
    try {
      const geminiResp = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          contents: [
            {
              parts: [
                {
                  text: `Extract the location name from this disaster description. Return only the location name: "${description}"`
                }
              ]
            }
          ]
        },
        { headers: { 'Content-Type': 'application/json' } }
      );
      location_name = geminiResp.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    } catch (geminiErr) {
      // fallback: “in <Place>”
      const m = description.match(/in\s+([A-Za-z ]+?)(?:\s+due|\s+because|$)/i);
      location_name = m ? m[1].trim() : description.split(/[.!]/)[0];
    }
    if (!location_name) {
      throw new Error('Could not determine location name');
    }

    // 3️⃣ Google Maps geocoding
    let lat, lng;
    try {
      const mapsRes = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          location_name
        )}&key=${process.env.GOOGLE_MAPS_API_KEY}`
      );
      const geo = mapsRes.data.results?.[0]?.geometry?.location;
      if (!geo) throw new Error();
      ({ lat, lng } = geo);
    } catch (err) {
      console.error('Google Maps geocoding error:', err.response?.data || err.message);
      // 4️⃣ OSM fallback
      const osmRes = await axios.get(
        'https://nominatim.openstreetmap.org/search',
        {
          params: { q: location_name, format: 'json', limit: 1 },
          headers: {
            'User-Agent': 'DisasterResponseApp/1.0 (contact@yourdomain.com)',
            // 'Referer': 'http://localhost:3000'
            'Referer': 'https://disaster-response-frontend.onrender.com/'
          }
        }
      );
      if (!osmRes.data.length) throw new Error('All geocoding failed');
      lat = parseFloat(osmRes.data[0].lat);
      lng = parseFloat(osmRes.data[0].lon);
    }

    const result = { location_name, lat, lng, original_description: description };
    // 5️⃣ Cache for 1h
    await supabase.from('cache').upsert({
      key: cacheKey,
      value: result,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
    });

    res.json(result);
  } catch (err) {
    console.error('Geocode error:', err);
    res.status(500).json({ error: err.message });
  }
};


// const supabase = require('../supabaseClient');
// const axios = require('axios');
// const { io } = require('../../index');

// // Cursor generated Gemini + Google Maps geocoding controller
// exports.geocode = async (req, res) => {
//   try {
//     const { description } = req.body;
    
//     if (!description) {
//       return res.status(400).json({ error: 'description is required' });
//     }
    
//     const cacheKey = `geocode_${description.replace(/[^a-zA-Z0-9]/g, '_')}`;
//     console.log("cacheKey", cacheKey);
    
//     // Check cache first (TTL: 1 hour)
//     // const { data: cached } = await supabase
//     //   .from('cache')
//     //   .select('*')
//     //   .eq('key', cacheKey)
//     //   .single();
    
//     // if (cached && new Date(cached.expires_at) > new Date()) {
//     //   console.log(`[LOG] Geocoding cache hit for: ${description}`);
//     //   return res.json(cached.value);
//     // }
    
//     // Step 1: Extract location name using Gemini API
//     const geminiApiKey = process.env.GEMINI_API_KEY;
//     console.log("gemini key", geminiApiKey)
//     let location_name = '';
    
//     try {
//       const geminiResponse = await axios.post(
//         `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiApiKey}`,
//         {
//           contents: [{
//             parts: [{
//               text: `Extract the location name from this disaster description. Return only the location name, nothing else: "${description}"`
//             }]
//           }]
//         },
//         {
//           headers: {
//             'Content-Type': 'application/json'
//           }
//         }
//       );
      
//       location_name = geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
//       console.log("location_name", location_name)
      
//     } catch (geminiError) {
//       console.log(`[WARNING] Gemini location extraction failed, using fallback: ${geminiError.message}`);
//       // Fallback: extract common location patterns
//       const locationMatch = description.match(/(Manhattan|NYC|New York|Brooklyn|Queens|Bronx|Staten Island|Lower East Side|Upper West Side|Chinatown|Midtown)/i);
//       location_name = locationMatch ? locationMatch[0] : 'Manhattan, NYC';
//     }
    
//     // Step 2: Geocode using Google Maps API
//     const mapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
//     let lat = null;
//     let lng = null;
    
//     try {
//       const geoResponse = await axios.get(
//         `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location_name)}&key=${mapsApiKey}`
//       );
      
//       if (geoResponse.data.results && geoResponse.data.results.length > 0) {
//         const coords = geoResponse.data.results[0].geometry.location;
//         lat = coords.lat;
//         lng = coords.lng;
//       }
      
//     } catch (mapsError) {
//       console.log(`[WARNING] Google Maps geocoding failed, using fallback coordinates: ${mapsError.message}`);
//       // Fallback coordinates for Manhattan
//       lat = 40.7128;
//       lng = -74.0060;
//     }
    
//     const result = {
//       location_name: location_name,
//       lat: lat,
//       lng: lng,
//       original_description: description,
//       timestamp: new Date().toISOString()
//     };
    
//     // Cache result for 1 hour
//     await supabase.from('cache').upsert({
//       key: cacheKey,
//       value: result,
//       expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
//     });
    
//     console.log(`[LOG] Location extracted and geocoded: ${location_name} -> ${lat},${lng}`);
//     res.json(result);
    
//   } catch (err) {
//     console.error(`[ERROR] Geocoding failed: ${err.message}`);
//     res.status(500).json({ error: err.message });
//   }
// };