import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { 
  Box, 
  Circle, 
  Triangle, 
  Layers, 
  Move, 
  RotateCw, 
  Maximize, 
  Trash2, 
  Plus, 
  Type, 
  Sun, 
  Grid,
  MousePointer2,
  Video,
  Palette,
  Hand,
  Undo2,
  Redo2,
  Upload,
  History,
  Users,
  Save,
  User,
  ArrowRight,
  Wifi
} from 'lucide-react';

// --- Constants & Helpers ---
// Unified channel for Scene updates, Cursors, and Presence Heartbeats
const CHANNEL_NAME_MAIN = '3d-studio-collaboration-v3'; 

const PRIMITIVES = [
  { type: 'cube', label: 'Cube', icon: Box },
  { type: 'sphere', label: 'Sphere', icon: Circle },
  { type: 'cone', label: 'Cone', icon: Triangle },
  { type: 'torus', label: 'Torus', icon: Layers }, // Fixed: Removed duplicate 'label'
  { type: 'icosahedron', label: 'Ico', icon: Triangle },
];

const INITIAL_OBJECTS = [
  { id: '1', type: 'cube', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], color: '#6366f1', wireframe: false },
  { id: '2', type: 'torus', position: [3, 1, 0], rotation: [0.5, 0, 0], scale: [1, 1, 1], color: '#ec4899', wireframe: false },
];

const generateId = () => Math.random().toString(36).substr(2, 9);
const getRandomColor = () => {
  const colors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e'];
  return colors[Math.floor(Math.random() * colors.length)];
};

