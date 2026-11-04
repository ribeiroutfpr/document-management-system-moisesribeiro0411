const { maxUploadsPerHour } = require('../config');
const DocumentError = require('../errors');

const windowMs = 60 * 60 * 1000;
const cleanupIntervalMs = 60 * 1000;
const uploadTimes = new Map();
const maxTrackedUsers = 10000;
let lastCleanup = 0;

function cleanExpiredEntries(now) {
  if (now - lastCleanup < cleanupIntervalMs) return;
  for (const [owner, times] of uploadTimes) {
    const recent = times.filter((time) => now - time < windowMs);
    if (recent.length) uploadTimes.set(owner, recent);
    else uploadTimes.delete(owner);
  }
  lastCleanup = now;
}

function limitUploads(req, res, next) {
  const owner = req.user.id;
  const now = Date.now();
  cleanExpiredEntries(now);
  const recentUploads = (uploadTimes.get(owner) || []).filter((time) => now - time < windowMs);

  if (recentUploads.length >= maxUploadsPerHour || (!uploadTimes.has(owner)
    && uploadTimes.size >= maxTrackedUsers)) {
    return next(new DocumentError('UPLOAD_RATE_LIMITED', 'Limite de envios atingido. Tente novamente mais tarde.'));
  }

  recentUploads.push(now);
  uploadTimes.set(owner, recentUploads);
  next();
}

module.exports = limitUploads;
