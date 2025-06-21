import React, { useState, useEffect, useCallback } from "react";
import io from "socket.io-client";
import "./App.css";

const API_BASE = "https://disaster-response-backend-f69m.onrender.com";

// console.log("base url", API_BASE);

function App() {
  // ... (existing state, unchanged)
  const [disasters, setDisasters] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDisaster, setSelectedDisaster] = useState(null);
  const [socialMedia, setSocialMedia] = useState([]);
  const [resources, setResources] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [verification, setVerification] = useState(null);
  const [socket, setSocket] = useState(null);

  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [user, setUser] = useState("netrunnerX");
  const [imageUrl, setImageUrl] = useState("");
  const [geocodeDescription, setGeocodeDescription] = useState("");
  const [geocodeResult, setGeocodeResult] = useState(null);

  // WebSocket
  useEffect(() => {
    const newSocket = io(API_BASE);
    setSocket(newSocket);

    newSocket.on("connect", () => {
      // Visual feedback handled by UI
    });

    newSocket.on("disaster_updated", () => {
      fetchDisasters();
    });

    newSocket.on("social_media_updated", (data) => {
      if (selectedDisaster && data.disasterId === selectedDisaster.id) {
        setSocialMedia(data.posts);
      }
    });

    newSocket.on("resources_updated", (data) => {
      if (selectedDisaster && data.disasterId === selectedDisaster.id) {
        setResources(data.resources);
      }
    });

    newSocket.on("official_updates_updated", (data) => {
      if (selectedDisaster && data.disasterId === selectedDisaster.id) {
        setUpdates(data.updates);
      }
    });

    return () => newSocket.close();
    // eslint-disable-next-line
  }, [selectedDisaster]);

  // Fetch disasters
  const fetchDisasters = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/disasters`, {
        headers: { "x-user": user },
      });
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("Invalid response format");
      setDisasters(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDisasters();
  }, [fetchDisasters]);

  // Create disaster
  const createDisaster = async () => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/disasters`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user": user,
        },
        body: JSON.stringify({
          title,
          description,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || "Failed to create disaster");
      }
      setTitle("");
      setDescription("");
      setTags("");
    } catch (err) {
      setError(err.message);
    }
  };

  // Geocode preview (unused, optional)
  const geocodeLocation = async () => {
    try {
      const response = await fetch(`${API_BASE}/geocode`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user": user,
        },
        body: JSON.stringify({ description: geocodeDescription }),
      });
      const data = await response.json();
      setGeocodeResult(data);
    } catch (err) {
      // Ignore
    }
  };

  // Fetchers
  const fetchSocialMedia = async (disasterId) => {
    try {
      const res = await fetch(`${API_BASE}/disasters/${disasterId}/social-media`, {
        headers: { "x-user": user },
      });
      if (!res.ok) throw new Error("Failed to fetch social media");
      const data = await res.json();
      setSocialMedia(data);
    } catch {}
  };

  const fetchResources = async (disasterId) => {
    try {
      const res = await fetch(
        `${API_BASE}/disasters/${disasterId}/resources?lat=${selectedDisaster.location.coordinates[1]}&lng=${selectedDisaster.location.coordinates[0]}`,
        { headers: { "x-user": user } }
      );
      if (!res.ok) throw new Error("Failed to fetch resources");
      const data = await res.json();
      setResources(data);
    } catch {}
  };

  const fetchUpdates = async (disasterId) => {
    try {
      const res = await fetch(`${API_BASE}/disasters/${disasterId}/official-updates`, {
        headers: { "x-user": user },
      });
      if (!res.ok) throw new Error("Failed to fetch updates");
      const data = await res.json();
      setUpdates(data);
    } catch {}
  };

  const verifyImage = async (disasterId) => {
    try {
      const res = await fetch(`${API_BASE}/disasters/${disasterId}/verify-image`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user": user,
        },
        body: JSON.stringify({ image_url: imageUrl }),
      });
      if (!res.ok) throw new Error("Failed to verify image");
      const data = await res.json();
      setVerification(data);
    } catch {}
  };

  // UI Section State (for tabs in selected disaster view)
  const [activeTab, setActiveTab] = useState("image");

  const handleDisasterSelect = (disaster) => {
    setSelectedDisaster(disaster);
    setActiveTab("image");
    if (socket) socket.emit("join_disaster", disaster.id);
    fetchSocialMedia(disaster.id);
    fetchResources(disaster.id);
    fetchUpdates(disaster.id);
  };

  return (
    <div className="App">
      {/* Background */}
      <div className="app-bg" />

      <header className="App-header glass-card">
        <h1>
           Disaster Response Platform
        </h1>
        <div className={`connection-status ${socket?.connected ? "online" : "offline"}`}>
          {socket?.connected ? "🟢 Live" : "🔴 Offline"}
        </div>
      </header>

      <main className="container">
        {/* User Select */}
        <div className="user-select-container">
          <label htmlFor="userSelect" className="select-label">
            Switch User:
          </label>
          <select
            id="userSelect"
            className="selectUser"
            value={user}
            onChange={e => setUser(e.target.value)}
          >
            <option value="netrunnerX">netrunnerX (Admin)</option>
            <option value="reliefAdmin">reliefAdmin (Admin)</option>
            <option value="citizen1">citizen1 (Contributor)</option>
          </select>
        </div>


        {/* Create Disaster */}
        <section className="section glass-card">
          <div className="section-header">
            <h2><span role="img" aria-label="create">📝</span> Post about a disaster</h2>
          </div>
          <form className="form" onSubmit={e => { e.preventDefault(); createDisaster(); }}>
            <input
              placeholder="Title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
            <textarea
              placeholder="Full description (location will be extracted)"
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
            />
            <input
              placeholder="Tags (comma-separated)"
              value={tags}
              onChange={e => setTags(e.target.value)}
            />
            <button type="submit" className="primary-btn">Post</button>
            {error && <div className="error">Error: {error}</div>}
          </form>
        </section>

        {/* Disasters List */}
        <section className="section glass-card">
          <div className="section-header">
            <h2><span role="img" aria-label="list">📋</span> Disasters</h2>
          </div>
          {isLoading ? (
            <div className="loading">Loading disasters…</div>
          ) : error ? (
            <div className="error">{error}</div>
          ) : disasters.length ? (
            <div className="disasters-list">
              {disasters.map((d) => (
                <div
                  key={d.id}
                  className={`disaster-item ${selectedDisaster?.id === d.id ? "selected" : ""}`}
                  onClick={() => handleDisasterSelect(d)}
                >
                  <h3>{d.title}</h3>
                  <p>
                    <strong>Location:</strong> {d.location_name}
                  </p>
                  <p className="disaster-desc">{d.description}</p>
                  <div className="tags-list">
                    {Array.isArray(d.tags) && d.tags.map((tag, idx) => (
                      <span key={idx} className={`tag ${tag.toLowerCase()}`}>{tag}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-data">No disasters found</div>
          )}
        </section>

        {/* Selected Disaster Details */}
        {selectedDisaster && (
          <section className="section glass-card selected-details">
            <div className="section-header">
              <h2>
                <span role="img" aria-label="search">🔍</span> {selectedDisaster.title}
              </h2>
              <div className="tab-bar">
                <button className={activeTab === "image" ? "active" : ""} onClick={() => setActiveTab("image")}>🖼️ Image Verification</button>
                <button className={activeTab === "social" ? "active" : ""} onClick={() => setActiveTab("social")}>📱 Social Media</button>
                <button className={activeTab === "resources" ? "active" : ""} onClick={() => setActiveTab("resources")}>🏥 Resources</button>
                <button className={activeTab === "updates" ? "active" : ""} onClick={() => setActiveTab("updates")}>📰 Updates</button>
              </div>
            </div>
            <div className="tab-content">
              {activeTab === "image" && (
                <div className="subsection">
                  <div className="subsection-header">
                    <h3>Image Verification</h3>
                  </div>
                  <div className="form inline-form">
                    <input
                      placeholder="Image URL"
                      value={imageUrl}
                      onChange={e => setImageUrl(e.target.value)}
                    />
                    <button type="button" className="primary-btn" onClick={() => verifyImage(selectedDisaster.id)}>
                      Verify
                    </button>
                  </div>
                  {verification && (
                    <div className="result animated-pop">
                      <p><strong>Status:</strong> <span className={`status-chip ${verification.status}`}>{verification.status}</span></p>
                      <p><strong>Confidence:</strong> {verification.confidence}</p>
                      <p><strong>Explanation:</strong> {verification.explanation}</p>
                    </div>
                  )}
                </div>
              )}
              {activeTab === "social" && (
                <div className="subsection">
                  <div className="subsection-header">
                    <h3>Social Media Reports</h3>
                    <button className="small-btn" onClick={() => fetchSocialMedia(selectedDisaster.id)}>
                      Refresh
                    </button>
                  </div>
                  <div className="social-media">
                    {socialMedia.length === 0 ? (
                      <div className="no-data">No social media reports</div>
                    ) : (
                      socialMedia.map((post, index) => (
                        <div key={index} className={`social-post ${post.priority}`}>
                          <div>
                            <span className="post-user">{post.user}</span>:
                            <span> {post.post}</span>
                          </div>
                          <span className={`priority ${post.priority}`}>{post.priority}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
              {activeTab === "resources" && (
                <div className="subsection">
                  <div className="subsection-header">
                    <h3>Nearby Resources</h3>
                    <button className="small-btn" onClick={() => fetchResources(selectedDisaster.id)}>
                      Refresh
                    </button>
                  </div>
                  <div className="resources">
                    {resources.length === 0 ? (
                      <div className="no-data">No resources found</div>
                    ) : (
                      resources.map((resource, i) => (
                        <div key={i} className="resource-item">
                          <h4>{resource.name}</h4>
                          <p><strong>Type:</strong> {resource.type}</p>
                          <p><strong>Location:</strong> {resource.location_name}</p>
                          {resource.distance && (
                            <p><strong>Distance:</strong> {resource.distance}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
              {activeTab === "updates" && (
                <div className="subsection">
                  <div className="subsection-header">
                    <h3>Official Updates</h3>
                    <button className="small-btn" onClick={() => fetchUpdates(selectedDisaster.id)}>
                      Refresh
                    </button>
                  </div>
                  <div className="updates">
                    {updates.length === 0 ? (
                      <div className="no-data">No updates</div>
                    ) : (
                      updates.map((u, i) => (
                        <div key={i} className="update-item">
                          <h4>{u.title}</h4>
                          <p><strong>Source:</strong> {u.source}</p>
                          <p><strong>Time:</strong> {new Date(u.timestamp).toLocaleString()}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </main>
      <footer className="app-footer">
        <span>Disaster Response Platform &copy; {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}

export default App;


// import React, { useState, useEffect, useCallback } from 'react';
// import io from 'socket.io-client';
// import './App.css';

// const API_BASE = 'http://localhost:5001';

// function App() {
//   const [disasters, setDisasters] = useState([]);
//   const [isLoading, setIsLoading] = useState(true);
//   const [error, setError] = useState(null);
//   const [selectedDisaster, setSelectedDisaster] = useState(null);
//   const [socialMedia, setSocialMedia] = useState([]);
//   const [resources, setResources] = useState([]);
//   const [updates, setUpdates] = useState([]);
//   const [verification, setVerification] = useState(null);
//   const [socket, setSocket] = useState(null);

//   // Form states
//   const [title, setTitle] = useState('');
//   const [description, setDescription] = useState('');
//   const [tags, setTags] = useState('');
//   const [user, setUser] = useState('netrunnerX');
//   const [imageUrl, setImageUrl] = useState('');
//   const [geocodeDescription, setGeocodeDescription] = useState('');
//   const [geocodeResult, setGeocodeResult] = useState(null);

//   // Initialize WebSocket connection
//   useEffect(() => {
//     const newSocket = io(API_BASE);
//     setSocket(newSocket);

//     newSocket.on('connect', () => {
//       console.log('Connected to WebSocket server');
//     });

//     newSocket.on('disaster_updated', () => {
//       fetchDisasters();
//     });

//     newSocket.on('social_media_updated', data => {
//       if (selectedDisaster && data.disasterId === selectedDisaster.id) {
//         setSocialMedia(data.posts);
//       }
//     });

//     newSocket.on('resources_updated', data => {
//       if (selectedDisaster && data.disasterId === selectedDisaster.id) {
//         setResources(data.resources);
//       }
//     });

//     newSocket.on('official_updates_updated', data => {
//       if (selectedDisaster && data.disasterId === selectedDisaster.id) {
//         setUpdates(data.updates);
//       }
//     });

//     return () => newSocket.close();
//   }, [selectedDisaster]);

//   // Fetch disasters
//   const fetchDisasters = useCallback(async () => {
//     setIsLoading(true);
//     setError(null);
//     try {
//       const response = await fetch(`${API_BASE}/disasters`, {
//         headers: { 'x-user': user }
//       });
//       const data = await response.json();
//       if (!Array.isArray(data)) throw new Error('Invalid response format');
//       setDisasters(data);
//     } catch (err) {
//       console.error('Error fetching disasters:', err);
//       setError(err.message);
//     } finally {
//       setIsLoading(false);
//     }
//   }, [user]);

//   useEffect(() => {
//     fetchDisasters();
//   }, [fetchDisasters]);

//   // Create disaster — backend will handle extract+geocode
//   const createDisaster = async () => {
//     setError(null);
//     try {
//       const res = await fetch(`${API_BASE}/disasters`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           'x-user': user
//         },
//         body: JSON.stringify({
//           title,
//           description,
//           tags: tags.split(',').map(t => t.trim()).filter(Boolean)
//         })
//       });
//       if (!res.ok) {
//         const { error } = await res.json();
//         throw new Error(error || 'Failed to create disaster');
//       }
//       setTitle('');
//       setDescription('');
//       setTags('');
//       // WebSocket will refresh
//     } catch (err) {
//       console.error(err);
//       setError(err.message);
//     }
//   };

//   // Optional geocode preview
//   const geocodeLocation = async () => {
//     try {
//       const response = await fetch(`${API_BASE}/geocode`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           'x-user': user
//         },
//         body: JSON.stringify({ description: geocodeDescription })
//       });
//       const data = await response.json();
//       setGeocodeResult(data);
//     } catch (err) {
//       console.error('Error geocoding:', err);
//     }
//   };

//   // --- New: implement social, resources, updates, verify fetchers ---

//   const fetchSocialMedia = async (disasterId) => {
//     try {
//       const res = await fetch(`${API_BASE}/disasters/${disasterId}/social-media`, {
//         headers: { 'x-user': user }
//       });
//       if (!res.ok) throw new Error('Failed to fetch social media');
//       const data = await res.json();
//       setSocialMedia(data);
//     } catch (err) {
//       console.error('Error fetching social media:', err);
//     }
//   };

//   const fetchResources = async (disasterId) => {
//     try {
//       const res = await fetch(
//         `${API_BASE}/disasters/${disasterId}/resources?lat=${selectedDisaster.location.coordinates[1]}&lng=${selectedDisaster.location.coordinates[0]}`,
//         { headers: { 'x-user': user } }
//       );
//       if (!res.ok) throw new Error('Failed to fetch resources');
//       const data = await res.json();
//       setResources(data);
//     } catch (err) {
//       console.error('Error fetching resources:', err);
//     }
//   };

//   const fetchUpdates = async (disasterId) => {
//     try {
//       const res = await fetch(`${API_BASE}/disasters/${disasterId}/official-updates`, {
//         headers: { 'x-user': user }
//       });
//       if (!res.ok) throw new Error('Failed to fetch updates');
//       const data = await res.json();
//       setUpdates(data);
//     } catch (err) {
//       console.error('Error fetching updates:', err);
//     }
//   };

//   const verifyImage = async (disasterId) => {
//     try {
//       const res = await fetch(`${API_BASE}/disasters/${disasterId}/verify-image`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           'x-user': user
//         },
//         body: JSON.stringify({ image_url: imageUrl })
//       });
//       if (!res.ok) throw new Error('Failed to verify image');
//       const data = await res.json();
//       setVerification(data);
//     } catch (err) {
//       console.error('Error verifying image:', err);
//     }
//   };

//   const handleDisasterSelect = disaster => {
//     setSelectedDisaster(disaster);
//     if (socket) socket.emit('join_disaster', disaster.id);
//     fetchSocialMedia(disaster.id);
//     fetchResources(disaster.id);
//     fetchUpdates(disaster.id);
//   };

//   return (
//     <div className="App">
//       <header className="App-header">
//         <h1>🚨 Disaster Response Coordination Platform</h1>
//         <div className="connection-status">
//           {socket?.connected ? '🟢 Connected' : '🔴 Disconnected'}
//         </div>
//       </header>

//       <div className="container">
//         {/* User */}
//         <div className="section">
//           <h2>👤 User</h2>
//           <select value={user} onChange={e => setUser(e.target.value)}>
//             <option value="netrunnerX">netrunnerX (Admin)</option>
//             <option value="reliefAdmin">reliefAdmin (Admin)</option>
//             <option value="citizen1">citizen1 (Contributor)</option>
//           </select>
//         </div>

//         {/* Create Disaster */}
//         <div className="section">
//           <h2>📝 Create Disaster</h2>
//           <div className="form">
//             <input
//               placeholder="Title"
//               value={title}
//               onChange={e => setTitle(e.target.value)}
//             />
//             <textarea
//               placeholder="Full description (we’ll extract location)"
//               value={description}
//               onChange={e => setDescription(e.target.value)}
//             />
//             <input
//               placeholder="Tags (comma-separated)"
//               value={tags}
//               onChange={e => setTags(e.target.value)}
//             />
//             <button onClick={createDisaster}>Create Disaster</button>
//             {error && <div className="error">Error: {error}</div>}
//           </div>
//         </div>

//         {/* Geocode Preview */}
//         {/* <div className="section">
//           <h2>🗺️ Geocode Preview (optional)</h2>
//           <div className="form">
//             <textarea
//               placeholder="Description for geocode preview"
//               value={geocodeDescription}
//               onChange={e => setGeocodeDescription(e.target.value)}
//             />
//             <button onClick={geocodeLocation}>Extract & Geocode</button>
//           </div>
//           {geocodeResult && (
//             <div className="result">
//               <p>
//                 <strong>Location:</strong> {geocodeResult.location_name}
//               </p>
//               <p>
//                 <strong>Coords:</strong> {geocodeResult.lat}, {geocodeResult.lng}
//               </p>
//             </div>
//           )}
//         </div> */}

//         {/* Disasters List */}
//         <div className="section">
//           <h2>📋 Disasters</h2>
//           {isLoading ? (
//             <div>Loading…</div>
//           ) : error ? (
//             <div className="error">{error}</div>
//           ) : disasters.length ? (
//             <div className="disasters-list">
//               {disasters.map(d => (
//                 <div
//                   key={d.id}
//                   className={`disaster-item ${
//                     selectedDisaster?.id === d.id ? 'selected' : ''
//                   }`}
//                   onClick={() => handleDisasterSelect(d)}
//                 >
//                   <h3>{d.title}</h3>
//                   <p>
//                     <strong>Location:</strong> {d.location_name}
//                   </p>
//                   <p>{d.description}</p>
//                 </div>
//               ))}
//             </div>
//           ) : (
//             <div>No disasters found</div>
//           )}
//         </div>

//         {/* Selected Disaster Details */}
//         {selectedDisaster && (
//           <div className="section">
//             <h2>🔍 Disaster Details: {selectedDisaster.title}</h2>

//             {/* Image Verification */}
//             <div className="subsection">
//               <h3>🖼️ Image Verification</h3>
//               <div className="form">
//                 <input
//                   placeholder="Image URL"
//                   value={imageUrl}
//                   onChange={e => setImageUrl(e.target.value)}
//                 />
//                 <button onClick={() => verifyImage(selectedDisaster.id)}>
//                   Verify Image
//                 </button>
//               </div>
//               {verification && (
//                 <div className="result">
//                   <p><strong>Status:</strong> {verification.status}</p>
//                   <p><strong>Confidence:</strong> {verification.confidence}</p>
//                   <p><strong>Explanation:</strong> {verification.explanation}</p>
//                 </div>
//               )}
//             </div>

//             {/* Social Media */}
//             <div className="subsection">
//               <h3>📱 Social Media Reports</h3>
//               <button onClick={() => fetchSocialMedia(selectedDisaster.id)}>
//                 Refresh
//               </button>
//               <div className="social-media">
//                 {socialMedia.map((post, index) => (
//                   <div key={index} className="social-post">
//                     <p><strong>{post.user}:</strong> {post.post}</p>
//                     <span className={`priority ${post.priority}`}>
//                       {post.priority}
//                     </span>
//                   </div>
//                 ))}
//               </div>
//             </div>

//             {/* Resources */}
//             <div className="subsection">
//               <h3>🏥 Nearby Resources</h3>
//               <button onClick={() => fetchResources(selectedDisaster.id)}>
//                 Refresh
//               </button>
//               <div className="resources">
//                 {resources.map((resource, i) => (
//                   <div key={i} className="resource-item">
//                     <h4>{resource.name}</h4>
//                     <p><strong>Type:</strong> {resource.type}</p>
//                     <p><strong>Location:</strong> {resource.location_name}</p>
//                     {resource.distance && <p><strong>Distance:</strong> {resource.distance}</p>}
//                   </div>
//                 ))}
//               </div>
//             </div>

//             {/* Official Updates */}
//             <div className="subsection">
//               <h3>📰 Official Updates</h3>
//               <button onClick={() => fetchUpdates(selectedDisaster.id)}>
//                 Refresh
//               </button>
//               <div className="updates">
//                 {updates.map((u, i) => (
//                   <div key={i} className="update-item">
//                     <h4>{u.title}</h4>
//                     <p><strong>Source:</strong> {u.source}</p>
//                     <p><strong>Time:</strong> {new Date(u.timestamp).toLocaleString()}</p>
//                   </div>
//                 ))}
//               </div>
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// export default App;