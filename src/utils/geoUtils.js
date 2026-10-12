import { featureCollection, point, lineString } from '@turf/helpers';
import convex from '@turf/convex';
import buffer from '@turf/buffer';

export const STATUS_COLORS = {
    'Not Approached': '#ef4444', 
    'Interest Letter Sent': '#f97316', 
    'Interested Letter Sent': '#f97316', 
    'Society Docs Received': '#eab308', 
    'Architect Survey Phase': '#84cc16', 
    'Architect Survey Completed': '#06b6d4', 
    'Offer Letter Sent': '#3b82f6', 
    'Offer Under Negotiation': '#a855f7', 
    'Meeting Finalized': '#ec4899', 
    'Offer Accepted': '#ec4899', 
    'Approved': '#22c55e', 
    'Consent Phase': '#14b8a6', 
    'DA Phase': '#a0522d', 
    'Plan & CC Phase': '#22c55e'
};

/**
 * Returns canonical hex color for a property status.
 * @param {string} status 
 * @returns {string} Hex color
 */
export function getStatusColor(status) {
    return STATUS_COLORS[status] || '#9ca3af';
}

export const GROUP_PALETTE = [
    '#7c3aed', // Purple / Violet
    '#0284c7', // Sky Blue
    '#059669', // Emerald Green
    '#ea580c', // Tangerine / Vivid Orange
    '#e11d48', // Crimson Rose
    '#d97706', // Rich Amber
    '#0891b2', // Teal / Cyan
    '#4f46e5', // Royal Indigo
    '#c026d3', // Magenta / Fuchsia
    '#16a34a', // Forest Green
];

/**
 * Returns a consistent, distinct color for a given group ID or index.
 * @param {string} groupId 
 * @param {number} [index] 
 * @returns {string} Hex color code
 */
export function getGroupColor(groupId, index) {
    if (typeof index === 'number' && index >= 0) {
        return GROUP_PALETTE[index % GROUP_PALETTE.length];
    }
    if (!groupId) return GROUP_PALETTE[0];
    let hash = 0;
    const str = String(groupId);
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    const idx = Math.abs(hash) % GROUP_PALETTE.length;
    return GROUP_PALETTE[idx];
}

/**
 * Generates a mathematical boundary (buffer or convex hull) for clubbed properties.
 * @param {Array} properties - Array of property objects with lat/lng
 * @returns {Array} - Array of paths (arrays of {lat, lng} coordinates) forming the final polygon
 */
export async function getClubBoundary(properties) {
    if (!properties || properties.length === 0) return null;

    // 1. Extract coordinates from property pins
    let coordinates = [];
    properties.forEach(p => {
        if (p.lat && p.lng) {
            // Note: Turf.js expects coordinates in [Longitude, Latitude] order
            coordinates.push([parseFloat(p.lng), parseFloat(p.lat)]);
        }
    });

    // 2. Mathematical Shape Generation (Turf.js)
    try {
        if (coordinates.length === 0) return null;

        // Scenario A: Only 1 point
        if (coordinates.length === 1) {
            const pt = point(coordinates[0]);
            // Draw a 25m circular radius around the single pin
            const bufferedPoint = buffer(pt, 25, { units: 'meters' }); 
            return [bufferedPoint.geometry.coordinates[0].map(coord => ({ lat: coord[1], lng: coord[0] }))];
        }

        // Scenario B: Exactly 2 points
        // Convex Hull fails on a flat 2D line, so we draw a thick buffered pill/capsule shape
        if (coordinates.length === 2) {
            const line = lineString(coordinates);
            // Draw a 20m thick capsule connecting the two properties
            const bufferedLine = buffer(line, 20, { units: 'meters' }); 
            return [bufferedLine.geometry.coordinates[0].map(coord => ({ lat: coord[1], lng: coord[0] }))];
        }

        // Scenario C: 3+ points
        // Wrap a tight "rubber band" (Convex Hull) around all points to create a perfect polygon boundary
        const points = featureCollection(coordinates.map(coord => point(coord)));
        const hull = convex(points);

        if (hull) {
            return [hull.geometry.coordinates[0].map(coord => ({ lat: coord[1], lng: coord[0] }))];
        }

        return null;

    } catch (mathError) {
        console.error("GeoUtils Error: Failed to generate boundaries mathematically", mathError);
        return null;
    }
}