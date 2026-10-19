// Shared notification inbox handlers, used by the admin portal and the "mark all read" actions
// of every portal. Patient and hospital listing routes keep their own handlers.
import mongoose from 'mongoose';

const escapeRegex = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function models() {
  const Notification = (await import('../models/Notification.js')).default;
  // Register every possible sender model so refPath population works
  await Promise.all([
    import('../models/Patient.js'),
    import('../models/Hospital.js'),
    import('../models/Superadmin.js'),
  ]);
  return { Notification };
}

export async function listNotifications(req, res, recipientModel) {
  try {
    const { Notification } = await models();
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid id' });

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const filter = req.query.filter === 'unread' ? 'unread' : 'all';
    const search = String(req.query.search || '').trim();

    const base = { recipient: id, recipientModel };
    if (search) {
      const rx = { $regex: escapeRegex(search), $options: 'i' };
      base.$or = [{ title: rx }, { message: rx }];
    }
    const query = filter === 'unread' ? { ...base, isRead: false } : base;

    const [notifications, total, totalCount, unreadCount] = await Promise.all([
      Notification.find(query)
        .populate('sender', 'firstName lastName name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Notification.countDocuments(query),
      Notification.countDocuments(base),
      Notification.countDocuments({ ...base, isRead: false }),
    ]);

    return res.json({
      ok: true,
      notifications: notifications.map((n) => ({
        id: n._id.toString(),
        type: n.type,
        title: n.title,
        message: n.message,
        metadata: n.metadata,
        isRead: n.isRead,
        readAt: n.readAt,
        actionUrl: n.actionUrl,
        relatedAccess: n.relatedAccess,
        sender: n.sender,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      })),
      pagination: { total, pages: Math.ceil(total / limit), page, limit },
      totalCount,
      unreadCount,
    });
  } catch (err) {
    console.error(`fetch ${recipientModel} notifications error:`, err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}

export async function countUnread(req, res, recipientModel) {
  try {
    const { Notification } = await models();
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const unreadCount = await Notification.countDocuments({ recipient: req.params.id, recipientModel, isRead: false });
    return res.json({ ok: true, unreadCount });
  } catch (err) {
    return res.status(500).json({ error: err.message || String(err) });
  }
}

export async function markRead(req, res, recipientModel) {
  try {
    const { Notification } = await models();
    const { id, notificationId } = req.params;
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(notificationId)) return res.status(400).json({ error: 'Invalid id' });
    const updated = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: id, recipientModel },
      { isRead: true, readAt: new Date() },
      { new: true },
    ).lean();
    if (!updated) return res.status(404).json({ error: 'Notification not found' });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || String(err) });
  }
}

export async function markAllRead(req, res, recipientModel) {
  try {
    const { Notification } = await models();
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid id' });
    const result = await Notification.updateMany(
      { recipient: id, recipientModel, isRead: false },
      { isRead: true, readAt: new Date() },
    );
    return res.json({ ok: true, updated: result.modifiedCount ?? 0 });
  } catch (err) {
    return res.status(500).json({ error: err.message || String(err) });
  }
}
