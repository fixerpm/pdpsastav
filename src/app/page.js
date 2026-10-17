"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import ChatSidebar from "@/components/ChatSidebar";
import MessageItem from "@/components/MessageItem";
import CallModal from "@/components/CallModal";
import Image from "next/image";
import ConfirmModal from "@/components/ConfirmModal";
import EditNicknameModal from "@/components/EditNicknameModal";
import { BRAND_CONFIG } from "@/config/branding";

const STICKERS = ["🔥", "❤️", "👍", "😂", "🎉", "🚀", "😎", "👏", "💯", "🥳", "💡", "✨", "🤩", "🤖", "⚡", "🙌"];

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

function createTempMessage({ author, senderId, recipientId, textBody, type, storageId, mediaUrl }) {
  const now = Date.now();
  const clientTempId = "temp-" + now + "-" + Math.random().toString(36).slice(2, 7);
  return {
    clientTempId,
    optimisticMsg: {
      _id: clientTempId,
      id: clientTempId,
      clientTempId,
      author,
      senderId,
      recipientId,
      body: textBody || "",
      type,
      status: "sending",
      isEdited: false,
      editedAt: null,
      storageId,
      mediaUrl,
      _creationTime: now,
      createdAt: new Date(now).toISOString(),
    },
  };
}

