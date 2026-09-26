import crypto from 'crypto';
import config from '../config/env.js';

/**
 * WebRTC ICE & TURN Credential Service
 * 
 * ARCHITECTURAL RESPONSIBILITY DISTINCTION:
 * 1. STUN/TURN (Network Layer / Connectivity & Path Selection):
 *    - STUN discovers public reflexive IP/port mappings so direct peer-to-peer (P2P) UDP connections can form.
 *    - TURN acts purely as a relay fallback when symmetric NATs, carrier-grade NATs (CGNAT), or strict corporate firewalls
 *      block all direct P2P candidate pairs.
 *    - TURN relays packets between peers; it DOES NOT compress video, transcode streams, or solve low bandwidth.
 *      In fact, routing through a TURN relay introduces an extra network hop and adds server transit overhead.
 * 2. ClinicalQoSController (Application Layer / Media Adaptation):
 *    - Responsible for dynamic bitrate adaptation, resolution scaling, frame rate reduction, and clinical audio prioritization.
 *    - When rural network conditions degrade, ClinicalQoSController steps down video streams and prioritizes essential diagnostic audio.
 *
 * CREDENTIAL SECURITY (RFC 5766 / TURN REST API):
 * - Permanent TURN admin credentials or secrets are NEVER sent to the client.
 * - Authenticated, short-lived ephemeral credentials with an expiration timestamp and HMAC-SHA1 signature are generated on demand.
 * - Direct P2P candidates (host and srflx) are preserved by setting iceTransportPolicy to 'all'.
 */

/**
 * Generate production-safe WebRTC ICE Configuration
 * @param {string} userId - Authenticated user identifier or session id
 * @returns {object} WebRTC RTCConfiguration object
 */
export const getIceConfiguration = (userId = 'guest') => {
  // Configured STUN servers for direct P2P discovery
  const stunUrls = (config.stunServers || 'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const iceServers = [
    {
      urls: stunUrls,
    },
  ];

  // If TURN server URLs are configured
  if (config.turnServerUrls) {
    const turnUrls = config.turnServerUrls
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    // If TURN Secret is provided, generate short-lived ephemeral credentials (RFC 5766)
    if (config.turnSecret) {
      const ttl = config.turnTtlSeconds || 86400; // Default 24 hours
      const expiryTimestamp = Math.floor(Date.now() / 1000) + ttl;
      const ephemeralUsername = `${expiryTimestamp}:${userId}`;
      const hmac = crypto.createHmac('sha1', config.turnSecret);
      hmac.update(ephemeralUsername);
      const ephemeralCredential = hmac.digest('base64');

      iceServers.push({
        urls: turnUrls,
        username: ephemeralUsername,
        credential: ephemeralCredential,
      });
    } else if (config.turnUsername && config.turnCredential) {
      // Static credentials proxied from backend config (never exposed in client bundle source)
      iceServers.push({
        urls: turnUrls,
        username: config.turnUsername,
        credential: config.turnCredential,
      });
    }
  }

  return {
    iceServers,
    // Direct P2P connections are prioritized; TURN is only used as relay fallback
    iceTransportPolicy: 'all',
    iceCandidatePoolSize: 2,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
  };
};

export default { getIceConfiguration };
