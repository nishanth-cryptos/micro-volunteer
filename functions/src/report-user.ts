import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { checkActiveStatus } from './moderation-helper';

if (getApps().length === 0) {
  initializeApp();
}

const REGION = 'asia-south1';

export const reportUser = onCall(
  { region: REGION },
  async (request): Promise<{ reportId: string }> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const data = (request.data ?? {}) as {
      reportedUserId?: unknown;
      taskId?: unknown;
      reason?: unknown;
      details?: unknown;
    };

    const reportedUserId = data.reportedUserId;
    const taskId = data.taskId;
    const reason = data.reason;
    const details = data.details ?? '';

    if (typeof reportedUserId !== 'string' || reportedUserId.length === 0) {
      throw new HttpsError('invalid-argument', 'reportedUserId is required.');
    }
    if (typeof taskId !== 'string' || taskId.length === 0) {
      throw new HttpsError('invalid-argument', 'taskId is required.');
    }
    if (typeof reason !== 'string' || reason.length === 0) {
      throw new HttpsError('invalid-argument', 'reason is required.');
    }
    if (typeof details !== 'string' || details.length > 500) {
      throw new HttpsError(
        'invalid-argument',
        'details must be a string up to 500 characters.',
      );
    }

    const reporterId = request.auth.uid;
    if (reporterId === reportedUserId) {
      throw new HttpsError('invalid-argument', 'You cannot report yourself.');
    }

    const db = getFirestore();
    await checkActiveStatus(db, reporterId);

    // Validate reporter has a completed or in-progress task with the reported user
    const taskSnap = await db.collection('tasks').doc(taskId).get();
    if (!taskSnap.exists) {
      throw new HttpsError('not-found', 'Task not found.');
    }
    const task = taskSnap.data() as {
      customerId?: string;
      acceptedVolunteerId?: string;
      status?: string;
    };

    const isCustomerReporter =
      task.customerId === reporterId && task.acceptedVolunteerId === reportedUserId;
    const isVolunteerReporter =
      task.acceptedVolunteerId === reporterId && task.customerId === reportedUserId;

    if (!isCustomerReporter && !isVolunteerReporter) {
      throw new HttpsError(
        'permission-denied',
        'You must have a shared task with this user to report them.',
      );
    }

    // Check task status (must be accepted, in_progress, or completed)
    const allowedStatuses = ['accepted', 'in_progress', 'completed'];
    if (!task.status || !allowedStatuses.includes(task.status)) {
      throw new HttpsError(
        'failed-precondition',
        'Reports are only allowed for tasks that are accepted, in progress, or completed.',
      );
    }

    // Create report document
    const reportRef = db.collection('reports').doc();
    const reportId = reportRef.id;

    await db.runTransaction(async (tx) => {
      // Create report
      tx.set(reportRef, {
        reporterUid: reporterId,
        reportedUid: reportedUserId,
        taskId,
        reason,
        details,
        status: 'pending',
        createdAt: FieldValue.serverTimestamp(),
      });

      // Increment pendingReports on the reported user doc
      const userRef = db.collection('users').doc(reportedUserId);
      tx.update(userRef, {
        pendingReports: FieldValue.increment(1),
        openReportsCount: FieldValue.increment(1), // for compatibility with scoring.ts
      });
    });

    return { reportId };
  },
);
