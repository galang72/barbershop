"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface UserSession {
  id: string;
  username: string;
  email: string;
  name: string;
  role: string;
  branch?: string;
}

interface UserContextValue {
  user: UserSession | null;
  loading: boolean;
  refresh: () => void;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  loading: true,
  refresh: () => {},
});

let _globalUser: UserSession | null = null;
let _globalLoading = true;
let _fetchPromise: Promise<void> | null = null;
const _listeners: Set<() => void> = new Set();

function notifyAll() {
  _listeners.forEach((fn) => fn());
}

function fetchUserOnce() {
  if (_fetchPromise) return _fetchPromise;
  _fetchPromise = fetch("/api/auth/me", { cache: "no-store" })
    .then((res) => res.json())
    .then((data) => {
      _globalUser = data.authenticated && data.user ? data.user : null;
      _globalLoading = false;
      notifyAll();
    })
    .catch(() => {
      _globalUser = null;
      _globalLoading = false;
      notifyAll();
    })
    .finally(() => {
      // Allow re-fetch after 30 seconds
      setTimeout(() => { _fetchPromise = null; }, 30000);
    });
  return _fetchPromise;
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(_globalUser);
  const [loading, setLoading] = useState(_globalLoading);

  useEffect(() => {
    const update = () => {
      setUser(_globalUser);
      setLoading(_globalLoading);
    };
    _listeners.add(update);

    if (_globalLoading) {
      fetchUserOnce();
    } else {
      update();
    }

    return () => {
      _listeners.delete(update);
    };
  }, []);

  const refresh = () => {
    _fetchPromise = null;
    _globalLoading = true;
    fetchUserOnce();
  };

  return (
    <UserContext.Provider value={{ user, loading, refresh }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
