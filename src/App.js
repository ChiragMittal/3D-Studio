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
  Pentagon,
  Star,
  Heart,
  Square
} from 'lucide-react';

// --- Constants & Helpers ---
const PRIMITIVES = [
  // Standard 3D
  { type: 'cube', label: 'Cube', icon: Box, category: 'basic' },
  { type: 'sphere', label: 'Sphere', icon: Circle, category: 'basic' },
  { type: 'cylinder', label: 'Cylinder', icon: Cylinder, category: 'basic' },
  { type: 'cone', label: 'Cone', icon: Triangle, category: 'basic' },
  { type: 'torus', label: 'Torus', icon: Layers, category: 'basic' },
  
  // Polyhedrons
  { type: 'icosahedron', label: 'Ico', icon: Hexagon, category: 'poly' },
  { type: 'dodecahedron', label: 'Dodeca', icon: Pentagon, category: 'poly' },
  { type: 'octahedron', label: 'Octa', icon: Diamond, category: 'poly' },
  { type: 'tetrahedron', label: 'Tetra', icon: Triangle, category: 'poly' },

  // Extrudable Shapes
  { type: 'ex_rect', label: 'Ex. Rect', icon: Square, category: 'extrude' },
  { type: 'ex_circle', label: 'Ex. Circle', icon: Circle, category: 'extrude' },
  { type: 'ex_tri', label: 'Ex. Tri', icon: Triangle, category: 'extrude' },
  { type: 'ex_hex', label: 'Ex. Hex', icon: Hexagon, category: 'extrude' },
  { type: 'ex_star', label: 'Ex. Star', icon: Star, category: 'extrude' },
  { type: 'ex_heart', label: 'Ex. Heart', icon: Heart, category: 'extrude' },
];

const INITIAL_OBJECTS = [
  { id: '1', type: 'cube', position: [-2, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], color: '#6366f1', wireframe: false },
  { id: '2', type: 'ex_star', position: [2, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], color: '#ec4899', wireframe: false, 
    extrudeSettings: { depth: 0.5, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 3 } },
];

const generateId = () => Math.random().toString(36).substr(2, 9);
const getRandomColor = () => {
  const colors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e'];
  return colors[Math.floor(Math.random() * colors.length)];
};

