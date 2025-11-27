import {
    Box,
    Circle,
    Triangle,
    Layers,
    Cylinder,
    Hexagon,
    Diamond,
    Pentagon,
    Star,
    Heart,
    Square
} from 'lucide-react';

export const PRIMITIVES = [
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

export const INITIAL_OBJECTS = [
    { id: '1', type: 'cube', position: [-2, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], color: '#6366f1', wireframe: false, mirror: { enabled: false, axis: 'x' } },
    {
        id: '2', type: 'ex_star', position: [2, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], color: '#ec4899', wireframe: false,
        extrudeSettings: { depth: 0.5, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 3 }, mirror: { enabled: false, axis: 'x' }
    },
];
