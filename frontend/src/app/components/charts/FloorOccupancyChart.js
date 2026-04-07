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
import { useEffect, useState } from 'react';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

/**
 * Builds dataset for stacked bar chart showing floor-by-floor occupancy
 * @param {Object} stackingData - JSON endpoint output from data of a singular building
 * @returns {Object} - Chart.js compatible data object
 */
function buildFloorOccupancyData(stackingData, floorNumbers) {
    const floors = stackingData.floors.length;
    
    // Create datasets for each tenant + vacancy
    const datasets = {};
    stackingData.tenants.forEach((tenant) => datasets[tenant.id] = ({
        label: tenant.name,
        data: new Array(floors).fill(0),
        sf: new Array(floors).fill(0),
        backgroundColor: `${tenant.color}aa`,
        borderColor: tenant.color,
        borderWidth: 2,
        borderRadius: {
            topLeft: 4,
            topRight: 4,
            bottomLeft: 4,
            bottomRight: 4,
        },
        borderSkipped: false,
    }));

    // Add vacancy dataset
    const vacancyDataset = {
        label: 'Vacancy',
        data: new Array(floors).fill(0),
        sf: new Array(floors).fill(0),
        backgroundColor: '#ccccccaa',
        borderColor: '#cccccc',
        borderWidth: 2,
        borderRadius: {
            topLeft: 4,
            topRight: 4,
            bottomLeft: 4,
            bottomRight: 4,
        },
        borderSkipped: false,
    };

    // Populate data for each floor with current tenants
    const now = new Date();
    stackingData.floors.forEach((floor) => {
        let totalOccupancy = 0;

        floor.occupancies.forEach((tenant) => {
            if (tenant.tenantId in datasets && (new Date(tenant.leaseStart)) <= now <= (new Date(tenant.leaseEnd))) {
                datasets[tenant.tenantId].sf[floor.floorNumber - 1] = tenant.squareFeet;
                datasets[tenant.tenantId].data[floor.floorNumber - 1] = (tenant.squareFeet / floor.squareFeet) * 100;
                totalOccupancy += tenant.squareFeet;
            }
        });

        // Calculate vacancy for this floor
        vacancyDataset.sf[floor.floorNumber - 1] = floor.squareFeet - totalOccupancy;
        vacancyDataset.data[floor.floorNumber - 1] = ((floor.squareFeet - totalOccupancy) / floor.squareFeet) * 100;
    });

    // Filter out tenants with no occupancy at all
    const activeDatasets = Object.entries({
        ...Object.fromEntries(
            Object.entries(datasets).filter(
                ([key, ds]) => ds.data.some(v => v > 0)
            )
        ),
        "Vacancy": vacancyDataset
    }).map(([key, ds]) => {return {id: key, ...ds, data: ds.data.reverse(), sf: ds.sf.reverse()}});

    return {
        labels: floorNumbers.map((floorNumber) => `Floor ${floorNumber}`),
        datasets: activeDatasets
    };
}

export default function FloorOccupancyChart({ stackingData, title = 'Floor-by-Floor Occupancy', isDarkMode = false, visualizationProps }) {
    const floorNumbers = stackingData.floors.map((floor) => floor.floorNumber).reverse()
    const data = buildFloorOccupancyData(stackingData, floorNumbers);
    const tenantIds = data.datasets.map((tenant) => tenant.id);

    const [visibleTenants, setVisibleTenants] = useState([...tenantIds, "Plate"]);

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        backgroundColor: isDarkMode ? '#0f172b' : '#ffffff',
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
                },
                onClick: (e, legendItem, legend) => {
                    const newVisibleTenants = [...visibleTenants];
                    setVisibleTenants(newVisibleTenants);
                    visualizationProps.setSelectedTenants(newVisibleTenants);
                    const index = legendItem.datasetIndex;
                    if (legend.chart.isDatasetVisible(legendItem.datasetIndex)) {
                        legend.chart.hide(legendItem.datasetIndex);
                        legendItem.hidden = true;
                        newVisibleTenants.splice(newVisibleTenants.indexOf(tenantIds[legendItem.datasetIndex]), 1);
                    } else {
                        legend.chart.show(legendItem.datasetIndex);
                        legendItem.hidden = false;
                        newVisibleTenants.push(tenantIds[legendItem.datasetIndex]);
                    };
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
                        return `${context.dataset.label}: ${context.parsed.x.toFixed(1)}% (${context.dataset.sf[context.parsed.y]} SF)`;
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
        },
        onHover: (e, chartElement) => {
            if (chartElement[0]) {
                if (visualizationProps.selectedFloors.includes(floorNumbers[chartElement[0]?.index])) {
                    return;
                }
                visualizationProps.setSelectedFloors([floorNumbers[chartElement[0]?.index]]);
            }
        }
    };

    return (
        <div
            className="w-full"
            style={{ 
                height: `${Math.max(600, stackingData.floors.length * 40)}px`, 
                backgroundColor: isDarkMode ? '#0f172b' : '#ffffff' 
            }}
            onMouseLeave={() => {
                if (visualizationProps.selectedFloors.size !== 0) {
                    visualizationProps.setSelectedFloors([]);
                }
            }}
        >
            <Bar data={data} options={options} />
        </div>
    );
}
