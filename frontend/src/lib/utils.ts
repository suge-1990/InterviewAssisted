import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Get backend API base URL, works on both localhost and LAN access */
export function getApiUrl() {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window === 'undefined') return 'http://localhost:8000/api';
  return `http://${window.location.hostname}:8000/api`;
}

/** Get backend WebSocket base URL, works on both localhost and LAN access */
export function getWsUrl() {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  if (typeof window === 'undefined') return 'ws://localhost:8000/ws';
  return `ws://${window.location.hostname}:8000/ws`;
}

/** Get backend base URL (no /api suffix) */
export function getBaseUrl() {
  if (typeof window === 'undefined') return 'http://localhost:8000';
  return `http://${window.location.hostname}:8000`;
}
