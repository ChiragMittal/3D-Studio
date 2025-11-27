import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import {
  Box,
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
  Star,
  Copy,
  Combine,
  Scissors
} from 'lucide-react';
import { SUBTRACTION, ADDITION, INTERSECTION, Brush, Evaluator } from 'three-bvh-csg';

import { PRIMITIVES, INITIAL_OBJECTS } from './constants';
import { generateId, getRandomColor, getGeometryForObject } from './utils';
import TransformGroup from './components/TransformGroup';
import ThreeScene from './components/ThreeScene';

export default function App() {
  const [objects, setObjects] = useState(INITIAL_OBJECTS);
  const [historyLog, setHistoryLog] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
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
      } : undefined,
      mirror: { enabled: false, axis: 'x' }
    };
    updateState([...objects, newObj], `Add ${type}`);
    setSelectedIds([newObj.id]);
    setActiveTool('move');
  };

  const restoreState = (snapshot) => {
    setObjects(snapshot);
    setSelectedIds([]);
  };

  const onSelect = useCallback((id, multi = false) => {
    if (!id) { if (!multi) setSelectedIds([]); return; }
    setSelectedIds(prev => multi ? (prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]) : [id]);
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

  const updateMirrorSetting = (id, setting, value) => {
    const newObjects = objects.map(obj => {
      if (obj.id !== id) return obj;
      return {
        ...obj,
        mirror: {
          ...(obj.mirror || { enabled: false, axis: 'x' }),
          [setting]: value
        }
      };
    });
    updateState(newObjects, `Update Mirror ${setting}`);
  };

  const onUpdateObjectPosition = useCallback((id, newPos) => {
    const newObjects = objects.map(obj => obj.id === id ? { ...obj, position: newPos } : obj);
    updateState(newObjects, `Move Object ${id}`);
  }, [objects, updateState]);

  const deleteObject = (id) => {
    const newObjects = objects.filter(o => o.id !== id);
    updateState(newObjects, `Delete Object ${id}`);
    setSelectedIds(prev => prev.filter(i => i !== id));
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      const isInputFocused = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
      if (!isInputFocused && (e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        e.preventDefault();
        const newObjects = objects.filter(o => !selectedIds.includes(o.id));
        updateState(newObjects, 'Delete Selected');
        setSelectedIds([]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, objects]);

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
    if (!file) return;
    const name = file.name.toLowerCase();
    const addModel = (url, format) => {
      const newObj = {
        id: generateId(),
        type: 'model',
        format: format,
        url: url,
        name: file.name,
        position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], color: '#ffffff', wireframe: false,
        mirror: { enabled: false, axis: 'x' }
      };
      updateState([...objects, newObj], `Import ${file.name}`);
      setSelectedIds([newObj.id]);
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

  const selectedObject = selectedIds.length === 1 ? objects.find(o => o.id === selectedIds[0]) : null;

  const performCSG = (op) => {
    if (selectedIds.length !== 2) {
      alert(`Please select exactly 2 objects. Currently selected: ${selectedIds.length}`);
      return;
    }
    const obj1 = objects.find(o => o.id === selectedIds[0]);
    const obj2 = objects.find(o => o.id === selectedIds[1]);
    if (!obj1 || !obj2) return;

    const createMesh = (obj) => {
      let geo;
      if (obj.type === 'model') return null; // Not supported yet
      else geo = getGeometryForObject(obj);

      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
      mesh.position.set(...obj.position);
      mesh.rotation.set(...obj.rotation);
      mesh.scale.set(...obj.scale);
      mesh.updateMatrixWorld();
      return mesh;
    };

    const mesh1 = createMesh(obj1);
    const mesh2 = createMesh(obj2);

    if (!mesh1 || !mesh2) {
      alert("CSG only supports primitives/shapes for now.");
      return;
    }

    const brush1 = new Brush(mesh1.geometry);
    brush1.position.copy(mesh1.position);
    brush1.rotation.copy(mesh1.rotation);
    brush1.scale.copy(mesh1.scale);
    brush1.updateMatrixWorld();

    const brush2 = new Brush(mesh2.geometry);
    brush2.position.copy(mesh2.position);
    brush2.rotation.copy(mesh2.rotation);
    brush2.scale.copy(mesh2.scale);
    brush2.updateMatrixWorld();

    const evaluator = new Evaluator();
    const result = evaluator.evaluate(brush1, brush2, op);

    // Center pivot
    result.geometry.computeBoundingBox();
    const center = new THREE.Vector3();
    result.geometry.boundingBox.getCenter(center);
    result.geometry.translate(-center.x, -center.y, -center.z);

    const json = result.toJSON();

    const newObj = {
      id: generateId(),
      type: 'model',
      format: 'json_data',
      data: json,
      name: 'CSG Result',
      position: [center.x, center.y, center.z],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#ffffff',
      wireframe: false,
      mirror: { enabled: false, axis: 'x' }
    };

    const newObjects = objects.filter(o => !selectedIds.includes(o.id));
    updateState([...newObjects, newObj], 'CSG Operation');
    setSelectedIds([newObj.id]);
  };

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
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button onClick={() => setActiveTool('select')} className={`p-2 rounded-md transition-all flex flex-col items-center gap-1 ${activeTool === 'select' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}><MousePointer2 size={18} /><span className="text-[10px]">Select</span></button>
              <button onClick={() => setActiveTool('move')} className={`p-2 rounded-md transition-all flex flex-col items-center gap-1 ${activeTool === 'move' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}><Move size={18} /><span className="text-[10px]">Move</span></button>
            </div>
            <div className="text-[9px] text-slate-600 font-bold uppercase mb-1 flex justify-between">
              <span>Boolean Ops</span>
              <span className="text-indigo-400">{selectedIds.length} Selected</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <button onClick={() => performCSG(ADDITION)} className={`p-1.5 rounded flex flex-col items-center gap-1 ${selectedIds.length === 2 ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-slate-700 text-slate-500 hover:bg-slate-600'}`} title="Union"><Combine size={14} /></button>
              <button onClick={() => performCSG(SUBTRACTION)} className={`p-1.5 rounded flex flex-col items-center gap-1 ${selectedIds.length === 2 ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-slate-700 text-slate-500 hover:bg-slate-600'}`} title="Difference"><Scissors size={14} /></button>
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
                  onClick={(e) => {
                    onSelect(obj.id, e.shiftKey);
                    setActiveTool('move');
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2 transition-colors ${selectedIds.includes(obj.id)
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:bg-slate-800'
                    }`}
                >
                  {getObjectIcon(obj.type)}
                  <span className="truncate">{obj.name || `${obj.type} ${obj.id.substring(0, 4)}`}</span>
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
          selectedIds={selectedIds}
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
                  <input type="range" min="0.1" max="5" step="0.1" value={selectedObject.extrudeSettings.depth} onChange={(e) => updateExtrudeSetting(selectedObject.id, 'depth', e.target.value)} className="w-full accent-indigo-500" />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="text-xs text-slate-500">Bevel Enabled</label>
                  <input type="checkbox" checked={selectedObject.extrudeSettings.bevelEnabled} onChange={(e) => updateExtrudeSetting(selectedObject.id, 'bevelEnabled', e.target.checked)} className="form-checkbox h-4 w-4 text-indigo-600 bg-slate-700 border-slate-600 rounded" />
                </div>

                {selectedObject.extrudeSettings.bevelEnabled && (
                  <>
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Bevel Thickness ({selectedObject.extrudeSettings.bevelThickness})</label>
                      <input type="range" min="0" max="1" step="0.05" value={selectedObject.extrudeSettings.bevelThickness} onChange={(e) => updateExtrudeSetting(selectedObject.id, 'bevelThickness', e.target.value)} className="w-full accent-indigo-500" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Bevel Size ({selectedObject.extrudeSettings.bevelSize})</label>
                      <input type="range" min="0" max="1" step="0.05" value={selectedObject.extrudeSettings.bevelSize} onChange={(e) => updateExtrudeSetting(selectedObject.id, 'bevelSize', e.target.value)} className="w-full accent-indigo-500" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Bevel Segments ({selectedObject.extrudeSettings.bevelSegments})</label>
                      <input type="range" min="1" max="10" step="1" value={selectedObject.extrudeSettings.bevelSegments} onChange={(e) => updateExtrudeSetting(selectedObject.id, 'bevelSegments', e.target.value)} className="w-full accent-indigo-500" />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Mirror Modifier */}
            <div className="pt-4 border-t border-slate-700 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                <Copy size={16} /> Mirror Modifier
              </div>
              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-500">Enable Mirror</label>
                <input type="checkbox" checked={selectedObject.mirror?.enabled || false} onChange={(e) => updateMirrorSetting(selectedObject.id, 'enabled', e.target.checked)} className="form-checkbox h-4 w-4 text-indigo-600 bg-slate-700 border-slate-600 rounded" />
              </div>
              {selectedObject.mirror?.enabled && (
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Mirror Axis</label>
                  <div className="flex gap-2">
                    {['x', 'y', 'z'].map(axis => (
                      <button
                        key={axis}
                        onClick={() => updateMirrorSetting(selectedObject.id, 'axis', axis)}
                        className={`flex-1 py-1 text-xs rounded uppercase font-bold ${selectedObject.mirror?.axis === axis ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                      >
                        {axis}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-700">
              <label className="text-xs text-slate-500 block mb-1">Color</label>
              <div className="flex gap-2">
                <input type="color" value={selectedObject.color} onChange={(e) => updateObject(selectedObject.id, 'color', e.target.value)} className="h-8 w-8 rounded cursor-pointer border-0 p-0" />
                <input type="text" value={selectedObject.color} onChange={(e) => updateObject(selectedObject.id, 'color', e.target.value)} className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 text-sm text-slate-300 font-mono" />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-700">
              <label className="flex items-center space-x-2 text-sm text-slate-300">
                <input type="checkbox" checked={selectedObject.wireframe} onChange={(e) => updateObject(selectedObject.id, 'wireframe', e.target.checked)} className="form-checkbox h-4 w-4 text-indigo-600 bg-slate-700 border-slate-600 rounded" />
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