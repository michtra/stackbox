'use client'

import { useState, useRef } from 'react';
import OccupancyPieChart from './OccupancyPieChart';
import FloorOccupancyChart from './FloorOccupancyChart';
import ChartExportButton from './ChartExportButton';

/**
 * Container panel for all tenant occupancy charts with export functionality
 * @param {Object} props
 * @param {Object} props.stackingData - The stacking.json data
 * @param {boolean} props.isOpen - Whether the panel is open
 * @param {Function} props.onToggle - Callback to toggle panel visibility
 */
export default function ChartPanel({ stackingData, isOpen, onToggle }) {
    const [activeTab, setActiveTab] = useState('pie');
    const chartContainerRef = useRef(null);

    const tabs = [
        { id: 'pie', label: 'Occupancy Overview' },
        { id: 'floor', label: 'Floor Breakdown' },
    ];

    if (!isOpen) {
        return (
            <button
                onClick={onToggle}
                className="
                    fixed top-4 right-4 z-50
                    px-4 py-2
                    bg-white hover:bg-gray-100
                    text-gray-800 font-medium
                    rounded-lg shadow-lg
                    border border-gray-200
                    transition-all duration-200
                    flex items-center gap-2
                "
            >
                <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2"
                >
                    <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                    <path d="M22 12A10 10 0 0 0 12 2v10z" />
                </svg>
                Charts
            </button>
        );
    }

    return (
        <div className="fixed top-4 right-4 z-50 w-96 max-h-[90vh] bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-800">Tenant Occupancy</h2>
                <div className="flex items-center gap-2">
                    <ChartExportButton 
                        targetRef={chartContainerRef}
                        filename={`tenant-occupancy-${activeTab}`}
                    >
                        Export
                    </ChartExportButton>
                    <button
                        onClick={onToggle}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                        aria-label="Close panel"
                    >
                        <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            width="20" 
                            height="20" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2"
                        >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`
                            flex-1 px-4 py-2 text-sm font-medium
                            transition-colors duration-200
                            ${activeTab === tab.id 
                                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' 
                                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                            }
                        `}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Chart Content */}
            <div 
                ref={chartContainerRef}
                className="flex-1 overflow-auto p-4 bg-white"
            >
                {activeTab === 'pie' && (
                    <OccupancyPieChart 
                        stackingData={stackingData}
                        title="Building Occupancy by Tenant"
                    />
                )}
                {activeTab === 'floor' && (
                    <FloorOccupancyChart 
                        stackingData={stackingData}
                        title="Occupancy by Floor"
                    />
                )}
            </div>

            {/* Stats Footer */}
            <div className="p-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-600">
                <div className="flex justify-between">
                    <span>Total Floors: {stackingData.floors}</span>
                    <span>Tenants: {Object.keys(stackingData.tenants).length}</span>
                </div>
            </div>
        </div>
    );
}
