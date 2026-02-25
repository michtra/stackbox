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
    children = 'Export as Image',
    isDarkMode = false
}) {
    const handleExport = useCallback(async () => {
        if (!targetRef?.current) {
            console.error('No target element to export');
            return;
        }

        try {
            const canvas = await html2canvas(targetRef.current, {
                backgroundColor: localStorage.theme === "dark" || (!("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches) ? '#1e293b' : '#ffffff',
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
            style={{
                padding: '6px 12px',
                backgroundColor: '#3b82f6',
                color: 'white',
                fontSize: '14px',
                fontWeight: '500',
                borderRadius: '6px',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                whiteSpace: 'nowrap',
                border: 'none',
                cursor: 'pointer',
                flexShrink: 0
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
            className={className}
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
