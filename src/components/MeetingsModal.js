import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { BRAND_CONFIG } from "@/config/branding";
import { parseErrorMessage } from "@/lib/error-parser";

function getIceServers() {
  const servers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ];

  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_TURN_URL) {
    servers.push({
      urls: process.env.NEXT_PUBLIC_TURN_URL,
      username: process.env.NEXT_PUBLIC_TURN_USERNAME || undefined,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || undefined,
    });
  }

  return { iceServers: servers };
}

// Alohida ishtirokchi video/audio paneli
function RemoteParticipantTile({ participant, stream }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch((err) => {
        console.warn("Video play error for remote participant:", participant.displayName, err);
      });
    }
  }, [stream, participant.isVideoOff]);

  const hasVideo = stream && stream.getVideoTracks().some((t) => t.enabled && t.readyState === "live") && !participant.isVideoOff;

  return (
    <div className="relative rounded-2xl bg-zinc-950 border border-zinc-800/80 overflow-hidden flex items-center justify-center group shadow-lg">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          hasVideo ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {!hasVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-3">
          <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-xl sm:text-2xl font-extrabold text-white shadow-xl ring-4 ring-cyan-500/20">
            {participant.displayName?.slice(0, 2).toUpperCase() || "PDP"}
          </div>
          <span className="mt-2.5 sm:mt-3 text-xs font-bold text-zinc-300 truncate max-w-[140px] sm:max-w-none text-center">
            {participant.displayName}
          </span>
          <span className="text-[10px] text-zinc-500 mt-0.5">Kamera o‘chiq</span>
        </div>
      )}

      {/* Name and mic badge */}
      <div className="absolute bottom-2 sm:bottom-2.5 left-2 sm:left-2.5 right-2 sm:right-2.5 flex items-center justify-between px-2 sm:px-2.5 py-1 sm:py-1.5 bg-black/60 backdrop-blur-md rounded-xl text-[10px] sm:text-[11px] text-white z-10">
        <span className="font-semibold truncate max-w-[70%]">
          {participant.displayName}
        </span>
        <span className="shrink-0">
          {participant.isMuted ? (
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
}

export default function MeetingsModal({
  isOpen,
  onClose,
  currentUser,
  meeting, // Active meeting object from Convex
  initialMeetingId,
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
  const [guestDisplayName, setGuestDisplayName] = useState("");

  // Local media streams
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);
  const [feedback, setFeedback] = useState("");

  // WebRTC Mesh holati
  const [remoteStreams, setRemoteStreams] = useState({});
  const peersRef = useRef({});
  const pendingCandidatesRef = useRef({});
  const processedSignalIdsRef = useRef(new Set());
  const guestUserIdRef = useRef(null);

  const localVideoRef = useRef(null);
  const screenVideoRef = useRef(null);
  const durationTimerRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);

  // Stable User ID
  if (!guestUserIdRef.current) {
    if (typeof window !== "undefined") {
      guestUserIdRef.current = localStorage.getItem("meet_guest_id") || `guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      try { localStorage.setItem("meet_guest_id", guestUserIdRef.current); } catch (e) {}
    } else {
      guestUserIdRef.current = `guest-${Date.now()}`;
    }
  }
  const myUserId = currentUser?.id || guestUserIdRef.current;

  // Convex mutations va queries
  const sendSignalMutation = useMutation(api.meetings.sendSignal);
  const incomingSignals = useQuery(
    api.meetings.getSignals,
    activeMeetingId && myUserId && meetingMode === "in-meeting"
      ? { meetingId: activeMeetingId, targetId: myUserId }
      : "skip"
  );

  useEffect(() => {
    if (initialMeetingId && !joinMeetingId) {
      setJoinMeetingId(initialMeetingId);
    }
  }, [initialMeetingId, joinMeetingId]);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    screenStreamRef.current = screenStream;
  }, [screenStream]);

  // Stop all media tracks helper
  const stopAllTracks = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      setScreenStream(null);
      setIsScreenSharing(false);
    }
  }, []);

  // WebRTC Peer Connection yaratish
  const createPeerConnection = useCallback((remoteUserId) => {
    if (peersRef.current[remoteUserId]) {
      return peersRef.current[remoteUserId];
    }

    const pc = new RTCPeerConnection(getIceServers());
    peersRef.current[remoteUserId] = pc;

    // Lokal treklarni qo'shish
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // ICE nomzodlarni jo'natish
    pc.onicecandidate = (event) => {
      if (event.candidate && activeMeetingId) {
        sendSignalMutation({
          meetingId: activeMeetingId,
          senderId: myUserId,
          targetId: remoteUserId,
          type: "candidate",
          payload: JSON.stringify(event.candidate),
        }).catch((err) => console.warn("ICE candidate signal yuborishda xato:", err));
      }
    };

    // Masofaviy trek qabul qilish
    pc.ontrack = (event) => {
      console.log("Remote track qabul qilindi:", remoteUserId, event.track.kind);
      const stream = event.streams[0] || new MediaStream([event.track]);
      setRemoteStreams((prev) => {
        const existing = prev[remoteUserId];
        if (existing) {
          const tracks = existing.getTracks();
          if (!tracks.some((t) => t.id === event.track.id)) {
            existing.addTrack(event.track);
          }
          return { ...prev, [remoteUserId]: new MediaStream(existing.getTracks()) };
        }
        return { ...prev, [remoteUserId]: stream };
      });
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed" || pc.connectionState === "closed") {
        console.log("Peer uzildi:", remoteUserId);
      }
    };

    return pc;
  }, [activeMeetingId, myUserId, sendSignalMutation]);

  // Signaling xabarlarini qayta ishlash (offer / answer / candidate / peer-join / peer-leave)
  useEffect(() => {
    if (!incomingSignals || incomingSignals.length === 0 || meetingMode !== "in-meeting") return;

    incomingSignals.forEach(async (signal) => {
      if (processedSignalIdsRef.current.has(signal._id)) return;
      processedSignalIdsRef.current.add(signal._id);

      const senderId = signal.senderId;
      if (!senderId || senderId === myUserId) return;

      try {
        if (signal.type === "peer-join") {
          // Yangi ishtirokchi kirdi - biz unga offer yaratamiz
          const pc = createPeerConnection(senderId);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await sendSignalMutation({
            meetingId: activeMeetingId,
            senderId: myUserId,
            targetId: senderId,
            type: "offer",
            payload: JSON.stringify(offer),
          });
        } else if (signal.type === "offer") {
          const pc = createPeerConnection(senderId);
          const offerDesc = new RTCSessionDescription(JSON.parse(signal.payload));
          await pc.setRemoteDescription(offerDesc);

          // Kutilayotgan nomzodlarni kiritish
          if (pendingCandidatesRef.current[senderId]) {
            for (const cand of pendingCandidatesRef.current[senderId]) {
              try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch (e) {}
            }
            pendingCandidatesRef.current[senderId] = [];
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendSignalMutation({
            meetingId: activeMeetingId,
            senderId: myUserId,
            targetId: senderId,
            type: "answer",
            payload: JSON.stringify(answer),
          });
        } else if (signal.type === "answer") {
          const pc = peersRef.current[senderId];
          if (pc && pc.signalingState !== "stable") {
            const answerDesc = new RTCSessionDescription(JSON.parse(signal.payload));
            await pc.setRemoteDescription(answerDesc);

            // Kutilayotgan nomzodlarni kiritish
            if (pendingCandidatesRef.current[senderId]) {
              for (const cand of pendingCandidatesRef.current[senderId]) {
                try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch (e) {}
              }
              pendingCandidatesRef.current[senderId] = [];
            }
          }
        } else if (signal.type === "candidate") {
          const candidateData = JSON.parse(signal.payload);
          const pc = peersRef.current[senderId];
          if (pc && pc.remoteDescription) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidateData));
            } catch (e) {
              console.warn("ICE candidate xatosi:", e);
            }
          } else {
            pendingCandidatesRef.current[senderId] = pendingCandidatesRef.current[senderId] || [];
            pendingCandidatesRef.current[senderId].push(candidateData);
          }
        } else if (signal.type === "peer-leave") {
          const pc = peersRef.current[senderId];
          if (pc) {
            pc.close();
            delete peersRef.current[senderId];
          }
          setRemoteStreams((prev) => {
            const next = { ...prev };
            delete next[senderId];
            return next;
          });
        }
      } catch (err) {
        console.error("Signal qayta ishlashda xato:", signal.type, err);
      }
    });
  }, [incomingSignals, meetingMode, activeMeetingId, myUserId, createPeerConnection, sendSignalMutation]);

  // Ishtirokchilar ro'yxatidagi boshqa foydalanuvchilar bilan aloqa o'rnatish
  useEffect(() => {
    if (meetingMode !== "in-meeting" || !meeting?.participants || !activeMeetingId) return;

    const otherParticipants = meeting.participants.filter((p) => p.userId !== myUserId);

    // Yangi kelgan boshqa ishtirokchilarga "peer-join" signali yuborish
    otherParticipants.forEach((p) => {
      if (!peersRef.current[p.userId]) {
        sendSignalMutation({
          meetingId: activeMeetingId,
          senderId: myUserId,
          targetId: p.userId,
          type: "peer-join",
          payload: "{}",
        }).catch((err) => console.warn("peer-join yuborishda xato:", err));
      }
    });

    // Chiqib ketgan ishtirokchilar peer ulanishlarini tozalash
    const currentParticipantIds = new Set(meeting.participants.map((p) => p.userId));
    Object.keys(peersRef.current).forEach((peerId) => {
      if (!currentParticipantIds.has(peerId)) {
        try { peersRef.current[peerId].close(); } catch (e) {}
        delete peersRef.current[peerId];
        setRemoteStreams((prev) => {
          const next = { ...prev };
          delete next[peerId];
          return next;
        });
      }
    });
  }, [meeting?.participants, meetingMode, activeMeetingId, myUserId, sendSignalMutation]);

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
      Object.values(peersRef.current).forEach((pc) => {
        try { pc.close(); } catch (e) {}
      });
      peersRef.current = {};
      stopAllTracks();
    };
  }, [stopAllTracks]);

  // Attach local stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStream && !isVideoOff) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream, isVideoOff, meetingMode]);

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
      setFeedback("Kamera ruxsati berilmadi. Faqat audio rejimida davom etilmoqda.");
      try {
        const audioOnlyStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setLocalStream(audioOnlyStream);
        setIsVideoOff(true);
        setIsMuted(false);
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
          const audioTrack = localStream?.getAudioTracks()[0];
          const updatedStream = new MediaStream(audioTrack ? [audioTrack, newTrack] : [newTrack]);
          setLocalStream(updatedStream);
          setIsVideoOff(false);

          // Barcha ulanishlardagi video trekni yangilash
          Object.values(peersRef.current).forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
            if (sender) {
              sender.replaceTrack(newTrack).catch((e) => console.warn(e));
            } else {
              pc.addTrack(newTrack, updatedStream);
            }
          });

          if (activeMeetingId && onUpdateMediaState) {
            onUpdateMediaState(activeMeetingId, { isVideoOff: false });
          }
        }
      } catch (err) {
        console.warn("Video toggle error:", err);
        setFeedback("Kamerani yoqish imkoni bo‘lmadi.");
      }
    } else {
      if (localStream) {
        localStream.getVideoTracks().forEach((track) => {
          track.enabled = false;
          try { track.stop(); } catch (e) {}
        });
        const audioTrack = localStream.getAudioTracks()[0];
        const updatedStream = audioTrack ? new MediaStream([audioTrack]) : new MediaStream();
        setLocalStream(updatedStream);
      }
      setIsVideoOff(true);

      // Barcha ulanishlardagi video trekni to'xtatish
      Object.values(peersRef.current).forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
        if (sender) {
          sender.replaceTrack(null).catch((e) => console.warn(e));
        }
      });

      if (activeMeetingId && onUpdateMediaState) {
        onUpdateMediaState(activeMeetingId, { isVideoOff: true });
      }
    }
  };

  // Toggle Screen Sharing
  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        setScreenStream(stream);
        setIsScreenSharing(true);

        const screenTrack = stream.getVideoTracks()[0];
        // Peer larga ekran trekini uzatish
        Object.values(peersRef.current).forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
          if (sender) {
            sender.replaceTrack(screenTrack).catch((e) => console.warn(e));
          }
        });

        screenTrack.onended = () => {
          stopAllScreenTracks();
        };

        if (activeMeetingId && onUpdateMediaState) {
          onUpdateMediaState(activeMeetingId, { isScreenSharing: true });
        }
      } catch (err) {
        console.warn("Screen share cancelled:", err);
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

    // Kamerani qayta ulash
    const camTrack = localStreamRef.current?.getVideoTracks()[0] || null;
    Object.values(peersRef.current).forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
      if (sender) {
        sender.replaceTrack(camTrack).catch((e) => console.warn(e));
      }
    });

    if (activeMeetingId && onUpdateMediaState) {
      onUpdateMediaState(activeMeetingId, { isScreenSharing: false });
    }
  };

  // Leave meeting
  const handleLeave = async () => {
    // Peer larga ketish xabarini berish
    if (activeMeetingId && myUserId) {
      Object.keys(peersRef.current).forEach((peerId) => {
        sendSignalMutation({
          meetingId: activeMeetingId,
          senderId: myUserId,
          targetId: peerId,
          type: "peer-leave",
          payload: "{}",
        }).catch(() => {});
      });
    }

    // Ulanishlarni yopish
    Object.values(peersRef.current).forEach((pc) => {
      try { pc.close(); } catch (e) {}
    });
    peersRef.current = {};
    pendingCandidatesRef.current = {};
    processedSignalIdsRef.current.clear();
    setRemoteStreams({});
    stopAllTracks();

    if (activeMeetingId) {
      await onLeaveMeeting(activeMeetingId);
    }
    setMeetingMode("lobby");
    onClose();
  };

  // End meeting for all (Host only)
  const handleEndForAll = async () => {
    Object.values(peersRef.current).forEach((pc) => {
      try { pc.close(); } catch (e) {}
    });
    peersRef.current = {};
    pendingCandidatesRef.current = {};
    processedSignalIdsRef.current.clear();
    setRemoteStreams({});
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
      setFeedback(`Havolani nusxalash: ${url}`);
    }
  };

  const participants = meeting?.participants || [
    {
      userId: myUserId,
      displayName: currentUser?.displayName || "Siz",
      isMuted,
      isVideoOff,
      isScreenSharing,
    },
  ];

  const isHost = meeting?.hostUserId === currentUser?.id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-xl animate-fade-in">
      <div className="relative w-full max-w-5xl h-[92vh] max-h-[850px] bg-zinc-950 border border-zinc-800 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Navbar */}
        <div className="relative z-10 px-4 sm:px-5 py-3 sm:py-3.5 border-b border-zinc-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <Image
              src={BRAND_CONFIG.avatarUrl}
              alt={BRAND_CONFIG.name}
              width={34}
              height={34}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover ring-2 ring-cyan-500/50 shadow shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 truncate">
                <h3 className="text-xs sm:text-sm font-extrabold text-white tracking-wide truncate">
                  {meetingMode === "in-meeting"
                    ? meeting?.title || "PDP Uchrashuv"
                    : "PDP Video Uchrashuvlar"}
                </h3>
                {meetingMode === "in-meeting" && (
                  <span className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 bg-rose-500/15 border border-rose-500/30 text-rose-400 rounded-full text-[9px] sm:text-[10px] font-bold shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                    Jonli
                  </span>
                )}
              </div>
              {meetingMode === "in-meeting" && (
                <p className="text-[10px] sm:text-[11px] font-mono text-cyan-400 truncate">
                  ID: {activeMeetingId} • {formatDuration(callDuration)}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {meetingMode === "in-meeting" && (
              <button
                onClick={copyMeetingLink}
                className="px-2.5 sm:px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                title="Havolani nusxalash"
              >
                <span>{copiedLink ? "✓" : "📋"}</span>
                <span className="hidden sm:inline">{copiedLink ? "Nusxalandi!" : "Havolani nusxalash"}</span>
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
          <div className="px-4 py-2 bg-rose-500/15 text-rose-300 text-xs flex items-center justify-between border-b border-rose-500/20 shrink-0">
            <span>⚠️ {feedback}</span>
            <button onClick={() => setFeedback("")} className="cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {/* MODE 1: LOBBY */}
        {meetingMode === "lobby" ? (
          <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 gap-6 overflow-y-auto">
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

            <div className="flex flex-col md:flex-row items-center justify-center gap-6 sm:gap-8 w-full max-w-3xl">
              {/* Left Column: Create instant meeting */}
              <div className="w-full max-w-sm bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">⚡</span>
                  <div>
                    <h4 className="text-sm font-bold text-white">Yangi uchrashuv</h4>
                    <p className="text-[11px] text-zinc-400">Darhol yangi video xona yarating</p>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                    Uchrashuv nomi (ixtiyoriy)
                  </label>
                  <input
                    type="text"
                    value={meetingTitle}
                    onChange={(e) => setMeetingTitle(e.target.value)}
                    placeholder="Masalan: Jamoa rejalashtirish"
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-cyan-400 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="audioOnlyCreate"
                    checked={isAudioOnly}
                    onChange={(e) => setIsAudioOnly(e.target.checked)}
                    className="rounded border-zinc-700 bg-zinc-950 text-cyan-500 focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="audioOnlyCreate" className="text-xs text-zinc-400 cursor-pointer">
                    Faqat audio uchrashuv (kamerasiz)
                  </label>
                </div>

                <button
                  type="button"
                  onClick={handleStartInstantMeeting}
                  disabled={isStartingMeeting}
                  className="w-full py-2.5 bg-gradient-to-r from-cyan-500 via-cyan-400 to-teal-400 hover:from-cyan-400 hover:to-teal-300 disabled:opacity-50 text-zinc-950 font-black text-xs rounded-xl shadow-lg transition cursor-pointer flex items-center justify-center gap-2"
                >
                  {isStartingMeeting && (
                    <span className="w-3.5 h-3.5 border-2 border-zinc-950/20 border-t-zinc-950 rounded-full animate-spin" />
                  )}
                  <span>{isStartingMeeting ? "Xona ochilmoqda..." : "Uchrashuv boshlash"}</span>
                </button>
              </div>

              {/* Right Column: Join via code */}
              <div className="w-full max-w-sm bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">🔗</span>
                  <div>
                    <h4 className="text-sm font-bold text-white">Havola orqali qo‘shilish</h4>
                    <p className="text-[11px] text-zinc-400">Mavjud uchrashuv kodini kiriting</p>
                  </div>
                </div>

                <form onSubmit={handleJoinExisting} className="space-y-3">
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
          <div className="flex-1 flex flex-col p-3 sm:p-4 overflow-hidden">
            {/* Main Stage: Screen share or Participant Tiles Grid */}
            <div className="flex-1 min-h-0 relative rounded-2xl bg-zinc-900/40 border border-zinc-800/80 p-2 sm:p-3 overflow-hidden flex flex-col justify-center">
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
                  className={`w-full h-full grid gap-2.5 sm:gap-3 ${
                    participants.length <= 1
                      ? "grid-cols-1"
                      : participants.length === 2
                      ? "grid-cols-1 md:grid-cols-2"
                      : participants.length <= 4
                      ? "grid-cols-1 sm:grid-cols-2"
                      : "grid-cols-2 sm:grid-cols-2 md:grid-cols-3"
                  }`}
                >
                  {participants.map((p) => {
                    const isSelf = p.userId === myUserId;

                    if (isSelf) {
                      return (
                        <div
                          key={p.userId}
                          className="relative rounded-2xl bg-zinc-950 border border-zinc-800/80 overflow-hidden flex items-center justify-center group shadow-lg"
                        >
                          {!isVideoOff && localStream ? (
                            <video
                              ref={localVideoRef}
                              autoPlay
                              playsInline
                              muted
                              className="w-full h-full object-cover -scale-x-100"
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center p-3">
                              <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-xl sm:text-2xl font-extrabold text-white shadow-xl ring-4 ring-cyan-500/20">
                                {p.displayName?.slice(0, 2).toUpperCase() || "PDP"}
                              </div>
                              <span className="mt-2.5 sm:mt-3 text-xs font-bold text-zinc-300 truncate max-w-[140px] sm:max-w-none text-center">
                                {p.displayName} (Siz)
                              </span>
                              <span className="text-[10px] text-zinc-500 mt-0.5">Kamera o‘chiq</span>
                            </div>
                          )}

                          {/* Name and mic badge */}
                          <div className="absolute bottom-2 sm:bottom-2.5 left-2 sm:left-2.5 right-2 sm:right-2.5 flex items-center justify-between px-2 sm:px-2.5 py-1 sm:py-1.5 bg-black/60 backdrop-blur-md rounded-xl text-[10px] sm:text-[11px] text-white z-10">
                            <span className="font-semibold truncate max-w-[70%]">
                              {p.displayName} (Siz)
                            </span>
                            <span className="shrink-0">
                              {isMuted ? (
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
                    }

                    // Remote Participant Tile
                    return (
                      <RemoteParticipantTile
                        key={p.userId}
                        participant={p}
                        stream={remoteStreams[p.userId]}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* Meeting Control Bar (Google Meet style) */}
            <div className="py-2.5 sm:py-3 px-2 flex items-center justify-center gap-2 sm:gap-4 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-zinc-950/80 backdrop-blur-md border-t border-zinc-800/60">
              {/* Mic Toggle */}
              <button
                onClick={toggleMute}
                className={`p-3 sm:px-5 sm:py-3 rounded-2xl font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-lg ${
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
                className={`p-3 sm:px-5 sm:py-3 rounded-2xl font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-lg ${
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
                className={`p-3 sm:px-5 sm:py-3 rounded-2xl font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-lg ${
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
