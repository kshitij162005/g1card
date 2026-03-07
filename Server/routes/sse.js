import express from 'express';

const router = express.Router();

// Store active SSE connections
const connections = new Map(); // Map<userId, Set<Response>>

// SSE endpoint for real-time updates
router.get('/stream/:userId/:userType', (req, res) => {
  const { userId, userType } = req.params;
  
  if (!userId || !userType) {
    return res.status(400).json({ error: 'Missing userId or userType' });
  }

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for nginx

  // Create connection key
  const connectionKey = `${userType}:${userId}`;
  
  // Store connection
  if (!connections.has(connectionKey)) {
    connections.set(connectionKey, new Set());
  }
  connections.get(connectionKey).add(res);

  console.log(`SSE connection established for ${connectionKey}. Total: ${connections.get(connectionKey).size}`);

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

  // Keep connection alive with periodic heartbeat
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 30000); // Every 30 seconds

  // Clean up on close
  req.on('close', () => {
    clearInterval(heartbeat);
    const connSet = connections.get(connectionKey);
    if (connSet) {
      connSet.delete(res);
      if (connSet.size === 0) {
        connections.delete(connectionKey);
      }
    }
    console.log(`SSE connection closed for ${connectionKey}`);
  });
});

// Helper function to send event to specific user
export function sendEventToUser(userType, userId, eventData) {
  const connectionKey = `${userType}:${userId}`;
  const connSet = connections.get(connectionKey);
  
  if (!connSet || connSet.size === 0) {
    console.log(`No active SSE connections for ${connectionKey}`);
    return false;
  }

  const message = `data: ${JSON.stringify(eventData)}\n\n`;
  let sent = 0;
  
  connSet.forEach((res) => {
    try {
      res.write(message);
      sent++;
    } catch (err) {
      console.error(`Error sending SSE to ${connectionKey}:`, err);
      connSet.delete(res);
    }
  });

  console.log(`Sent SSE event to ${sent} connections for ${connectionKey}`);
  return sent > 0;
}

// Helper function to broadcast to all connections of a type
export function broadcastToUserType(userType, eventData) {
  let sent = 0;
  const message = `data: ${JSON.stringify(eventData)}\n\n`;
  
  connections.forEach((connSet, connectionKey) => {
    if (connectionKey.startsWith(`${userType}:`)) {
      connSet.forEach((res) => {
        try {
          res.write(message);
          sent++;
        } catch (err) {
          console.error(`Error broadcasting SSE:`, err);
          connSet.delete(res);
        }
      });
    }
  });

  console.log(`Broadcasted SSE event to ${sent} ${userType} connections`);
  return sent > 0;
}

export default router;
