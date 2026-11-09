"use client";

import dynamic from "next/dynamic";

// The map library needs the browser, so it never renders on the server.
const MapClient = dynamic(() => import("./IncidentMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface-2" />,
});

export default MapClient;
