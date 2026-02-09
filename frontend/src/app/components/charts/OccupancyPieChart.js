'use client'

import { Pie } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
    Title
} from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend, Title);

/**
 * Calculates total occupancy per tenant across all floors
 * @param {Object} stackingData - The stacking.json data
 * @returns {Object} - { labels, values, colors }
 */
function calculateTenantOccupancy(stackingData) {
    const tenantOccupancy = {};
    let totalVacancy = 0;

    // Sum up occupancy for each tenant across all floors
    stackingData.stackingplan.forEach((floor) => {
        let floorOccupancy = 0;
        floor.forEach(([tenantName, percentage]) => {
            if (!tenantOccupancy[tenantName]) {
                tenantOccupancy[tenantName] = 0;
            }
            tenantOccupancy[tenantName] += percentage;
            floorOccupancy += percentage;
        });
        totalVacancy += (1 - floorOccupancy);
    });

    const labels = Object.keys(tenantOccupancy);
    const values = Object.values(tenantOccupancy);
    const colors = labels.map(name => stackingData.tenants[name]?.color || '#cccccc');

    // Add vacancy
    if (totalVacancy > 0) {
        labels.push('Vacancy');
        values.push(totalVacancy);
        colors.push('#e5e5e5');
    }

    return { labels, values, colors };
}

export default function OccupancyPieChart({ stackingData, title = 'Tenant Occupancy Distribution', isDarkMode = false }) {
    const { labels, values, colors } = calculateTenantOccupancy(stackingData);

    const data = {
        labels,
        datasets: [
            {
                data: values,
                backgroundColor: colors,
                borderColor: colors.map(() => '#ffffff'),
                borderWidth: 2,
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
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
                        size: 14,
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
                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                        const percentage = ((context.parsed / total) * 100).toFixed(1);
                        return `${context.label}: ${percentage}% (${context.parsed.toFixed(2)} floors)`;
                    }
                }
            }
        }
    };

    return (
        <div className="w-full h-full flex items-center justify-center" style={{ 
            minHeight: '500px', 
            backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' 
        }}>
            <div className="w-full max-w-2xl" style={{ 
                height: '500px', 
                backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' 
            }}>
                <Pie data={data} options={options} />
            </div>
        </div>
    );
}
