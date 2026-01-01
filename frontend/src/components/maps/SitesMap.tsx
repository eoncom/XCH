'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Site } from '@/types';

// Fix for default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface SitesMapProps {
  sites: Site[];
  selectedSiteId?: string;
  onSiteClick?: (site: Site) => void;
  height?: string;
}

export default function SitesMap({
  sites,
  selectedSiteId,
  onSiteClick,
  height = '500px',
}: SitesMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Create map centered on France
    const map = L.map(mapContainerRef.current).setView([46.603354, 1.888334], 6);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    markersLayerRef.current = L.layerGroup().addTo(map);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update markers when sites change
  useEffect(() => {
    if (!mapRef.current || !markersLayerRef.current) return;

    // Clear existing markers
    markersLayerRef.current.clearLayers();

    // Filter sites with valid coordinates
    const sitesWithCoords = sites.filter(
      (site) => site.latitude != null && site.longitude != null
    );

    if (sitesWithCoords.length === 0) return;

    // Add markers
    const markers: L.Marker[] = [];
    sitesWithCoords.forEach((site) => {
      if (site.latitude == null || site.longitude == null) return;

      const marker = L.marker([site.latitude, site.longitude]);

      // Customize marker for selected site
      if (selectedSiteId && site.id === selectedSiteId) {
        marker.setIcon(
          L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41],
          })
        );
      }

      // Add popup
      const popupContent = `
        <div>
          <h3 style="font-weight: bold; margin-bottom: 4px;">${site.name}</h3>
          <p style="margin: 0; font-size: 12px; color: #666;">${site.code}</p>
          ${site.city ? `<p style="margin: 0; font-size: 12px;">${site.city}</p>` : ''}
          <p style="margin-top: 4px; font-size: 12px;">
            <span style="padding: 2px 6px; background: ${
              site.status === 'ACTIVE' ? '#10b981' :
              site.status === 'MAINTENANCE' ? '#f59e0b' : '#6b7280'
            }; color: white; border-radius: 4px;">${site.status}</span>
          </p>
        </div>
      `;
      marker.bindPopup(popupContent);

      // Add click handler
      if (onSiteClick) {
        marker.on('click', () => {
          onSiteClick(site);
        });
      }

      markers.push(marker);
      markersLayerRef.current?.addLayer(marker);
    });

    // Fit map to markers
    if (markers.length > 0) {
      const group = L.featureGroup(markers);
      mapRef.current.fitBounds(group.getBounds(), { padding: [50, 50] });
    }
  }, [sites, selectedSiteId, onSiteClick]);

  return (
    <div
      ref={mapContainerRef}
      style={{ height, width: '100%', borderRadius: '8px' }}
      className="z-0"
    />
  );
}
