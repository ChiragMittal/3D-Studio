import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Type, 
  MousePointer2,
  Upload,
  Download,
  History,
  List,
  Cylinder,
  Hexagon,
  Diamond,
  Pentagon
} from 'lucide-react';

// --- Constants & Helpers ---
const PRIMITIVES = [
  { type: 'cube', label: 'Cube', icon: Box },
  { type: 'sphere', label: 'Sphere', icon: Circle },
  { type: 'cylinder', label: 'Cylinder', icon: Cylinder },
  { type: 'cone', label: 'Cone', icon: Triangle },
  { type: 'torus', label: 'Torus', icon: Layers }, 
  { type: 'icosahedron', label: 'Ico', icon: Hexagon },
  { type: 'dodecahedron', label: 'Dodeca', icon: Pentagon },
  { type: 'octahedron', label: 'Octa', icon: Diamond },
  { type: 'tetrahedron', label: 'Tetra', icon: Triangle },
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

/**
 * Main application component for the 3D editor.
 */
export default function App() {
  // --- Scene State ---
  const [objects, setObjects] = useState(INITIAL_OBJECTS);
  
  // History now stores full state snapshots: { id, label, snapshot: [] }
  const [historyLog, setHistoryLog] = useState([]); 
  
  const [selectedId, setSelectedId] = useState(null);
  const [activeTool, setActiveTool] = useState('select'); 
  
  const fileInputRef = useRef(null);
  const historyEndRef = useRef(null);

  // Function to update the scene state and log the action
  const updateState = useCallback((newObjects, actionLabel) => {
      setObjects(newObjects);
      setHistoryLog(prev => {
          const newEntry = {
              id: generateId(),
              label: actionLabel,
              snapshot: JSON.parse(JSON.stringify(newObjects)), // Deep copy state
              timestamp: new Date().toLocaleTimeString()
          };
          return [...prev, newEntry].slice(-20); // Keep last 20
      });
  }, []);

  // --- Actions ---
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
    updateState([...objects, newObj], `Add ${type}`);
    setSelectedId(newObj.id);
    setActiveTool('move'); 
  };

  const restoreState = (snapshot) => {
      // Restore objects from history snapshot
      setObjects(snapshot);
      setSelectedId(null); // Deselect to avoid issues if selected object doesn't exist in snapshot
  };
  
  const onSelect = useCallback((id) => {
      setSelectedId(id);
  }, []);

  const updateTransform = (id, type, axis, value) => {
    const newObjects = objects.map(obj => {
      if (obj.id !== id) return obj;
      const newTransform = [...obj[type]];
      const idx = axis === 'x' ? 0 : axis === 'y' ? 1 : axis === 'z' ? 2 : 0; 
      newTransform[idx] = parseFloat(value) || 0;
      return { ...obj, [type]: newTransform };
    });
    updateState(newObjects, `Set ${axis.toUpperCase()} ${type} of ${id}`);
  };

  const updateObject = (id, field, value) => {
    const newObjects = objects.map(obj => obj.id === id ? { ...obj, [field]: value } : obj);
    updateState(newObjects, `Update ${field} of ${id}`);
  };
  
  const onUpdateObjectPosition = useCallback((id, newPos) => {
    const newObjects = objects.map(obj => obj.id === id ? { ...obj, position: newPos } : obj);
    updateState(newObjects, `Move Object ${id}`);
  }, [objects, updateState]);

  const deleteObject = (id) => {
    const newObjects = objects.filter(o => o.id !== id);
    updateState(newObjects, `Delete Object ${id}`);
    if (selectedId === id) setSelectedId(null);
  };
  
  // Keyboard deletion
  useEffect(() => {
    const handleKeyDown = (e) => {
        const isInputFocused = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
        if (!isInputFocused && (e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
            e.preventDefault(); 
            deleteObject(selectedId);
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, objects]);

  // Scroll to bottom of log
  useEffect(() => {
    if (historyEndRef.current) {
        historyEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [historyLog]);

  // --- Import / Export Logic ---

  const handleImportClick = () => fileInputRef.current?.click();
  
  const handleExportClick = () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(objects));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", "scene.json");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
  };

  const handleFileUpload = (e) => {
      const file = e.target.files[0];
      if(!file) return;
      
      const name = file.name.toLowerCase();

      const addModel = (url, format) => {
          const newObj = {
              id: generateId(), 
              type: 'model', 
              format: format, 
              url: url, 
              name: file.name,
              position: [0,0,0], rotation: [0,0,0], scale: [1,1,1], color: '#ffffff', wireframe: false
          };
          updateState([...objects, newObj], `Import ${file.name}`);
          setSelectedId(newObj.id);
      };

      if (name.endsWith('.json')) {
          const reader = new FileReader();
          reader.onload = (evt) => {
              try {
                  const json = JSON.parse(evt.target.result);
                  if (Array.isArray(json)) {
                      updateState(json, `Load Scene ${file.name}`);
                  } else {
                      const url = URL.createObjectURL(file);
                      addModel(url, 'json');
                  }
              } catch (err) {
                  console.error("Invalid JSON", err);
              }
          };
          reader.readAsText(file);
      } else {
          const url = URL.createObjectURL(file);
          const format = name.split('.').pop();
          addModel(url, format);
      }
      
      e.target.value = null; 
  };

  const selectedObject = objects.find(o => o.id === selectedId);

  const getObjectIcon = (type) => {
      const prim = PRIMITIVES.find(p => p.type === type);
      if (prim) return <prim.icon size={14} />;
      if (type === 'model') return <Upload size={14} />;
      return <Box size={14} />;
  };

  return (
    <div className="flex h-screen w-full bg-slate-900 text-slate-100 overflow-hidden font-sans">
      <input type="file" ref={fileInputRef} className="hidden" accept=".glb,.gltf,.obj,.stl,.json" onChange={handleFileUpload} />

      {/* Left Sidebar */}
      <div className="w-64 border-r border-slate-700 bg-slate-800 flex flex-col z-10 shadow-xl">
        <div className="p-4 border-b border-slate-700 flex items-center bg-indigo-600/10">
          <div className="flex items-center gap-2">
            <Box size={20} className="text-indigo-400" />
            <span className="font-bold tracking-wider text-sm">3D EDITOR</span>
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
                <button key={prim.type} onClick={() => addObject(prim.type)} className="aspect-square rounded-md bg-slate-700 hover:bg-slate-600 flex flex-col items-center justify-center gap-1 transition-colors group" title={prim.label}>
                    <prim.icon size={18} className="text-slate-400 group-hover:text-white" />
                </button>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
                <button onClick={handleImportClick} className="p-2 rounded-md bg-slate-700/50 border border-dashed border-slate-600 hover:border-indigo-500 text-xs text-slate-400 flex flex-col items-center justify-center gap-1">
                    <Upload size={14} /> <span>Import</span>
                </button>
                <button onClick={handleExportClick} className="p-2 rounded-md bg-slate-700/50 border border-dashed border-slate-600 hover:border-indigo-500 text-xs text-slate-400 flex flex-col items-center justify-center gap-1">
                    <Download size={14} /> <span>Export</span>
                </button>
            </div>
          </div>

          {/* Scene Objects List */}
          <div className="flex-1 p-3 flex flex-col min-h-[150px]">
             <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase font-bold mb-2 tracking-wider px-1">
               <div className="flex items-center gap-2"><List size={12} /> Scene Objects</div>
             </div>
             <div className="flex-1 bg-slate-900/50 rounded-lg border border-slate-700/50 overflow-y-auto p-2 space-y-1">
                {objects.map((obj) => (
                    <button
                        key={obj.id}
                        onClick={() => {
                            setSelectedId(obj.id);
                            setActiveTool('move');
                        }}
                        className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2 transition-colors ${
                            selectedId === obj.id 
                                ? 'bg-indigo-600 text-white' 
                                : 'text-slate-400 hover:bg-slate-800'
                        }`}
                    >
                        {getObjectIcon(obj.type)}
                        <span className="truncate">{obj.name || `${obj.type} ${obj.id.substring(0,4)}`}</span>
                    </button>
                ))}
                {objects.length === 0 && <div className="text-xs text-slate-600 italic p-1">Empty Scene</div>}
             </div>
          </div>

          {/* Action Log */}
          <div className="p-3 border-t border-slate-700 max-h-[150px] flex flex-col">
            <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase font-bold mb-2 tracking-wider px-1">
               <History size={12} /> History (Click to Restore)
            </div>
            <div className="flex-1 bg-slate-900/50 rounded-lg border border-slate-700/50 overflow-y-auto p-2 space-y-1">
              {historyLog.map((entry) => (
                <button 
                    key={entry.id} 
                    onClick={() => restoreState(entry.snapshot)}
                    className="w-full text-left text-xs text-slate-400 hover:bg-slate-800 hover:text-white truncate border-l-2 border-slate-700 pl-2 py-1 rounded transition-colors"
                    title={`Restore state from ${entry.timestamp}`}
                >
                    {entry.label}
                </button>
              ))}
              <div ref={historyEndRef} />
            </div>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative bg-black cursor-crosshair overflow-hidden">
        <ThreeScene 
          objects={objects} 
          selectedId={selectedId} 
          activeTool={activeTool}
          onSelect={onSelect}
          onUpdateObjectPosition={onUpdateObjectPosition}
        />
      </div>

      {/* Right Sidebar */}
      <div className="w-80 border-l border-slate-700 bg-slate-800 flex flex-col z-10 overflow-y-auto">
        <div className="p-4 border-b border-slate-700 font-bold text-slate-100 flex items-center gap-2"><Type size={18} /> Properties</div>
        {selectedObject ? (
          <div className="p-4 space-y-6">
            <h2 className="text-lg font-semibold text-white truncate mb-4">Editing: {selectedObject.name || selectedObject.type}</h2>
            
            <TransformGroup icon={<Move size={16} />} label="Position" values={selectedObject.position} onChange={(axis, val) => updateTransform(selectedObject.id, 'position', axis, val)} />
            <TransformGroup icon={<RotateCw size={16} />} label="Rotation (rad)" values={selectedObject.rotation} onChange={(axis, val) => updateTransform(selectedObject.id, 'rotation', axis, val)} />
            <TransformGroup icon={<Maximize size={16} />} label="Scale" values={selectedObject.scale} onChange={(axis, val) => updateTransform(selectedObject.id, 'scale', axis, val)} />
            
            <div className="pt-4 border-t border-slate-700">
                <label className="text-xs text-slate-500 block mb-1">Color</label>
                <div className="flex gap-2">
                    <input type="color" value={selectedObject.color} onChange={(e) => updateObject(selectedObject.id, 'color', e.target.value)} className="h-8 w-8 rounded cursor-pointer border-0 p-0"/>
                    <input type="text" value={selectedObject.color} onChange={(e) => updateObject(selectedObject.id, 'color', e.target.value)} className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 text-sm text-slate-300 font-mono"/>
                </div>
            </div>
            
            <div className="pt-4 border-t border-slate-700">
                <label className="flex items-center space-x-2 text-sm text-slate-300">
                    <input type="checkbox" checked={selectedObject.wireframe} onChange={(e) => updateObject(selectedObject.id, 'wireframe', e.target.checked)} className="form-checkbox h-4 w-4 text-indigo-600 bg-slate-700 border-slate-600 rounded"/>
                    <span>Wireframe Mode</span>
                </label>
            </div>
            
            <button onClick={() => deleteObject(selectedObject.id)} className="w-full mt-4 bg-red-500/10 text-red-400 py-2 rounded border border-red-500/20 text-sm flex items-center justify-center gap-2 hover:bg-red-500/20 transition-colors"><Trash2 size={16} /> Delete Object</button>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500 opacity-50 text-sm">Select an object or create a primitive to begin editing.</div>
        )}
      </div>
    </div>
  );
}

// --- Helper UI Component ---
const TransformGroup = ({ icon, label, values, onChange }) => (
  <div className="space-y-2">
    <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">{icon} {label}</div>
    <div className="grid grid-cols-3 gap-2">
      {['x', 'y', 'z'].map((axis, i) => (
        <div key={axis} className="relative group">
          <div className="absolute left-2 top-1.5 text-[10px] font-bold text-slate-600 uppercase pointer-events-none group-focus-within:text-indigo-500 transition-colors">
            {axis}
          </div>
          <input
            type="number"
            step={0.1}
            value={values[i]}
            onChange={(e) => onChange(axis, e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded pl-6 pr-1 py-1.5 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
          />
        </div>
      ))}
    </div>
  </div>
);

// --- Three.js Engine Wrapper ---
const ThreeScene = ({ objects, selectedId, activeTool, onSelect, onUpdateObjectPosition }) => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const meshesRef = useRef({});
  const frameIdRef = useRef(null);
  
  // Dragging State
  const dragPlane = useRef(new THREE.Plane());
  const dragOffset = useRef(new THREE.Vector3());
  const isDraggingObject = useRef(false);

  // Camera state
  const cameraState = useRef({
    radius: 10,
    theta: Math.PI / 4, 
    phi: Math.PI / 3,   
    target: new THREE.Vector3(0, 0, 0),
    isDragging: false,
    lastMouse: { x: 0, y: 0 }
  });

  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());

  // 1. Initialize Scene
  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0f172a');
    scene.fog = new THREE.FogExp2('#0f172a', 0.03);
    sceneRef.current = scene;

    // Grid & Helpers
    const gridHelper = new THREE.GridHelper(30, 30, '#334155', '#1e293b');
    scene.add(gridHelper);
    const axesHelper = new THREE.AxesHelper(2);
    scene.add(axesHelper);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 7);
    dirLight.castShadow = true;
    scene.add(dirLight);
    
    const backLight = new THREE.DirectionalLight(0x6366f1, 0.3);
    backLight.position.set(-5, 2, -5);
    scene.add(backLight);

    // Camera
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Animation Loop
    const animate = () => {
      if (!sceneRef.current || !cameraRef.current || !rendererRef.current) return;

      const { radius, theta, phi, target } = cameraState.current;
      const x = target.x + radius * Math.sin(phi) * Math.cos(theta);
      const y = target.y + radius * Math.cos(phi);
      const z = target.z + radius * Math.sin(phi) * Math.sin(theta);
      camera.position.set(x, y, z);
      camera.lookAt(target);
      
      renderer.render(scene, camera);
      frameIdRef.current = requestAnimationFrame(animate);
    };
    
    animate();

    return () => {
      cancelAnimationFrame(frameIdRef.current);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      meshesRef.current = {};
    };
  }, []);

  // 2. Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 3. Sync Objects (React State -> Three.js Scene)
  useEffect(() => {
    if (!sceneRef.current) return;

    const scene = sceneRef.current;
    const meshes = meshesRef.current;
    
    const currentIds = new Set(objects.map(o => o.id));

    // Update or Create
    objects.forEach(obj => {
      let mesh = meshes[obj.id];

      // Create if doesn't exist
      if (!mesh) {
        if (obj.type === 'model') {
          // Initialize an empty group for async loading
          mesh = new THREE.Group();
          
          // Load Logic
          const ext = obj.format ? obj.format.toLowerCase() : '';
          
          if (ext === 'glb' || ext === 'gltf') {
            const loader = new GLTFLoader();
            loader.load(obj.url, (gltf) => {
              const model = gltf.scene;
              // Normalize scale roughly
              const box = new THREE.Box3().setFromObject(model);
              const size = box.getSize(new THREE.Vector3());
              const maxDim = Math.max(size.x, size.y, size.z);
              if (maxDim > 2) {
                const scale = 2 / maxDim;
                model.scale.set(scale, scale, scale);
              }
              mesh.add(model);
            });
          } else if (ext === 'obj') {
            const loader = new OBJLoader();
            loader.load(obj.url, (objGroup) => {
              // Basic material for obj if none provided
              objGroup.traverse((child) => {
                 if (child.isMesh) {
                   child.material = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.5, metalness: 0.5 });
                 }
              });
              // Normalize
              const box = new THREE.Box3().setFromObject(objGroup);
              const size = box.getSize(new THREE.Vector3());
              const maxDim = Math.max(size.x, size.y, size.z);
              if (maxDim > 2) {
                const scale = 2 / maxDim;
                objGroup.scale.set(scale, scale, scale);
              }
              mesh.add(objGroup);
            });
          } else if (ext === 'json') {
             // JSON Loader for Three.js Objects
             fetch(obj.url)
                .then(res => res.json())
                .then(data => {
                    const loader = new THREE.ObjectLoader();
                    const m = loader.parse(data);
                    
                    const box = new THREE.Box3().setFromObject(m);
                    const size = box.getSize(new THREE.Vector3());
                    const maxDim = Math.max(size.x, size.y, size.z);
                    if (maxDim > 2) {
                        const scale = 2 / maxDim;
                        m.scale.set(scale, scale, scale);
                    }
                    mesh.add(m);
                })
                .catch(e => console.error("Failed to load JSON model", e));
          } else if (ext === 'stl') {
            const loader = new STLLoader();
            loader.load(obj.url, (geometry) => {
              const material = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.5, metalness: 0.5 });
              const stlMesh = new THREE.Mesh(geometry, material);
              // Normalize
              geometry.computeBoundingBox();
              const size = new THREE.Vector3();
              geometry.boundingBox.getSize(size);
              const maxDim = Math.max(size.x, size.y, size.z);
              if (maxDim > 2) {
                 const scale = 2 / maxDim;
                 stlMesh.scale.set(scale, scale, scale);
              }
              // Center geometry
              geometry.center();
              mesh.add(stlMesh);
            });
          }
          
        } else {
          // Standard Primitives
          let geometry;
          switch(obj.type) {
            case 'cube': geometry = new THREE.BoxGeometry(1, 1, 1); break;
            case 'sphere': geometry = new THREE.SphereGeometry(0.6, 32, 32); break;
            case 'cylinder': geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32); break;
            case 'cone': geometry = new THREE.ConeGeometry(0.5, 1, 32); break;
            case 'torus': geometry = new THREE.TorusGeometry(0.5, 0.2, 16, 100); break;
            case 'icosahedron': geometry = new THREE.IcosahedronGeometry(0.6, 0); break;
            case 'dodecahedron': geometry = new THREE.DodecahedronGeometry(0.6, 0); break;
            case 'octahedron': geometry = new THREE.OctahedronGeometry(0.6, 0); break;
            case 'tetrahedron': geometry = new THREE.TetrahedronGeometry(0.6, 0); break;
            default: geometry = new THREE.BoxGeometry(1, 1, 1);
          }
          
          const material = new THREE.MeshStandardMaterial({ 
            color: obj.color,
            roughness: 0.3,
            metalness: 0.2,
          });
          
          mesh = new THREE.Mesh(geometry, material);
        }
        
        mesh.userData = { id: obj.id };
        scene.add(mesh);
        meshes[obj.id] = mesh;
      }

      // Update Transforms
      if (!isDraggingObject.current || selectedId !== obj.id) {
          mesh.position.set(...obj.position);
      }
      mesh.rotation.set(...obj.rotation);
      mesh.scale.set(...obj.scale);

      // Update Material Props
      const targetColor = new THREE.Color(obj.color);
      mesh.traverse((child) => {
         if (child.isMesh) {
             if (obj.type !== 'model' || obj.color !== '#ffffff') {
                child.material.color.lerp(targetColor, 0.1);
             }
             if (obj.type !== 'model') {
               child.material.color.set(obj.color);
             }
             
             child.material.wireframe = obj.wireframe;
             
             if (obj.id === selectedId) {
               child.material.emissive.setHex(0x444444);
             } else {
               child.material.emissive.setHex(0x000000);
             }
         }
      });

    });

    // Remove deleted objects
    Object.keys(meshes).forEach(id => {
      if (!currentIds.has(id)) {
        scene.remove(meshes[id]);
        // Dispose logic
        meshes[id].traverse((child) => {
            if (child.isMesh) {
                child.geometry.dispose();
                if (child.material.map) child.material.map.dispose();
                child.material.dispose();
            }
        });
        delete meshes[id];
      }
    });

  }, [objects, selectedId]);

  // 4. Input Handling
  useEffect(() => {
    const canvas = mountRef.current;
    if (!canvas) return;

    const onMouseDown = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      // Raycast
      raycaster.current.setFromCamera(mouse.current, cameraRef.current);
      const meshArray = Object.values(meshesRef.current);
      const intersects = raycaster.current.intersectObjects(meshArray, true); 

      if (intersects.length > 0) {
        let target = intersects[0].object;
        while (target && !target.userData.id) {
            target = target.parent;
        }
        
        if (target && target.userData.id) {
            const id = target.userData.id;
            onSelect(id);

            if (activeTool === 'move') {
                isDraggingObject.current = true;
                const normal = new THREE.Vector3();
                cameraRef.current.getWorldDirection(normal).negate();
                dragPlane.current.setFromNormalAndCoplanarPoint(normal, intersects[0].point);
                
                const objPos = meshesRef.current[id].position;
                dragOffset.current.copy(objPos).sub(intersects[0].point);
                
                cameraState.current.isDragging = false;
                return;
            }
        }
      } else {
        onSelect(null);
      }

      cameraState.current.isDragging = true;
      cameraState.current.lastMouse = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const currentMouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const currentMouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (isDraggingObject.current && selectedId && activeTool === 'move') {
        mouse.current.x = currentMouseX;
        mouse.current.y = currentMouseY;
        
        raycaster.current.setFromCamera(mouse.current, cameraRef.current);
        const intersect = new THREE.Vector3();
        
        if (raycaster.current.ray.intersectPlane(dragPlane.current, intersect)) {
            const newPos = intersect.add(dragOffset.current);
            const mesh = meshesRef.current[selectedId];
            if (mesh) {
                mesh.position.copy(newPos);
            }
        }
      } else if (cameraState.current.isDragging) {
        const dx = e.clientX - cameraState.current.lastMouse.x;
        const dy = e.clientY - cameraState.current.lastMouse.y;
        
        cameraState.current.theta -= dx * 0.005;
        cameraState.current.phi -= dy * 0.005;
        cameraState.current.phi = Math.max(0.1, Math.min(Math.PI - 0.1, cameraState.current.phi));
        
        cameraState.current.lastMouse = { x: e.clientX, y: e.clientY };
      }
    };

    const onMouseUp = () => {
      if (isDraggingObject.current && selectedId && activeTool === 'move') {
        const mesh = meshesRef.current[selectedId];
        if (mesh) {
          onUpdateObjectPosition(selectedId, [mesh.position.x, mesh.position.y, mesh.position.z]);
        }
      }
      isDraggingObject.current = false;
      cameraState.current.isDragging = false;
    };

    const onWheel = (e) => {
      e.preventDefault();
      cameraState.current.radius += e.deltaY * 0.01;
      cameraState.current.radius = Math.max(2, Math.min(50, cameraState.current.radius));
    };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [activeTool, selectedId, onSelect, onUpdateObjectPosition]);

  return <div ref={mountRef} className="w-full h-full cursor-crosshair" />;
};