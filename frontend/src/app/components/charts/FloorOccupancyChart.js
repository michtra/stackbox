'use client'

import { Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

/**
 * Builds dataset for stacked bar chart showing floor-by-floor occupancy
 * @param {Object} stackingData - The stacking.json data
 * @returns {Object} - Chart.js compatible data object
 */
function buildFloorOccupancyData(stackingData) {
    const floors = stackingData.stackingplan.length;
    const tenantNames = Object.keys(stackingData.tenants);
    
    // Create datasets for each tenant + vacancy
    const datasets = tenantNames.map(tenantName => ({
        label: tenantName,
        data: new Array(floors).fill(0),
        backgroundColor: stackingData.tenants[tenantName].color,
        borderColor: stackingData.tenants[tenantName].color,
        borderWidth: 1,
    }));

    // Add vacancy dataset
    const vacancyDataset = {
        label: 'Vacancy',
        data: new Array(floors).fill(0),
        backgroundColor: '#e5e5e5',
        borderColor: '#cccccc',
        borderWidth: 1,
    };

    // Populate data for each floor
    stackingData.stackingplan.forEach((floor, floorIndex) => {
        let totalOccupancy = 0;

        floor.forEach(([tenantName, percentage]) => {
            const datasetIndex = tenantNames.indexOf(tenantName);
            if (datasetIndex !== -1) {
                datasets[datasetIndex].data[floorIndex] = percentage * 100;
                totalOccupancy += percentage;
            }
        });

        // Calculate vacancy for this floor
        vacancyDataset.data[floorIndex] = (1 - totalOccupancy) * 100;
    });

    // Filter out tenants with no occupancy at all
    const activeDatasets = datasets.filter(ds => ds.data.some(v => v > 0));
    activeDatasets.push(vacancyDataset);

    return {
        labels: Array.from({ length: floors }, (_, i) => `Floor ${i + 1}`),
        datasets: activeDatasets
    };
}

export default function FloorOccupancyChart({ stackingData, title = 'Floor-by-Floor Occupancy', isDarkMode = false }) {
    const data = buildFloorOccupancyData(stackingData);

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
        color: isDarkMode ? '#e2e8f0' : '#111827',
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    padding: 20,
                    usePointStyle: true,
                    pointStyle: 'circle',
                    font: {
                        size: 13,
                        weight: '500'
                    },
                    color: isDarkMode ? '#e2e8f0' : '#1f2937',
                    boxWidth: 12,
                    boxHeight: 12
                }
            },
            title: {
                display: false
            },
            tooltip: {
                backgroundColor: isDarkMode ? '#0f172a' : '#1f2937',
                titleColor: '#ffffff',
                bodyColor: '#ffffff',
                padding: 12,
                cornerRadius: 8,
                titleFont: {
                    size: 14,
                    weight: 'bold'
                },
                bodyFont: {
                    size: 13
                },
                callbacks: {
                    label: function(context) {
                        return `${context.dataset.label}: ${context.parsed.x.toFixed(1)}%`;
                    }
                }
            }
        },
        scales: {
            x: {
                stacked: true,
                max: 100,
                grid: {
                    color: isDarkMode ? '#334155' : '#e5e7eb'
                },
                ticks: {
                    font: {
                        size: 12,
                        weight: '500'
                    },
                    color: isDarkMode ? '#cbd5e1' : '#4b5563'
                },
                title: {
                    display: true,
                    text: 'Occupancy %',
                    font: {
                        size: 14,
                        weight: 'bold'
                    },
                    color: isDarkMode ? '#e2e8f0' : '#1f2937',
                    padding: { top: 10 }
                }
            },
            y: {
                stacked: true,
                grid: {
                    display: false
                },
                ticks: {
                    font: {
                        size: 13,
                        weight: '500'
                    },
                    color: isDarkMode ? '#e2e8f0' : '#1f2937',
                    padding: 10
                }
            }
        }
    };

    return (
        <div className="w-full" style={{ 
            height: `${Math.max(600, stackingData.floors * 20)}px`, 
            backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' 
        }}>
            <Bar data={data} options={options} />
        </div>
    );
}
