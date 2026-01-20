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
  remoteUserName?: string // اسم الطرف الآخر (الداعم للعميل، أو العميل للداعم)
}

export default function VideoCallModal({ call, onClose, remoteUserName }: Props) {
  const { user } = useAuthStore()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [hasRemoteStream, setHasRemoteStream] = useState(false)
  const [callDuration, setCallDuration] = useState(0) // مدة المكالمة بالثواني
  const callStartTimeRef = useRef<number | null>(null)
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
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
  const iceRestartAttemptsRef = useRef<number>(0)
  const maxIceRestartAttempts = 3

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
    iceRestartAttemptsRef.current = 0
    // إعادة تعيين العداد الزمني
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
    callStartTimeRef.current = null
    setCallDuration(0)

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
        const turnHost = '91.99.83.210'
        const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME || 'turnuser'
        const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL || 'turnpassword'

        const iceServers: RTCIceServer[] = [
          // TURN servers - CRITICAL for cross-network connectivity (put first for priority)
          {
            urls: [
              `turn:${turnHost}:3478?transport=udp`,
              `turn:${turnHost}:3478?transport=tcp`,
              `turns:${turnHost}:5349?transport=tcp`,
            ],
            username: turnUsername,
            credential: turnCredential,
          },
          // Fallback public STUN server (used as backup when TURN is not needed)
          { urls: 'stun:stun.l.google.com:19302' },
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
          // استخدام 'all' أولاً، لكن سنغيره إلى 'relay' عند الفشل
          iceTransportPolicy: 'relay', // Use relay only - required for different networks
          bundlePolicy: 'max-bundle',
          iceCandidatePoolSize: 10,// Pre-gather ICE candidates for faster connection
        })
        
        console.log('RTCPeerConnection configured with:', {
          iceServersCount: iceServers.length,
          iceTransportPolicy: 'relay',
          bundlePolicy: 'max-bundle',
          iceCandidatePoolSize: 10,
          iceRestartAttempts: iceRestartAttemptsRef.current,
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
          
          // بدء العداد الزمني عند استلام الـ stream (مرة واحدة فقط)
          if (callStartTimeRef.current === null && !timerIntervalRef.current) {
            callStartTimeRef.current = Date.now()
            // تحديث العداد كل ثانية
            timerIntervalRef.current = setInterval(() => {
              if (callStartTimeRef.current) {
                const elapsed = Math.floor((Date.now() - callStartTimeRef.current) / 1000)
                setCallDuration(elapsed)
              }
            }, 1000)
            console.log('⏱️ Call timer started')
          }
          
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
            restartAttempts: iceRestartAttemptsRef.current,
          })
          
          // إضافة timeout للتحقق من أن ICE connection يبدأ
          if (state === 'new') {
            // إذا بقي في 'new' لأكثر من 5 ثواني، هناك مشكلة
            setTimeout(() => {
              if (pc.iceConnectionState === 'new') {
                console.error('⚠️ ICE connection stuck in "new" state - may need restart')
                // محاولة إعادة تشغيل ICE
                if (pc.restartIce) {
                  console.log('🔄 Attempting ICE restart...')
                  pc.restartIce()
                }
              }
            }, 5000)
          }
          
          // Check which connection type is actually being used
          if (state === 'connected' || state === 'completed') {
            // Get stats to see which candidate is actually used
            pc.getStats().then(stats => {
              let connectionType = 'UNKNOWN'
              stats.forEach(report => {
                if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                  const localCandidate = stats.get(report.localCandidateId)
                  const remoteCandidate = stats.get(report.remoteCandidateId)
                  if (localCandidate?.candidateType === 'relay' || remoteCandidate?.candidateType === 'relay') {
                    connectionType = 'RELAY (TURN)'
                  } else if (localCandidate?.candidateType === 'srflx' || remoteCandidate?.candidateType === 'srflx') {
                    connectionType = 'DIRECT (STUN)'
                  } else {
                    connectionType = 'DIRECT (HOST)'
                  }
                }
              })
              console.log('✅ ICE connection established successfully', {
                connectionType,
                stats: { ...iceCandidateStatsRef.current },
                note: connectionType === 'RELAY (TURN)' 
                  ? 'Using TURN relay - cross-network connection is working!'
                  : 'Using direct connection - may not work on different networks',
              })
            }).catch(err => {
              console.log('✅ ICE connection established successfully', {
                connectionType: iceCandidateStatsRef.current.relay > 0 ? 'RELAY (TURN)' : 'DIRECT (STUN)',
                stats: { ...iceCandidateStatsRef.current },
                note: 'Could not determine exact connection type from stats',
              })
            })
          } else if (state === 'failed') {
            console.error('❌ ICE connection failed', {
              retryCount: connectionRetryCountRef.current,
              maxRetries,
              stats: { ...iceCandidateStatsRef.current },
              hasRelay: iceCandidateStatsRef.current.relay > 0,
              iceRestartAttempts: iceRestartAttemptsRef.current,
              suggestion: iceCandidateStatsRef.current.relay === 0
                ? 'No relay candidates - TURN servers may be blocked or unavailable'
                : 'Relay available but connection failed - may need more time or check network/firewall',
            })
            
            // إذا فشل الاتصال ولدينا relay candidates، أجبر استخدام relay
            if (iceCandidateStatsRef.current.relay > 0 && iceRestartAttemptsRef.current < maxIceRestartAttempts) {
              iceRestartAttemptsRef.current++
              console.log(`🔄 Forcing relay-only mode (attempt ${iceRestartAttemptsRef.current}/${maxIceRestartAttempts})...`)
              
              // إعادة إنشاء peer connection مع relay-only policy
              if (localStreamRef.current) {
                // احفظ الـ stream والـ socket handlers
                const savedStream = localStreamRef.current
                const currentSocket = socketRef.current
                const currentRoomId = roomIdRef.current
                
                // احفظ event handlers
                const savedOntrack = pc.ontrack
                const savedOnicecandidate = pc.onicecandidate
                const savedOnconnectionstatechange = pc.onconnectionstatechange
                const savedOnsignalingstatechange = pc.onsignalingstatechange
                
                // أغلق الـ connection القديم
                try {
                  pc.close()
                } catch (error) {
                  console.error('Error closing old peer connection:', error)
                }
                
                // أنشئ connection جديد مع relay-only
                const newPc = new RTCPeerConnection({
                  iceServers,
                  iceTransportPolicy: 'relay', // Force relay only
                  bundlePolicy: 'max-bundle',
                  iceCandidatePoolSize: 10,
                })
                
                // أعد إعداد event handlers
                newPc.ontrack = savedOntrack
                newPc.onicecandidate = savedOnicecandidate
                newPc.onconnectionstatechange = savedOnconnectionstatechange
                newPc.onsignalingstatechange = savedOnsignalingstatechange
                
                // أضف الـ tracks مرة أخرى
                savedStream.getTracks().forEach((track) => {
                  newPc.addTrack(track, savedStream)
                })
                
                // أعد تعيين oniceconnectionstatechange مع الإشارة إلى newPc
                newPc.oniceconnectionstatechange = () => {
                  const newState = newPc.iceConnectionState
                  console.log('ICE connection state changed (relay-only):', newState, {
                    stats: { ...iceCandidateStatsRef.current },
                    hasRelay: iceCandidateStatsRef.current.relay > 0,
                    restartAttempts: iceRestartAttemptsRef.current,
                  })
                  
                  if (newState === 'connected' || newState === 'completed') {
                    newPc.getStats().then(stats => {
                      let connectionType = 'RELAY (TURN)'
                      stats.forEach(report => {
                        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                          const localCandidate = stats.get(report.localCandidateId)
                          const remoteCandidate = stats.get(report.remoteCandidateId)
                          if (localCandidate?.candidateType === 'relay' || remoteCandidate?.candidateType === 'relay') {
                            connectionType = 'RELAY (TURN)'
                          }
                        }
                      })
                      console.log('✅ ICE connection established successfully (relay-only)', {
                        connectionType,
                        stats: { ...iceCandidateStatsRef.current },
                        note: 'Using TURN relay - cross-network connection is working!',
                      })
                    }).catch(err => {
                      console.log('✅ ICE connection established successfully (relay-only)', {
                        connectionType: 'RELAY (TURN)',
                        stats: { ...iceCandidateStatsRef.current },
                      })
                    })
                  } else if (newState === 'failed') {
                    console.error('❌ ICE connection failed even with relay-only mode', {
                      stats: { ...iceCandidateStatsRef.current },
                      restartAttempts: iceRestartAttemptsRef.current,
                    })
                    const errorMsg = 'فشل الاتصال حتى مع استخدام TURN relay. قد تكون هناك مشكلة في الشبكة أو خادم TURN.'
                    toast.error(errorMsg)
                  }
                }
                
                peerConnectionRef.current = newPc
                remoteDescriptionSetRef.current = false
                pendingIceCandidatesRef.current = []
                iceCandidateStatsRef.current = { host: 0, srflx: 0, relay: 0 }
                
                // أعد إرسال offer/answer
                setTimeout(async () => {
                  try {
                    if (newPc.signalingState === 'stable' || newPc.signalingState === 'have-local-offer') {
                      const offer = await newPc.createOffer()
                      await newPc.setLocalDescription(offer)
                      console.log('✅ Created and sent new offer with relay-only policy')
                      if (currentSocket) {
                        currentSocket.emit('offer', { roomId: currentRoomId, offer })
                      }
                    }
                  } catch (error) {
                    console.error('Error creating offer with relay-only:', error)
                  }
                }, 1000)
                
                return // لا تتابع مع retry logic العادي
              }
            }
            
            // Wait a bit before retrying to allow network to stabilize
            const retryDelay = Math.min(1000 * (connectionRetryCountRef.current + 1), 5000)
            
            // Try to restart ICE gathering with retry limit
            if (connectionRetryCountRef.current < maxRetries) {
              connectionRetryCountRef.current++
              console.log(`Attempting ICE restart (${connectionRetryCountRef.current}/${maxRetries}) after ${retryDelay}ms delay...`)
              
              setTimeout(() => {
                try {
                  if (pc && pc.iceConnectionState === 'failed') {
                    pc.restartIce()
                    console.log('ICE restart initiated after delay')
                    // Reset stats for new gathering attempt
                    iceCandidateStatsRef.current = { host: 0, srflx: 0, relay: 0 }
                  }
                } catch (error) {
                  console.error('Error restarting ICE:', error)
                }
              }, retryDelay)
            } else {
              console.error(`Max retries (${maxRetries}) reached. Connection cannot be recovered.`, {
                hasRelay: iceCandidateStatsRef.current.relay > 0,
                finalStats: { ...iceCandidateStatsRef.current },
              })
              
              // If we have relay candidates but still failed, it might be a TURN server issue
              const errorMsg = iceCandidateStatsRef.current.relay === 0
                ? 'فشل الاتصال - لا توجد خوادم TURN متاحة. يرجى التحقق من الشبكة.'
                : 'فشل الاتصال بعد عدة محاولات. قد تكون هناك مشكلة في الشبكة أو خادم TURN.'
              toast.error(errorMsg)
            }
          } else if (state === 'disconnected') {
            console.warn('⚠️ ICE connection disconnected, may reconnect...', {
              stats: { ...iceCandidateStatsRef.current },
            })
          } else if (state === 'checking') {
            console.log('🔄 ICE connection checking...', {
              stats: { ...iceCandidateStatsRef.current },
              hasRelay: iceCandidateStatsRef.current.relay > 0,
              message: 'Attempting to establish connection - this may take a few seconds',
            })
          } else if (state === 'new') {
            console.log('🆕 ICE connection state: new', {
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

    newSocket.on('room-ready', async (data: { hasOtherUser: boolean }) => {
      console.log('Room ready event received:', data)
      socketRef.current = newSocket
      
      // If another user is already in the room, wait for their offer
      // If we're the first user, wait for user-joined event
      if (data.hasOtherUser) {
        console.log('Another user already in room, waiting for offer')
        // Start call without creating offer (will wait for offer from other user)
        if (!peerConnectionRef.current) {
          console.log('Starting call as second user, will wait for offer')
          await startCallHandler(false)
        }
      } else {
        console.log('First user in room, waiting for second user to join')
        // Will start when user-joined event is received
      }
    })

    newSocket.on('user-joined', async () => {
      console.log('User joined event received')
      socketRef.current = newSocket
      
      // Only start if peer connection doesn't exist yet
      // This means we're the first user and someone just joined
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
      // إيقاف العداد الزمني عند unmount
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
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
    
    // إيقاف العداد الزمني
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
    callStartTimeRef.current = null
    setCallDuration(0)
    
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
    iceRestartAttemptsRef.current = 0
    setHasRemoteStream(false)
    
    console.log('✅ Call cleanup completed')
    
    // Close UI modal (this is UI-only, doesn't affect call state)
    onClose()
  }
  
  // دالة لتنسيق الوقت (دقائق:ثواني)
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
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
      <div className="relative w-full h-full">
        {/* Remote video - full screen */}
        <div className="absolute inset-0 w-full h-full">
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
          <div className="absolute bottom-2 sm:bottom-4 left-2 sm:left-4 text-white bg-black/70 backdrop-blur-sm px-2 sm:px-3 py-1 rounded text-xs sm:text-sm border border-gold/30">
            الطرف الآخر{remoteUserName && user?.role === 'customer' ? ` - ${remoteUserName}` : ''}
          </div>
          {!hasRemoteStream && (
            <div className="absolute inset-0 flex items-center justify-center text-white bg-black/50">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold mx-auto mb-4"></div>
                <p className="text-sm sm:text-base">في انتظار الطرف الآخر...</p>
              </div>
            </div>
          )}
        </div>

        {/* Local video - small in top right corner - portrait */}
        <div className="absolute top-4 right-4 w-[75px] sm:w-[100px] md:w-[125px] h-[125px] sm:h-[175px] md:h-[225px] bg-gray-900 rounded-lg overflow-hidden border-2 border-gold/40 shadow-2xl z-20">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
          <div className="absolute bottom-2 left-2 text-white bg-black/70 backdrop-blur-sm px-2 py-1 rounded text-xs border border-gold/30">
            أنت
          </div>
        </div>

        {/* Close button - top right, below video */}
        <button
          onClick={handleEndCall}
          className="absolute top-4 left-[10px] text-white hover:text-gray-300 z-30 bg-black/50 backdrop-blur-sm p-2 rounded-full hover:bg-black/70 transition-all"
        >
          <X size={24} />
        </button>

        {/* Call duration timer - bottom left */}
        {callDuration > 0 && (
          <div className="absolute bottom-4 right-4 text-white bg-black/70 backdrop-blur-sm px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base border border-gold/30 z-30 font-mono">
            {formatDuration(callDuration)}
          </div>
        )}

        {/* Control buttons - bottom center */}
        <div className="absolute bottom-4 sm:bottom-8 left-1/2 transform -translate-x-1/2 flex gap-3 sm:gap-4 flex-wrap justify-center z-30">
          <button
            onClick={toggleVideo}
            className={`p-3 sm:p-4 rounded-full transition-all ${
              isVideoEnabled
                ? 'bg-gray-700 text-white hover:bg-gray-600'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            {isVideoEnabled ? <Video size={20} className="sm:w-6 sm:h-6" /> : <VideoOff size={20} className="sm:w-6 sm:h-6" />}
          </button>
          <button
            onClick={toggleAudio}
            className={`p-3 sm:p-4 rounded-full transition-all ${
              isAudioEnabled
                ? 'bg-gray-700 text-white hover:bg-gray-600'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            {isAudioEnabled ? <Mic size={20} className="sm:w-6 sm:h-6" /> : <MicOff size={20} className="sm:w-6 sm:h-6" />}
          </button>
          <button
            onClick={handleEndCall}
            className="p-3 sm:p-4 rounded-full bg-red-600 text-white hover:bg-red-700 transition-all"
          >
            <PhoneOff size={20} className="sm:w-6 sm:h-6" />
          </button>
        </div>
      </div>
    </div>
  )
}