export default function ChatPage() {
  // Foydalanuvchi va sessiya
  const [currentUser, setCurrentUser] = useState(null);
  const [sessionToken, setSessionToken] = useState("");
  const [author, setAuthor] = useState("Foydalanuvchi");
  const [isEditingName, setIsEditingName] = useState(false);

  // Tanlangan chat va guruh sozlamalari
  const [activeChat, setActiveChat] = useState("public"); // "public" yoki user object
  const [groupSettings, setGroupSettings] = useState({ title: BRAND_CONFIG.defaultGroupTitle });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Foydalanuvchilar va o'qilmagan xabarlar
  const [users, setUsers] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});

  // Xabarlar
  const [messages, setMessages] = useState([]);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showStickers, setShowStickers] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  // Modallar holati
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    description: "",
    confirmLabel: "O‘chirish",
    isDestructive: true,
    showForEveryoneOption: false,
    forEveryone: false,
    onConfirm: null,
  });

  const [nicknameModal, setNicknameModal] = useState({
    isOpen: false,
    title: "Chat nomini tahrirlash",
    description: "Faqat siz uchun ko‘rinadigan shaxsiy taxallus belgilang.",
    placeholder: "Nom...",
    initialValue: "",
    targetContactId: null,
    isGroupTitle: false,
  });

  // Typing
  const [typingUsers, setTypingUsers] = useState({});
  const typingTimeoutRef = useRef(null);

  // Ovozli xabar holati
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  // Dumaloq Video xabar holati
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [videoSeconds, setVideoSeconds] = useState(0);
  const videoLivePreviewRef = useRef(null);
  const videoMediaRecorderRef = useRef(null);
  const videoStreamRef = useRef(null);
  const videoChunksRef = useRef([]);
  const videoTimerRef = useRef(null);

  const messagesEndRef = useRef(null);

  // WebRTC Qo'ng'iroq holati
  const [callState, setCallState] = useState({
    status: "idle",
    callId: null,
    callType: "video",
    otherUser: null,
    incomingOfferSdp: null,
    error: null,
  });
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [iceStatus, setIceStatus] = useState("idle");
  const peerConnectionRef = useRef(null);
  const callTimerRef = useRef(null);

  // Convex integratsiyasi (Real-time Cloud Database)
  const isConvexConfigured =
    typeof window !== "undefined"
      ? Boolean(process.env.NEXT_PUBLIC_CONVEX_URL || localStorage.getItem("CONVEX_URL_DEV"))
      : Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

  const activeRecipientId = activeChat === "public" ? "public" : (activeChat?.id || "public");

  const convexMessages = useQuery(
    api.messages.list,
    isConvexConfigured
      ? { recipientId: activeRecipientId, viewerId: currentUser?.id || undefined }
      : "skip"
  );
  const convexSend = useMutation(api.messages.send);
  const convexEdit = useMutation(api.messages.edit);
  const convexDelete = useMutation(api.messages.deleteMessage);
  const convexGenerateUploadUrl = useMutation(api.messages.generateUploadUrl);
  const convexSetNickname = useMutation(api.conversations.setNickname);
  const convexSetGroupTitle = useMutation(api.conversations.setGroupTitle);
  const convexArchive = useMutation(api.conversations.archive);
  const convexClearHistory = useMutation(api.conversations.clearHistory);

  const isConvexReady = isConvexConfigured && convexMessages !== undefined;
  const displayMessages = isConvexReady && Array.isArray(convexMessages) ? convexMessages : messages;
  const isLoaded = initialLoaded || isConvexReady;

  // 1. Dastlabki autentifikatsiya
  useEffect(() => {
    async function initAuth() {
      if (typeof window === "undefined") return;

      let savedName = localStorage.getItem("chat_username");
      let savedToken = localStorage.getItem("chat_token");

      if (!savedName) {
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        savedName = `Foydalanuvchi_${randomNum}`;
        localStorage.setItem("chat_username", savedName);
      }
      setAuthor(savedName);

      try {
        let isValid = false;
        if (savedToken) {
          const checkRes = await fetch("/api/chat/auth", {
            headers: { Authorization: `Bearer ${savedToken}` },
          });
          if (checkRes.ok) {
            const data = await checkRes.json();
            if (data.authenticated && data.user) {
              setCurrentUser(data.user);
              setSessionToken(savedToken);
              isValid = true;
            }
          }
        }

        if (!isValid) {
          const authRes = await fetch("/api/chat/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username: savedName,
              displayName: savedName,
            }),
          });
          if (authRes.ok) {
            const authData = await authRes.json();
            setCurrentUser(authData.user);
            setSessionToken(authData.token);
            localStorage.setItem("chat_token", authData.token);
            localStorage.setItem("chat_user", JSON.stringify(authData.user));
          }
        }
      } catch (err) {
        console.error("Auth init error:", err);
      }
    }

    initAuth();
  }, []);

  // 2. Foydalanuvchilar va guruh sozlamalarini yuklash
  useEffect(() => {
    let ignore = false;
    async function loadData() {
      if (!sessionToken) return;
      try {
        const [usersRes, convRes] = await Promise.all([
          fetch("/api/chat/users", {
            headers: { Authorization: `Bearer ${sessionToken}` },
          }),
          fetch("/api/chat/conversations", {
            headers: { Authorization: `Bearer ${sessionToken}` },
          }),
        ]);

        if (usersRes.ok) {
          const data = await usersRes.json();
          if (!ignore && data.users) {
            setUsers(data.users);
          }
        }

        if (convRes.ok) {
          const convData = await convRes.json();
          if (!ignore && convData.groupSettings) {
            setGroupSettings(convData.groupSettings);
          }
        }
      } catch (e) {
        console.error("Fetch data error:", e);
      }
    }

    loadData();
    return () => {
      ignore = true;
    };
  }, [sessionToken]);

  // 3. Xabarlarni yuklash
  useEffect(() => {
    let ignore = false;
    async function loadMessages() {
      try {
        const recipientParam = activeChat === "public" ? "public" : activeChat.id;
        const headers = sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {};

        const res = await fetch(`/api/chat/messages?recipientId=${recipientParam}`, { headers });
        if (res.ok) {
          const data = await res.json();
          if (!ignore && data.messages) {
            setMessages(data.messages);
          }
        }
      } catch (e) {
        console.error("Fetch messages error:", e);
      } finally {
        if (!ignore) {
          setInitialLoaded(true);
        }
      }
    }
    loadMessages();
    return () => {
      ignore = true;
    };
  }, [activeChat, sessionToken]);

  // Xabarlar scroll qilish
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages]);

  // 4. WebRTC Track va Resurslarini tozalash
  const cleanupMediaStreams = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => track.stop());
      setRemoteStream(null);
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    setCallDuration(0);
    setIsMuted(false);
    setIsVideoOff(false);
    setIceStatus("idle");
  }, [localStream, remoteStream]);

  // WebRTC Signal yuborish
  const sendCallSignal = useCallback(
    async (payload) => {
      if (!sessionToken) return;
      try {
        await fetch("/api/chat/call", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify(payload),
        });
      } catch (e) {
        console.error("Signal yuborishda xatolik:", e);
      }
    },
    [sessionToken]
  );

  // 5. SSE Real-Time oqimiga ulanish
  useEffect(() => {
    if (!currentUser?.id) return;

    let eventSource;
    let retryTimer;

    function connectSSE() {
      try {
        const streamUrl = `/api/chat/stream?token=${encodeURIComponent(sessionToken)}&userId=${encodeURIComponent(
          currentUser.id
        )}`;
        eventSource = new EventSource(streamUrl);

        eventSource.addEventListener("connected", () => {
          setIsConnected(true);
        });

        // Yangi xabar
        eventSource.addEventListener("message", (e) => {
          try {
            const newMsg = JSON.parse(e.data);
            const isForCurrentChat =
              activeChat === "public"
                ? !newMsg.recipientId || newMsg.recipientId === "public"
                : (newMsg.senderId === activeChat.id && newMsg.recipientId === currentUser.id) ||
                  (newMsg.senderId === currentUser.id && newMsg.recipientId === activeChat.id);

            if (isForCurrentChat) {
              setMessages((prev) => {
                if (
                  prev.some(
                    (m) =>
                      m._id === newMsg._id ||
                      (m.id && m.id === newMsg.id) ||
                      (newMsg.clientTempId && m.clientTempId === newMsg.clientTempId)
                  )
                ) {
                  return prev.map((m) =>
                    (newMsg.clientTempId && m.clientTempId === newMsg.clientTempId) || m._id === newMsg._id
                      ? newMsg
                      : m
                  );
                }
                return [...prev, newMsg];
              });

              if (newMsg.senderId && newMsg.senderId !== currentUser.id && activeChat !== "public") {
                fetch("/api/chat/messages", {
                  method: "PATCH",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${sessionToken}`,
                  },
                  body: JSON.stringify({ chatWithId: activeChat.id }),
                }).catch(() => {});
              }
            } else if (newMsg.senderId && newMsg.senderId !== currentUser.id) {
              setUnreadCounts((prev) => ({
                ...prev,
                [newMsg.senderId]: (prev[newMsg.senderId] || 0) + 1,
              }));
            }
          } catch (err) {
            console.error("SSE message parse error:", err);
          }
        });

        // Xabar tahrirlanganida
        eventSource.addEventListener("message_edit", (e) => {
          try {
            const data = JSON.parse(e.data);
            setMessages((prev) =>
              prev.map((m) => {
                if (m._id === data.messageId || m.id === data.messageId) {
                  return {
                    ...m,
                    body: data.newBody,
                    text: data.newBody,
                    isEdited: true,
                    editedAt: data.editedAt,
                  };
                }
                return m;
              })
            );
          } catch (err) {
            console.error("SSE message_edit error:", err);
          }
        });

        // Xabar o'chirilganida
        eventSource.addEventListener("message_delete", (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.forEveryone) {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m._id === data.messageId || m.id === data.messageId) {
                    return {
                      ...m,
                      body: "Ushbu xabar o‘chirildi",
                      text: "Ushbu xabar o‘chirildi",
                      type: "deleted",
                      isDeletedForEveryone: true,
                      mediaUrl: null,
                      storageId: null,
                    };
                  }
                  return m;
                })
              );
            } else {
              setMessages((prev) =>
                prev.filter((m) => m._id !== data.messageId && m.id !== data.messageId)
              );
            }
          } catch (err) {
            console.error("SSE message_delete error:", err);
          }
        });

        // Chat tarixi tozalanganda
        eventSource.addEventListener("chat_cleared", () => {
          setMessages([]);
        });

        // Chat o'chirilganda
        eventSource.addEventListener("chat_deleted", () => {
          setMessages([]);
          setActiveChat("public");
        });

        // Guruh nomi o'zgarganda
        eventSource.addEventListener("group_update", (e) => {
          try {
            const data = JSON.parse(e.data);
            setGroupSettings(data);
          } catch (err) {
            console.error("SSE group_update error:", err);
          }
        });

        // Xabar holati (read receipts)
        eventSource.addEventListener("message_status", (e) => {
          try {
            const data = JSON.parse(e.data);
            setMessages((prev) =>
              prev.map((m) => {
                if (data.messageIds?.includes(m._id || m.id)) {
                  return { ...m, status: data.status };
                }
                return m;
              })
            );
          } catch (err) {
            console.error("SSE message_status parse error:", err);
          }
        });

        // Typing indikatori
        eventSource.addEventListener("typing", (e) => {
          try {
            const data = JSON.parse(e.data);
            const chatKey = data.recipientId === "public" ? "public" : data.senderId;

            if (data.isTyping) {
              setTypingUsers((prev) => ({ ...prev, [chatKey]: data.senderName }));
            } else {
              setTypingUsers((prev) => {
                const next = { ...prev };
                delete next[chatKey];
                return next;
              });
            }
          } catch (err) {
            console.error("SSE typing parse error:", err);
          }
        });

        // Foydalanuvchilar ro'yxati
        eventSource.addEventListener("users_update", (e) => {
          try {
            const updatedUsers = JSON.parse(e.data);
            setUsers(updatedUsers);
          } catch (err) {
            console.error("SSE users_update parse error:", err);
          }
        });

        // WebRTC Qo'ng'iroq signallari
        eventSource.addEventListener("call_signal", async (e) => {
          try {
            const signal = JSON.parse(e.data);

            switch (signal.action) {
              case "call_incoming": {
                setCallState({
                  status: "incoming",
                  callId: signal.callId,
                  callType: signal.callType,
                  otherUser: {
                    id: signal.callerId,
                    displayName: signal.callerName,
                    avatarBg: signal.callerAvatarBg,
                  },
                  incomingOfferSdp: signal.sdp,
                  error: null,
                });
                break;
              }

              case "call_accepted": {
                if (peerConnectionRef.current && signal.sdp) {
                  await peerConnectionRef.current.setRemoteDescription(
                    new RTCSessionDescription(signal.sdp)
                  );
                  setCallState((prev) => ({ ...prev, status: "connected" }));
                  callTimerRef.current = setInterval(() => {
                    setCallDuration((prev) => prev + 1);
                  }, 1000);
                }
                break;
              }

              case "ice_candidate": {
                if (peerConnectionRef.current && signal.candidate) {
                  try {
                    await peerConnectionRef.current.addIceCandidate(
                      new RTCIceCandidate(signal.candidate)
                    );
                  } catch (err) {
                    console.error("Error adding ice candidate:", err);
                  }
                }
                break;
              }

              case "call_rejected": {
                setCallState((prev) => ({
                  ...prev,
                  status: "idle",
                  error: signal.reason || "Qo‘ng‘iroq rad etildi",
                }));
                cleanupMediaStreams();
                break;
              }

              case "call_busy": {
                setCallState((prev) => ({
                  ...prev,
                  status: "idle",
                  error: "Foydalanuvchi boshqa qo‘ng‘iroqda band",
                }));
                cleanupMediaStreams();
                break;
              }

              case "call_timeout": {
                setCallState((prev) => ({
                  ...prev,
                  status: "idle",
                  error: "Javob berilmadi (qo‘ng‘iroq vaqti tugadi)",
                }));
                cleanupMediaStreams();
                break;
              }

              case "call_ended": {
                setCallState({
                  status: "idle",
                  callId: null,
                  callType: "video",
                  otherUser: null,
                  incomingOfferSdp: null,
                  error: signal.reason || null,
                });
                cleanupMediaStreams();
                break;
              }

              default:
                break;
            }
          } catch (err) {
            console.error("SSE call_signal parse error:", err);
          }
        });

        eventSource.onerror = () => {
          setIsConnected(false);
          if (eventSource) eventSource.close();
          retryTimer = setTimeout(connectSSE, 3000);
        };
      } catch (err) {
        setIsConnected(false);
        retryTimer = setTimeout(connectSSE, 3000);
      }
    }

    connectSSE();

    return () => {
      if (eventSource) eventSource.close();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [currentUser?.id, sessionToken, activeChat, cleanupMediaStreams]);

  // 6. Xabarni tahrirlash (Edit Message)
  const handleEditMessage = async (messageId, newText) => {
    if (isConvexReady && convexEdit && messageId && !String(messageId).startsWith("temp-") && !String(messageId).startsWith("msg-")) {
      try {
        await convexEdit({
          messageId,
          userId: currentUser?.id || "anon",
          newText,
        });
        return;
      } catch (err) {
        console.warn("Convex edit error, falling back to local API:", err);
      }
    }

    if (!sessionToken) return;
    try {
      const res = await fetch("/api/chat/messages", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ messageId, text: newText }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Xabarni tahrirlab bo‘lmadi");
      }
    } catch (err) {
      console.error("Edit message error:", err);
      setErrorMsg(err.message || "Tahrirlashda xatolik yuz berdi");
    }
  };

  // 7. Xabarni o'chirish (Delete Message Prompt)
  const handleDeleteMessagePrompt = (msg) => {
    const isAuthor = (currentUser && msg.senderId === currentUser.id) || msg.author === author;

    setConfirmModal({
      isOpen: true,
      title: "Xabarni o‘chirish",
      description: isAuthor
        ? "Ushbu xabarni faqat o‘zingiz uchunmi yoki barcha foydalanuvchilar uchun o‘chirmoqchimisiz?"
        : "Ushbu xabarni o‘zingizning suhbat tarixingizdan o‘chirmoqchimisiz?",
      confirmLabel: "O‘chirish",
      isDestructive: true,
      showForEveryoneOption: isAuthor,
      forEveryone: false,
      onConfirm: async () => {
        try {
          const targetId = msg._id || msg.id;
          if (isConvexReady && convexDelete && targetId && !String(targetId).startsWith("temp-") && !String(targetId).startsWith("msg-")) {
            await convexDelete({
              messageId: targetId,
              userId: currentUser?.id || "anon",
              forEveryone: confirmModal.forEveryone,
            });
            return;
          }

          const query = new URLSearchParams({
            messageId: targetId,
            forEveryone: confirmModal.forEveryone ? "true" : "false",
          });
          const res = await fetch(`/api/chat/messages?${query.toString()}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${sessionToken}` },
          });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "O‘chirib bo‘lmadi");
          }
        } catch (err) {
          console.error("Delete error:", err);
          setErrorMsg(err.message || "Xabarni o‘chirishda xatolik");
        } finally {
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // 8. Kontakt nomini tahrirlash (Nickname)
  const handleOpenEditNickname = (contactUser) => {
    setNicknameModal({
      isOpen: true,
      title: `${contactUser.originalDisplayName || contactUser.displayName} uchun taxallus`,
      description: "Faqat sizning darchangizda ko‘rinadigan shaxsiy taxallus (nickname) belgilang.",
      placeholder: "Taxallus kiriting...",
      initialValue: contactUser.customNickname || contactUser.displayName,
      targetContactId: contactUser.id,
      isGroupTitle: false,
    });
  };

  // Guruh nomini tahrirlash
  const handleOpenEditGroupTitle = () => {
    setNicknameModal({
      isOpen: true,
      title: `${BRAND_CONFIG.name} nomini tahrirlash`,
      description: "Barcha foydalanuvchilar uchun ko‘rinadigan yangi guruh nomini kiriting.",
      placeholder: "Guruh nomi...",
      initialValue: groupSettings.title || BRAND_CONFIG.defaultGroupTitle,
      targetContactId: null,
      isGroupTitle: true,
    });
  };

  // Taxallus yoki Guruh nomini saqlash
  const handleSaveNickname = async (newValue) => {
    try {
      if (isConvexReady) {
        if (nicknameModal.isGroupTitle && convexSetGroupTitle) {
          await convexSetGroupTitle({
            userId: currentUser?.id || "anon",
            userName: currentUser?.displayName || author,
            newTitle: newValue,
          });
          setGroupSettings({ title: newValue, updatedAt: new Date().toISOString() });
          setNicknameModal((prev) => ({ ...prev, isOpen: false }));
          return;
        } else if (!nicknameModal.isGroupTitle && convexSetNickname && currentUser?.id) {
          await convexSetNickname({
            userId: currentUser.id,
            contactId: nicknameModal.targetContactId,
            nickname: newValue,
          });
          setUsers((prev) =>
            prev.map((u) => {
              if (u.id === nicknameModal.targetContactId) {
                return {
                  ...u,
                  displayName: newValue || u.originalDisplayName,
                  customNickname: newValue || null,
                };
              }
              return u;
            })
          );
          if (activeChat !== "public" && activeChat.id === nicknameModal.targetContactId) {
            setActiveChat((prev) => ({
              ...prev,
              displayName: newValue || prev.originalDisplayName,
              customNickname: newValue || null,
            }));
          }
          setNicknameModal((prev) => ({ ...prev, isOpen: false }));
          return;
        }
      }

      if (!sessionToken) return;
      if (nicknameModal.isGroupTitle) {
        const res = await fetch("/api/chat/conversations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            action: "set_group_title",
            title: newValue,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setGroupSettings({ title: data.title, updatedAt: data.updatedAt });
        }
      } else {
        const res = await fetch("/api/chat/conversations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            action: "set_nickname",
            contactId: nicknameModal.targetContactId,
            nickname: newValue,
          }),
        });
        if (res.ok) {
          setUsers((prev) =>
            prev.map((u) => {
              if (u.id === nicknameModal.targetContactId) {
                return {
                  ...u,
                  displayName: newValue || u.originalDisplayName,
                  customNickname: newValue || null,
                };
              }
              return u;
            })
          );
          if (activeChat !== "public" && activeChat.id === nicknameModal.targetContactId) {
            setActiveChat((prev) => ({
              ...prev,
              displayName: newValue || prev.originalDisplayName,
              customNickname: newValue || null,
            }));
          }
        }
      }
    } catch (err) {
      console.error("Save nickname error:", err);
    } finally {
      setNicknameModal((prev) => ({ ...prev, isOpen: false }));
    }
  };

  // 9. Chatni arxivlash / arxivdan chiqarish
  const handleArchiveChat = async (chatKey, isArchived) => {
    if (isConvexReady && convexArchive && currentUser?.id) {
      try {
        await convexArchive({
          userId: currentUser.id,
          chatKey,
          isArchived,
        });
        setUsers((prev) =>
          prev.map((u) => (u.id === chatKey ? { ...u, isArchived } : u))
        );
        return;
      } catch (err) {
        console.warn("Convex archive error, falling back to local API:", err);
      }
    }

    if (!sessionToken) return;
    try {
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          action: "archive_chat",
          chatKey,
          isArchived,
        }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === chatKey ? { ...u, isArchived } : u))
        );
      }
    } catch (err) {
      console.error("Archive error:", err);
    }
  };

  // 10. Suhbat tarixini tozalash (Clear History Prompt)
  const handleClearHistoryPrompt = (contactUser) => {
    setConfirmModal({
      isOpen: true,
      title: "Suhbat tarixini tozalash",
      description: `${contactUser.displayName} bilan barcha xabarlar faqat sizning tarixingizdan o‘chiriladi. Suhbatdoshda xabarlar saqlanib qoladi.`,
      confirmLabel: "Tarixni tozalash",
      isDestructive: true,
      showForEveryoneOption: false,
      forEveryone: false,
      onConfirm: async () => {
        try {
          const res = await fetch("/api/chat/conversations", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${sessionToken}`,
            },
            body: JSON.stringify({
              action: "clear_history",
              chatKey: contactUser.id,
            }),
          });
          if (res.ok && activeChat !== "public" && activeChat.id === contactUser.id) {
            setMessages([]);
          }
        } catch (err) {
          console.error("Clear history error:", err);
        } finally {
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // 11. Chatni o'chirish (Delete Chat Prompt)
  const handleDeleteChatPrompt = (contactUser) => {
    setConfirmModal({
      isOpen: true,
      title: "Chatni o‘chirish",
      description: `${contactUser.displayName} bilan suhbatni o‘chirmoqchimisiz?`,
      confirmLabel: "Chatni o‘chirish",
      isDestructive: true,
      showForEveryoneOption: true,
      forEveryone: false,
      onConfirm: async () => {
        try {
          const res = await fetch("/api/chat/conversations", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${sessionToken}`,
            },
            body: JSON.stringify({
              action: "delete_chat",
              chatKey: contactUser.id,
              forEveryone: confirmModal.forEveryone,
            }),
          });
          if (res.ok) {
            setUsers((prev) => prev.filter((u) => u.id !== contactUser.id));
            if (activeChat !== "public" && activeChat.id === contactUser.id) {
              setActiveChat("public");
            }
          }
        } catch (err) {
          console.error("Delete chat error:", err);
        } finally {
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // 12. WebRTC: Qo'ng'iroq boshlash (Outgoing Call)
  const handleStartCall = async (targetUser, callType = "video") => {
    setErrorMsg("");
    cleanupMediaStreams();

    try {
      const isVideo = callType === "video";
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo ? { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } : false,
      });

      setLocalStream(stream);

      const pc = new RTCPeerConnection(getIceServers());
      peerConnectionRef.current = pc;

      pc.oniceconnectionstatechange = () => {
        setIceStatus(pc.iceConnectionState);
        if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
          console.warn("ICE connection state changed:", pc.iceConnectionState);
        }
      };

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const remote = new MediaStream();
      setRemoteStream(remote);

      pc.ontrack = (event) => {
        event.streams[0]?.getTracks().forEach((t) => remote.addTrack(t));
      };

      const newCallId = "call-" + Date.now();

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendCallSignal({
            action: "ice_candidate",
            callId: newCallId,
            candidate: event.candidate,
          });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      setCallState({
        status: "calling",
        callId: newCallId,
        callType,
        otherUser: targetUser,
        incomingOfferSdp: null,
        error: null,
      });

      await sendCallSignal({
        action: "call_initiate",
        callId: newCallId,
        targetUserId: targetUser.id,
        callType,
        sdp: offer,
      });
    } catch (err) {
      console.error("Start call error:", err);
      let msg = "Qo‘ng‘iroqni boshlab bo‘lmadi.";
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        msg = "Kamera yoki mikrofondan foydalanishga ruxsat berilmadi. Iltimos brauzer sozlamalaridan ruxsat bering.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        msg = "Qurilmada kamera yoki mikrofon topilmadi.";
      }
      setCallState({
        status: "idle",
        callId: null,
        callType,
        otherUser: null,
        incomingOfferSdp: null,
        error: msg,
      });
      cleanupMediaStreams();
    }
  };

  // 13. WebRTC: Qo'ng'iroqni qabul qilish
  const handleAcceptCall = async () => {
    try {
      const isVideo = callState.callType === "video";
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo ? { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } : false,
      });

      setLocalStream(stream);

      const pc = new RTCPeerConnection(getIceServers());
      peerConnectionRef.current = pc;

      pc.oniceconnectionstatechange = () => {
        setIceStatus(pc.iceConnectionState);
        if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
          console.warn("ICE connection state changed:", pc.iceConnectionState);
        }
      };

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const remote = new MediaStream();
      setRemoteStream(remote);

      pc.ontrack = (event) => {
        event.streams[0]?.getTracks().forEach((t) => remote.addTrack(t));
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendCallSignal({
            action: "ice_candidate",
            callId: callState.callId,
            candidate: event.candidate,
          });
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(callState.incomingOfferSdp));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await sendCallSignal({
        action: "call_accept",
        callId: callState.callId,
        sdp: answer,
      });

      setCallState((prev) => ({ ...prev, status: "connected" }));
      callTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Accept call error:", err);
      let msg = "Qo‘ng‘iroqni qabul qilib bo‘lmadi.";
      if (err.name === "NotAllowedError") {
        msg = "Kameraga yoki mikrofonga ruxsat berilmadi.";
      }
      handleRejectCall(msg);
    }
  };

  // 14. WebRTC: Qo'ng'iroqni rad etish
  const handleRejectCall = async (reason = "Qo‘ng‘iroq rad etildi") => {
    if (callState.callId) {
      await sendCallSignal({
        action: "call_reject",
        callId: callState.callId,
        reason,
      });
    }
    setCallState({
      status: "idle",
      callId: null,
      callType: "video",
      otherUser: null,
      incomingOfferSdp: null,
      error: null,
    });
    cleanupMediaStreams();
  };

  // 15. WebRTC: Qo'ng'iroqni tugatish
  const handleEndCall = async () => {
    if (callState.callId) {
      await sendCallSignal({
        action: "call_end",
        callId: callState.callId,
      });
    }
    setCallState({
      status: "idle",
      callId: null,
      callType: "video",
      otherUser: null,
      incomingOfferSdp: null,
      error: null,
    });
    cleanupMediaStreams();
  };

  const handleToggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const handleToggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  // 16. Fayl yuklash (Convex storage yoki fallback API)
  const uploadMediaFile = async (file) => {
    if (isConvexReady && convexGenerateUploadUrl) {
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Convex upload timeout")), 2500)
        );
        const postUrl = await Promise.race([convexGenerateUploadUrl(), timeoutPromise]);
        if (postUrl) {
          const result = await fetch(postUrl, {
            method: "POST",
            headers: { "Content-Type": file.type || "application/octet-stream" },
            body: file,
          });
          const { storageId } = await result.json();
          return { storageId, mediaUrl: null };
        }
      } catch (e) {
        console.warn("Convex storage fallback to local API:", e);
      }
    }

    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/chat/upload", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Fayl yuklab bo'lmadi");
    return { storageId: data.storageId, mediaUrl: data.url };
  };

  // 17. Umumiy xabar jo'natish
  const dispatchMessage = async ({ textBody, type = "text", storageId = null, mediaUrl = null }) => {
    const isPublic = activeChat === "public";
    const recipientId = isPublic ? "public" : activeChat.id;
    const authorName = currentUser?.displayName || author.trim() || "Anonim";

    const { clientTempId, optimisticMsg } = createTempMessage({
      author: authorName,
      senderId: currentUser?.id || null,
      recipientId,
      textBody,
      type,
      storageId,
      mediaUrl,
    });

    setMessages((prev) => [...prev, optimisticMsg]);

    const msgData = {
      author: authorName,
      body: textBody || "",
      type,
      storageId: storageId || undefined,
      mediaUrl: mediaUrl || undefined,
      recipientId: isPublic ? undefined : activeChat.id,
      clientTempId,
    };

    let sentViaConvex = false;
    if (isConvexReady && convexSend) {
      try {
        await convexSend({
          author: msgData.author,
          body: msgData.body,
          type: msgData.type,
          storageId: msgData.storageId,
          mediaUrl: msgData.mediaUrl,
          senderId: currentUser?.id,
          recipientId: isPublic ? "public" : activeChat.id,
          status: "delivered",
        });
        sentViaConvex = true;
      } catch (err) {
        console.warn("Convex send failed, falling back to local API:", err);
      }
    }

    if (!sentViaConvex) {
      const headers = {
        "Content-Type": "application/json",
      };
      if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;

      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers,
        body: JSON.stringify(msgData),
      });

      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.clientTempId !== clientTempId));
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Xabar yuborishda xatolik");
      }

      const data = await res.json();
      if (data.message) {
        setMessages((prev) =>
          prev.map((m) => (m.clientTempId === clientTempId ? { ...data.message, _id: data.message.id } : m))
        );
      }
    }
  };

  const handleSendText = async (e) => {
    e.preventDefault();
    if (!body.trim() || isSending) return;

    setErrorMsg("");
    setIsSending(true);

    try {
      await dispatchMessage({ textBody: body.trim(), type: "text" });
      setBody("");
    } catch (err) {
      console.error("Xabar yuborishda xatolik:", err);
      setErrorMsg(err.message || "Xabar yuborilmadi.");
    } finally {
      setIsSending(false);
    }
  };

  const handleSendSticker = async (sticker) => {
    setShowStickers(false);
    setIsSending(true);
    try {
      await dispatchMessage({ textBody: sticker, type: "sticker" });
    } catch (err) {
      console.error("Stiker yuborishda xatolik:", err);
      setErrorMsg("Stiker yuborilmadi.");
    } finally {
      setIsSending(false);
    }
  };

  const handleInputChange = (e) => {
    setBody(e.target.value);

    if (sessionToken && currentUser) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      fetch("/api/chat/typing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          recipientId: activeChat === "public" ? "public" : activeChat.id,
          isTyping: true,
        }),
      }).catch(() => {});

      typingTimeoutRef.current = setTimeout(() => {
        fetch("/api/chat/typing", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            recipientId: activeChat === "public" ? "public" : activeChat.id,
            isTyping: false,
          }),
        }).catch(() => {});
      }, 2500);
    }
  };

  // Ovozli xabar yozish
  const startRecording = async () => {
    setErrorMsg("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (audioChunksRef.current.length === 0) return;

        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, {
          type: "audio/webm",
        });

        setIsSending(true);
        try {
          const { storageId, mediaUrl } = await uploadMediaFile(audioFile);
          await dispatchMessage({
            textBody: "Ovozli xabar",
            type: "voice",
            storageId,
            mediaUrl,
          });
        } catch (err) {
          console.error("Ovozli xabar yuklashda xatolik:", err);
          setErrorMsg("Ovozli xabar yuborilmadi.");
        } finally {
          setIsSending(false);
        }
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Mikrofonga ruxsat berilmadi:", err);
      setErrorMsg("Mikrofonga ruxsat berilmadi yoki mavjud emas.");
    }
  };

  const stopRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const cancelRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    audioChunksRef.current = [];
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  // Dumaloq videoxabar yozish
  const startVideoRecording = async () => {
    setErrorMsg("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 480 } },
        audio: true,
      });

      videoStreamRef.current = stream;
      videoChunksRef.current = [];

      let mimeType = "video/webm";
      if (typeof MediaRecorder.isTypeSupported === "function") {
        if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) {
          mimeType = "video/webm;codecs=vp9";
        } else if (MediaRecorder.isTypeSupported("video/mp4")) {
          mimeType = "video/mp4";
        }
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      videoMediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          videoChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (videoChunksRef.current.length === 0) return;

        const videoBlob = new Blob(videoChunksRef.current, { type: mimeType });
        const videoFile = new File([videoBlob], `videonote_${Date.now()}.webm`, {
          type: mimeType,
        });

        setIsSending(true);
        try {
          const { storageId, mediaUrl } = await uploadMediaFile(videoFile);
          await dispatchMessage({
            textBody: "Videoxabar",
            type: "video",
            storageId,
            mediaUrl,
          });
        } catch (err) {
          console.error("Videoxabar yuklashda xatolik:", err);
          setErrorMsg("Videoxabar yuborilmadi.");
        } finally {
          setIsSending(false);
        }
      };

      mediaRecorder.start(250);
      setIsVideoRecording(true);
      setVideoSeconds(0);

      videoTimerRef.current = setInterval(() => {
        setVideoSeconds((prev) => prev + 1);
      }, 1000);

      setTimeout(() => {
        if (videoLivePreviewRef.current) {
          videoLivePreviewRef.current.srcObject = stream;
          videoLivePreviewRef.current.play().catch(() => {});
        }
      }, 100);
    } catch (err) {
      console.error("Kameraga ruxsat berilmadi:", err);
      setErrorMsg("Kameraga yoki mikrofonga ruxsat berilmadi.");
    }
  };

  const stopVideoRecording = () => {
    if (videoTimerRef.current) clearInterval(videoTimerRef.current);
    setIsVideoRecording(false);
    if (videoMediaRecorderRef.current && videoMediaRecorderRef.current.state !== "inactive") {
      videoMediaRecorderRef.current.stop();
    }
  };

  const cancelVideoRecording = () => {
    if (videoTimerRef.current) clearInterval(videoTimerRef.current);
    setIsVideoRecording(false);
    videoChunksRef.current = [];
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (videoMediaRecorderRef.current && videoMediaRecorderRef.current.state !== "inactive") {
      videoMediaRecorderRef.current.stop();
    }
  };

  // O'z ismini o'zgartirish
  const handleSaveName = async (newName) => {
    const trimmed = newName.trim();
    if (trimmed) {
      setAuthor(trimmed);
      if (typeof window !== "undefined") {
        localStorage.setItem("chat_username", trimmed);
      }

      try {
        const res = await fetch("/api/chat/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: trimmed,
            displayName: trimmed,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setCurrentUser(data.user);
          setSessionToken(data.token);
          localStorage.setItem("chat_token", data.token);
          localStorage.setItem("chat_user", JSON.stringify(data.user));
        }
      } catch (err) {
        console.error("Rename error:", err);
      }
    }
    setIsEditingName(false);
  };

  const getAvatarColor = (name) => {
    const colors = [
      "from-blue-500 to-indigo-600",
      "from-emerald-500 to-teal-600",
      "from-violet-500 to-purple-600",
      "from-rose-500 to-pink-600",
      "from-amber-500 to-orange-600",
      "from-cyan-500 to-blue-600",
    ];
    let hash = 0;
    for (let i = 0; i < (name || "").length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const handleSelectChat = (chat) => {
    setActiveChat(chat);
    if (chat !== "public") {
      setUnreadCounts((prev) => ({ ...prev, [chat.id]: 0 }));
    }
  };

  const currentChatKey = activeChat === "public" ? "public" : activeChat.id;
  const currentTypingUser = typingUsers[currentChatKey];

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-amber-500/30 overflow-hidden">
      {/* Chap Sidebar (Suhbatlar va Foydalanuvchilar) */}
      <ChatSidebar
        users={users}
        groupSettings={groupSettings}
        activeChat={activeChat}
        onSelectChat={handleSelectChat}
        onStartCall={handleStartCall}
        onOpenEditNickname={handleOpenEditNickname}
        onOpenEditGroupTitle={handleOpenEditGroupTitle}
        onArchiveChat={handleArchiveChat}
        onClearHistory={handleClearHistoryPrompt}
        onDeleteChat={handleDeleteChatPrompt}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        unreadCounts={unreadCounts}
        currentUserId={currentUser?.id}
      />

      {/* Asosiy Chat Oynasi */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Header */}
        <header className="shrink-0 border-b border-zinc-800/80 bg-zinc-900/50 backdrop-blur-md px-3 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              className="p-2 -ml-1 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/60 text-zinc-300 lg:hidden cursor-pointer shrink-0"
              title="Suhbatlar ro'yxati"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Chat sarlavhasi */}
            {activeChat === "public" ? (
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="relative shrink-0">
                  <Image
                    src={BRAND_CONFIG.avatarUrl}
                    alt={BRAND_CONFIG.name}
                    width={44}
                    height={44}
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover object-center ring-2 ring-cyan-500/60 shadow-lg shadow-cyan-500/25"
                    priority
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-zinc-950" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <h1 className="text-sm sm:text-base font-extrabold text-white tracking-tight truncate flex items-center gap-1">
                      <span>{BRAND_CONFIG.brandPrefix}</span>
                      <span className="text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]">{BRAND_CONFIG.brandSuffix}</span>
                    </h1>
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      Jonli
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 truncate">
                    {BRAND_CONFIG.supportText}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="relative shrink-0">
                  <div
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr ${
                      activeChat.avatarBg || "from-blue-500 to-indigo-600"
                    } flex items-center justify-center text-xs sm:text-sm font-bold text-white shadow-md`}
                  >
                    {activeChat.avatarText || activeChat.displayName?.[0]?.toUpperCase() || "U"}
                  </div>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-zinc-900 ${
                      activeChat.isOnline ? "bg-emerald-500" : "bg-zinc-600"
                    }`}
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
                      {activeChat.displayName}
                    </h2>
                    <button
                      type="button"
                      onClick={() => handleOpenEditNickname(activeChat)}
                      className="text-zinc-500 hover:text-cyan-400 transition p-1"
                      title="Taxallus belgilash"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    {activeChat.isOnline ? "Hozir onlayn" : "Oflayn"}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* O'ng tomon: Qo'ng'iroq va Profil */}
          <div className="flex items-center gap-2 shrink-0">
            {activeChat !== "public" && (
              <div className="flex items-center gap-1.5 mr-1 sm:mr-2">
                <button
                  type="button"
                  onClick={() => handleStartCall(activeChat, "audio")}
                  className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-zinc-800/90 hover:bg-zinc-800 border border-zinc-700/70 text-zinc-200 hover:text-emerald-400 transition cursor-pointer flex items-center gap-1.5 text-xs font-medium"
                  title="Ovozli qo'ng'iroq"
                >
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                    />
                  </svg>
                  <span className="hidden sm:inline">Ovoz</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleStartCall(activeChat, "video")}
                  className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/35 text-cyan-300 transition cursor-pointer flex items-center gap-1.5 text-xs font-semibold shadow-sm"
                  title="Video qo'ng'iroq"
                >
                  <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  <span className="hidden sm:inline">Video</span>
                </button>
              </div>
            )}

            {/* Ismni tahrirlash */}
            {isEditingName ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const val = e.currentTarget.elements.namedItem("name").value;
                  handleSaveName(val);
                }}
                className="flex items-center gap-1.5"
              >
                <input
                  name="name"
                  defaultValue={author}
                  autoFocus
                  className="bg-zinc-800 border border-zinc-700 text-xs text-white rounded-lg px-2.5 py-1.5 w-28 sm:w-36 focus:outline-none focus:border-cyan-400"
                />
                <button
                  type="submit"
                  className="bg-cyan-500 hover:bg-cyan-400 text-zinc-950 text-xs font-bold px-2 py-1.5 rounded-lg transition cursor-pointer"
                >
                  Ok
                </button>
              </form>
            ) : (
              <button
                onClick={() => setIsEditingName(true)}
                className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/60 transition text-xs text-zinc-300 hover:text-white cursor-pointer"
                title="Ismni o'zgartirish"
              >
                <span
                  className={`w-5 h-5 rounded-full bg-gradient-to-tr ${getAvatarColor(
                    author
                  )} flex items-center justify-center text-[10px] font-bold text-white shadow-sm`}
                >
                  {author[0]?.toUpperCase() || "U"}
                </span>
                <span className="max-w-[70px] sm:max-w-[110px] truncate font-medium hidden sm:inline">
                  {author}
                </span>
                <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
              </button>
            )}
          </div>
        </header>

        {/* Tarmoq uzilishi ogohlantirishi */}
        {!isConnected && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-400 text-xs py-1.5 px-4 text-center flex items-center justify-center gap-2 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>Tarmoq uzildi. Qayta ulanmoqda...</span>
          </div>
        )}

        {/* Asosiy suhbat maydoni */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-4xl w-full mx-auto flex flex-col justify-between">
          {!isLoaded ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-500">
              <div className="w-8 h-8 border-2 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin" />
              <p className="text-sm">Xabarlar yuklanmoqda...</p>
            </div>
          ) : displayMessages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
              <div className="relative">
                <Image
                  src={BRAND_CONFIG.avatarUrl}
                  alt={BRAND_CONFIG.name}
                  width={80}
                  height={80}
                  className="w-20 h-20 rounded-full object-cover ring-4 ring-cyan-500/40 shadow-2xl shadow-cyan-500/30 mx-auto"
                />
                <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-cyan-400 border-2 border-zinc-950 flex items-center justify-center text-[10px] text-zinc-950 font-black">
                  ✓
                </span>
              </div>
              <div className="space-y-1.5 max-w-sm">
                <h3 className="text-base font-bold text-white tracking-wide">
                  {activeChat === "public" ? `${BRAND_CONFIG.name} ga xush kelibsiz!` : `${activeChat.displayName} bilan suhbat`}
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {activeChat === "public"
                    ? "Ushbu umumiy kanalda barcha ishtirokchilar bilan real-time xabar, stiker, audio va dumaloq videoxabar almashishingiz mumkin!"
                    : `${activeChat.displayName} bilan shaxsiy xavfsiz suhbatni birinchi bo‘lib boshlang!`}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {displayMessages.map((msg) => {
                const isMe =
                  (currentUser && msg.senderId === currentUser.id) ||
                  msg.author === author ||
                  msg.senderName === author;

                return (
                  <MessageItem
                    key={msg._id || msg.id || msg.clientTempId}
                    msg={msg}
                    isMe={isMe}
                    getAvatarColor={getAvatarColor}
                    formatTime={formatTime}
                    onEditMessage={handleEditMessage}
                    onDeleteMessage={handleDeleteMessagePrompt}
                  />
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </main>

        {/* Typing indikatori */}
        {currentTypingUser && (
          <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-1">
            <div className="flex items-center gap-2 text-xs text-cyan-400/90 font-medium animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              <span>{currentTypingUser} yozmoqda...</span>
            </div>
          </div>
        )}

        {/* Stikerlar paneli */}
        {showStickers && (
          <div className="max-w-4xl mx-auto w-full px-4 mb-2">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 shadow-xl backdrop-blur-md flex flex-wrap gap-2.5 justify-center sm:justify-start">
              {STICKERS.map((st) => (
                <button
                  key={st}
                  onClick={() => handleSendSticker(st)}
                  className="text-2xl hover:scale-125 transition transform p-2 hover:bg-zinc-800 rounded-xl cursor-pointer"
                  title="Stiker yuborish"
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Jonli kamera orqali dumaloq videoxabar yozish oynasi */}
        {isVideoRecording && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-4">
            <div className="relative flex flex-col items-center gap-6 max-w-sm w-full animate-in fade-in zoom-in duration-200">
              <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-full overflow-hidden border-4 border-cyan-400 shadow-2xl shadow-cyan-500/35 bg-zinc-950">
                <video
                  ref={videoLivePreviewRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/70 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-semibold text-rose-400 border border-rose-500/30 shadow-lg">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                  <span>
                    {Math.floor(videoSeconds / 60)}:
                    {String(videoSeconds % 60).padStart(2, "0")}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={cancelVideoRecording}
                  className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm font-medium text-zinc-300 transition cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="button"
                  onClick={stopVideoRecording}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-cyan-400 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-zinc-950 font-bold text-sm transition shadow-lg shadow-cyan-500/30 flex items-center gap-2 cursor-pointer"
                >
                  <span>Yuborish</span>
                  <svg className="w-4 h-4 transform rotate-90" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-zinc-400 text-center">
                Videoxabar dumaloq formatda (Telegram video note kabi) yuboriladi
              </p>
            </div>
          </div>
        )}

        {/* Xabar kiritish va boshqaruv paneli */}
        <footer className="shrink-0 border-t border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md p-3 sm:p-4 sticky bottom-0">
          <div className="max-w-4xl mx-auto">
            {errorMsg && (
              <div className="mb-2 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center justify-between">
                <span>{errorMsg}</span>
                <button
                  onClick={() => setErrorMsg("")}
                  className="text-rose-400 hover:text-rose-300 font-bold ml-2 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {isRecording ? (
              <div className="flex items-center justify-between bg-zinc-950 border border-rose-500/40 rounded-xl px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                  <span className="text-sm font-semibold text-rose-400">
                    Ovoz yozilmoqda... {Math.floor(recordingSeconds / 60)}:
                    {String(recordingSeconds % 60).padStart(2, "0")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={cancelRecording}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 transition cursor-pointer"
                  >
                    Bekor qilish
                  </button>
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 font-semibold text-xs text-white transition cursor-pointer shadow-md"
                  >
                    Yuborish
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSendText} className="flex items-center gap-2 sm:gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowStickers((prev) => !prev)}
                  className={`p-2.5 rounded-xl border transition cursor-pointer shrink-0 ${
                    showStickers
                      ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                      : "bg-zinc-800/80 border-zinc-700/80 hover:bg-zinc-800 text-zinc-300"
                  }`}
                  title="Stikerlar"
                >
                  😊
                </button>

                <button
                  type="button"
                  onClick={startVideoRecording}
                  className="p-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700/80 hover:bg-zinc-800 text-zinc-300 transition cursor-pointer shrink-0"
                  title="Kamera orqali videoxabar yozish"
                >
                  📹
                </button>

                <button
                  type="button"
                  onClick={startRecording}
                  className="p-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700/80 hover:bg-zinc-800 text-zinc-300 transition cursor-pointer shrink-0"
                  title="Ovozli xabar yozish"
                >
                  🎙️
                </button>

                <input
                  type="text"
                  value={body}
                  onChange={handleInputChange}
                  placeholder={
                    activeChat === "public"
                      ? `${groupSettings?.title || BRAND_CONFIG.defaultGroupTitle}ga xabar yozing... (Enter bilan yuboring)`
                      : `${activeChat.displayName}ga xabar yozing...`
                  }
                  className="flex-1 bg-zinc-950/80 border border-zinc-800 focus:border-cyan-400/80 focus:ring-1 focus:ring-cyan-500/30 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none transition shadow-inner"
                  disabled={isSending}
                />

                <button
                  type="submit"
                  disabled={!body.trim() || isSending}
                  className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-teal-400 hover:from-cyan-400 hover:to-teal-300 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 font-black px-4 sm:px-5 py-2.5 rounded-xl text-sm transition shadow-lg shadow-cyan-500/25 flex items-center gap-2 cursor-pointer shrink-0"
                >
                  {isSending ? (
                    <span className="w-4 h-4 border-2 border-zinc-950/20 border-t-zinc-950 rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4 transform rotate-90" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                    </svg>
                  )}
                  <span className="hidden sm:inline">Yuborish</span>
                </button>
              </form>
            )}
          </div>
        </footer>
      </div>

      {/* WebRTC Audio & Video Qo'ng'iroq Modali */}
      <CallModal
        callState={callState}
        localStream={localStream}
        remoteStream={remoteStream}
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        callDuration={callDuration}
        iceStatus={iceStatus}
        onAccept={handleAcceptCall}
        onReject={() => handleRejectCall("Qo‘ng‘iroq rad etildi")}
        onEnd={handleEndCall}
        onToggleMute={handleToggleMute}
        onToggleVideo={handleToggleVideo}
        onDismissError={() =>
          setCallState((prev) => ({ ...prev, status: "idle", error: null }))
        }
      />

      {/* Tasdiqlash Modali (Confirm Modal for Delete / Clear History) */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmLabel={confirmModal.confirmLabel}
        isDestructive={confirmModal.isDestructive}
        showForEveryoneOption={confirmModal.showForEveryoneOption}
        forEveryone={confirmModal.forEveryone}
        onToggleForEveryone={(val) => setConfirmModal((prev) => ({ ...prev, forEveryone: val }))}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Taxallus va Guruh Nomini Tahrirlash Modali */}
      <EditNicknameModal
        isOpen={nicknameModal.isOpen}
        title={nicknameModal.title}
        description={nicknameModal.description}
        placeholder={nicknameModal.placeholder}
        initialValue={nicknameModal.initialValue}
        onSave={handleSaveNickname}
        onClose={() => setNicknameModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
