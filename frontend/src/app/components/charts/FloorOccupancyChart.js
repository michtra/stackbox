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

export default function FloorOccupancyChart({ stackingData, title = 'Floor-by-Floor Occupancy' }) {
    const data = buildFloorOccupancyData(stackingData);

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y', // Horizontal bars - floors on y-axis
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    padding: 15,
                    usePointStyle: true,
                    font: {
                        size: 10
                    }
                }
            },
            title: {
                display: true,
                text: title,
                font: {
                    size: 16,
                    weight: 'bold'
                },
                padding: {
                    bottom: 10
                }
            },
            tooltip: {
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
                title: {
                    display: true,
                    text: 'Occupancy %'
                }
            },
            y: {
                stacked: true,
                ticks: {
                    font: {
                        size: 9
                    }
                }
            }
        }
    };

    return (
        <div className="w-full" style={{ height: `${Math.max(400, stackingData.floors * 12)}px` }}>
            <Bar data={data} options={options} />
        </div>
    );
}
