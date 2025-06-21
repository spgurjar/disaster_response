// backend/src/controllers/resourcesController.js

const supabase = require('../supabaseClient');

/**
 * GET /disasters/:id/resources?lat=<>&lng=<>
 * Uses the get_resources_nearby() Postgres RPC for proximity lookup.
 */
exports.getNearbyResources = async (req, res) => {
  try {
    const disasterId = parseInt(req.params.id, 10);
    const lat         = parseFloat(req.query.lat);
    const lng         = parseFloat(req.query.lng);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'Valid lat and lng parameters are required' });
    }

    const cacheKey = `resources_${disasterId}_${lat}_${lng}`;

    // 1️⃣ Check cache
    const { data: cached } = await supabase
      .from('cache')
      .select('value, expires_at')
      .eq('key', cacheKey)
      .single();
    if (cached && new Date(cached.expires_at) > new Date()) {
      console.log('Resources cache hit');
      return res.json(cached.value);
    }

    // 2️⃣ Call our Postgres function via RPC
    const { data, error } = await supabase
      .rpc('get_resources_nearby', {
        in_disaster_id:     disasterId,
        in_lng:             lng,
        in_lat:             lat,
        in_radius_meters:  10000
      });

    if (error) throw error;

    let resources = data;
    if (!resources.length) {
      // fallback sample data
      resources = [
        { id: 'sample-1', disaster_id: disasterId, name: 'Red Cross Shelter',           location_name: 'Lower East Side, NYC', type: 'shelter', distance: '2.5km' },
        { id: 'sample-2', disaster_id: disasterId, name: 'NYC Medical Center',         location_name: 'Manhattan, NYC',      type: 'hospital', distance: '5.1km' },
        { id: 'sample-3', disaster_id: disasterId, name: 'Emergency Food Distribution', location_name: 'Chinatown, NYC',     type: 'food',     distance: '3.8km' }
      ];
    }

    // 3️⃣ Cache for 1h
    await supabase.from('cache').upsert({
      key:        cacheKey,
      value:      resources,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
    });

    // 4️⃣ Emit WebSocket update
    const io = req.app.get('io');
    io.to(`disaster_${disasterId}`).emit('resources_updated', {
      disasterId,
      resources,
      timestamp: new Date().toISOString()
    });

    return res.json(resources);
  } catch (err) {
    console.error('Resources lookup failed:', err);
    return res.status(500).json({ error: err.message });
  }
};
