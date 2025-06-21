// src/controllers/socialController.js
const supabase = require('../supabaseClient');

/**
 * GET /disasters/:id/social-media
 * - Checks cache (TTL: 1h)
 * - If expired or missing, returns a mock feed, caches it
 * - Emits 'social_media_updated' to the disaster room
 */
exports.getSocialMedia = async (req, res) => {
  try {
    const disasterId = req.params.id;
    const cacheKey   = `social_${disasterId}`;

    // 1️⃣ Cache lookup
    const { data: cached } = await supabase
      .from('cache')
      .select('value, expires_at')
      .eq('key', cacheKey)
      .single();

    if (cached && new Date(cached.expires_at) > new Date()) {
      return res.json(cached.value);
    }

    // 2️⃣ Fetch (mock) social feed
    const mockData = [
      { post: "#floodhelp Need boats in Indore",    user: "citizenA", timestamp: new Date().toISOString(), priority: "urgent" },
      { post: "Water level rising by hour",         user: "citizenB", timestamp: new Date().toISOString(), priority: "high"   },
      { post: "Shelter at Main St open",            user: "reliefOrg",timestamp: new Date().toISOString(), priority: "normal" },
      { post: "Trapped near City Mall, need rescue",user: "citizenC", timestamp: new Date().toISOString(), priority: "urgent" },
      { post: "Trapped near City Mall, need rescue",user: "citizenC", timestamp: new Date().toISOString(), priority: "urgent" },
    ];

    // 3️⃣ Cache for 1 hour
    await supabase.from('cache').upsert({
      key:        cacheKey,
      value:      mockData,
      expires_at: new Date(Date.now() + 60*60*1000).toISOString()
    });

    // 4️⃣ Emit WebSocket update
    const io = req.app.get('io');
    io.to(`disaster_${disasterId}`)
      .emit('social_media_updated', { disasterId, posts: mockData, timestamp: new Date().toISOString() });

    return res.json(mockData);
  } catch (err) {
    console.error('Social media fetch failed:', err);
    return res.status(500).json({ error: err.message });
  }
};


// const supabase = require('../supabaseClient');

// // Cursor generated mock social media controller with proper WebSocket integration
// exports.getSocialMedia = async (req, res) => {
//   try {
//     const disasterId = req.params.id;
//     const cacheKey = `social_${disasterId}`;
    
//     // Check cache first (TTL: 1 hour)
//     const { data: cached } = await supabase
//       .from('cache')
//       .select('*')
//       .eq('key', cacheKey)
//       .single();
    
//     if (cached && new Date(cached.expires_at) > new Date()) {
//       console.log(`[LOG] Social media cache hit for disaster: ${disasterId}`);
//       return res.json(cached.value);
//     }
    
//     // Mock Twitter API data (replace with real Twitter/Bluesky API if available)
//     const mockData = [
//       { 
//         post: "#floodrelief Need food and water in NYC Lower East Side", 
//         user: "citizen1",
//         timestamp: new Date().toISOString(),
//         priority: "urgent"
//       },
//       { 
//         post: "Water rising fast in Manhattan! Streets are flooded", 
//         user: "citizen2",
//         timestamp: new Date().toISOString(),
//         priority: "high"
//       },
//       { 
//         post: "Red Cross shelter open at 123 Main St", 
//         user: "relief_worker",
//         timestamp: new Date().toISOString(),
//         priority: "normal"
//       },
//       { 
//         post: "SOS: Trapped in building on 5th Ave, need immediate help", 
//         user: "trapped_citizen",
//         timestamp: new Date().toISOString(),
//         priority: "urgent"
//       }
//     ];
    
//     // Cache result for 1 hour
//     await supabase.from('cache').upsert({
//       key: cacheKey,
//       value: mockData,
//       expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
//     });
    
//     // Emit WebSocket event for real-time updates
//     const io = req.app.get('io');
//     io.to(`disaster_${disasterId}`).emit('social_media_updated', { 
//       disasterId, 
//       posts: mockData,
//       timestamp: new Date().toISOString()
//     });
    
//     console.log(`[LOG] Social media reports fetched for disaster: ${disasterId}`);
//     res.json(mockData);
//   } catch (err) {
//     console.error(`[ERROR] Social media fetch failed: ${err.message}`);
//     res.status(500).json({ error: err.message });
//   }
// }; 