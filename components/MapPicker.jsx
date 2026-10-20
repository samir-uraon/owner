
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import {
  MapPin,
  Search,
  LocateFixed,
  X,
  Check,
  LoaderCircle,
  Navigation,
  AlertCircle,
  Crosshair,
  Building2,
} from "lucide-react";
import "leaflet/dist/leaflet.css";

const DEFAULT_POSITION = {
  latitude: 22.5726,
  longitude: 88.3639,
};

const markerIcon = L.divIcon({
  className: "zeric-location-marker",
  html: `
    <div style="
      width:30px;height:30px;
      display:flex;align-items:center;justify-content:center;
      background:#4f46e5;border:4px solid #ffffff;
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      box-shadow:0 5px 18px rgba(79,70,229,.35);
    ">
      <div style="
        width:11px;height:11px;
        background:#ffffff;border-radius:50%;
      "></div>
    </div>
  `,
  iconSize: [42, 42],
  iconAnchor: [21, 42],
});

function validCoordinate(latitude, longitude) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function getPosition(value, initialPosition) {
  const source = value ?? initialPosition;

  if (!source) return DEFAULT_POSITION;

  const rawLat = source.latitude ?? source.lat;
  const rawLng = source.longitude ?? source.lng;

  if (
    rawLat === "" ||
    rawLat === null ||
    rawLat === undefined ||
    rawLng === "" ||
    rawLng === null ||
    rawLng === undefined
  ) {
    return DEFAULT_POSITION;
  }

  const latitude = Number(rawLat);
  const longitude = Number(rawLng);

  return validCoordinate(latitude, longitude)
    ? { latitude, longitude }
    : DEFAULT_POSITION;
}

function MapUpdater({ position }) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();

    map.flyTo(
      [position.latitude, position.longitude],
      Math.max(map.getZoom(), 15),
      { animate: true, duration: 0.4 }
    );
  }, [map, position.latitude, position.longitude]);

  return null;
}

function MapClickHandler({ onSelect }) {
  useMapEvents({
    click(event) {
      onSelect({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      });
    },
  });

  return null;
}

