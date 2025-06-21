// backend/src/controllers/disastersController.js

const supabase = require('../supabaseClient');
const axios    = require('axios');

/**
 * Extracts a location name via Gemini (with regex fallback),
 * then geocodes via Google Maps (with Nominatim fallback),
 * caching the result in Supabase.
 */
async function extractAndGeocode(description) {
  const cacheKey = `geocode_${description.replace(/[^a-zA-Z0-9]/g, '_')}`;

  // 1️⃣ Check cache
  const { data: cached } = await supabase
    .from('cache')
    .select('value, expires_at')
    .eq('key', cacheKey)
    .single();
  if (cached && new Date(cached.expires_at) > new Date()) {
    return cached.value;
  }

  // 2️⃣ Gemini extraction
  let location_name;
  try {
    const geminiResp = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{
            text: `Extract the location name from this disaster description. Return ONLY the location name: "${description}"`
          }]
        }]
      },
      { headers: { 'Content-Type': 'application/json' } }
    );
    location_name = geminiResp.data
      ?.candidates?.[0]?.content?.parts?.[0]?.text
      ?.trim();
  } catch (_) {
    // Dynamic regex fallback: look for “in <Place>”
    const m = description.match(/in\s+([A-Za-z ]+?)(?:\s+due|\s+because|[.!]|$)/i);
    location_name = m
      ? m[1].trim()
      : description.split(/[.!]/)[0].trim();
  }

  if (!location_name) {
    throw new Error('Could not determine a location name');
  }

  // 3️⃣ Google Maps geocoding
  let lat, lng;
  try {
    const mapsRes = await axios.get(
      `https://maps.googleapis.com/maps/api/geocode/json`,
      { params: { address: location_name, key: process.env.GOOGLE_MAPS_API_KEY } }
    );
    const geo = mapsRes.data.results?.[0]?.geometry?.location;
    if (!geo) throw new Error();
    ({ lat, lng } = geo);
  } catch (_) {
    // 4️⃣ Fallback to OpenStreetMap Nominatim with proper headers
    const osmRes = await axios.get(
      'https://nominatim.openstreetmap.org/search',
      {
        params: { q: location_name, format: 'json', limit: 1 },
        headers: {
          'User-Agent': 'DisasterResponseApp/1.0 (contact@yourdomain.com)',
          // 'Referer':    'http://localhost:3000',
          'Referer': 'https://disaster-response-frontend.onrender.com/'
        }
      }
    );
    if (!osmRes.data.length) {
      throw new Error('All geocoding attempts failed');
    }
    lat = parseFloat(osmRes.data[0].lat);
    lng = parseFloat(osmRes.data[0].lon);
  }

  const result = { location_name, lat, lng };

  // 5️⃣ Cache for 1 hour
  await supabase.from('cache').upsert({
    key: cacheKey,
    value: result,
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
  });

  return result;
}

