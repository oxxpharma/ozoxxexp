import { Button } from "./ui/button";
import { Calendar, CalendarPlus } from "lucide-react";
import { useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";

function formatICSDate(d) {
  const dt = new Date(d);
  return dt.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

export default function AddToCalendar({ event }) {
  if (!event) return null;
  const title = encodeURIComponent(event.name || "Ozoxx Experience");
  const details = encodeURIComponent(event.description || "");
  const location = encodeURIComponent(`${event.location_name || ""}, ${event.location_address || ""}`);
  const startUtc = formatICSDate(event.start_date);
  const endUtc = formatICSDate(event.end_date);

  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startUtc}/${endUtc}&details=${details}&location=${location}`;
  const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${event.start_date}&enddt=${event.end_date}&body=${details}&location=${location}`;

  const downloadICS = () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Ozoxx Experience//PT-BR",
      "BEGIN:VEVENT",
      `UID:${Date.now()}@ozoxx`,
      `DTSTAMP:${formatICSDate(new Date().toISOString())}`,
      `DTSTART:${startUtc}`,
      `DTEND:${endUtc}`,
      `SUMMARY:${event.name}`,
      `DESCRIPTION:${(event.description || "").replace(/\n/g, "\\n")}`,
      `LOCATION:${event.location_name}, ${event.location_address}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "ozoxx-experience.ics";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="border-white/15 text-white hover:bg-white/10 rounded-full px-6" data-testid="add-to-calendar-btn">
          <CalendarPlus className="w-4 h-4 mr-2" /> Adicionar à Agenda
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-ozx-bg2 border-white/10 text-white">
        <DropdownMenuItem onClick={() => window.open(googleUrl, "_blank")} data-testid="cal-google">
          <Calendar className="w-4 h-4 mr-2" /> Google Agenda
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => window.open(outlookUrl, "_blank")} data-testid="cal-outlook">
          <Calendar className="w-4 h-4 mr-2" /> Outlook
        </DropdownMenuItem>
        <DropdownMenuItem onClick={downloadICS} data-testid="cal-ics">
          <Calendar className="w-4 h-4 mr-2" /> Apple / .ics
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
