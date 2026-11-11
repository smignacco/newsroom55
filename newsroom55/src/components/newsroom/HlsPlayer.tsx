"use client";

import { useEffect, useRef } from "react";
import Hls from "hls.js";
import type { PublicChannel } from "@/lib/video/player";
import { hlsBufferProfile } from "@/lib/video/buffer-profile";

export type PlaybackState = "idle" | "loading" | "playing" | "error";

export function HlsPlayer({
  channel,
  muted,
  concurrentStreams,
  onState,
}: {
  channel: PublicChannel;
  muted: boolean;
  concurrentStreams: number;
  onState: (state: PlaybackState, message?: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    if (!muted) void video.play().catch(() => onState("error", "Touchez l’écran pour autoriser l’audio."));
  }, [muted, onState]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    let hls: Hls | null = null;
    let networkRetries = 0;
    let mediaRetries = 0;
    let nativeRetries = 0;
    let usingNativeHls = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const controller = new AbortController();
    const profile = hlsBufferProfile(concurrentStreams);

    const schedule = (callback: () => void, delay: number) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (!cancelled) callback();
      }, delay);
      timers.add(timer);
    };

    const fail = (message: string) => {
      if (!cancelled) onState("error", message);
    };
    const play = async () => {
      try {
        await video.play();
      } catch {
        fail("Lecture automatique bloquée. Touchez « Audio actif », puis réessayez.");
      }
    };
    const start = async () => {
      onState("loading");
      try {
        let playbackUrl = "";
        let lastError = "Flux HLS indisponible";
        for (let attempt = 0; attempt < 3 && !playbackUrl; attempt += 1) {
          const response = await fetch(`/api/video/channels/${channel.id}`, {
            cache: "no-store",
            signal: controller.signal,
          });
          const data = (await response.json().catch(() => ({}))) as {
            playbackUrl?: string;
            error?: string;
          };
          if (response.ok && data.playbackUrl) playbackUrl = data.playbackUrl;
          else lastError = data.error || `Flux HLS indisponible (${response.status})`;
          if (!playbackUrl && attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
          }
        }
        if (!playbackUrl) throw new Error(lastError);
        if (cancelled) return;

        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          usingNativeHls = true;
          video.src = playbackUrl;
          video.addEventListener("loadedmetadata", play, { once: true });
          return;
        }
        if (!Hls.isSupported()) throw new Error("Ce navigateur ne prend en charge ni HLS natif ni Media Source.");

        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: profile.backSeconds,
          maxBufferLength: profile.forwardSeconds,
          maxMaxBufferLength: profile.maximumSeconds,
          maxBufferSize: profile.maximumBytes,
          liveSyncDurationCount: 4,
          liveMaxLatencyDurationCount: 12,
          maxBufferHole: 0.5,
        });
        hls.loadSource(playbackUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => void play());
        hls.on(Hls.Events.ERROR, (_event, details) => {
          if (!details.fatal) return;
          if (details.type === Hls.ErrorTypes.NETWORK_ERROR) {
            if (networkRetries < 5) {
              const delay = 1000 * 2 ** networkRetries;
              networkRetries += 1;
              onState("loading", `Reconnexion au flux (${networkRetries}/5)…`);
              schedule(() => hls?.startLoad(-1), delay);
              return;
            }
            fail("Le flux ne répond plus après cinq tentatives.");
          } else if (details.type === Hls.ErrorTypes.MEDIA_ERROR) {
            if (mediaRetries < 3) {
              mediaRetries += 1;
              onState("loading", `Récupération du décodage (${mediaRetries}/3)…`);
              hls?.recoverMediaError();
              return;
            }
            fail("Le décodage du flux n’a pas pu être récupéré.");
          } else {
            fail("La lecture HLS a échoué.");
          }
          hls?.destroy();
          hls = null;
        });
      } catch (error) {
        fail(error instanceof Error ? error.message : "Impossible de démarrer le flux.");
      }
    };

    const onPlaying = () => {
      networkRetries = 0;
      mediaRetries = 0;
      nativeRetries = 0;
      onState("playing");
    };
    const onWaiting = () => onState("loading");
    const onVideoError = () => {
      if (!usingNativeHls && hls) return;
      if (usingNativeHls && nativeRetries < 3) {
        nativeRetries += 1;
        onState("loading", `Reconnexion native (${nativeRetries}/3)…`);
        schedule(() => {
          video.load();
          void play();
        }, 1000 * 2 ** (nativeRetries - 1));
        return;
      }
      fail("Le navigateur n’a pas pu décoder ce flux.");
    };
    video.addEventListener("playing", onPlaying);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("error", onVideoError);
    void start();

    return () => {
      cancelled = true;
      controller.abort();
      for (const timer of timers) clearTimeout(timer);
      hls?.destroy();
      video.pause();
      video.removeAttribute("src");
      video.load();
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("error", onVideoError);
      onState("idle");
    };
  }, [channel.id, concurrentStreams, onState]);

  return (
    <video
      ref={videoRef}
      className="nr-hls-video"
      muted={muted}
      autoPlay
      playsInline
      preload="auto"
      aria-label={`Flux vidéo ${channel.name}`}
    />
  );
}
