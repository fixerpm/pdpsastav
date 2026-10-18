import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { BRAND_CONFIG } from "@/config/branding";
import { parseErrorMessage } from "@/lib/error-parser";

export default function MeetingsModal({
  isOpen,
  onClose,
  currentUser,
  meeting, // Active meeting object from Convex
  onCreateMeeting,
  onJoinMeeting,
  onLeaveMeeting,
  onEndMeeting,
  onUpdateMediaState,
  convexGetMeeting,
  currentGroupId,
}) {
  const [meetingMode, setMeetingMode] = useState("lobby"); // "lobby" | "in-meeting"
  const [meetingTitle, setMeetingTitle] = useState("");
  const [joinMeetingId, setJoinMeetingId] = useState("");
  const [activeMeetingId, setActiveMeetingId] = useState(null);
  const [isAudioOnly, setIsAudioOnly] = useState(false);
  const [isStartingMeeting, setIsStartingMeeting] = useState(false);
  const [isJoiningMeeting, setIsJoiningMeeting] = useState(false);

  // Local media streams
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);
  const [feedback, setFeedback] = useState("");

  const localVideoRef = useRef(null);
  const screenVideoRef = useRef(null);
  const durationTimerRef = useRef(null);

  // Stop all media tracks helper
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    screenStreamRef.current = screenStream;
  }, [screenStream]);

  // Stop all media tracks helper
  const stopAllTracks = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      setScreenStream(null);
      setIsScreenSharing(false);
    }
  };

  // Duration timer
  useEffect(() => {
    if (meetingMode !== "in-meeting") return;

    durationTimerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    };
  }, [meetingMode]);

  // Clean up media on unmount
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Attach local stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, meetingMode]);

  // Attach screen stream to video element
  useEffect(() => {
    if (screenVideoRef.current && screenStream) {
      screenVideoRef.current.srcObject = screenStream;
    }
  }, [screenStream, isScreenSharing]);

  if (!isOpen) return null;

  const formatDuration = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Start media devices
  const initUserMedia = async (audioOnly = false) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: audioOnly ? false : { width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      setLocalStream(stream);
      setIsVideoOff(audioOnly);
      setIsMuted(false);
      return stream;
    } catch (err) {
      console.warn("Media devices error:", err);
      setFeedback("Kamera yoki mikrofon ruxsati berilmadi. Faqat audio rejimida davom etishingiz mumkin.");
      try {
        const audioOnlyStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setLocalStream(audioOnlyStream);
        setIsVideoOff(true);
        return audioOnlyStream;
      } catch (audioErr) {
        setFeedback("Kamera va mikrofonga ulanib bo‘lmadi.");
        return null;
      }
    }
  };

  // Create Instant Meeting
  const handleStartInstantMeeting = async () => {
    if (isStartingMeeting) return;
    setIsStartingMeeting(true);
    setFeedback("");
    try {
      await initUserMedia(isAudioOnly);
      const res = await onCreateMeeting({
        title: meetingTitle.trim() || `${currentUser?.displayName || "PDP"} Uchrashuvi`,
        isAudioOnly,
        groupId: currentGroupId,
      });
      setActiveMeetingId(res.meetingId);
      setMeetingMode("in-meeting");
    } catch (err) {
      setFeedback(parseErrorMessage(err, "Uchrashuv yaratishda xatolik yuz berdi"));
    } finally {
      setIsStartingMeeting(false);
    }
  };

  const [guestDisplayName, setGuestDisplayName] = useState("");

  useEffect(() => {
    if (meeting?.meetingId && !joinMeetingId) {
      setJoinMeetingId(meeting.meetingId);
    }
  }, [meeting?.meetingId, joinMeetingId]);

  // Join Existing Meeting
  const handleJoinExisting = async (e) => {
    if (e) e.preventDefault();
    const cleanId = (joinMeetingId || meeting?.meetingId || "").trim().toLowerCase();
    if (!cleanId || isJoiningMeeting) return;

    if (!currentUser && !guestDisplayName.trim()) {
      setFeedback("Uchrashuvga qo‘shilish uchun ismingizni kiriting");
      return;
    }

    setIsJoiningMeeting(true);
    setFeedback("");
    try {
      await initUserMedia(isAudioOnly);
      await onJoinMeeting(cleanId, isAudioOnly, guestDisplayName.trim() || undefined);
      setActiveMeetingId(cleanId);
      setMeetingMode("in-meeting");
    } catch (err) {
      setFeedback(parseErrorMessage(err, "Uchrashuv topilmadi yoki unga kirishga ruxsat yo‘q"));
    } finally {
      setIsJoiningMeeting(false);
    }
  };

  // Toggle Mic
  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      if (activeMeetingId && onUpdateMediaState) {
        onUpdateMediaState(activeMeetingId, { isMuted: newMuted });
      }
    }
  };

  // Toggle Video (Takroriy yoqish/o'chirish imkoniyati bilan)
  const toggleVideo = async () => {
    const currentTrack = localStream?.getVideoTracks()[0];
    const shouldEnable = isVideoOff || !currentTrack || currentTrack.readyState === "ended";

    if (shouldEnable) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        const newTrack = stream.getVideoTracks()[0];
        if (newTrack) {
          if (localStream) {
            localStream.getVideoTracks().forEach((t) => {
              try { t.stop(); } catch (e) {}
              localStream.removeTrack(t);
            });
            localStream.addTrack(newTrack);
          } else {
            setLocalStream(stream);
          }
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStream || stream;
          }
          setIsVideoOff(false);
          if (activeMeetingId && onUpdateMediaState) {
            onUpdateMediaState(activeMeetingId, { isVideoOff: false });
          }
        }
      } catch (err) {
        console.warn("Video toggle error:", err);
        let msg = "Kamerani yoqib bo‘lmadi.";
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          msg = "Kameradan foydalanishga ruxsat berilmadi.";
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          msg = "Qurilmada kamera topilmadi.";
        }
        setFeedback(msg);
      }
    } else {
      if (localStream) {
        localStream.getVideoTracks().forEach((track) => {
          track.enabled = false;
          track.stop();
          localStream.removeTrack(track);
        });
      }
      setIsVideoOff(true);
      if (activeMeetingId && onUpdateMediaState) {
        onUpdateMediaState(activeMeetingId, { isVideoOff: true });
      }
    }
  };

  // Toggle Screen Sharing (Google Meet feature)
  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        setScreenStream(stream);
        setIsScreenSharing(true);

        stream.getVideoTracks()[0].onended = () => {
          stopAllScreenTracks();
        };

        if (activeMeetingId && onUpdateMediaState) {
          onUpdateMediaState(activeMeetingId, { isScreenSharing: true });
        }
      } catch (err) {
        console.warn("Screen share cancelled or failed:", err);
      }
    } else {
      stopAllScreenTracks();
    }
  };

  const stopAllScreenTracks = () => {
    if (screenStream) {
      screenStream.getTracks().forEach((t) => t.stop());
      setScreenStream(null);
    }
    setIsScreenSharing(false);
    if (activeMeetingId && onUpdateMediaState) {
      onUpdateMediaState(activeMeetingId, { isScreenSharing: false });
    }
  };

  // Leave meeting
  const handleLeave = async () => {
    stopAllTracks();
    if (activeMeetingId) {
      await onLeaveMeeting(activeMeetingId);
    }
    setMeetingMode("lobby");
    onClose();
  };

  // End meeting for all (Host only)
  const handleEndForAll = async () => {
    stopAllTracks();
    if (activeMeetingId) {
      await onEndMeeting(activeMeetingId);
    }
    setMeetingMode("lobby");
    onClose();
  };

  const copyMeetingLink = async () => {
    const origin = typeof window !== "undefined" && window.location.origin ? window.location.origin : "https://pdpsastav.vercel.app";
    const url = `${origin}/?meet=${activeMeetingId}`;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = url;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (err) {
      console.error("Clipboard copy error:", err);
      setFeedback(`Havolani nusxalashda xatolik. Qo‘lda nusxalang: ${url}`);
    }
  };

  const participants = meeting?.participants || [
    {
      userId: currentUser?.id,
      displayName: currentUser?.displayName || "Siz",
      isMuted,
      isVideoOff,
      isScreenSharing,
    },
  ];

  const isHost = meeting?.hostUserId === currentUser?.id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-xl animate-fade-in">
      <div className="relative w-full max-w-5xl h-[92vh] bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Navbar */}
        <div className="relative z-10 px-5 py-3.5 border-b border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src={BRAND_CONFIG.avatarUrl}
              alt={BRAND_CONFIG.name}
              width={34}
              height={34}
              className="w-8 h-8 rounded-full object-cover ring-2 ring-cyan-500/50 shadow"
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-white tracking-wide">
                  {meetingMode === "in-meeting"
                    ? meeting?.title || "PDP Uchrashuv"
                    : "PDP Video Uchrashuvlar"}
                </h3>
                {meetingMode === "in-meeting" && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-rose-500/15 border border-rose-500/30 text-rose-400 rounded-full text-[10px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                    Jonli efir
                  </span>
                )}
              </div>
              {meetingMode === "in-meeting" && (
                <p className="text-[11px] font-mono text-cyan-400">
                  ID: {activeMeetingId} • Davomiyligi: {formatDuration(callDuration)}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {meetingMode === "in-meeting" && (
              <button
                onClick={copyMeetingLink}
                className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <span>{copiedLink ? "✓ Nusxalandi!" : "📋 Havolani nusxalash"}</span>
              </button>
            )}

            <button
              onClick={meetingMode === "in-meeting" ? handleLeave : onClose}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
              title="Yopish"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Feedback alert */}
        {feedback && (
          <div className="px-4 py-2 bg-rose-500/15 text-rose-300 text-xs flex items-center justify-between border-b border-rose-500/20">
            <span>⚠️ {feedback}</span>
            <button onClick={() => setFeedback("")} className="cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {/* MODE 1: LOBBY */}
        {meetingMode === "lobby" ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6 overflow-y-auto">
            {meeting && meeting.title && (
              <div className="w-full max-w-2xl bg-cyan-500/10 border border-cyan-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
                <div>
                  <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">Taklif qilingan uchrashuv:</span>
                  <h3 className="text-base font-extrabold text-white">{meeting.title}</h3>
                  <p className="text-[11px] text-zinc-400">Boshlovchi: {meeting.hostName} • {meeting.participants?.length || 0} ishtirokchi</p>
                </div>
                <button
                  type="button"
                  onClick={handleJoinExisting}
                  disabled={isJoiningMeeting}
                  className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg transition cursor-pointer shrink-0"
                >
                  {isJoiningMeeting ? "Ulanmoqda..." : "Hozir qo‘shilish"}
                </button>
              </div>
            )}

            <div className="flex flex-col md:flex-row items-center justify-center gap-8 w-full max-w-3xl">
            {/* Left Column: Create instant meeting */}
            <div className="w-full max-w-sm bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">⚡</span>
                <div>
                  <h4 className="text-sm font-bold text-white">Yangi uchrashuv ochish</h4>
                  <p className="text-[11px] text-zinc-400">Google Meet uslubida bir zumda xona yarating</p>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                  Uchrashuv mavzusi (ixtiyoriy)
                </label>
                <input
                  type="text"
                  value={meetingTitle}
                  onChange={(e) => setMeetingTitle(e.target.value)}
                  placeholder="Masalan: PDP SASTAV Dars tahlili"
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-cyan-400 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="audioOnlyLobby"
                  checked={isAudioOnly}
                  onChange={(e) => setIsAudioOnly(e.target.checked)}
                  className="rounded border-zinc-800 text-cyan-500 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="audioOnlyLobby" className="text-xs text-zinc-300 cursor-pointer">
                  Faqat audio uchrashuv (kam internet sarfi)
                </label>
              </div>

              <button
                onClick={handleStartInstantMeeting}
                disabled={isStartingMeeting}
                className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/25 transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {isStartingMeeting && (
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                )}
                <span>{isStartingMeeting ? "Xona ochilmoqda..." : "📹 Uchrashuvni boshlash"}</span>
              </button>
            </div>

            {/* Right Column: Join with code */}
            <div className="w-full max-w-sm bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🔗</span>
                <div>
                  <h4 className="text-sm font-bold text-white">Havola yoki kod orqali kirish</h4>
                  <p className="text-[11px] text-zinc-400">Boshqa foydalanuvchi uchrashuviga qo‘shilish</p>
                </div>
              </div>

              <form onSubmit={handleJoinExisting} className="space-y-4">
                {!currentUser && (
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                      Ismingiz
                    </label>
                    <input
                      type="text"
                      value={guestDisplayName}
                      onChange={(e) => setGuestDisplayName(e.target.value)}
                      placeholder="Ismingizni kiriting"
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-cyan-400 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                    Uchrashuv kodi (ID)
                  </label>
                  <input
                    type="text"
                    value={joinMeetingId}
                    onChange={(e) => setJoinMeetingId(e.target.value)}
                    placeholder="Masalan: pdp-abc-xyz"
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-cyan-400 rounded-xl px-3.5 py-2 text-xs text-cyan-400 font-mono placeholder-zinc-500 focus:outline-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={!joinMeetingId.trim() || isJoiningMeeting}
                  className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
                >
                  {isJoiningMeeting && (
                    <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  )}
                  <span>{isJoiningMeeting ? "Ulanmoqda..." : "Qo‘shilish"}</span>
                </button>
              </form>
            </div>
            </div>
          </div>
        ) : (
          /* MODE 2: ACTIVE IN-MEETING */
          <div className="flex-1 flex flex-col p-4 overflow-hidden">
            {/* Main Stage: Screen share or Participant Tiles Grid */}
            <div className="flex-1 min-h-0 relative rounded-2xl bg-zinc-900/40 border border-zinc-800/80 p-3 overflow-hidden flex flex-col justify-center">
              {isScreenSharing && screenStream ? (
                /* Screen share view */
                <div className="w-full h-full relative rounded-xl overflow-hidden bg-black flex items-center justify-center">
                  <video
                    ref={screenVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-3 left-3 px-3 py-1 bg-cyan-500/80 text-zinc-950 text-xs font-extrabold rounded-lg backdrop-blur-sm">
                    🖥️ Siz ekraningizni ulashyapsiz
                  </div>
                </div>
              ) : (
                /* Participants Grid */
                <div
                  className={`w-full h-full grid gap-3 ${
                    participants.length <= 1
                      ? "grid-cols-1"
                      : participants.length === 2
                      ? "grid-cols-1 md:grid-cols-2"
                      : "grid-cols-2 md:grid-cols-3"
                  }`}
                >
                  {participants.map((p) => {
                    const isSelf = p.userId === currentUser?.id;
                    return (
                      <div
                        key={p.userId}
                        className="relative rounded-2xl bg-zinc-950 border border-zinc-800/80 overflow-hidden flex items-center justify-center group shadow-lg"
                      >
                        {isSelf && !isVideoOff && localStream ? (
                          <video
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover -scale-x-100"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center">
                            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-2xl font-extrabold text-white shadow-xl ring-4 ring-cyan-500/20">
                              {p.displayName?.slice(0, 2).toUpperCase() || "PDP"}
                            </div>
                            <span className="mt-3 text-xs font-bold text-zinc-300">
                              {p.displayName} {isSelf && "(Siz)"}
                            </span>
                          </div>
                        )}

                        {/* Name and mic badge */}
                        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between px-2.5 py-1.5 bg-black/60 backdrop-blur-md rounded-xl text-[11px] text-white">
                          <span className="font-semibold truncate">
                            {p.displayName} {isSelf && "(Siz)"}
                          </span>
                          <span className="shrink-0">
                            {(isSelf ? isMuted : p.isMuted) ? (
                              <span className="text-rose-400" title="Mikrofon o‘chirilgan">
                                🔇
                              </span>
                            ) : (
                              <span className="text-emerald-400" title="Mikrofon yoniq">
                                🎙️
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Meeting Control Bar (Google Meet style) */}
            <div className="mt-4 py-2 flex items-center justify-center gap-3 sm:gap-4 shrink-0">
              {/* Mic Toggle */}
              <button
                onClick={toggleMute}
                className={`p-3.5 sm:px-5 sm:py-3 rounded-2xl font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-lg ${
                  isMuted
                    ? "bg-rose-500/20 border border-rose-500/40 text-rose-400 hover:bg-rose-500/30"
                    : "bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700"
                }`}
                title={isMuted ? "Mikrofonni yoqish" : "Mikrofonni o‘chirish"}
              >
                <span>{isMuted ? "🔇" : "🎙️"}</span>
                <span className="hidden sm:inline">{isMuted ? "O‘chirilgan" : "Mikrofon"}</span>
              </button>

              {/* Camera Toggle */}
              <button
                onClick={toggleVideo}
                className={`p-3.5 sm:px-5 sm:py-3 rounded-2xl font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-lg ${
                  isVideoOff
                    ? "bg-rose-500/20 border border-rose-500/40 text-rose-400 hover:bg-rose-500/30"
                    : "bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700"
                }`}
                title={isVideoOff ? "Kamerani yoqish" : "Kamerani o‘chirish"}
              >
                <span>{isVideoOff ? "🚫" : "📹"}</span>
                <span className="hidden sm:inline">{isVideoOff ? "Kamera yopiq" : "Kamera"}</span>
              </button>

              {/* Screen Share Toggle */}
              <button
                onClick={toggleScreenShare}
                className={`p-3.5 sm:px-5 sm:py-3 rounded-2xl font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-lg ${
                  isScreenSharing
                    ? "bg-cyan-500 text-zinc-950 hover:bg-cyan-400"
                    : "bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700"
                }`}
                title="Ekranni ulashish"
              >
                <span>🖥️</span>
                <span className="hidden sm:inline">
                  {isScreenSharing ? "Ekranni to‘xtatish" : "Ekranni ulashish"}
                </span>
              </button>

              {/* Leave Call */}
              <button
                onClick={handleLeave}
                className="px-4 sm:px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-rose-600/30 transition cursor-pointer flex items-center gap-2"
                title="Qo‘ng‘iroqdan chiqish"
              >
                <span>📞</span>
                <span>Chiqish</span>
              </button>

              {/* Host only: End Meeting for all */}
              {isHost && (
                <button
                  onClick={handleEndForAll}
                  className="hidden sm:flex px-4 py-3 bg-zinc-900 hover:bg-rose-950 border border-rose-500/40 text-rose-400 font-bold text-xs rounded-2xl transition cursor-pointer"
                  title="Barcha ishtirokchilar uchun yakunlash"
                >
                  Barcha uchun yakunlash
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
