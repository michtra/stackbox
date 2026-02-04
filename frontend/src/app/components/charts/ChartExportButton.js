'use client'

import { useCallback } from 'react';
import html2canvas from 'html2canvas';

/**
 * Export button component that captures a target element as an image
 * @param {Object} props
 * @param {React.RefObject} props.targetRef - Ref to the element to capture
 * @param {string} props.filename - Name for the downloaded file (without extension)
 * @param {string} props.format - Image format: 'png' or 'jpeg'
 * @param {string} props.className - Additional CSS classes
 */
export default function ChartExportButton({ 
    targetRef, 
    filename = 'chart', 
    format = 'png',
    className = '',
    children = 'Export as Image'
}) {
    const handleExport = useCallback(async () => {
        if (!targetRef?.current) {
            console.error('No target element to export');
            return;
        }

        try {
            const canvas = await html2canvas(targetRef.current, {
                backgroundColor: '#ffffff',
                scale: 2, // Higher resolution
                logging: false,
                useCORS: true
            });

            const link = document.createElement('a');
            link.download = `${filename}.${format}`;
            link.href = canvas.toDataURL(`image/${format}`, 0.9);
            link.click();
        } catch (error) {
            console.error('Failed to export chart:', error);
        }
    }, [targetRef, filename, format]);

    return (
        <button
            onClick={handleExport}
            className={`
                px-3 py-1.5 
                bg-blue-600 hover:bg-blue-700 
                text-white text-sm font-medium
                rounded-md shadow-sm
                transition-colors duration-200
                flex items-center gap-2
                ${className}
            `}
        >
            <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
            >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {children}
        </button>
    );
}
