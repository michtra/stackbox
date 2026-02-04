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

export default function OccupancyPieChart({ stackingData, title = 'Tenant Occupancy Distribution' }) {
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
        plugins: {
            legend: {
                position: 'right',
                labels: {
                    padding: 15,
                    usePointStyle: true,
                    font: {
                        size: 11
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
                    bottom: 20
                }
            },
            tooltip: {
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
        <div className="w-full h-64">
            <Pie data={data} options={options} />
        </div>
    );
}