export default function App() {
  // --- User State ---
  const [hasJoined, setHasJoined] = useState(false);
  const [userName, setUserName] = useState('');
  const [myUser, setMyUser] = useState(null);
  
  // --- Scene State ---
  // Note: Since localStorage is removed, objects reset on refresh
  const [objects, setObjects] = useState(INITIAL_OBJECTS);
  const [historyLog, setHistoryLog] = useState([]); 
  const [selectedId, setSelectedId] = useState(null);
  const [activeTool, setActiveTool] = useState('select'); 
  
  // --- Collaboration State ---
  const [remoteUsers, setRemoteUsers] = useState({}); // Cursors
  const [activeUserCount, setActiveUserCount] = useState(1);
  
  const fileInputRef = useRef(null);
  const broadcastChannel = useRef(null);
  const isRemoteUpdate = useRef(false); // Flag to prevent echo loops
  const activeUsersMapRef = useRef({}); // Internal map for presence tracking

  // --- 1. Login ---
  const handleJoin = (e) => {
    e.preventDefault();
    if (!userName.trim()) return;
    const user = { id: generateId(), name: userName, color: getRandomColor() };
    setMyUser(user);
    setHasJoined(true);
  };

  // --- 2. Save Scene (BroadcastChannel) ---
  const saveScene = useCallback((newObjects, actionLabel) => {
      // Prevent echo from a remote update or if channel isn't ready
      if (isRemoteUpdate.current || !broadcastChannel.current) return;

      const newLog = [...historyLog, actionLabel].slice(-20); 
      setObjects(newObjects);
      setHistoryLog(newLog);

      // Broadcast the state change to all other tabs
      broadcastChannel.current.postMessage({
          type: 'SCENE_UPDATE',
          objects: newObjects,
          log: newLog
      });
  }, [historyLog]);
  
  // --- 3. Broadcast Cursor (BroadcastChannel) ---
  const broadcastCursor = useCallback((x, y) => {
      if (broadcastChannel.current && myUser) {
          broadcastChannel.current.postMessage({
              type: 'CURSOR_UPDATE',
              userId: myUser.id,
              user: myUser,
              x, y
          });
      }
  }, [myUser]);


  // --- 4. Unified BroadcastChannel Listener (Scene, Cursor, and Presence) ---
  useEffect(() => {
    if (!hasJoined || !myUser) return;

    // --- Channel Setup ---
    broadcastChannel.current = new BroadcastChannel(CHANNEL_NAME_MAIN);
    const timeoutSeconds = 5; // User considered active if heartbeat received in last 5 seconds

    // --- Heartbeat Sender ---
    const sendHeartbeat = () => {
        broadcastChannel.current.postMessage({
            type: 'HEARTBEAT',
            userId: myUser.id,
            user: myUser,
        });
    };
    
    // Initial heartbeat and recurring pulse
    sendHeartbeat();
    const heartbeatInterval = setInterval(sendHeartbeat, timeoutSeconds * 1000 / 2); // Pulse every 2.5s

    // --- Cleanup Stale Users and Update Count ---
    const cleanupInterval = setInterval(() => {
        const now = Date.now();
        const freshUsers = {};
        let count = 0;
        
        // Always include self
        freshUsers[myUser.id] = { ...myUser, lastUpdate: now };
        count++;

        // Filter out stale users
        Object.keys(activeUsersMapRef.current).forEach(key => {
            if (key !== myUser.id && now - activeUsersMapRef.current[key].lastUpdate < timeoutSeconds * 1000) {
                freshUsers[key] = activeUsersMapRef.current[key];
                count++;
            }
        });
        activeUsersMapRef.current = freshUsers;
        setActiveUserCount(count);
    }, 1000); // Check every second

    // --- Message Listener ---
    broadcastChannel.current.onmessage = (event) => {
        const { type, userId, user } = event.data;
        if (userId === myUser.id) return; // Ignore messages from self

        if (type === 'HEARTBEAT') {
            activeUsersMapRef.current[userId] = { ...user, lastUpdate: Date.now() };
            // The cleanup interval will update the state
            
        } else if (type === 'SCENE_UPDATE') {
            const { objects: newObjects, log: newLog } = event.data;
            
            // Mark as remote update to prevent immediate broadcast back (echo)
            isRemoteUpdate.current = true;
            setObjects(newObjects);
            setHistoryLog(newLog || []);
            
            // Reset flag after render cycle
            setTimeout(() => { isRemoteUpdate.current = false; }, 50);

        } else if (type === 'CURSOR_UPDATE') {
            const { x, y } = event.data;
            setRemoteUsers(prev => ({
                ...prev,
                [userId]: { ...user, x, y, lastUpdate: Date.now() }
            }));
        }
    };
    
    // Cleanup on unmount
    return () => {
        broadcastChannel.current.close();
        clearInterval(heartbeatInterval);
        clearInterval(cleanupInterval);
    };
  }, [hasJoined, myUser]); // Dependencies updated

  // --- Actions (using updated saveScene) ---
  const addObject = (type) => {
    const newObj = {
      id: generateId(),
      type,
      position: [Math.random() * 4 - 2, Math.random() * 4 - 2, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: getRandomColor(), 
      wireframe: false
    };
    saveScene([...objects, newObj], `Add ${type}`);
    setSelectedId(newObj.id);
    setActiveTool('move'); 
  };

  const updateTransform = (id, type, axis, value) => {
    const newObjects = objects.map(obj => {
      if (obj.id !== id) return obj;
      const newTransform = [...obj[type]];
      const idx = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
      newTransform[idx] = parseFloat(value) || 0;
      return { ...obj, [type]: newTransform };
    });
    saveScene(newObjects, `Transform ${type}`);
  };

  const updateObject = (id, field, value) => {
    const newObjects = objects.map(obj => obj.id === id ? { ...obj, [field]: value } : obj);
    saveScene(newObjects, `Update ${field}`);
  };

  const updateObjectPosition = (id, newPos) => {
    const newObjects = objects.map(obj => obj.id === id ? { ...obj, position: newPos } : obj);
    saveScene(newObjects, 'Move Object');
  };

  const deleteObject = (id) => {
    const newObjects = objects.filter(o => o.id !== id);
    saveScene(newObjects, 'Delete Object');
    if (selectedId === id) setSelectedId(null);
  };

  const undo = () => {
      // Simple undo is tricky with shared state, skipping to keep sync robust
      // Changed alert to console.log as per instructions
      console.log("Undo temporarily disabled in Multi-User V3 to prevent conflicts."); 
  };
  
  const handleImportClick = () => fileInputRef.current?.click();
  const handleFileUpload = (e) => {
      const file = e.target.files[0];
      if(!file) return;
      const url = URL.createObjectURL(file);
      const newObj = {
          id: generateId(), type: 'model', format: file.name.split('.').pop(), url, name: file.name,
          position: [0,0,0], rotation: [0,0,0], scale: [1,1,1], color: '#ffffff', wireframe: false
      };
      saveScene([...objects, newObj], `Import ${file.name}`);
      e.target.value = null;
  };

  const selectedObject = objects.find(o => o.id === selectedId);

  if (!hasJoined) {
    return (
      <div className="flex h-screen w-full bg-slate-900 items-center justify-center font-sans">
        <div className="w-96 bg-slate-800 p-8 rounded-xl shadow-2xl border border-slate-700 text-center">
          <div className="w-16 h-16 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg">
             <Box size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">3D Studio Live</h1>
          <p className="text-slate-400 mb-8">Multi-Tab Collaboration</p>
          <form onSubmit={handleJoin} className="space-y-4">
            <input autoFocus type="text" placeholder="Enter your name" className="w-full bg-slate-900 border border-slate-600 rounded-lg py-3 px-4 text-white focus:outline-none focus:border-indigo-500" value={userName} onChange={(e) => setUserName(e.target.value)} />
            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg transition-all">Join Session</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-900 text-slate-100 overflow-hidden font-sans">
      <input type="file" ref={fileInputRef} className="hidden" accept=".glb,.gltf,.obj,.stl" onChange={handleFileUpload} />

      {/* Left Sidebar */}
      <div className="w-64 border-r border-slate-700 bg-slate-800 flex flex-col z-10 shadow-xl">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-indigo-600/10">
          <div className="flex items-center gap-2"><Box size={20} className="text-indigo-400" /><span className="font-bold tracking-wider text-sm">STUDIO</span></div>
          <div className="flex items-center gap-2 bg-slate-700/50 px-2 py-1 rounded-full" style={{borderColor: myUser.color, borderWidth: '1px'}}>
             <span className="text-xs font-bold">{myUser.name}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col">
          {/* Tools */}
          <div className="p-3 border-b border-slate-700">
             <div className="text-[10px] text-slate-500 uppercase font-bold mb-2 tracking-wider px-1">Tools</div>
             <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setActiveTool('select')} className={`p-2 rounded-md transition-all flex flex-col items-center gap-1 ${activeTool === 'select' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}><MousePointer2 size={18} /><span className="text-[10px]">Select</span></button>
                <button onClick={() => setActiveTool('move')} className={`p-2 rounded-md transition-all flex flex-col items-center gap-1 ${activeTool === 'move' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}><Move size={18} /><span className="text-[10px]">Move</span></button>
             </div>
          </div>

          {/* Create */}
          <div className="p-3 border-b border-slate-700">
            <div className="text-[10px] text-slate-500 uppercase font-bold mb-2 tracking-wider px-1">Create</div>
            <div className="grid grid-cols-3 gap-2">
              {PRIMITIVES.map((prim) => (
                <button key={prim.type} onClick={() => addObject(prim.type)} className="aspect-square rounded-md bg-slate-700 hover:bg-slate-600 flex flex-col items-center justify-center gap-1 transition-colors group"><prim.icon size={18} className="text-slate-400 group-hover:text-white" /></button>
              ))}
            </div>
            <button onClick={handleImportClick} className="w-full mt-2 p-2 rounded-md bg-slate-700/50 border border-dashed border-slate-600 hover:border-indigo-500 text-xs text-slate-400">Import Model</button>
          </div>

          {/* Stats */}
          <div className="flex-1 p-3 flex flex-col">
            <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase font-bold mb-2 tracking-wider px-1">
               <div className="flex items-center gap-2"><History size={12} /> Log</div>
               <div className="flex items-center gap-1 text-green-400 animate-pulse"><Wifi size={10} /> {activeUserCount} Online</div>
            </div>
            <div className="flex-1 bg-slate-900/50 rounded-lg border border-slate-700/50 overflow-y-auto p-2 space-y-1">
              {historyLog.slice().reverse().map((entry, i) => (
                <div key={i} className="text-xs text-slate-400 truncate border-l-2 border-slate-700 pl-2">{entry}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative bg-black cursor-crosshair overflow-hidden">
        {/* Remote Cursors */}
        <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
            {Object.entries(remoteUsers).map(([uid, user]) => {
                if (Date.now() - user.lastUpdate > 5000) return null; // Hide stale cursors
                return (
                  <div key={uid} className="absolute transition-all duration-75 ease-linear flex flex-col items-start" style={{ left: `${user.x}%`, top: `${user.y}%` }}>
                    <svg width="18" height="24" viewBox="0 0 24 24" fill={user.color} stroke="white" strokeWidth="2" className="drop-shadow-md"><path d="M3 3L10 21L13 13L21 10L3 3Z" /></svg>
                    <div className="ml-4 -mt-2 text-[10px] font-bold px-1.5 py-0.5 rounded text-white shadow-sm whitespace-nowrap" style={{ backgroundColor: user.color }}>{user.name}</div>
                  </div>
                );
            })}
        </div>

        <ThreeScene 
          objects={objects} 
          selectedId={selectedId} 
          activeTool={activeTool}
          onSelect={setSelectedId}
          onUpdateObjectPosition={updateObjectPosition}
          onCursorMove={broadcastCursor}
        />
        
        <div className="absolute bottom-4 left-4 pointer-events-none opacity-60 bg-black/50 p-3 rounded-lg border border-white/10 text-xs text-slate-400">
           <p>Open this URL in a 2nd tab to test sync.</p>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-80 border-l border-slate-700 bg-slate-800 flex flex-col z-10 overflow-y-auto">
        <div className="p-4 border-b border-slate-700 font-bold text-slate-100 flex items-center gap-2"><Type size={18} /> Properties</div>
        {selectedObject ? (
          <div className="p-4 space-y-6">
            <TransformGroup icon={<Move size={16} />} label="Position" values={selectedObject.position} onChange={(axis, val) => updateTransform(selectedObject.id, 'position', axis, val)} />
            <TransformGroup icon={<RotateCw size={16} />} label="Rotation" values={selectedObject.rotation} onChange={(axis, val) => updateTransform(selectedObject.id, 'rotation', axis, val)} />
            <TransformGroup icon={<Maximize size={16} />} label="Scale" values={selectedObject.scale} onChange={(axis, val) => updateTransform(selectedObject.id, 'scale', axis, val)} />
            
            <div className="pt-4 border-t border-slate-700">
                <label className="text-xs text-slate-500 block mb-1">Color</label>
                <div className="flex gap-2">
                    <input type="color" value={selectedObject.color} onChange={(e) => updateObject(selectedObject.id, 'color', e.target.value)} className="h-8 w-8 rounded cursor-pointer border-0 p-0"/>
                    <input type="text" value={selectedObject.color} onChange={(e) => updateObject(selectedObject.id, 'color', e.target.value)} className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 text-sm text-slate-300 font-mono"/>
                </div>
            </div>
            <button onClick={() => deleteObject(selectedObject.id)} className="w-full mt-4 bg-red-500/10 text-red-400 py-2 rounded border border-red-500/20 text-sm">Delete Object</button>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500 opacity-50 text-sm">Select an object</div>
        )}
      </div>
    </div>
  );
}

const TransformGroup = ({ icon, label, values, onChange }) => (
  <div className="space-y-2">
    <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">{icon} {label}</div>
    <div className="grid grid-cols-3 gap-2">
      {['x', 'y', 'z'].map((axis, i) => (
        <div key={axis} className="relative"><div className="absolute left-2 top-1.5 text-[10px] font-bold text-slate-600 uppercase">{axis}</div><input type="number" step={0.1} value={values[i]} onChange={(e) => onChange(axis, e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded pl-6 pr-1 py-1 text-xs text-slate-300" /></div>
      ))}
    </div>
  </div>
);

const ThreeScene = ({ objects, selectedId, activeTool, onSelect, onUpdateObjectPosition, onCursorMove }) => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const meshesRef = useRef({});
  
  const dragPlane = useRef(new THREE.Plane());
  const dragOffset = useRef(new THREE.Vector3());
  const isDraggingObject = useRef(false);
  const cameraState = useRef({ radius: 10, theta: Math.PI/4, phi: Math.PI/3, target: new THREE.Vector3(0,0,0), isDragging: false, lastMouse: {x:0, y:0} });
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());

  // Init
  useEffect(() => {
    if (!mountRef.current) return;
    const observer = new ResizeObserver(entries => {
        if (rendererRef.current && cameraRef.current) {
            const { width, height } = entries[0].contentRect;
            if(width > 0) {
                cameraRef.current.aspect = width / height;
                cameraRef.current.updateProjectionMatrix();
                rendererRef.current.setSize(width, height);
            }
        }
    });
    observer.observe(mountRef.current);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0f172a');
    scene.fog = new THREE.FogExp2('#0f172a', 0.03);
    sceneRef.current = scene;

    const grid = new THREE.GridHelper(30, 30, '#334155', '#1e293b'); scene.add(grid);
    const axes = new THREE.AxesHelper(2); scene.add(axes);
    const amb = new THREE.AmbientLight(0xffffff, 0.5); scene.add(amb);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8); dir.position.set(5, 10, 7); scene.add(dir);

    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const animate = () => {
      if (!scene) return;
      const { radius, theta, phi, target } = cameraState.current;
      camera.position.set(
          target.x + radius * Math.sin(phi) * Math.cos(theta),
          target.y + radius * Math.cos(phi),
          target.z + radius * Math.sin(phi) * Math.sin(theta)
      );
      camera.lookAt(target);
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    return () => {
        observer.disconnect();
        renderer.dispose();
        if(mountRef.current) mountRef.current.innerHTML = '';
    };
  }, []);

  // Sync Objects
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    const safeObjs = Array.isArray(objects) ? objects : [];
    const currentIds = new Set(safeObjs.map(o => o.id));

    safeObjs.forEach(obj => {
      let mesh = meshesRef.current[obj.id];
      if (!mesh) {
        if (obj.type === 'model') {
            mesh = new THREE.Group();
            const load = (l) => l.load(obj.url, (g) => {
                const m = g.scene || g;
                const box = new THREE.Box3().setFromObject(m);
                const max = Math.max(...box.getSize(new THREE.Vector3()).toArray());
                if(max > 2) m.scale.setScalar(2/max);
                mesh.add(m);
            });
            if(obj.format === 'glb' || obj.format === 'gltf') load(new GLTFLoader());
            else if(obj.format === 'obj') load(new OBJLoader());
            else if(obj.format === 'stl') new STLLoader().load(obj.url, (geo) => {
                const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({color:0xcccccc}));
                geo.computeBoundingBox();
                const max = Math.max(...geo.boundingBox.getSize(new THREE.Vector3()).toArray());
                if(max>2) m.scale.setScalar(2/max);
                mesh.add(m);
            });
        } else {
            let geo;
            if(obj.type==='cube') geo = new THREE.BoxGeometry(1,1,1);
            else if(obj.type==='sphere') geo = new THREE.SphereGeometry(0.6,32,32);
            else if(obj.type==='cone') geo = new THREE.ConeGeometry(0.5,1,32);
            else if(obj.type==='torus') geo = new THREE.TorusGeometry(0.5,0.2,16,100);
            else geo = new THREE.IcosahedronGeometry(0.6,0);
            mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.2 }));
        }
        mesh.userData = { id: obj.id };
        scene.add(mesh);
        meshesRef.current[obj.id] = mesh;
      }

      if(!isDraggingObject.current || selectedId !== obj.id) {
          const pos = obj.position || [0,0,0];
          mesh.position.set(pos[0], pos[1], pos[2]);
      }
      const rot = obj.rotation || [0,0,0];
      mesh.rotation.set(rot[0], rot[1], rot[2]);
      const sc = obj.scale || [1,1,1];
      mesh.scale.set(sc[0], sc[1], sc[2]);

      const col = new THREE.Color(obj.color);
      mesh.traverse(c => {
          if(c.isMesh) {
              if(obj.type !== 'model') c.material.color.set(col);
              else c.material.color.lerp(col, 0.5);
              c.material.wireframe = !!obj.wireframe;
              c.material.emissive.setHex(selectedId === obj.id ? 0x444444 : 0x000000);
          }
      });
    });

    Object.keys(meshesRef.current).forEach(id => {
        if(!currentIds.has(id)) {
            scene.remove(meshesRef.current[id]);
            delete meshesRef.current[id];
        }
    });
  }, [objects, selectedId]);

  // Inputs
  useEffect(() => {
      const cvs = mountRef.current;
      if(!cvs) return;

      const getMouse = (e) => {
          const r = cvs.getBoundingClientRect();
          return { x: ((e.clientX - r.left)/r.width)*2-1, y: -((e.clientY - r.top)/r.height)*2+1 };
      };

      const onDown = (e) => {
          e.preventDefault();
          const m = getMouse(e);
          mouse.current.set(m.x, m.y);
          raycaster.current.setFromCamera(mouse.current, cameraRef.current);
          const isect = raycaster.current.intersectObjects(Object.values(meshesRef.current), true);
          
          if(isect.length > 0) {
              let t = isect[0].object;
              while(t && !t.userData.id) t = t.parent;
              if(t) {
                  onSelect(t.userData.id);
                  if(activeTool === 'move') {
                      isDraggingObject.current = true;
                      const n = new THREE.Vector3();
                      cameraRef.current.getWorldDirection(n).negate();
                      dragPlane.current.setFromNormalAndCoplanarPoint(n, isect[0].point);
                      dragOffset.current.copy(meshesRef.current[t.userData.id].position).sub(isect[0].point);
                      cameraState.current.isDragging = false;
                      return;
                  }
              }
          } else {
              onSelect(null);
          }
          cameraState.current.isDragging = true;
          cameraState.current.lastMouse = {x: e.clientX, y: e.clientY};
      };

      const onMove = (e) => {
          const r = cvs.getBoundingClientRect();
          const xPct = ((e.clientX - r.left)/r.width)*100;
          const yPct = ((e.clientY - r.top)/r.height)*100;
          if(xPct >=0 && xPct<=100 && yPct>=0 && yPct<=100) onCursorMove(xPct, yPct);

          if(isDraggingObject.current && selectedId) {
              const m = getMouse(e);
              mouse.current.set(m.x, m.y);
              raycaster.current.setFromCamera(mouse.current, cameraRef.current);
              const t = new THREE.Vector3();
              if(raycaster.current.ray.intersectPlane(dragPlane.current, t)) {
                  const np = t.add(dragOffset.current);
                  const mesh = meshesRef.current[selectedId];
                  if(mesh) mesh.position.copy(np);
              }
              return;
          }

          if(cameraState.current.isDragging) {
              const dx = e.clientX - cameraState.current.lastMouse.x;
              const dy = e.clientY - cameraState.current.lastMouse.y;
              cameraState.current.theta -= dx * 0.005;
              cameraState.current.phi = Math.max(0.1, Math.min(Math.PI-0.1, cameraState.current.phi - dy * 0.005));
              cameraState.current.lastMouse = {x: e.clientX, y: e.clientY};
          }
      };

      const onUp = () => {
          if(isDraggingObject.current && selectedId) {
              const m = meshesRef.current[selectedId];
              if(m) onUpdateObjectPosition(selectedId, [m.position.x, m.position.y, m.position.z]);
          }
          isDraggingObject.current = false;
          cameraState.current.isDragging = false;
      };

      const onWheel = (e) => {
          e.preventDefault();
          cameraState.current.radius = Math.max(2, Math.min(50, cameraState.current.radius + e.deltaY * 0.01));
      };

      cvs.addEventListener('mousedown', onDown);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      cvs.addEventListener('wheel', onWheel, {passive:false});
      return () => {
          cvs.removeEventListener('mousedown', onDown);
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
          cvs.removeEventListener('wheel', onWheel);
      };
  }, [activeTool, selectedId, onSelect, onUpdateObjectPosition, onCursorMove]);

  return <div ref={mountRef} className="w-full h-full cursor-crosshair" />;
};