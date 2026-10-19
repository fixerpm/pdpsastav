"use client";

import { useState, useEffect, Suspense } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import MeetingsModal from "@/components/MeetingsModal";
import MeetErrorBoundary from "@/components/MeetErrorBoundary";
import { BRAND_CONFIG } from "@/config/branding";

function MeetPageContent() {
  const [activeMeetingRoomId, setActiveMeetingRoomId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [author, setAuthor] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedUser = localStorage.getItem("chat_user");
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        setCurrentUser(parsed);
        if (parsed.displayName || parsed.username) {
          setAuthor(parsed.displayName || parsed.username);
        }
      }
      const params = new URLSearchParams(window.location.search);
      const meetCode = params.get("meet") || params.get("id");
      if (meetCode) {
        setActiveMeetingRoomId(meetCode.trim().toLowerCase());
      }
    } catch (e) {
      console.warn("Meet page init error:", e);
    }
  }, []);

  const convexCurrentMeeting = useQuery(
    api.meetings.getMeeting,
    activeMeetingRoomId ? { meetingId: activeMeetingRoomId } : "skip"
  );
  const convexCreateMeeting = useMutation(api.meetings.createMeeting);
  const convexJoinMeeting = useMutation(api.meetings.joinMeeting);
  const convexLeaveMeeting = useMutation(api.meetings.leaveMeeting);
  const convexEndMeeting = useMutation(api.meetings.endMeeting);
  const convexUpdateMeetingMediaState = useMutation(api.meetings.updateMediaState);

  const handleClose = () => {
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  return (
    <div className="flex h-[100dvh] w-full bg-zinc-950 text-zinc-100 overflow-hidden items-center justify-center">
      <MeetErrorBoundary onClose={handleClose}>
        <MeetingsModal
          isOpen={true}
          onClose={handleClose}
          currentUser={currentUser}
          meeting={convexCurrentMeeting}
          initialMeetingId={activeMeetingRoomId}
          onCreateMeeting={async ({ title, isAudioOnly, groupId }) => {
            const res = await convexCreateMeeting({
              title,
              hostUserId: currentUser?.id || "anon",
              hostName: currentUser?.displayName || author,
              groupId: groupId || undefined,
              isAudioOnly,
            });
            setActiveMeetingRoomId(res.meetingId);
            return res;
          }}
          onJoinMeeting={async (meetingId, isAudioOnly, guestName) => {
            const effectiveName = currentUser?.displayName || guestName || author;
            await convexJoinMeeting({
              meetingId,
              userId: currentUser?.id || `guest-${Date.now()}`,
              displayName: effectiveName,
              isAudioOnly,
            });
            setActiveMeetingRoomId(meetingId);
          }}
          onLeaveMeeting={async (meetingId) => {
            if (currentUser?.id) {
              await convexLeaveMeeting({ meetingId, userId: currentUser.id });
            }
            setActiveMeetingRoomId(null);
            handleClose();
          }}
          onEndMeeting={async (meetingId) => {
            if (currentUser?.id) {
              await convexEndMeeting({ meetingId, hostUserId: currentUser.id });
            }
            setActiveMeetingRoomId(null);
            handleClose();
          }}
          onUpdateMediaState={async (meetingId, states) => {
            if (currentUser?.id) {
              await convexUpdateMeetingMediaState({
                meetingId,
                userId: currentUser.id,
                ...states,
              });
            }
          }}
        />
      </MeetErrorBoundary>
    </div>
  );
}

export default function MeetPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-full items-center justify-center bg-zinc-950 text-zinc-400 text-xs">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
            <p className="font-semibold text-zinc-300">PDP Uchrashuv xonasi tayyorlanmoqda...</p>
          </div>
        </div>
      }
    >
      <MeetPageContent />
    </Suspense>
  );
}
