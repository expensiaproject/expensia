import { base44 } from '@/api/base44Client';

export const logAuditEvent = async (user, entity, entityId, action, diff = null, meta = null) => {
  try {
    await base44.entities.AuditLog.create({
      actorId: user?.id || 'system',
      actorEmail: user?.email || 'system',
      entity,
      entityId,
      action,
      diff,
      meta
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
};

export default logAuditEvent;