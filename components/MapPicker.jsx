 
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
  className: "zeriy-location-marker",
  html: `
    <div style="
      width:30px;
      height:30px;
      display:flex;
      align-items:center;
      justify-content:center;
      background:#4f46e5;
      border:4px solid white;
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      box-shadow:0 5px 18px rgba(79,70,229,.35);
    ">
      <div style="
        width:11px;
        height:11px;
        background:white;
        border-radius:50%;
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
    rawLat == null ||
    rawLng === "" ||
    rawLng == null
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
    const timer = requestAnimationFrame(() => {
      map.invalidateSize();

      map.flyTo(
        [position.latitude, position.longitude],
        Math.max(map.getZoom(), 15),
        {
          animate: true,
          duration: 0.4,
        }
      );
    });

    return () => cancelAnimationFrame(timer);
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
    if (closed.current) return;

    closed.current = true;
    onClose?.();
  }, [onClose]);

  // Prevent background scrolling.
  useEffect(() => {
    closed.current = false;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closePicker();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;

      window.removeEventListener("keydown", handleKeyDown);

      reverseRequest.current += 1;
      searchRequest.current += 1;
    };
  }, [closePicker]);

  // Reverse geocoding.
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
        `https://nominatim.openstreetmap.org/reverse?${params}`,
        {
          headers: {
            Accept: "application/json",
          },
        }
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
      if (
        requestId === reverseRequest.current &&
        !closed.current
      ) {
        setAddress("");
      }
    } finally {
      if (
        requestId === reverseRequest.current &&
        !closed.current
      ) {
        setLoadingAddress(false);
      }
    }
  }, []);

  // Select a location.
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

  // Search places.
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
        `https://nominatim.openstreetmap.org/search?${params}`,
        {
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Search is temporarily unavailable.");
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

      if (
        requestId !== searchRequest.current ||
        closed.current
      ) {
        return;
      }

      if (!places.length) {
        setError("No places found. Try a more specific search.");
      } else {
        setResults(places);
      }
    } catch (err) {
      if (
        requestId === searchRequest.current &&
        !closed.current
      ) {
        setError(err.message || "Unable to search for that place.");
      }
    } finally {
      if (
        requestId === searchRequest.current &&
        !closed.current
      ) {
        setSearching(false);
      }
    }
  };

  // Current location.
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

        setLocating(false);

        selectPosition({
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
        });
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
          setError("Unable to detect your location.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
      }
    );
  };

  // Confirm selected location.
  const confirmLocation = useCallback(() => {
    if (saving || closed.current) return;

    if (typeof onChange !== "function") {
      setError("Location save handler is missing.");
      return;
    }

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

      onChange(selectedLocation);
      closePicker();
    } catch (err) {
      setSaving(false);
      setError(err.message || "Could not save this location.");
    }
  }, [saving, position, address, onChange, closePicker]);

  return (
    <div
      className="
        fixed inset-0 z-[9999]
        flex items-center justify-center
        bg-slate-950/60 backdrop-blur-[3px]
        p-0 sm:p-4
      "
      style={{
        height: "100dvh",
        width: "100%",
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closePicker();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="zeriy-map-title"
        className="
          flex h-full w-full min-h-0 flex-col
          overflow-hidden bg-white
          shadow-2xl
          sm:h-[min(850px,94dvh)]
          sm:max-w-5xl
          sm:rounded-3xl
          sm:border sm:border-slate-200
        "
        onMouseDown={(event) => event.stopPropagation()}
      >
        {/* HEADER */}
        <header className="
          flex shrink-0 items-center justify-between
          border-b border-slate-100
          px-3 py-2.5
          sm:px-6 sm:py-4
        ">
          <div className="flex min-w-0 items-center gap-3">
            <div className="
              flex h-9 w-9 shrink-0 items-center justify-center
              rounded-xl bg-indigo-50 text-indigo-600
              sm:h-11 sm:w-11 sm:rounded-2xl
            ">
              <Building2 size={20} />
            </div>

            <div className="min-w-0">
              <h2
                id="zeriy-map-title"
                className="text-sm font-bold tracking-tight text-slate-900 sm:text-lg"
              >
                Business location
              </h2>

              <p className="text-[10px] text-slate-500 sm:text-sm">
                Set the exact location customers should visit
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closePicker}
            aria-label="Close location picker"
            className="
              flex h-9 w-9 shrink-0 items-center justify-center
              rounded-xl border border-slate-200
              text-slate-500 transition hover:bg-slate-50
            "
          >
            <X size={19} />
          </button>
        </header>

        {/* SEARCH */}
        <div className="
          relative z-[600] shrink-0
          border-b border-slate-100
          bg-white px-3 py-2
          sm:px-5 sm:py-3
        ">
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                size={16}
                className="
                  pointer-events-none absolute left-3
                  top-1/2 -translate-y-1/2 text-slate-400
                "
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
                className="
                  h-10 w-full rounded-xl
                  border border-slate-200
                  bg-slate-50 pl-10 pr-3
                  text-sm text-slate-800
                  outline-none transition
                  placeholder:text-slate-400
                  focus:border-indigo-400
                  focus:bg-white focus:ring-4 focus:ring-indigo-50
                "
              />
            </div>

            <button
              type="button"
              onClick={searchPlaces}
              disabled={searching}
              className="
                inline-flex h-10 shrink-0 items-center
                justify-center gap-2 rounded-xl
                bg-indigo-600 px-3
                text-xs font-semibold text-white
                transition hover:bg-indigo-700
                disabled:opacity-60
                sm:px-5 sm:text-sm
              "
            >
              {searching ? (
                <LoaderCircle size={17} className="animate-spin" />
              ) : (
                <Search size={17} />
              )}

              <span>Search</span>
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="
                mt-2 flex items-start gap-2
                rounded-xl border border-rose-100
                bg-rose-50 px-3 py-2
                text-xs text-rose-700
              "
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* SEARCH RESULTS */}
          {results.length > 0 && (
            <div className="
              absolute left-3 right-3 top-full
              z-[1000] max-h-48 overflow-y-auto
              rounded-xl border border-slate-200
              bg-white p-1.5 shadow-xl
              sm:left-5 sm:right-5
            ">
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
                  className="
                    flex w-full items-start gap-3
                    rounded-xl px-3 py-2.5
                    text-left transition hover:bg-indigo-50
                  "
                >
                  <span className="
                    mt-0.5 flex h-8 w-8 shrink-0
                    items-center justify-center
                    rounded-lg bg-indigo-50 text-indigo-600
                  ">
                    <MapPin size={16} />
                  </span>

                  <span className="min-w-0 text-xs leading-5 text-slate-700 sm:text-sm">
                    {result.address}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* MAP */}
        <div className="relative min-h-0 flex-1 bg-slate-100">
          <MapContainer
            center={[
              position.latitude,
              position.longitude,
            ]}
            zoom={15}
            scrollWheelZoom
            className="h-full w-full"
            style={{
              width: "100%",
              height: "100%",
            }}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapUpdater position={position} />

            <MapClickHandler onSelect={selectPosition} />

            <Marker
              position={[
                position.latitude,
                position.longitude,
              ]}
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

          {/* MAP INSTRUCTION */}
          <div className="
            pointer-events-none absolute
            left-2 top-2 z-[500]
            flex items-center gap-1.5
            rounded-lg border border-white
            bg-white/95 px-2.5 py-2
            shadow-md sm:left-5 sm:top-5 sm:gap-2 sm:px-3
          ">
            <Crosshair size={15} className="text-indigo-600" />

            <span className="text-[10px] font-semibold text-slate-700 sm:text-xs">
              Click map or drag pin
            </span>
          </div>

          {/* CURRENT LOCATION */}
          <button
            type="button"
            onClick={useCurrentLocation}
            disabled={locating}
            className="
              absolute right-2 top-2 z-[500]
              flex h-9 items-center gap-1.5
              rounded-lg border border-slate-200
              bg-white px-2.5
              text-xs font-semibold text-slate-700
              shadow-lg transition hover:bg-slate-50
              disabled:opacity-60
              sm:bottom-5 sm:right-5 sm:top-auto
              sm:h-11 sm:gap-2 sm:rounded-xl sm:px-4 sm:text-sm
            "
          >
            {locating ? (
              <LoaderCircle
                size={16}
                className="animate-spin text-indigo-600"
              />
            ) : (
              <Navigation
                size={16}
                className="text-indigo-600"
              />
            )}

            <span>
              {locating ? "Locating..." : "My location"}
            </span>
          </button>
        </div>

        {/* FOOTER */}
        <footer className="
          relative z-[600] shrink-0
          border-t border-slate-200
          bg-white px-3 py-2.5
          sm:px-6 sm:py-4
        ">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {/* LOCATION INFORMATION */}
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <div className="
                flex h-8 w-8 shrink-0
                items-center justify-center
                rounded-xl bg-indigo-50 text-indigo-600
                sm:h-10 sm:w-10
              ">
                <MapPin size={17} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-slate-900 sm:text-sm">
                  Selected location
                </p>

                <p className="truncate font-mono text-[9px] text-slate-500 sm:text-xs">
                  {position.latitude.toFixed(6)},{" "}
                  {position.longitude.toFixed(6)}
                </p>

                {loadingAddress ? (
                  <p className="
                    mt-0.5 flex items-center gap-1
                    text-[10px] text-indigo-600 sm:text-xs
                  ">
                    <LoaderCircle
                      size={11}
                      className="animate-spin"
                    />
                    Finding address...
                  </p>
                ) : (
                  <p className="
                    mt-0.5 truncate text-[10px]
                    text-slate-600 sm:text-xs
                  ">
                    {address || "Select a point on the map."}
                  </p>
                )}
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={closePicker}
                className="
                  inline-flex h-9 items-center justify-center
                  rounded-lg border border-slate-200
                  bg-white px-2.5
                  text-[11px] font-semibold text-slate-700
                  transition hover:bg-slate-50
                  sm:h-11 sm:rounded-xl sm:px-4 sm:text-sm
                "
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmLocation}
                disabled={saving}
                className="
                  inline-flex h-9 items-center justify-center
                  gap-1 rounded-lg
                  bg-indigo-600 px-2.5
                  text-[11px] font-semibold text-white
                  shadow-sm transition hover:bg-indigo-700
                  disabled:cursor-not-allowed disabled:opacity-60
                  sm:h-11 sm:gap-2 sm:rounded-xl sm:px-5 sm:text-sm
                "
              >
                {saving ? (
                  <LoaderCircle
                    size={15}
                    className="animate-spin"
                  />
                ) : (
                  <Check size={15} strokeWidth={2.5} />
                )}

                <span>
                  {saving ? "Saving..." : "Save"}
                </span>
              </button>
            </div>
          </div>
        </footer>
      </section>
    </div>
  );
}
