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
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const roomIdRef = useRef<string>(call.roomId)
  const socketRef = useRef<Socket | null>(null)
  const pendingIceCandidatesRef = useRef<RTCIceCandidate[]>([])
  const remoteDescriptionSetRef = useRef<boolean>(false)
  const connectionRetryCountRef = useRef<number>(0)
  const maxRetries = 2

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

    const wsUrl = NEXT_PUBLIC_API_URL
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
            { urls: 'stun:stun2.l.google.com:19302' },
          ],
          iceCandidatePoolSize: 10,
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

        // Track remote streams
        const remoteStreams = new Map<string, MediaStream>()
        
        pc.ontrack = (event) => {
          console.log('Received remote stream - ontrack event:', {
            streams: event.streams.length,
            track: event.track.kind,
            id: event.track.id,
            enabled: event.track.enabled,
            readyState: event.track.readyState
          })
          
          // Get or create stream for this track
          let remoteStream: MediaStream
          if (event.streams && event.streams.length > 0) {
            remoteStream = event.streams[0]
          } else if (event.track) {
            // Create a new stream from the track
            console.log('Creating stream from track')
            remoteStream = new MediaStream([event.track])
          } else {
            console.error('No stream or track in ontrack event')
            return
          }
          
          // Store stream by ID
          remoteStreams.set(remoteStream.id, remoteStream)
          
          console.log('Setting remote video stream:', {
            id: remoteStream.id,
            tracks: remoteStream.getTracks().length,
            totalRemoteTracks: pc.getReceivers().length
          })
          
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream
            // Force play
            remoteVideoRef.current.play().catch(err => {
              console.error('Error playing remote video:', err)
            })
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
          if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
            console.log('ICE connection established successfully')
          } else if (pc.iceConnectionState === 'failed') {
            console.error('ICE connection failed, attempting to restart ICE')
            // Try to restart ICE gathering
            try {
              pc.restartIce()
              console.log('ICE restart initiated')
            } catch (error) {
              console.error('Error restarting ICE:', error)
            }
          } else if (pc.iceConnectionState === 'disconnected') {
            console.warn('ICE connection disconnected, may reconnect...')
          }
        }
        
        pc.onconnectionstatechange = () => {
          console.log('Peer connection state:', pc.connectionState)
          console.log('ICE connection state:', pc.iceConnectionState)
          console.log('Signaling state:', pc.signalingState)
          
          if (pc.connectionState === 'failed') {
            console.error('Peer connection failed')
            console.error('Current states:', {
              iceConnectionState: pc.iceConnectionState,
              signalingState: pc.signalingState,
              connectionState: pc.connectionState,
              localTracks: pc.getSenders().length,
              remoteTracks: pc.getReceivers().length
            })
            
            // If ICE is connected but peer connection failed, there's a media negotiation issue
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
              
              // Try to restart ICE to renegotiate
              if (connectionRetryCountRef.current < maxRetries) {
                connectionRetryCountRef.current++
                console.log(`Attempting to restart ICE (retry ${connectionRetryCountRef.current}/${maxRetries})...`)
                try {
                  pc.restartIce()
                } catch (error) {
                  console.error('Error restarting ICE on connection failure:', error)
                }
              } else {
                console.error('Max retries reached. Connection cannot be recovered.')
                toast.error('فشل الاتصال. يرجى إعادة المحاولة.')
              }
            } else if (pc.iceConnectionState !== 'failed') {
              // ICE is not failed yet, try to restart
              if (connectionRetryCountRef.current < maxRetries) {
                connectionRetryCountRef.current++
                console.log(`Attempting to restart ICE (retry ${connectionRetryCountRef.current}/${maxRetries})...`)
                try {
                  pc.restartIce()
                } catch (error) {
                  console.error('Error restarting ICE on connection failure:', error)
                }
              }
            } else {
              console.error('ICE also failed, cannot recover. Need to recreate connection.')
            }
          } else if (pc.connectionState === 'connected') {
            console.log('Peer connection established successfully')
            console.log('Connection details:', {
              localTracks: pc.getSenders().length,
              remoteTracks: pc.getReceivers().length,
              iceConnectionState: pc.iceConnectionState,
              signalingState: pc.signalingState
            })
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

        // Only create offer if we should (first user or after receiving offer)
        if (shouldCreateOffer) {
          console.log('Creating offer...')
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
          })
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
      console.log('Emitted join-room:', { roomId, userId })
      
      // Fallback: Start call after a delay if user-joined doesn't fire
      // This handles the case where we're the first user or the other user is already connected
      setTimeout(async () => {
        if (!localStreamRef.current && !isCallStarted && newSocket.connected) {
          console.log('Fallback: Starting call after timeout (no user-joined event)')
          const room = newSocket.io.engine.transport.name
          console.log('Transport:', room)
          // Check if we should start - if we're connected and haven't started, start now
          await startCallHandler(true)
        }
      }, 2000)
    })

    newSocket.on('user-joined', async (data) => {
      console.log('User joined event received:', data)
      // Make sure socket ref is set
      socketRef.current = newSocket
      
      // Wait a bit to avoid race condition when both users join at the same time
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Check if we already have a peer connection (meaning we already started)
      const hasPeerConnection = peerConnectionRef.current !== null
      const hasLocalStream = localStreamRef.current !== null
      
      console.log('Call state check:', { 
        hasPeerConnection, 
        hasLocalStream, 
        isCallStarted,
        shouldStart: !hasLocalStream && !isCallStarted
      })
      
      // Only start if not already started
      if (!hasLocalStream && !isCallStarted) {
        // First user to start creates the offer
        // We'll determine this by checking if we're the first in the room
        // For now, always create offer when we start first
        console.log('Starting call as first user, will create offer')
        await startCallHandler(true)
      } else if (hasPeerConnection && !hasLocalStream) {
        // We have peer connection but no stream - something went wrong, restart
        console.log('Peer connection exists but no stream, restarting...')
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close()
          peerConnectionRef.current = null
        }
        isCallStarted = false
        await startCallHandler(true)
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
      if (!localStreamRef.current && !isCallStarted) {
        console.log('Starting call after receiving offer')
        await startCallHandler(false) // Don't create offer, we received one
      }
      
      // Wait a bit to ensure peer connection is ready
      await new Promise(resolve => setTimeout(resolve, 200))
      
      if (peerConnectionRef.current) {
        try {
          console.log('Setting remote description from offer')
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(offer)
          )
          remoteDescriptionSetRef.current = true
          console.log('Remote description set, processing pending ICE candidates')
          
          // Process any pending ICE candidates
          while (pendingIceCandidatesRef.current.length > 0) {
            const candidate = pendingIceCandidatesRef.current.shift()
            if (candidate) {
              try {
                await peerConnectionRef.current.addIceCandidate(candidate)
                console.log('Processed pending ICE candidate')
              } catch (error) {
                console.error('Error adding pending ICE candidate:', error)
              }
            }
          }
          
          console.log('Creating answer...')
          const answer = await peerConnectionRef.current.createAnswer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
          })
          await peerConnectionRef.current.setLocalDescription(answer)
          console.log('Answer created and local description set:', {
            type: answer.type,
            sdpLength: answer.sdp?.length || 0,
            signalingState: peerConnectionRef.current.signalingState
          })
          newSocket.emit('answer', { roomId, answer })
          console.log('Answer sent successfully')
        } catch (error) {
          console.error('Error handling offer:', error)
        }
      } else {
        console.warn('Received offer but no peer connection yet')
      }
    })

    newSocket.on('answer', async (answer) => {
      console.log('Received answer:', answer)
      
      // Validate answer
      if (!answer || !answer.sdp || !answer.type) {
        console.error('Invalid answer received:', answer)
        return
      }
      
      if (peerConnectionRef.current) {
        try {
          const currentState = peerConnectionRef.current.signalingState
          console.log('Current signaling state before setting answer:', currentState)
          
          if (currentState === 'have-local-offer' || currentState === 'stable') {
            await peerConnectionRef.current.setRemoteDescription(
              new RTCSessionDescription(answer)
            )
            remoteDescriptionSetRef.current = true
            console.log('Remote description set from answer successfully')
            
            // Process any pending ICE candidates
            while (pendingIceCandidatesRef.current.length > 0) {
              const candidate = pendingIceCandidatesRef.current.shift()
              if (candidate) {
                try {
                  await peerConnectionRef.current.addIceCandidate(candidate)
                  console.log('Processed pending ICE candidate')
                } catch (error) {
                  console.error('Error adding pending ICE candidate:', error)
                }
              }
            }
          } else {
            console.warn('Cannot set remote description, signaling state:', currentState)
          }
        } catch (error) {
          console.error('Error setting remote description from answer:', error)
        }
      } else {
        console.warn('Received answer but no peer connection')
      }
    })

    newSocket.on('ice-candidate', async (candidate) => {
      console.log('Received ICE candidate:', candidate)
      if (peerConnectionRef.current) {
        try {
          // Check if remote description is set
          if (!remoteDescriptionSetRef.current) {
            // Queue the candidate if remote description is not set yet
            if (candidate && candidate.candidate) {
              console.log('Queueing ICE candidate (remote description not set yet)')
              pendingIceCandidatesRef.current.push(new RTCIceCandidate(candidate))
            }
            return
          }
          
          if (candidate && candidate.candidate) {
            await peerConnectionRef.current.addIceCandidate(
              new RTCIceCandidate(candidate)
            )
            console.log('ICE candidate added successfully')
          } else {
            console.log('Received null ICE candidate (end of candidates)')
            await peerConnectionRef.current.addIceCandidate(null)
          }
        } catch (error) {
          console.error('Error adding ICE candidate:', error)
          // If error occurs, try to queue it anyway (might be timing issue)
          if (candidate && candidate.candidate && !remoteDescriptionSetRef.current) {
            pendingIceCandidatesRef.current.push(new RTCIceCandidate(candidate))
          }
        }
      } else {
        console.warn('Received ICE candidate but no peer connection')
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
      pendingIceCandidatesRef.current = []
      remoteDescriptionSetRef.current = false
      onClose()
    })

    setSocket(newSocket)

    return () => {
      newSocket.disconnect()
      // Only cleanup if component is actually unmounting
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop())
        localStreamRef.current = null
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close()
        peerConnectionRef.current = null
      }
      pendingIceCandidatesRef.current = []
      remoteDescriptionSetRef.current = false
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
    pendingIceCandidatesRef.current = []
    remoteDescriptionSetRef.current = false
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
            {!remoteVideoRef.current?.srcObject && (
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

