'use client'

import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { X, PhoneOff, Video, VideoOff, Mic, MicOff } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import { NEXT_PUBLIC_API_URL } from '@/base'

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
  const [hasRemoteStream, setHasRemoteStream] = useState(false)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const roomIdRef = useRef<string>(call.roomId)
  const socketRef = useRef<Socket | null>(null)
  const pendingIceCandidatesRef = useRef<RTCIceCandidate[]>([])
  const remoteDescriptionSetRef = useRef<boolean>(false)
  const connectionRetryCountRef = useRef<number>(0)
  const isCallStartedRef = useRef<boolean>(false)
  const joinedRoomRef = useRef<boolean>(false)
  const isCallInitializedRef = useRef<boolean>(false)
  const maxRetries = 5 // Increased for better reliability on different networks
  const iceCandidateStatsRef = useRef<{ host: number; srflx: number; relay: number }>({
    host: 0,
    srflx: 0,
    relay: 0,
  })

  // Store roomId in ref - only update if it's actually a new call
  useEffect(() => {
    // Only update if it's a genuinely new room (different from current)
    if (roomIdRef.current !== call.roomId) {
      console.log('New call detected, resetting state')
      roomIdRef.current = call.roomId
      // Reset initialization flag for new call
      isCallInitializedRef.current = false
      joinedRoomRef.current = false
    }
  }, [call.roomId])

  useEffect(() => {
    socketRef.current = socket
  }, [socket])

  useEffect(() => {
    const roomId = roomIdRef.current // Use ref instead of call.roomId
    const userId = user?.id
    if (!roomId || !userId) return

    // CRITICAL: Prevent re-initialization if call already exists
    if (isCallInitializedRef.current || peerConnectionRef.current || socketRef.current?.connected) {
      console.log('⚠️ Call already initialized, skipping re-initialization')
      return
    }

    // Mark as initialized immediately to prevent race conditions
    isCallInitializedRef.current = true

    // Reset state for new call
    setHasRemoteStream(false)
    connectionRetryCountRef.current = 0
    pendingIceCandidatesRef.current = []
    remoteDescriptionSetRef.current = false
    isCallStartedRef.current = false
    joinedRoomRef.current = false
    iceCandidateStatsRef.current = { host: 0, srflx: 0, relay: 0 }

    const wsUrl = NEXT_PUBLIC_API_URL
    const newSocket = io(wsUrl, {
      transports: ['websocket'], // WebSocket only for lower latency and better real-time performance
    })

    const startCallHandler = async (shouldCreateOffer = false) => {
      // Prevent starting call multiple times
      if (isCallStartedRef.current || localStreamRef.current) {
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
        isCallStartedRef.current = true
        localStreamRef.current = stream
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
        }

        // Configure ICE servers with STUN and TURN for cross-network connectivity
        // STUN for NAT discovery (try direct connection first)
        // TURN for media relay when direct connection fails (different networks)
        // Use custom TURN server from environment variables or default to your VPS
        const turnHost = process.env.NEXT_PUBLIC_TURN_HOST || 'al7ram.nabdtech.store'
        const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME || 'turnuser'
        const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL || 'turnpassword'

        const iceServers: RTCIceServer[] = [
          // Primary STUN server
          { urls: 'stun:stun.l.google.com:19302' },
          // Backup STUN servers
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          // TURN servers - CRITICAL for cross-network connectivity
          {
            urls: [
              `turn:${turnHost}:3478?transport=udp`,
              `turn:${turnHost}:3478?transport=tcp`,
              `turns:${turnHost}:5349?transport=tcp`,
            ],
            username: turnUsername,
            credential: turnCredential,
          },
        ]

        console.log('ICE servers configured:', {
          stun: ['stun.l.google.com:19302', 'stun1.l.google.com:19302', 'stun2.l.google.com:19302'],
          turn: {
            host: turnHost,
            udp: `turn:${turnHost}:3478`,
            tcp: `turn:${turnHost}:3478`,
            tls: `turns:${turnHost}:5349`,
            username: turnUsername,
          },
          note: 'TURN will be used only when needed (different networks)',
        })

        const pc = new RTCPeerConnection({
          iceServers,
          iceTransportPolicy: 'all', // Try both relay and direct connections
          bundlePolicy: 'max-bundle', // Bundle tracks in single RTP session for better performance
        })
        
        console.log('RTCPeerConnection configured with:', {
          iceServersCount: iceServers.length,
          iceTransportPolicy: 'all',
          bundlePolicy: 'max-bundle',
        })

        // Add tracks to peer connection
        stream.getTracks().forEach((track) => {
          const sender = pc.addTrack(track, stream)
          console.log(`Added ${track.kind} track:`, {
            id: track.id,
            enabled: track.enabled,
            readyState: track.readyState,
            senderId: sender ? 'added' : 'failed'
          })
        })
        
        console.log('Peer connection initialized with tracks:', {
          localTracks: pc.getSenders().length,
          streamTracks: stream.getTracks().length
        })

        pc.ontrack = (event) => {
          console.log('Received remote stream - ontrack event:', {
            streams: event.streams.length,
            track: event.track.kind,
            id: event.track.id,
            enabled: event.track.enabled,
            readyState: event.track.readyState
          })
          
          if (!remoteVideoRef.current) return
          
          // Prevent setting srcObject multiple times (causes AbortError)
          if (remoteVideoRef.current.srcObject) {
            console.log('Remote video srcObject already set, skipping...')
            return
          }
          
          // Get stream from event
          const remoteStream = event.streams && event.streams.length > 0 
            ? event.streams[0]
            : null
          
          if (!remoteStream) {
            console.error('No stream in ontrack event')
            return
          }
          
          console.log('Setting remote video stream:', {
            id: remoteStream.id,
            tracks: remoteStream.getTracks().length,
            totalRemoteTracks: pc.getReceivers().length
          })
          
          remoteVideoRef.current.srcObject = remoteStream
          setHasRemoteStream(true)
          remoteVideoRef.current.play().catch(err => {
            console.error('Error playing remote video:', err)
          })
        }

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            // Log ICE candidate type for debugging (host, srflx, relay)
            const candidateType = event.candidate.type
            if (candidateType === 'host') {
              iceCandidateStatsRef.current.host++
            } else if (candidateType === 'srflx') {
              iceCandidateStatsRef.current.srflx++
            } else if (candidateType === 'relay') {
              iceCandidateStatsRef.current.relay++
              console.log('✅ RELAY candidate found - TURN server is working!', {
                candidate: event.candidate.candidate.substring(0, 100),
                type: candidateType,
              })
            }
            
            console.log(`ICE candidate (${candidateType}):`, {
              type: candidateType,
              protocol: event.candidate.protocol,
              address: event.candidate.address,
              port: event.candidate.port,
              stats: { ...iceCandidateStatsRef.current },
            })
            
            if (socketRef.current) {
              socketRef.current.emit('ice-candidate', {
                roomId: roomIdRef.current,
                candidate: event.candidate,
              })
            }
          } else {
            // End of candidates
            console.log('ICE candidate gathering completed', {
              finalStats: { ...iceCandidateStatsRef.current },
              hasRelay: iceCandidateStatsRef.current.relay > 0,
              message: iceCandidateStatsRef.current.relay > 0
                ? '✅ TURN relay available - cross-network connection should work'
                : '⚠️ No relay candidates - may fail on different networks',
            })
          }
        }

        pc.oniceconnectionstatechange = () => {
          const state = pc.iceConnectionState
          console.log('ICE connection state changed:', state, {
            stats: { ...iceCandidateStatsRef.current },
            hasRelay: iceCandidateStatsRef.current.relay > 0,
          })
          
          if (state === 'connected' || state === 'completed') {
            console.log('✅ ICE connection established successfully', {
              connectionType: iceCandidateStatsRef.current.relay > 0 ? 'RELAY (TURN)' : 'DIRECT (STUN)',
              stats: { ...iceCandidateStatsRef.current },
            })
          } else if (state === 'failed') {
            console.error('❌ ICE connection failed', {
              retryCount: connectionRetryCountRef.current,
              maxRetries,
              stats: { ...iceCandidateStatsRef.current },
              hasRelay: iceCandidateStatsRef.current.relay > 0,
              suggestion: iceCandidateStatsRef.current.relay === 0
                ? 'No relay candidates - TURN servers may be blocked or unavailable'
                : 'Relay available but connection failed - check network/firewall',
            })
            
            // Try to restart ICE gathering with retry limit
            if (connectionRetryCountRef.current < maxRetries) {
              connectionRetryCountRef.current++
              console.log(`Attempting ICE restart (${connectionRetryCountRef.current}/${maxRetries})...`)
              try {
                pc.restartIce()
                console.log('ICE restart initiated')
                // Reset stats for new gathering attempt
                iceCandidateStatsRef.current = { host: 0, srflx: 0, relay: 0 }
              } catch (error) {
                console.error('Error restarting ICE:', error)
              }
            } else {
              console.error(`Max retries (${maxRetries}) reached. Connection cannot be recovered.`)
              toast.error('فشل الاتصال بعد عدة محاولات. يرجى التحقق من الشبكة وإعادة المحاولة.')
            }
          } else if (state === 'disconnected') {
            console.warn('⚠️ ICE connection disconnected, may reconnect...', {
              stats: { ...iceCandidateStatsRef.current },
            })
          } else if (state === 'checking') {
            console.log('🔄 ICE connection checking...', {
              stats: { ...iceCandidateStatsRef.current },
            })
          }
        }
        
        pc.onconnectionstatechange = () => {
          const connectionState = pc.connectionState
          const iceState = pc.iceConnectionState
          const signalingState = pc.signalingState
          
          console.log('Peer connection state changed:', {
            connectionState,
            iceConnectionState: iceState,
            signalingState,
            stats: { ...iceCandidateStatsRef.current },
            hasRelay: iceCandidateStatsRef.current.relay > 0,
          })
          
          if (connectionState === 'failed') {
            console.error('❌ Peer connection failed', {
              iceConnectionState: iceState,
              signalingState,
              connectionState,
              localTracks: pc.getSenders().length,
              remoteTracks: pc.getReceivers().length,
              stats: { ...iceCandidateStatsRef.current },
              hasRelay: iceCandidateStatsRef.current.relay > 0,
              retryCount: connectionRetryCountRef.current,
            })
            
            // Log error details but don't restart ICE here (only in oniceconnectionstatechange)
            if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
              console.error('ICE is connected but peer connection failed - media negotiation issue')
              console.error('This usually means media tracks are not properly negotiated')
              
              // Check if we have tracks
              const senders = pc.getSenders()
              const receivers = pc.getReceivers()
              console.error('Track status:', {
                localSenders: senders.length,
                remoteReceivers: receivers.length,
                sendersWithTracks: senders.filter(s => s.track).length,
                receiversWithTracks: receivers.filter(r => r.track).length
              })
              
              toast.error('فشل الاتصال - مشكلة في التفاوض على الوسائط')
            } else {
              console.error('ICE also failed, cannot recover. Need to recreate connection.')
              const errorMsg = iceCandidateStatsRef.current.relay === 0
                ? 'فشل الاتصال - لا توجد خوادم TURN متاحة. يرجى التحقق من الشبكة.'
                : 'فشل الاتصال بعد عدة محاولات. يرجى إعادة المحاولة.'
              toast.error(errorMsg)
            }
          } else if (connectionState === 'connected') {
            const connectionType = iceCandidateStatsRef.current.relay > 0 ? 'RELAY (TURN)' : 'DIRECT (STUN)'
            console.log('✅ Peer connection established successfully', {
              connectionType,
              localTracks: pc.getSenders().length,
              remoteTracks: pc.getReceivers().length,
              iceConnectionState: iceState,
              signalingState,
              stats: { ...iceCandidateStatsRef.current },
            })
            
            if (iceCandidateStatsRef.current.relay > 0) {
              console.log('✅ Using TURN relay - cross-network connection is working!')
            } else {
              console.log('ℹ️ Using direct connection - both users may be on same network')
            }
          } else if (pc.connectionState === 'disconnected') {
            console.warn('Peer connection disconnected, may reconnect...')
          } else if (pc.connectionState === 'connecting') {
            console.log('Peer connection connecting...')
          }
        }
        
        pc.onsignalingstatechange = () => {
          console.log('Signaling state changed:', pc.signalingState)
          if (pc.signalingState === 'stable') {
            console.log('Signaling is stable, connection should be ready')
            console.log('Connection state:', pc.connectionState)
            console.log('ICE connection state:', pc.iceConnectionState)
            console.log('Tracks:', {
              localSenders: pc.getSenders().length,
              remoteReceivers: pc.getReceivers().length
            })
          } else if (pc.signalingState === 'closed') {
            console.error('Signaling state is closed')
          }
        }

        peerConnectionRef.current = pc
        remoteDescriptionSetRef.current = false
        pendingIceCandidatesRef.current = []
        connectionRetryCountRef.current = 0
        iceCandidateStatsRef.current = { host: 0, srflx: 0, relay: 0 }

        // Only create offer if we should (first user or after receiving offer)
        if (shouldCreateOffer) {
          console.log('Creating offer...')
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          console.log('Local description set:', {
            type: offer.type,
            sdpLength: offer.sdp?.length || 0,
            signalingState: pc.signalingState
          })
          if (socketRef.current) {
            socketRef.current.emit('offer', { roomId: roomIdRef.current, offer })
            console.log('Offer sent')
          }
        }
      } catch (error: any) {
        console.error('Error starting call:', error)
        isCallStartedRef.current = false
        
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
      socketRef.current = newSocket
      
      // Prevent joining room multiple times
      if (joinedRoomRef.current) {
        console.log('⚠️ Already joined room, skipping join-room emit')
        return
      }
      
      joinedRoomRef.current = true
      newSocket.emit('join-room', {
        roomId,
        userId,
      })
      console.log('✅ Emitted join-room:', { roomId, userId })
    })

    newSocket.on('user-joined', async () => {
      console.log('User joined event received')
      socketRef.current = newSocket
      
      // Only start if peer connection doesn't exist yet
      if (!peerConnectionRef.current) {
        console.log('Starting call as first user, will create offer')
        await startCallHandler(true)
      } else {
        console.log('Peer connection already exists, skipping start')
      }
    })

    newSocket.on('offer', async (offer) => {
      console.log('Received offer:', offer)
      
      // Validate offer
      if (!offer || !offer.sdp || !offer.type) {
        console.error('Invalid offer received:', offer)
        return
      }
      
      // Start call if not started yet (we received offer before starting)
      if (!localStreamRef.current && !isCallStartedRef.current) {
        console.log('Starting call after receiving offer')
        await startCallHandler(false) // Don't create offer, we received one
      }
      
      if (!peerConnectionRef.current) {
        console.warn('Received offer but no peer connection yet')
        return
      }

      const pc = peerConnectionRef.current

      try {
        // Set remote description first
        console.log('Setting remote description from offer')
        await pc.setRemoteDescription(new RTCSessionDescription(offer))
        remoteDescriptionSetRef.current = true
        console.log('✅ Remote description set from offer')

        // CRITICAL: Flush all pending ICE candidates immediately
        const pendingCount = pendingIceCandidatesRef.current.length
        if (pendingCount > 0) {
          console.log(`Processing ${pendingCount} pending ICE candidates...`)
          while (pendingIceCandidatesRef.current.length > 0) {
            const candidate = pendingIceCandidatesRef.current.shift()
            if (candidate && candidate.candidate) {
              try {
                await pc.addIceCandidate(candidate)
                console.log(`✅ Processed pending ICE candidate: ${candidate.type || 'unknown'}`)
              } catch (error) {
                console.error('❌ Error adding pending ICE candidate:', error)
              }
            }
          }
          console.log(`✅ All ${pendingCount} pending ICE candidates processed`)
        }

        // Create and send answer
        console.log('Creating answer...')
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        console.log('✅ Answer created and local description set:', {
          type: answer.type,
          sdpLength: answer.sdp?.length || 0,
          signalingState: pc.signalingState
        })
        
        newSocket.emit('answer', { roomId, answer })
        console.log('✅ Answer sent successfully')
      } catch (error) {
        console.error('❌ Error handling offer:', error)
      }
    })

    newSocket.on('answer', async (answer) => {
      console.log('Received answer:', answer)
      
      // Validate answer
      if (!answer || !answer.sdp || !answer.type) {
        console.error('Invalid answer received:', answer)
        return
      }
      
      if (!peerConnectionRef.current) {
        console.warn('Received answer but no peer connection')
        return
      }

      const pc = peerConnectionRef.current
      
      try {
        const currentState = pc.signalingState
        console.log('Current signaling state before setting answer:', currentState)
        
        // Only proceed if we're expecting an answer
        if (currentState !== 'have-local-offer') {
          console.warn('Cannot set remote description, unexpected signaling state:', currentState)
          return
        }

        // Set remote description first
        await pc.setRemoteDescription(new RTCSessionDescription(answer))
        remoteDescriptionSetRef.current = true
        console.log('✅ Remote description set from answer successfully')
        
        // CRITICAL: Flush all pending ICE candidates immediately after setRemoteDescription
        const pendingCount = pendingIceCandidatesRef.current.length
        console.log(`Processing ${pendingCount} pending ICE candidates...`)
        
        while (pendingIceCandidatesRef.current.length > 0) {
          const candidate = pendingIceCandidatesRef.current.shift()
          if (candidate && candidate.candidate) {
            try {
              await pc.addIceCandidate(candidate)
              console.log(`✅ Processed pending ICE candidate: ${candidate.type || 'unknown'}`)
            } catch (error) {
              console.error('❌ Error adding pending ICE candidate:', error, candidate)
            }
          }
        }
        
        if (pendingCount > 0) {
          console.log(`✅ All ${pendingCount} pending ICE candidates processed`)
        }
      } catch (error) {
        console.error('❌ Error setting remote description from answer:', error)
      }
    })

    newSocket.on('ice-candidate', async (candidate) => {
      if (!peerConnectionRef.current) {
        console.warn('Received ICE candidate but no peer connection')
        return
      }

      const pc = peerConnectionRef.current

      // Handle null candidate (end of candidates)
      if (!candidate || !candidate.candidate) {
        try {
          await pc.addIceCandidate(null)
          console.log('✅ Received null ICE candidate (end of candidates)')
        } catch (error) {
          console.error('Error adding null ICE candidate:', error)
        }
        return
      }

      try {
        // If remote description is not set yet, queue the candidate
        if (!remoteDescriptionSetRef.current) {
          pendingIceCandidatesRef.current.push(new RTCIceCandidate(candidate))
          console.log(`📦 Queueing ICE candidate (${candidate.type || 'unknown'}) - remote description not set yet`)
          return
        }

        // Remote description is set, add candidate immediately
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
        console.log(`✅ ICE candidate added: ${candidate.type || 'unknown'}`)
      } catch (error) {
        console.error('❌ Error adding ICE candidate:', error)
        // If error and remote description not set, queue it
        if (!remoteDescriptionSetRef.current) {
          pendingIceCandidatesRef.current.push(new RTCIceCandidate(candidate))
          console.log(`📦 Queued ICE candidate after error (will process later)`)
        }
      }
    })

    newSocket.on('call-ended', () => {
      console.log('Call ended event received')
      // Call ended from remote - end the call properly
      handleEndCall()
    })

    setSocket(newSocket)

    // Cleanup only on unmount (component is actually being removed)
    // Do NOT cleanup resources here - that's handleEndCall's job
    return () => {
      console.log('Component unmounting - cleaning up socket only...')
      // Only disconnect socket, don't cleanup media/resources
      // Resources will be cleaned up by handleEndCall if needed
      try {
        if (newSocket.connected) {
          newSocket.removeAllListeners()
          newSocket.disconnect()
        }
      } catch (error) {
        console.error('Error disconnecting socket on unmount:', error)
      }
    }
  }, [call.roomId, user?.id]) // Depend on roomId and userId only

  const handleEndCall = () => {
    console.log('🔴 Ending call - cleanup starting...')
    
    // Emit leave-room event before cleanup
    if (socketRef.current && socketRef.current.connected) {
      try {
        socketRef.current.emit('leave-room', {
          roomId: roomIdRef.current,
          userId: user?.id,
        })
      } catch (error) {
        console.error('Error emitting leave-room:', error)
      }
    }
    
    // Cleanup media streams
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop()
        track.enabled = false
      })
      localStreamRef.current = null
    }
    
    // Cleanup peer connection
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close()
      } catch (error) {
        console.error('Error closing peer connection:', error)
      }
      peerConnectionRef.current = null
    }
    
    // Cleanup video elements
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null
    }
    
    // Cleanup socket
    if (socketRef.current) {
      try {
        socketRef.current.removeAllListeners()
        socketRef.current.disconnect()
      } catch (error) {
        console.error('Error disconnecting socket:', error)
      }
      socketRef.current = null
    }
    
    // Reset all refs
    pendingIceCandidatesRef.current = []
    remoteDescriptionSetRef.current = false
    connectionRetryCountRef.current = 0
    isCallStartedRef.current = false
    joinedRoomRef.current = false
    isCallInitializedRef.current = false
    iceCandidateStatsRef.current = { host: 0, srflx: 0, relay: 0 }
    setHasRemoteStream(false)
    
    console.log('✅ Call cleanup completed')
    
    // Close UI modal (this is UI-only, doesn't affect call state)
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
          onClick={handleEndCall}
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
              muted={false}
              className="w-full h-full object-cover"
              onLoadedMetadata={() => {
                console.log('Remote video metadata loaded')
                if (remoteVideoRef.current) {
                  remoteVideoRef.current.play().catch(err => {
                    console.error('Error auto-playing remote video:', err)
                  })
                }
              }}
              onPlay={() => {
                console.log('Remote video started playing')
              }}
              onError={(e) => {
                console.error('Remote video error:', e)
              }}
            />
            <div className="absolute bottom-4 left-4 text-white bg-black bg-opacity-50 px-3 py-1 rounded">
              الطرف الآخر
            </div>
            {!hasRemoteStream && (
              <div className="absolute inset-0 flex items-center justify-center text-white">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mx-auto mb-4"></div>
                  <p>في انتظار الطرف الآخر...</p>
                </div>
              </div>
            )}
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

