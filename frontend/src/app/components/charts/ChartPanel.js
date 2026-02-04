'use client'

import { useState, useRef } from 'react';
import OccupancyPieChart from './OccupancyPieChart';
import FloorOccupancyChart from './FloorOccupancyChart';
import ChartExportButton from './ChartExportButton';

/**
 * Sidebar panel for all tenant occupancy charts with export functionality
 * @param {Object} props
 * @param {Object} props.stackingData - The stacking.json data
 * @param {boolean} props.isOpen - Whether the sidebar is expanded
 * @param {Function} props.onToggle - Callback to toggle sidebar visibility
 */
export default function ChartPanel({ stackingData, isOpen, onToggle }) {
    const [activeTab, setActiveTab] = useState('pie');
    const chartContainerRef = useRef(null);

    const tabs = [
        { id: 'pie', label: 'Overview' },
        { id: 'floor', label: 'By Floor' },
    ];

    return (
        <div 
            className={`
                fixed top-0 right-0 h-full z-50
                bg-white shadow-xl border-l border-gray-200
                flex flex-col
                transition-all duration-300 ease-in-out
                ${isOpen ? 'w-96' : 'w-12'}
            `}
        >
            {/* Collapse/Expand Toggle */}
            <button
                onClick={onToggle}
                className="
                    absolute top-1/2 -left-3 transform -translate-y-1/2
                    w-6 h-12 
                    bg-white hover:bg-gray-100
                    border border-gray-200
                    rounded-l-md shadow-md
                    flex items-center justify-center
                    transition-colors duration-200
                "
                aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
                <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="14" 
                    height="14" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2"
                    className={`transition-transform duration-300 ${isOpen ? 'rotate-0' : 'rotate-180'}`}
                >
                    <polyline points="15 18 9 12 15 6" />
                </svg>
            </button>

            {/* Collapsed State - Vertical Icon Bar */}
            {!isOpen && (
                <div className="flex flex-col items-center py-4 gap-4">
                    <div className="w-8 h-8 flex items-center justify-center text-gray-600">
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
                    </div>
                    <div className="writing-mode-vertical text-xs text-gray-500 font-medium tracking-wider"
                         style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                        CHARTS
                    </div>
                </div>
            )}

            {/* Expanded State */}
            {isOpen && (
                <>
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-200">
                        <h2 className="text-lg font-bold text-gray-800">Tenant Occupancy</h2>
                        <ChartExportButton 
                            targetRef={chartContainerRef}
                            filename={`tenant-occupancy-${activeTab}`}
                        >
                            Export
                        </ChartExportButton>
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
                </>
            )}
        </div>
    );
}
