'use client'

import { Pie } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
    Title
} from 'chart.js';
import { useEffect, useState } from 'react';

ChartJS.register(ArcElement, Tooltip, Legend, Title);

/**
 * Calculates total occupancy per tenant across all floors
 * @param {Object} stackingData - JSON endpoint output from data of a singular building
 * @returns {Object} - { labels, values, colors }
 */
function calculateTenantOccupancy(stackingData) {
    const tenantOccupancy = {};
    const tenantData = {};
    let totalVacancy = 0;

    // Sum up occupancy for each current tenant across all floors (in SF)
    const now = new Date();
    stackingData.floors.forEach((floor) => {
        let floorOccupancy = 0;
        floor.occupancies.forEach((tenant) => {
            if ((new Date(tenant.leaseStart)) <= now <= (new Date(tenant.leaseEnd))) {
                if (!(tenant.tenantId in tenantOccupancy)) {
                    tenantOccupancy[tenant.tenantId] = 0;
                }
                tenantOccupancy[tenant.tenantId] += tenant.squareFeet.parsedValue;
                floorOccupancy += tenant.squareFeet.parsedValue;
            }
        });
        totalVacancy += (floor.squareFeet.parsedValue - floorOccupancy);
    });

    // Get tenant data
    stackingData.tenants.forEach((tenant) => {
        tenantData[tenant.id] = {
            name: tenant.name,
            color: tenant.color
        }
    })

    const labels = Object.keys(tenantOccupancy).map((key) => tenantData[key].name);
    const values = Object.values(tenantOccupancy);
    const colors = Object.keys(tenantOccupancy).map((key) => tenantData[key]?.color || "#cccccc");

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
        backgroundColor: isDarkMode ? '#0f172b' : '#ffffff',
        color: isDarkMode ? '#0f172b' : '#e2e8f0',
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
                        return `${context.label}: ${percentage}% (${context.parsed.toFixed(2)} SF)`;
                    }
                }
            }
        }
    };

    return (
        <div className="w-full h-full flex items-center justify-center" style={{ 
            minHeight: '500px', 
            backgroundColor: isDarkMode ? '#0f172b' : '#ffffff' 
        }}>
            <div className="w-full max-w-2xl" style={{ 
                height: '500px', 
                backgroundColor: isDarkMode ? '#0f172b' : '#ffffff' 
            }}>
                <Pie data={data} options={options} />
            </div>
        </div>
    );
}
