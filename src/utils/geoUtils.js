import { featureCollection, point, lineString } from '@turf/helpers';
import convex from '@turf/convex';
import buffer from '@turf/buffer';

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