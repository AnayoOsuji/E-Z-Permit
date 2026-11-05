"use client";

import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client.ts";

/**
 * The signed-in user as the browser sees it: `undefined` until checked, then the user or null.
 * Lets statically generated pages (and the navbar, which sits on them) know who is viewing without
 * reading cookies on the server. Pass `recheckOn` (e.g. the pathname) to look again after navigation.
 */
export function useUser(recheckOn?: string): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setUser(null);
      return;
    }
    let active = true;
    supabase.auth.getSession().then(({ data }) => active && setUser(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [recheckOn]);

  return user;
}