export default function App() {
  const [objects, setObjects] = useState(INITIAL_OBJECTS);
  const [historyLog, setHistoryLog] = useState([]); 
  const [selectedId, setSelectedId] = useState(null);
  const [activeTool, setActiveTool] = useState('select'); 
  
  const fileInputRef = useRef(null);
  const historyEndRef = useRef(null);

  const updateState = useCallback((newObjects, actionLabel) => {
      setObjects(newObjects);
      setHistoryLog(prev => {
          const newEntry = {
              id: generateId(),
              label: actionLabel,
              snapshot: JSON.parse(JSON.stringify(newObjects)), 
              timestamp: new Date().toLocaleTimeString()
          };
          return [...prev, newEntry].slice(-20); 
      });
  }, []);

  const addObject = (type) => {
    const isExtrudable = type.startsWith('ex_');
    const newObj = {
      id: generateId(),
      type,
      position: [Math.random() * 2 - 1, Math.random() * 2 - 1, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: getRandomColor(), 
      wireframe: false,
      extrudeSettings: isExtrudable ? {
          depth: 0.5,
          bevelEnabled: true,
          bevelThickness: 0.1,
          bevelSize: 0.1,
          bevelSegments: 3
      } : undefined
    };
    updateState([...objects, newObj], `Add ${type}`);
    setSelectedId(newObj.id);
    setActiveTool('move'); 
  };

  const restoreState = (snapshot) => {
      setObjects(snapshot);
      setSelectedId(null); 
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
  
  const updateExtrudeSetting = (id, setting, value) => {
      const newObjects = objects.map(obj => {
          if (obj.id !== id) return obj;
          return {
              ...obj,
              extrudeSettings: {
                  ...obj.extrudeSettings,
                  [setting]: setting === 'bevelEnabled' ? value : parseFloat(value)
              }
          };
      });
      updateState(newObjects, `Update ${setting}`);
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

  useEffect(() => {
    if (historyEndRef.current) {
        historyEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [historyLog]);

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
              } catch (err) { console.error("Invalid JSON", err); }
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
            
            {/* Primitives */}
            <div className="mb-2 text-[9px] text-slate-600 font-bold uppercase">Basic</div>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {PRIMITIVES.filter(p => p.category !== 'extrude').map((prim) => (
                <button key={prim.type} onClick={() => addObject(prim.type)} className="aspect-square rounded-md bg-slate-700 hover:bg-slate-600 flex flex-col items-center justify-center gap-1 transition-colors group" title={prim.label}>
                    <prim.icon size={16} className="text-slate-400 group-hover:text-white" />
                </button>
              ))}
            </div>
            
            {/* Extrudables */}
            <div className="mb-2 text-[9px] text-slate-600 font-bold uppercase">Extrudable</div>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {PRIMITIVES.filter(p => p.category === 'extrude').map((prim) => (
                <button key={prim.type} onClick={() => addObject(prim.type)} className="aspect-square rounded-md bg-slate-700 hover:bg-slate-600 flex flex-col items-center justify-center gap-1 transition-colors group" title={prim.label}>
                    <prim.icon size={16} className="text-slate-400 group-hover:text-white" />
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
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
            
            {/* Extrusion & Bevel Controls */}
            {selectedObject.extrudeSettings && (
                 <div className="pt-4 border-t border-slate-700 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                        <Star size={16} /> Extrusion & Bevel
                    </div>
                    <div>
                        <label className="text-xs text-slate-500 block mb-1">Depth ({selectedObject.extrudeSettings.depth})</label>
                        <input type="range" min="0.1" max="5" step="0.1" value={selectedObject.extrudeSettings.depth} onChange={(e) => updateExtrudeSetting(selectedObject.id, 'depth', e.target.value)} className="w-full accent-indigo-500"/>
                    </div>
                    
                    <div className="flex items-center justify-between pt-1">
                        <label className="text-xs text-slate-500">Bevel Enabled</label>
                        <input type="checkbox" checked={selectedObject.extrudeSettings.bevelEnabled} onChange={(e) => updateExtrudeSetting(selectedObject.id, 'bevelEnabled', e.target.checked)} className="form-checkbox h-4 w-4 text-indigo-600 bg-slate-700 border-slate-600 rounded"/>
                    </div>

                    {selectedObject.extrudeSettings.bevelEnabled && (
                        <>
                            <div>
                                <label className="text-xs text-slate-500 block mb-1">Bevel Thickness ({selectedObject.extrudeSettings.bevelThickness})</label>
                                <input type="range" min="0" max="1" step="0.05" value={selectedObject.extrudeSettings.bevelThickness} onChange={(e) => updateExtrudeSetting(selectedObject.id, 'bevelThickness', e.target.value)} className="w-full accent-indigo-500"/>
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 block mb-1">Bevel Size ({selectedObject.extrudeSettings.bevelSize})</label>
                                <input type="range" min="0" max="1" step="0.05" value={selectedObject.extrudeSettings.bevelSize} onChange={(e) => updateExtrudeSetting(selectedObject.id, 'bevelSize', e.target.value)} className="w-full accent-indigo-500"/>
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 block mb-1">Bevel Segments ({selectedObject.extrudeSettings.bevelSegments})</label>
                                <input type="range" min="1" max="10" step="1" value={selectedObject.extrudeSettings.bevelSegments} onChange={(e) => updateExtrudeSetting(selectedObject.id, 'bevelSegments', e.target.value)} className="w-full accent-indigo-500"/>
                            </div>
                        </>
                    )}
                 </div>
            )}

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
          <div className="p-8 text-center text-slate-500 opacity-50 text-sm">Select an object from the list or viewport to edit.</div>
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

const ThreeScene = ({ objects, selectedId, activeTool, onSelect, onUpdateObjectPosition }) => {
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
    const backLight = new THREE.DirectionalLight(0x6366f1, 0.3); backLight.position.set(-5, 2, -5); scene.add(backLight);

    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const animate = () => {
      if (!sceneRef.current || !cameraRef.current || !rendererRef.current) return;
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
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      meshesRef.current = {};
    };
  }, []);

  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    const currentIds = new Set(objects.map(o => o.id));

    objects.forEach(obj => {
      let mesh = meshesRef.current[obj.id];
      
      // Check if extrusion settings updated
      const needsRebuild = mesh && obj.extrudeSettings && (
          mesh.userData.depth !== obj.extrudeSettings.depth ||
          mesh.userData.bevelThickness !== obj.extrudeSettings.bevelThickness ||
          mesh.userData.bevelSize !== obj.extrudeSettings.bevelSize ||
          mesh.userData.bevelEnabled !== obj.extrudeSettings.bevelEnabled ||
          mesh.userData.bevelSegments !== obj.extrudeSettings.bevelSegments
      );

      if (needsRebuild) {
          scene.remove(mesh);
          if(mesh.geometry) mesh.geometry.dispose();
          delete meshesRef.current[obj.id];
          mesh = null;
      }

      if (!mesh) {
        if (obj.type === 'model') {
          mesh = new THREE.Group();
          const load = (loader, url) => {
            loader.load(url, (g) => {
                const m = g.scene || g; 
                const box = new THREE.Box3().setFromObject(m);
                const max = Math.max(...box.getSize(new THREE.Vector3()).toArray());
                if(max > 2) m.scale.setScalar(2/max);
                mesh.add(m);
            });
          };
          if (obj.format === 'glb' || obj.format === 'gltf') load(new GLTFLoader(), obj.url);
          else if (obj.format === 'obj') load(new OBJLoader(), obj.url);
          else if (obj.format === 'stl') new STLLoader().load(obj.url, (geo) => {
             const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({color:0xcccccc}));
             mesh.add(m);
          });
          else if (obj.format === 'json') new THREE.ObjectLoader().load(obj.url, (m) => mesh.add(m));
        } else {
          let geometry;
          const material = new THREE.MeshStandardMaterial({ color: obj.color, roughness: 0.3, metalness: 0.2 });
          
          // Helper to get extrude settings or defaults
          const s = obj.extrudeSettings || { depth: 0.5, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 2 };

          // SHAPE GENERATION FOR EXTRUSION
          const createExtrudedShape = (type) => {
              const shape = new THREE.Shape();
              if (type === 'ex_rect') {
                  shape.moveTo(-0.5, -0.5); shape.lineTo(0.5, -0.5); shape.lineTo(0.5, 0.5); shape.lineTo(-0.5, 0.5);
              } else if (type === 'ex_circle') {
                  shape.absarc(0, 0, 0.6, 0, Math.PI * 2, false);
              } else if (type === 'ex_tri') {
                  shape.moveTo(0, 0.6); shape.lineTo(0.5, -0.4); shape.lineTo(-0.5, -0.4);
              } else if (type === 'ex_hex') {
                  for(let i=0; i<6; i++) {
                      const angle = (i/6) * Math.PI * 2;
                      const x = Math.cos(angle) * 0.6;
                      const y = Math.sin(angle) * 0.6;
                      if(i===0) shape.moveTo(x, y); else shape.lineTo(x, y);
                  }
              } else if (type === 'ex_star') {
                  for(let i=0; i<10; i++) {
                      const r = i%2===0 ? 0.7 : 0.35;
                      const a = (i/10) * Math.PI * 2;
                      const x = Math.cos(a)*r; const y = Math.sin(a)*r;
                      if(i===0) shape.moveTo(x, y); else shape.lineTo(x, y);
                  }
              } else if (type === 'ex_heart') {
                  const x = 0, y = 0;
                  shape.moveTo( x + .25, y + .25 );
                  shape.bezierCurveTo( x + .25, y + .25, x + .20, y, x, y );
                  shape.bezierCurveTo( x - .30, y, x - .30, y + .35,x - .30, y + .35 );
                  shape.bezierCurveTo( x - .30, y + .55, x - .10, y + .77, x + .25, y + .95 );
                  shape.bezierCurveTo( x + .60, y + .77, x + .80, y + .55, x + .80, y + .35 );
                  shape.bezierCurveTo( x + .80, y + .35, x + .80, y, x + .50, y );
                  shape.bezierCurveTo( x + .35, y, x + .25, y + .25, x + .25, y + .25 );
              }
              shape.closePath();
              return shape;
          };

          if (obj.type.startsWith('ex_')) {
              const shape = createExtrudedShape(obj.type);
              geometry = new THREE.ExtrudeGeometry(shape, s);
              geometry.center(); // Center the extrusion
          } else {
              // Standard Primitives
              if(obj.type==='cube') geometry = new THREE.BoxGeometry(1, 1, 1);
              else if(obj.type==='sphere') geometry = new THREE.SphereGeometry(0.6, 32, 32);
              else if(obj.type==='cylinder') geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
              else if(obj.type==='cone') geometry = new THREE.ConeGeometry(0.5, 1, 32);
              else if(obj.type==='torus') geometry = new THREE.TorusGeometry(0.5, 0.2, 16, 100);
              else if(obj.type==='icosahedron') geometry = new THREE.IcosahedronGeometry(0.6, 0);
              else if(obj.type==='dodecahedron') geometry = new THREE.DodecahedronGeometry(0.6, 0);
              else if(obj.type==='octahedron') geometry = new THREE.OctahedronGeometry(0.6, 0);
              else if(obj.type==='tetrahedron') geometry = new THREE.TetrahedronGeometry(0.6, 0);
              else geometry = new THREE.BoxGeometry(1, 1, 1);
          }
          
          mesh = new THREE.Mesh(geometry, material);
          // Store user data for caching checks
          if(obj.extrudeSettings) {
              mesh.userData.depth = s.depth;
              mesh.userData.bevelThickness = s.bevelThickness;
              mesh.userData.bevelSize = s.bevelSize;
              mesh.userData.bevelEnabled = s.bevelEnabled;
              mesh.userData.bevelSegments = s.bevelSegments;
          }
        }
        
        mesh.userData.id = obj.id;
        scene.add(mesh);
        meshesRef.current[obj.id] = mesh;
      }

      // Transformations
      if(!isDraggingObject.current || selectedId !== obj.id) {
          const pos = obj.position || [0,0,0];
          mesh.position.set(pos[0], pos[1], pos[2]);
      }
      const rot = obj.rotation || [0,0,0];
      mesh.rotation.set(rot[0], rot[1], rot[2]);
      const sc = obj.scale || [1,1,1];
      mesh.scale.set(sc[0], sc[1], sc[2]);

      // Appearance
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
      if (!currentIds.has(id)) {
        scene.remove(meshesRef.current[id]);
        meshesRef.current[id].traverse(o => { if(o.geometry) o.geometry.dispose(); if(o.material) o.material.dispose(); });
        delete meshesRef.current[id];
      }
    });
  }, [objects, selectedId]);

  // Input Handling (Combined for brevity but functional)
  useEffect(() => {
    const cvs = mountRef.current;
    if (!cvs) return;

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
          while(t && !t.userData.id && t !== sceneRef.current) t = t.parent;
          if(t && t.userData.id) {
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
      } else { onSelect(null); }
      cameraState.current.isDragging = true;
      cameraState.current.lastMouse = {x: e.clientX, y: e.clientY};
    };

    const onMove = (e) => {
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
  }, [activeTool, selectedId, onSelect, onUpdateObjectPosition]);

  return <div ref={mountRef} className="w-full h-full cursor-crosshair" />;
};