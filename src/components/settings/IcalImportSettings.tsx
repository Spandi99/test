"use client";

import { useCallback, useRef, useState } from "react";

import { Loader2, Upload, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useCalendarStore } from "@/store/calendar";

interface ImportResponse {
  feedId: string;
  imported: number;
  feedName: string;
}

export function IcalImportSettings() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [feedName, setFeedName] = useState("");
  const [icalUrl, setIcalUrl] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [isImporting, setIsImporting] = useState(false);
  const [lastImported, setLastImported] = useState<ImportResponse | null>(null);

  const { refreshEvents, refreshFeeds } = useCalendarStore();

  const triggerImport = useCallback(
    async (payload: { icalData?: string; icalUrl?: string }) => {
      if (!payload.icalData && !payload.icalUrl) {
        toast.error("Bitte geben Sie entweder eine iCal-Datei oder einen Link an.");
        return;
      }

      setIsImporting(true);
      try {
        const response = await fetch("/api/import/ical", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            feedName: feedName.trim() || undefined,
            color,
            ...payload,
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({ error: undefined }));
          throw new Error(data.error || "Import fehlgeschlagen");
        }

        const data = (await response.json()) as ImportResponse;
        setLastImported(data);
        toast.success(
          `Kalender „${data.feedName}“ wurde importiert. ${data.imported} Termine hinzugefügt.`
        );

        await Promise.all([refreshFeeds(), refreshEvents()]);
      } catch (error) {
        console.error("Failed to import iCal data", error);
        toast.error(
          error instanceof Error ? error.message : "Import fehlgeschlagen"
        );
      } finally {
        setIsImporting(false);
      }
    },
    [color, feedName, refreshEvents, refreshFeeds]
  );

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();

      if (!feedName.trim()) {
        const inferredName = file.name.replace(/\.ics$/i, "");
        setFeedName(inferredName);
      }

      await triggerImport({ icalData: text });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleUrlImport = async () => {
    if (!icalUrl.trim()) {
      toast.error("Bitte geben Sie einen gültigen iCal-Link ein.");
      return;
    }

    await triggerImport({ icalUrl: icalUrl.trim() });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>iCal Import</CardTitle>
          <CardDescription>
            Importieren Sie Termine aus einer iCal-Datei oder einem iCal-Link in
            Ihren Fluid Calendar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="feed-name">Name des Kalenders</Label>
              <Input
                id="feed-name"
                placeholder="z. B. Uni Stundenplan"
                value={feedName}
                onChange={(event) => setFeedName(event.target.value)}
                disabled={isImporting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="feed-color">Farbe</Label>
              <Input
                id="feed-color"
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                disabled={isImporting}
                className="h-10 w-full cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ical-url">iCal-Link</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="ical-url"
                placeholder="https://example.de/stundenplan.ics"
                value={icalUrl}
                onChange={(event) => setIcalUrl(event.target.value)}
                disabled={isImporting}
              />
              <Button
                onClick={handleUrlImport}
                disabled={isImporting}
                className="flex items-center gap-2"
              >
                {isImporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LinkIcon className="h-4 w-4" />
                )}
                Aus Link importieren
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>iCal-Datei</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={handleImportClick}
                disabled={isImporting}
                className="flex items-center gap-2"
              >
                {isImporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Datei auswählen
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".ics"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Unterstützt Standard-iCal-Dateien (.ics). Die Termine werden in
              einen neuen lokalen Kalender importiert.
            </p>
          </div>

          {lastImported && (
            <div className="rounded-md border border-muted-foreground/20 bg-muted p-4 text-sm">
              <p className="font-medium">
                Letzter Import: „{lastImported.feedName}“ mit {lastImported.imported}
                {" "}
                Terminen.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