exports.createDisaster = async (req, res) => {
  try {
    const { title, description, tags } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }

    // Extract & geocode
    let geo;
    try {
      geo = await extractAndGeocode(description);
    } catch (err) {
      return res.status(400).json({ error: `Location extraction failed: ${err.message}` });
    }
    const { location_name, lat, lng } = geo;
    const point = { type: 'Point', coordinates: [lng, lat] };

    // Build audit trail & insert
    const owner_id    = req.user.id;
    const audit_trail = [{ action: 'create', user_id: owner_id, timestamp: new Date().toISOString() }];

    const dataTesting = {
        title,
        description,
        tags,
        owner_id,
        audit_trail,
        location_name,
        location: point
      }

    console.log("data tsting", dataTesting);

    const { data, error } = await supabase
      .from('disasters')
      .insert([{
        title,
        description,
        tags,
        owner_id,
        audit_trail,
        location_name,
        location: point
      }])
      .select('*')
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Emit WebSocket event
    const io = req.app.get('io');
    io.emit('disaster_updated', {
      type: 'create',
      disaster: data,
      timestamp: new Date().toISOString(),
      user: owner_id
    });

    res.json(data);
  } catch (err) {
    console.error('Disaster creation failed:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getDisasters = async (req, res) => {
  try {
    const tag = req.query.tag;
    let query = supabase.from('disasters').select('*');
    if (tag) query = query.contains('tags', [tag]);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return res.status(400).json({ error: error.message });
    
    console.log(`[LOG] Disasters fetched: ${data?.length || 0} disasters`);
    res.json(data);
  } catch (err) {
    console.error(`[ERROR] Disaster fetch failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
};

exports.updateDisaster = async (req, res) => {
  try {
    const id = req.params.id;
    const { title, location_name, description, tags } = req.body;
    const user_id = req.user.id;
    
    // Fetch current audit trail
    const { data: current, error: fetchErr } = await supabase
      .from('disasters')
      .select('audit_trail')
      .eq('id', id)
      .single();
      
    if (fetchErr) return res.status(404).json({ error: 'Disaster not found' });
    
    const audit_trail = current.audit_trail || [];
    audit_trail.push({ action: 'update', user_id, timestamp: new Date().toISOString() });
    
    const { data, error } = await supabase
      .from('disasters')
      .update({ title, location_name, description, tags, audit_trail })
      .eq('id', id)
      .select('*')
      .single();
      
    if (error) return res.status(400).json({ error: error.message });
    
    // Emit WebSocket event for real-time updates
    const io = req.app.get('io');
    io.emit('disaster_updated', { 
      type: 'update', 
      disaster: data,
      timestamp: new Date().toISOString(),
      user: user_id
    });
    
    console.log(`[LOG] Disaster updated: ${id} by ${user_id}`);
    res.json(data);
  } catch (err) {
    console.error(`[ERROR] Disaster update failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteDisaster = async (req, res) => {
  try {
    const id = req.params.id;
    const user_id = req.user.id;
    
    // Fetch current audit trail
    const { data: current, error: fetchErr } = await supabase
      .from('disasters')
      .select('audit_trail')
      .eq('id', id)
      .single();
      
    if (fetchErr) return res.status(404).json({ error: 'Disaster not found' });
    
    const audit_trail = current.audit_trail || [];
    audit_trail.push({ action: 'delete', user_id, timestamp: new Date().toISOString() });
    
    const { error } = await supabase.from('disasters').delete().eq('id', id);
    if (error) return res.status(400).json({ error: error.message });
    
    // Emit WebSocket event for real-time updates
    const io = req.app.get('io');
    io.emit('disaster_updated', { 
      type: 'delete', 
      disaster_id: id,
      timestamp: new Date().toISOString(),
      user: user_id
    });
    
    console.log(`[LOG] Disaster deleted: ${id} by ${user_id}`);
    res.json({ success: true, message: 'Disaster deleted successfully' });
  } catch (err) {
    console.error(`[ERROR] Disaster deletion failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
};



// const supabase = require('../supabaseClient');
// // const geocoder = require("../utils/geocoder");
// const axios     = require('axios');
// // Cursor generated disasters CRUD controller with proper WebSocket integration

// async function extractAndGeocode(description) {
//   const cacheKey = `geocode_${description.replace(/[^a-zA-Z0-9]/g, '_')}`;

//   // 1. Check cache
//   const { data: cached } = await supabase
//     .from('cache')
//     .select('value, expires_at')
//     .eq('key', cacheKey)
//     .single();

//   if (cached && new Date(cached.expires_at) > new Date()) {
//     return cached.value;
//   }

//   // 2. Gemini extraction
//   const geminiResponse = await axios.post(
//     `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
//     {
//       contents: [{
//         parts: [{
//           text: `Extract the location name from this disaster description. Return only the location name: "${description}"`
//         }]
//       }]
//     },
//     { headers: { 'Content-Type': 'application/json' } }
//   );
//   const location_name = geminiResponse.data
//     ?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
//   if (!location_name) {
//     throw new Error('Gemini failed to extract a location');
//   }

//   // 3. Google Maps geocoding
//   const mapsRes = await axios.get(
//     `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location_name)}&key=${process.env.GOOGLE_MAPS_API_KEY}`
//   );
//   const geo = mapsRes.data.results?.[0]?.geometry?.location;
//   if (!geo) {
//     throw new Error('Maps API failed to geocode location');
//   }

//   const result = { location_name, lat: geo.lat, lng: geo.lng };

//   // 4. Cache for 1h
//   await supabase.from('cache').upsert({
//     key: cacheKey,
//     value: result,
//     expires_at: new Date(Date.now() + 60*60*1000).toISOString()
//   });

//   return result;
// }

// exports.createDisaster = async (req, res) => {
//   try {
//     const { title, description, tags, location_name, location } = req.body;
//     if (!title || !description) {
//       return res.status(400).json({ error: 'Title and description are required' });
//     }

//     // 1️⃣ Extract & geocode (overrides any client‐sent location_name/location)
//     let geo;
//     try {
//       geo = await extractAndGeocode(description);
//     } catch (err) {
//       return res.status(400).json({ error: 'Could not extract location from description' });
//     }
//     const { location_name: extractedName, lat, lng } = geo;
//     const point = { type: 'Point', coordinates: [lng, lat] };

//     // 2️⃣ Build audit trail & insert
//     const owner_id = req.user.id;
//     const audit_trail = [{ action: 'create', user_id: owner_id, timestamp: new Date().toISOString() }];

//     const { data, error } = await supabase
//       .from('disasters')
//       .insert([{
//         title,
//         description,
//         tags,
//         owner_id,
//         audit_trail,
//         location_name: extractedName,
//         location: point
//       }])
//       .select('*')
//       .single();

//     if (error) {
//       return res.status(400).json({ error: error.message });
//     }

//     // 3️⃣ Emit WebSocket event
//     const io = req.app.get('io');
//     io.emit('disaster_updated', {
//       type: 'create',
//       disaster: data,
//       timestamp: new Date().toISOString(),
//       user: owner_id
//     });

//     res.json(data);
//   } catch (err) {
//     console.error('Disaster creation failed:', err);
//     res.status(500).json({ error: err.message });
//   }
// };

// exports.getDisasters = async (req, res) => {
//   try {
//     const tag = req.query.tag;
//     let query = supabase.from('disasters').select('*');
//     if (tag) query = query.contains('tags', [tag]);
//     const { data, error } = await query.order('created_at', { ascending: false });
//     if (error) return res.status(400).json({ error: error.message });
    
//     console.log(`[LOG] Disasters fetched: ${data?.length || 0} disasters`);
//     res.json(data);
//   } catch (err) {
//     console.error(`[ERROR] Disaster fetch failed: ${err.message}`);
//     res.status(500).json({ error: err.message });
//   }
// };

// exports.updateDisaster = async (req, res) => {
//   try {
//     const id = req.params.id;
//     const { title, location_name, description, tags } = req.body;
//     const user_id = req.user.id;
    
//     // Fetch current audit trail
//     const { data: current, error: fetchErr } = await supabase
//       .from('disasters')
//       .select('audit_trail')
//       .eq('id', id)
//       .single();
      
//     if (fetchErr) return res.status(404).json({ error: 'Disaster not found' });
    
//     const audit_trail = current.audit_trail || [];
//     audit_trail.push({ action: 'update', user_id, timestamp: new Date().toISOString() });
    
//     const { data, error } = await supabase
//       .from('disasters')
//       .update({ title, location_name, description, tags, audit_trail })
//       .eq('id', id)
//       .select('*')
//       .single();
      
//     if (error) return res.status(400).json({ error: error.message });
    
//     // Emit WebSocket event for real-time updates
//     const io = req.app.get('io');
//     io.emit('disaster_updated', { 
//       type: 'update', 
//       disaster: data,
//       timestamp: new Date().toISOString(),
//       user: user_id
//     });
    
//     console.log(`[LOG] Disaster updated: ${id} by ${user_id}`);
//     res.json(data);
//   } catch (err) {
//     console.error(`[ERROR] Disaster update failed: ${err.message}`);
//     res.status(500).json({ error: err.message });
//   }
// };

// exports.deleteDisaster = async (req, res) => {
//   try {
//     const id = req.params.id;
//     const user_id = req.user.id;
    
//     // Fetch current audit trail
//     const { data: current, error: fetchErr } = await supabase
//       .from('disasters')
//       .select('audit_trail')
//       .eq('id', id)
//       .single();
      
//     if (fetchErr) return res.status(404).json({ error: 'Disaster not found' });
    
//     const audit_trail = current.audit_trail || [];
//     audit_trail.push({ action: 'delete', user_id, timestamp: new Date().toISOString() });
    
//     const { error } = await supabase.from('disasters').delete().eq('id', id);
//     if (error) return res.status(400).json({ error: error.message });
    
//     // Emit WebSocket event for real-time updates
//     const io = req.app.get('io');
//     io.emit('disaster_updated', { 
//       type: 'delete', 
//       disaster_id: id,
//       timestamp: new Date().toISOString(),
//       user: user_id
//     });
    
//     console.log(`[LOG] Disaster deleted: ${id} by ${user_id}`);
//     res.json({ success: true, message: 'Disaster deleted successfully' });
//   } catch (err) {
//     console.error(`[ERROR] Disaster deletion failed: ${err.message}`);
//     res.status(500).json({ error: err.message });
//   }
// };