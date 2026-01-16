'use client'

import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { X, PhoneOff, Video, VideoOff, Mic, MicOff } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

interface VideoCall {
  id: string
  roomId: string
  status: string
}

interface Props {
  call: VideoCall
  onClose: () => void
}

export default function VideoCallModal({ call, onClose }: Props) {
  const { user } = useAuthStore()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const roomIdRef = useRef<string>(call.roomId)
  const socketRef = useRef<Socket | null>(null)

  // Update refs when call changes
  useEffect(() => {
    roomIdRef.current = call.roomId
  }, [call.roomId])

  useEffect(() => {
    socketRef.current = socket
  }, [socket])

  useEffect(() => {
    const roomId = call.roomId
    const userId = user?.id
    if (!roomId || !userId) return

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001'
    const newSocket = io(wsUrl, {
      transports: ['websocket', 'polling'],
    })

    let isCallStarted = false

    const startCallHandler = async (shouldCreateOffer = false) => {
      // Prevent starting call multiple times
      if (isCallStarted || localStreamRef.current) {
        console.log('Call already started, skipping...')
        return
      }

      // Ensure socket is ready
      if (!socketRef.current && newSocket.connected) {
        socketRef.current = newSocket
      }

      try {
        console.log('Requesting media access...')
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        })

        console.log('Media access granted')
        isCallStarted = true
        localStreamRef.current = stream
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
        }

        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        })

        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream)
        })

        pc.ontrack = (event) => {
          console.log('Received remote stream')
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0]
          }
        }

        pc.onicecandidate = (event) => {
          if (event.candidate && socketRef.current) {
            socketRef.current.emit('ice-candidate', {
              roomId: roomIdRef.current,
              candidate: event.candidate,
            })
          }
        }

        pc.oniceconnectionstatechange = () => {
          console.log('ICE connection state:', pc.iceConnectionState)
        }

        peerConnectionRef.current = pc

        // Only create offer if we should (first user or after receiving offer)
        if (shouldCreateOffer) {
          console.log('Creating offer...')
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          if (socketRef.current) {
            socketRef.current.emit('offer', { roomId: roomIdRef.current, offer })
            console.log('Offer sent')
          }
        }
      } catch (error: any) {
        console.error('Error starting call:', error)
        isCallStarted = false
        
        let errorMessage = 'فشل في بدء المكالمة'
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          errorMessage = 'تم رفض الوصول للكاميرا/الميكروفون - يرجى السماح بالوصول وإعادة المحاولة'
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          errorMessage = 'لم يتم العثور على كاميرا أو ميكروفون - يرجى التأكد من وجود الجهاز'
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          errorMessage = 'الكاميرا أو الميكروفون مستخدم من قبل تطبيق آخر - يرجى إغلاق التطبيقات الأخرى'
        }
        
        toast.error(errorMessage)
      }
    }

    newSocket.on('connect', () => {
      console.log('VideoCall WebSocket connected')
      // Update socket ref immediately
      socketRef.current = newSocket
      newSocket.emit('join-room', {
        roomId,
        userId,
      })
      // Don't start call yet - wait for user-joined event
    })

    newSocket.on('user-joined', async (data) => {
      console.log('User joined:', data)
      // Make sure socket ref is set
      socketRef.current = newSocket
      
      // Wait a bit to avoid race condition when both users join at the same time
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Start call when someone joins
      // If we're the first (no peerConnection yet), we create the offer
      // Otherwise, we wait for the offer from the other user
      const shouldCreateOffer = !peerConnectionRef.current
      
      // Only start if not already started
      if (!localStreamRef.current && !isCallStarted) {
        await startCallHandler(shouldCreateOffer)
      }
    })

    newSocket.on('offer', async (offer) => {
      console.log('Received offer')
      // Start call if not started yet (we received offer before starting)
      if (!localStreamRef.current) {
        await startCallHandler(false) // Don't create offer, we received one
      }
      
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(offer)
        )
        const answer = await peerConnectionRef.current.createAnswer()
        await peerConnectionRef.current.setLocalDescription(answer)
        newSocket.emit('answer', { roomId, answer })
        console.log('Sent answer')
      }
    })

    newSocket.on('answer', async (answer) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(answer)
        )
      }
    })

    newSocket.on('ice-candidate', async (candidate) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.addIceCandidate(
          new RTCIceCandidate(candidate)
        )
      }
    })

    newSocket.on('call-ended', () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop())
        localStreamRef.current = null
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close()
        peerConnectionRef.current = null
      }
      onClose()
    })

    setSocket(newSocket)

    return () => {
      newSocket.disconnect()
      // Only cleanup if component is actually unmounting
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop())
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close()
        peerConnectionRef.current = null
      }
    }
  }, [call.roomId]) // Only depend on roomId, not the whole call object

  const handleEndCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop())
      localStreamRef.current = null
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }
    if (socketRef.current) {
      socketRef.current.emit('leave-room', {
        roomId: roomIdRef.current,
        userId: user?.id,
      })
    }
    onClose()
  }

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !isVideoEnabled
        setIsVideoEnabled(!isVideoEnabled)
      }
    }
  }

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !isAudioEnabled
        setIsAudioEnabled(!isAudioEnabled)
      }
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
      <div className="relative w-full h-full max-w-7xl mx-auto p-4">
        <button
          onClick={onClose}
          className="absolute top-4 left-4 text-white hover:text-gray-300 z-10"
        >
          <X size={24} />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
          <div className="relative bg-gray-900 rounded-lg overflow-hidden">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-4 left-4 text-white bg-black bg-opacity-50 px-3 py-1 rounded">
              أنت
            </div>
          </div>

          <div className="relative bg-gray-900 rounded-lg overflow-hidden">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-4 left-4 text-white bg-black bg-opacity-50 px-3 py-1 rounded">
              الطرف الآخر
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-4">
          <button
            onClick={toggleVideo}
            className={`p-4 rounded-full ${
              isVideoEnabled
                ? 'bg-gray-700 text-white'
                : 'bg-red-600 text-white'
            } hover:bg-opacity-80 transition-colors`}
          >
            {isVideoEnabled ? <Video size={24} /> : <VideoOff size={24} />}
          </button>
          <button
            onClick={toggleAudio}
            className={`p-4 rounded-full ${
              isAudioEnabled
                ? 'bg-gray-700 text-white'
                : 'bg-red-600 text-white'
            } hover:bg-opacity-80 transition-colors`}
          >
            {isAudioEnabled ? <Mic size={24} /> : <MicOff size={24} />}
          </button>
          <button
            onClick={handleEndCall}
            className="p-4 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            <PhoneOff size={24} />
          </button>
        </div>
      </div>
    </div>
  )
}

