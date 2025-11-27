import React from 'react';

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

export default TransformGroup;