export default function MapPicker({
  value,
  initialPosition,
  initialAddress = "",
  onChange,
  onClose,
}) {
  const [position, setPosition] = useState(() =>
    getPosition(value, initialPosition)
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [address, setAddress] = useState(
    initialAddress || value?.address || ""
  );
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const reverseRequest = useRef(0);
  const searchRequest = useRef(0);
  const closed = useRef(false);

const closePicker = useCallback(() => {
  closed.current = true;
  onClose?.();
}, [onClose]);

  useEffect(() => {
    closed.current = false;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closePicker();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      reverseRequest.current += 1;
      searchRequest.current += 1;
    };
  }, [closePicker]);

  const reverseGeocode = useCallback(async (latitude, longitude) => {
    const requestId = ++reverseRequest.current;
    setLoadingAddress(true);

    try {
      const params = new URLSearchParams({
        format: "jsonv2",
        lat: String(latitude),
        lon: String(longitude),
      });

      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
        { headers: { Accept: "application/json" } }
      );

      if (!response.ok) {
        throw new Error("Address lookup failed.");
      }

      const data = await response.json();

      if (
        requestId === reverseRequest.current &&
        !closed.current
      ) {
        setAddress(data.display_name || "");
      }
    } catch {
      if (requestId === reverseRequest.current && !closed.current) {
        setAddress("");
      }
    } finally {
      if (requestId === reverseRequest.current && !closed.current) {
        setLoadingAddress(false);
      }
    }
  }, []);

  const selectPosition = useCallback(
    (nextPosition, nextAddress = null) => {
      if (
        !validCoordinate(
          nextPosition.latitude,
          nextPosition.longitude
        )
      ) {
        setError("That location has invalid coordinates.");
        return;
      }

      reverseRequest.current += 1;
      setPosition(nextPosition);
      setError("");
      setResults([]);
      setLoadingAddress(false);

      if (typeof nextAddress === "string") {
        setAddress(nextAddress);
      } else {
        setAddress("");
        reverseGeocode(
          nextPosition.latitude,
          nextPosition.longitude
        );
      }
    },
    [reverseGeocode]
  );

  const searchPlaces = async () => {
    const query = searchQuery.trim();

    if (!query) {
      setError("Enter a business address, area, or landmark.");
      return;
    }

    const requestId = ++searchRequest.current;

    setSearching(true);
    setError("");
    setResults([]);

    try {
      const params = new URLSearchParams({
        q: query,
        format: "jsonv2",
        limit: "5",
        addressdetails: "1",
      });

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
        { headers: { Accept: "application/json" } }
      );

      if (!response.ok) {
        throw new Error("Search is temporarily unavailable. Please try again.");
      }

      const data = await response.json();

      const places = (Array.isArray(data) ? data : [])
        .map((item) => ({
          id: item.place_id,
          latitude: Number(item.lat),
          longitude: Number(item.lon),
          address: item.display_name,
        }))
        .filter(
          (item) =>
            item.id != null &&
            validCoordinate(item.latitude, item.longitude)
        );

      if (requestId !== searchRequest.current || closed.current) return;

      if (!places.length) {
        setError("No places found. Try a more specific search.");
      } else {
        setResults(places);
      }
    } catch (err) {
      if (requestId === searchRequest.current && !closed.current) {
        setError(err.message || "Unable to search for that place.");
      }
    } finally {
      if (requestId === searchRequest.current && !closed.current) {
        setSearching(false);
      }
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Your browser does not support location access.");
      return;
    }

    setLocating(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      (result) => {
        if (closed.current) return;

        const nextPosition = {
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
        };

        setLocating(false);
        selectPosition(nextPosition);
      },
      (geoError) => {
        if (closed.current) return;

        setLocating(false);

        if (geoError.code === 1) {
          setError(
            "Location permission denied. Allow location access or search for your address."
          );
        } else if (geoError.code === 3) {
          setError("Location request timed out. Please try again.");
        } else {
          setError("Unable to detect your location. Please try again.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
      }
    );
  };

const confirmLocation = useCallback(() => {
  if (saving || closed.current) return;

  setSaving(true);
  setError("");

  try {
    const selectedLocation = {
      latitude: position.latitude,
      longitude: position.longitude,
      lat: position.latitude,
      lng: position.longitude,
      address: address.trim(),
    };

    if (typeof onChange !== "function") {
      throw new Error("Location save handler is missing.");
    }

    onChange(selectedLocation);
    closePicker();
  } catch (error) {
    setSaving(false);
    setError(error.message || "Could not save this location.");
  }
}, [saving, position, address, onChange, closePicker]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/50 p-0 backdrop-blur-[3px] sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closePicker();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="zeric-map-title"
        className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-[min(850px,92dvh)] sm:max-w-5xl sm:rounded-3xl sm:border sm:border-slate-200"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {/* Top bar */}
        <header className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <Building2 size={21} />
            </div>

            <div className="min-w-0">
              <h2
                id="zeric-map-title"
                className="text-base font-bold tracking-tight text-slate-900 sm:text-lg"
              >
                Business location
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
                Set the exact location customers should visit
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closePicker}
            aria-label="Close location picker"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <X size={19} />
          </button>
        </header>

        {/* Search controls */}
        <div className="relative z-[600] shrink-0 border-b border-slate-100 bg-white p-2 sm:p-5">
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                size={12}
                className="pointer-events-none absolute left-4.5  top-2.5 text-slate-400"
              />

              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    searchPlaces();
                  }
                }}
                placeholder="Search address or landmark"
                aria-label="Search business address"
                className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50"
              />
            </div>

            <button
              type="button"
              onClick={searchPlaces}
              disabled={searching}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 sm:px-5"
            >
              {searching ? (
                <LoaderCircle size={17} className="animate-spin" />
              ) : (
                <Search size={17} />
              )}
              <span className="hidden sm:inline">Search</span>
            </button>

          
          </div>

          {error && (
            <div
              role="alert"
              className="mt-3 flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2.5 text-sm text-rose-700"
            >
              <AlertCircle size={17} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {results.length > 0 && (
            <div className="absolute left-3 right-3 top-[calc(100%-5px)] max-h-52 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl sm:left-5 sm:right-5">
              {results.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() =>
                    selectPosition(
                      {
                        latitude: result.latitude,
                        longitude: result.longitude,
                      },
                      result.address
                    )
                  }
                  className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-indigo-50"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <MapPin size={16} />
                  </span>
                  <span className="min-w-0 text-sm leading-5 text-slate-700">
                    {result.address}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Map */}
        <div className="relative min-h-0 flex-1 bg-slate-100">
          <MapContainer
            center={[position.latitude, position.longitude]}
            zoom={15}
            scrollWheelZoom
            className="h-full w-full"
            style={{ minHeight: 200 }}
          >
            <TileLayer
              attribution='&copy; Zeric contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapUpdater position={position} />
            <MapClickHandler onSelect={selectPosition} />

            <Marker
              position={[position.latitude, position.longitude]}
              icon={markerIcon}
              draggable
              eventHandlers={{
                dragend(event) {
                  const latlng = event.target.getLatLng();

                  selectPosition({
                    latitude: latlng.lat,
                    longitude: latlng.lng,
                  });
                },
              }}
            />
          </MapContainer>

          <div className="pointer-events-none absolute left-3 top-3 z-[500] flex items-center gap-2 rounded-xl border border-white bg-white/95 px-3 py-2.5 shadow-md sm:left-5 sm:top-5">
            <Crosshair size={16} className="text-indigo-600" />
            <span className="text-xs font-semibold text-slate-700">
              Click the map or drag the pin
            </span>
          </div>

          <button
            type="button"
            onClick={useCurrentLocation}
            disabled={locating}
            className="absolute  top-5 right-3 z-[500] flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-lg transition hover:bg-slate-50 sm:bottom-5 sm:right-5"
          >
            {locating ? (
              <LoaderCircle size={17} className="animate-spin text-indigo-600" />
            ) : (
              <Navigation size={17} className="text-indigo-600" />
            )}
            <span>My location</span>
          </button>
        </div>

    
{/* Location details and actions */}
<footer className="relative z-[600] shrink-0 border-t border-slate-200 bg-white px-3 py-3 sm:px-6 sm:py-4">
  <div className="flex min-w-0 items-center gap-3">
    {/* Location details */}
    <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 sm:h-10 sm:w-10">
        <MapPin size={10} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-slate-900 sm:text-sm">
          Selected location
        </p>

        <p className="truncate font-mono text-[10px] text-slate-500 sm:text-xs">
          {position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}
        </p>

        {loadingAddress ? (
          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-indigo-600 sm:text-xs">
            <LoaderCircle size={12} className="animate-spin" />
            Finding address...
          </p>
        ) : address ? (
          <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-600 sm:text-xs">
            {address}
          </p>
        ) : (
          <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-500 sm:text-xs">
            Select a point on the map.
          </p>
        )}
      </div>
    </div>

    {/* Actions on the same line */}
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          closePicker();
        }}
        className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 sm:h-12 sm:rounded-xl sm:px-4 sm:text-sm"
      >
        Cancel
      </button>

      <button
        type="button"
        onClick={confirmLocation}
        disabled={saving}
        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 sm:h-12 sm:gap-2 sm:rounded-xl sm:px-5 sm:text-sm"
      >
        {saving ? (
          <LoaderCircle size={16} className="animate-spin" />
        ) : (
          <Check size={16} strokeWidth={2.5} />
        )}
        <span>{saving ? "Saving..." : "Save location"}</span>
      </button>
    </div>
  </div>
</footer>

      </section>
    </div>
  );
}
