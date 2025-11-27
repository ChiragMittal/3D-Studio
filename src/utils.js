import * as THREE from 'three';

export const generateId = () => Math.random().toString(36).substr(2, 9);

export const getRandomColor = () => {
    const colors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e'];
    return colors[Math.floor(Math.random() * colors.length)];
};

export const createExtrudedShape = (type) => {
    const shape = new THREE.Shape();
    if (type === 'ex_rect') {
        shape.moveTo(-0.5, -0.5); shape.lineTo(0.5, -0.5); shape.lineTo(0.5, 0.5); shape.lineTo(-0.5, 0.5);
    } else if (type === 'ex_circle') {
        shape.absarc(0, 0, 0.6, 0, Math.PI * 2, false);
    } else if (type === 'ex_tri') {
        shape.moveTo(0, 0.6); shape.lineTo(0.5, -0.4); shape.lineTo(-0.5, -0.4);
    } else if (type === 'ex_hex') {
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const x = Math.cos(angle) * 0.6;
            const y = Math.sin(angle) * 0.6;
            if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
        }
    } else if (type === 'ex_star') {
        for (let i = 0; i < 10; i++) {
            const r = i % 2 === 0 ? 0.7 : 0.35;
            const a = (i / 10) * Math.PI * 2;
            const x = Math.cos(a) * r; const y = Math.sin(a) * r;
            if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
        }
    } else if (type === 'ex_heart') {
        const x = 0, y = 0;
        shape.moveTo(x + .25, y + .25);
        shape.bezierCurveTo(x + .25, y + .25, x + .20, y, x, y);
        shape.bezierCurveTo(x - .30, y, x - .30, y + .35, x - .30, y + .35);
        shape.bezierCurveTo(x - .30, y + .55, x - .10, y + .77, x + .25, y + .95);
        shape.bezierCurveTo(x + .60, y + .77, x + .80, y + .55, x + .80, y + .35);
        shape.bezierCurveTo(x + .80, y + .35, x + .80, y, x + .50, y);
        shape.bezierCurveTo(x + .35, y, x + .25, y + .25, x + .25, y + .25);
    }
    shape.closePath();
    return shape;
};

export const getGeometryForObject = (obj) => {
    if (obj.type.startsWith('ex_')) {
        const s = obj.extrudeSettings || { depth: 0.5, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 2 };
        const shape = createExtrudedShape(obj.type);
        const geometry = new THREE.ExtrudeGeometry(shape, s);
        geometry.center();
        return geometry;
    }
    if (obj.type === 'cube') return new THREE.BoxGeometry(1, 1, 1);
    if (obj.type === 'sphere') return new THREE.SphereGeometry(0.6, 32, 32);
    if (obj.type === 'cylinder') return new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
    if (obj.type === 'cone') return new THREE.ConeGeometry(0.5, 1, 32);
    if (obj.type === 'torus') return new THREE.TorusGeometry(0.5, 0.2, 16, 100);
    if (obj.type === 'icosahedron') return new THREE.IcosahedronGeometry(0.6, 0);
    if (obj.type === 'dodecahedron') return new THREE.DodecahedronGeometry(0.6, 0);
    if (obj.type === 'octahedron') return new THREE.OctahedronGeometry(0.6, 0);
    if (obj.type === 'tetrahedron') return new THREE.TetrahedronGeometry(0.6, 0);
    return new THREE.BoxGeometry(1, 1, 1);
};
