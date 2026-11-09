"use client";

// Interactive incident map (MapLibre GL). Shows each incident as a dot colored by severity,
// grouped into numbered clusters when zoomed out. Use it through <MapClient>, which skips server rendering.
import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MLMap, GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Incident } from "@/lib/data";

// The map's background worker is copied to /public on npm install (see package.json postinstall).
maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");

// Free OpenFreeMap basemap (OpenStreetMap data, no API key). Swap for Mapbox later if you want.
const STYLE = "https://tiles.openfreemap.org/styles/positron";
const AUSTIN: [number, number] = [-97.7431, 30.2672];

// Map data format: one point per incident, carrying the fields the layers below need.
function toGeoJSON(items: Incident[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: items.map((i) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [i.lng, i.lat] },
      properties: { id: i.id, severity: i.severity },
    })),
  };
}

export default function IncidentMap({
  items,
  interactive = true,
  onSelect,
  className = "",
}: {
  items: Incident[];
  /** false = small static preview (no zoom, pan, clusters or clicks). */
  interactive?: boolean;
  /** Called with the incident id when a dot is clicked. */
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  // Latest props, readable from map event handlers without recreating the map.
  const itemsRef = useRef(items);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    itemsRef.current = items;
    onSelectRef.current = onSelect;
  });

  // Create the map once.
  useEffect(() => {
    if (!ref.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: STYLE,
      center: AUSTIN,
      zoom: interactive ? 11.6 : 10.8,
      interactive,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    if (interactive) map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

    // Add our layers as soon as the basemap style is ready.
    map.on("style.load", () => {
      map.addSource("incidents", { type: "geojson", data: toGeoJSON(itemsRef.current), cluster: interactive, clusterRadius: 42, clusterMaxZoom: 13 });

      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "incidents",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#5b3fd6",
          "circle-opacity": 0.9,
          "circle-radius": ["step", ["get", "point_count"], 16, 8, 20, 20, 26],
          "circle-stroke-width": 4,
          "circle-stroke-color": "rgba(91,63,214,0.25)",
        },
      });
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "incidents",
        filter: ["has", "point_count"],
        layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12, "text-font": ["Noto Sans Bold"] },
        paint: { "text-color": "#fff" },
      });
      map.addLayer({
        id: "points",
        type: "circle",
        source: "incidents",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": ["match", ["get", "severity"], "high", "#e5484d", "medium", "#f08c1a", "#d6a700"],
          "circle-radius": interactive ? 8 : 6,
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "#fff",
        },
      });

      if (!interactive) return;

      // Clicking a cluster zooms in until it splits apart.
      map.on("click", "clusters", async (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const src = map.getSource("incidents") as GeoJSONSource;
        const zoom = await src.getClusterExpansionZoom(f.properties.cluster_id);
        map.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom });
      });

      map.on("click", "points", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        onSelectRef.current?.(String(f.properties.id));
        map.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number] });
      });

      for (const layer of ["clusters", "points"]) {
        map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [interactive]);

  // Update points when filters change.
  useEffect(() => {
    const src = mapRef.current?.getSource("incidents") as GeoJSONSource | undefined;
    src?.setData(toGeoJSON(items));
  }, [items]);

  return <div ref={ref} className={className} />;
}
