import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { getGeometryForObject } from '../utils';

const ThreeScene = ({ objects, selectedIds, activeTool, onSelect, onUpdateObjectPosition }) => {
    const mountRef = useRef(null);
    const sceneRef = useRef(null);
    const rendererRef = useRef(null);
    const cameraRef = useRef(null);
    const meshesRef = useRef({});

    const dragPlane = useRef(new THREE.Plane());
    const dragOffset = useRef(new THREE.Vector3());
    const isDraggingObject = useRef(false);
    const cameraState = useRef({ radius: 10, theta: Math.PI / 4, phi: Math.PI / 3, target: new THREE.Vector3(0, 0, 0), isDragging: false, lastMouse: { x: 0, y: 0 } });
    const raycaster = useRef(new THREE.Raycaster());
    const mouse = useRef(new THREE.Vector2());

    useEffect(() => {
        if (!mountRef.current) return;
        const observer = new ResizeObserver(entries => {
            if (rendererRef.current && cameraRef.current) {
                const { width, height } = entries[0].contentRect;
                if (width > 0) {
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
                if (mesh.geometry) mesh.geometry.dispose();
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
                            if (max > 2) m.scale.setScalar(2 / max);
                            mesh.add(m);
                        });
                    };
                    if (obj.format === 'glb' || obj.format === 'gltf') load(new GLTFLoader(), obj.url);
                    else if (obj.format === 'obj') load(new OBJLoader(), obj.url);
                    else if (obj.format === 'stl') new STLLoader().load(obj.url, (geo) => {
                        const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xcccccc }));
                        mesh.add(m);
                    });
                    else if (obj.format === 'json') new THREE.ObjectLoader().load(obj.url, (m) => mesh.add(m));
                    else if (obj.format === 'json_data') {
                        const m = new THREE.ObjectLoader().parse(obj.data);
                        mesh.add(m);
                    }
                } else {
                    let geometry = getGeometryForObject(obj);
                    const material = new THREE.MeshStandardMaterial({ color: obj.color, roughness: 0.3, metalness: 0.2 });
                    const s = obj.extrudeSettings || { depth: 0.5, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 2 };

                    mesh = new THREE.Mesh(geometry, material);
                    // Store user data for caching checks
                    if (obj.extrudeSettings) {
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
            if (!isDraggingObject.current || !selectedIds.includes(obj.id)) {
                const pos = obj.position || [0, 0, 0];
                mesh.position.set(pos[0], pos[1], pos[2]);
            }
            const rot = obj.rotation || [0, 0, 0];
            mesh.rotation.set(rot[0], rot[1], rot[2]);
            const sc = obj.scale || [1, 1, 1];
            mesh.scale.set(sc[0], sc[1], sc[2]);

            // Mirror Logic
            const mirrorId = `${obj.id}_mirror`;
            let mirrorMesh = meshesRef.current[mirrorId];

            if (obj.mirror && obj.mirror.enabled) {
                const shouldRebuild = !mirrorMesh ||
                    (mesh.isMesh && mirrorMesh.isMesh && mirrorMesh.geometry !== mesh.geometry) ||
                    (mesh.isGroup && mirrorMesh.isGroup && mirrorMesh.children.length !== mesh.children.length);

                if (shouldRebuild) {
                    if (mirrorMesh) {
                        scene.remove(mirrorMesh);
                    }
                    mirrorMesh = mesh.clone();
                    mirrorMesh.userData.id = mirrorId;
                    mirrorMesh.userData.isMirror = true;
                    mirrorMesh.userData.parentId = obj.id;
                    scene.add(mirrorMesh);
                    meshesRef.current[mirrorId] = mirrorMesh;
                }

                // Sync Transform
                mirrorMesh.position.copy(mesh.position);
                mirrorMesh.rotation.copy(mesh.rotation);
                mirrorMesh.scale.copy(mesh.scale);

                // Apply Mirror Scale
                const axis = obj.mirror.axis;
                if (axis === 'x') mirrorMesh.scale.x *= -1;
                if (axis === 'y') mirrorMesh.scale.y *= -1;
                if (axis === 'z') mirrorMesh.scale.z *= -1;
            } else {
                if (mirrorMesh) {
                    scene.remove(mirrorMesh);
                    delete meshesRef.current[mirrorId];
                }
            }

            // Appearance
            const col = new THREE.Color(obj.color);
            mesh.traverse(c => {
                if (c.isMesh) {
                    const materials = Array.isArray(c.material) ? c.material : [c.material];
                    materials.forEach(mat => {
                        if (mat && mat.color) {
                            if (obj.type !== 'model') mat.color.set(col);
                            else mat.color.lerp(col, 0.5);
                            mat.wireframe = !!obj.wireframe;
                            if (mat.emissive) {
                                mat.emissive.setHex(selectedIds.includes(obj.id) ? 0x444444 : 0x000000);
                            }
                        }
                    });
                }
            });
        });

        const validIds = new Set();
        objects.forEach(obj => {
            validIds.add(obj.id);
            if (obj.mirror && obj.mirror.enabled) {
                validIds.add(`${obj.id}_mirror`);
            }
        });

        Object.keys(meshesRef.current).forEach(id => {
            if (!validIds.has(id)) {
                scene.remove(meshesRef.current[id]);
                meshesRef.current[id].traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
                delete meshesRef.current[id];
            }
        });
    }, [objects, selectedIds]);

    // Input Handling (Combined for brevity but functional)
    useEffect(() => {
        const cvs = mountRef.current;
        if (!cvs) return;

        const getMouse = (e) => {
            const r = cvs.getBoundingClientRect();
            return { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 };
        };

        const onDown = (e) => {
            e.preventDefault();
            const m = getMouse(e);
            mouse.current.set(m.x, m.y);
            raycaster.current.setFromCamera(mouse.current, cameraRef.current);
            const isect = raycaster.current.intersectObjects(Object.values(meshesRef.current), true);

            if (isect.length > 0) {
                let t = isect[0].object;
                while (t && !t.userData.id && t !== sceneRef.current) t = t.parent;
                if (t && t.userData.id) {
                    onSelect(t.userData.id, e.shiftKey);
                    if (activeTool === 'move') {
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
            cameraState.current.lastMouse = { x: e.clientX, y: e.clientY };
        };

        const onMove = (e) => {
            if (isDraggingObject.current && selectedIds.length > 0) {
                const m = getMouse(e);
                mouse.current.set(m.x, m.y);
                raycaster.current.setFromCamera(mouse.current, cameraRef.current);
                const t = new THREE.Vector3();
                if (raycaster.current.ray.intersectPlane(dragPlane.current, t)) {
                    const np = t.add(dragOffset.current);
                    // Only move the last selected object for now, or the one we clicked?
                    // Simplified: move the last selected one (usually the one clicked)
                    const id = selectedIds[selectedIds.length - 1];
                    const mesh = meshesRef.current[id];
                    if (mesh) mesh.position.copy(np);
                }
                return;
            }
            if (cameraState.current.isDragging) {
                const dx = e.clientX - cameraState.current.lastMouse.x;
                const dy = e.clientY - cameraState.current.lastMouse.y;
                cameraState.current.theta -= dx * 0.005;
                cameraState.current.phi = Math.max(0.1, Math.min(Math.PI - 0.1, cameraState.current.phi - dy * 0.005));
                cameraState.current.lastMouse = { x: e.clientX, y: e.clientY };
            }
        };

        const onUp = () => {
            if (isDraggingObject.current && selectedIds.length > 0) {
                const id = selectedIds[selectedIds.length - 1];
                const m = meshesRef.current[id];
                if (m) onUpdateObjectPosition(id, [m.position.x, m.position.y, m.position.z]);
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
        cvs.addEventListener('wheel', onWheel, { passive: false });
        return () => {
            cvs.removeEventListener('mousedown', onDown);
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            cvs.removeEventListener('wheel', onWheel);
        };
    }, [activeTool, selectedIds, onSelect, onUpdateObjectPosition]);

    return <div ref={mountRef} className="w-full h-full cursor-crosshair" />;
};

export default ThreeScene;
