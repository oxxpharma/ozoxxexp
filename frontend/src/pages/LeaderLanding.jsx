import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

export default function LeaderLanding() {
  const { slug } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    localStorage.setItem("ozx_leader_slug", slug);
    navigate("/?ref=" + slug, { replace: true });
  }, [slug, navigate]);
  return null;
}
