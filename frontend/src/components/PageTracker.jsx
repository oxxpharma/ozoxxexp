import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import api from "../lib/api";
import { captureUTM, getUTM, getOrCreateSessionId } from "../lib/utm";

export default function PageTracker() {
  const location = useLocation();
  useEffect(() => {
    captureUTM();
    const utm = getUTM();
    api.post("/tracking/pageview", {
      path: location.pathname,
      utm_source: utm.utm_source,
      utm_medium: utm.utm_medium,
      utm_campaign: utm.utm_campaign,
      referrer: document.referrer || "",
      leader_slug: utm.leader_slug,
      session_id: getOrCreateSessionId(),
    }).catch(() => {});
  }, [location.pathname]);
  return null;
}
