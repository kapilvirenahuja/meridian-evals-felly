'use client';

import { useState } from 'react';
import { AxiosError } from 'axios';
import { apiClient } from '../../lib/api-client';

interface VerificationActionsProps {
  mentorProfileId: string;
  currentStatus: string;
  onActionComplete: () => void;
}

export function VerificationActions({
  mentorProfileId,
  currentStatus,
  onActionComplete,
}: VerificationActionsProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isResubmitting, setIsResubmitting] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    setIsApproving(true);
    setError(null);
    try {
      await apiClient.post(`/admin/mentors/${mentorProfileId}/approve`);
      onActionComplete();
    } catch (err) {
      const message =
        err instanceof AxiosError
          ? (err.response?.data as { message?: string })?.message || 'Approval failed'
          : 'An unexpected error occurred';
      setError(message);
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setError('Rejection reason is required');
      return;
    }
    setIsRejecting(true);
    setError(null);
    try {
      await apiClient.post(`/admin/mentors/${mentorProfileId}/reject`, {
        reason: rejectionReason,
      });
      setShowRejectForm(false);
      setRejectionReason('');
      onActionComplete();
    } catch (err) {
      const message =
        err instanceof AxiosError
          ? (err.response?.data as { message?: string })?.message || 'Rejection failed'
          : 'An unexpected error occurred';
      setError(message);
    } finally {
      setIsRejecting(false);
    }
  };

  const handleResubmit = async () => {
    setIsResubmitting(true);
    setError(null);
    try {
      await apiClient.post(`/admin/mentors/${mentorProfileId}/resubmit`);
      onActionComplete();
    } catch (err) {
      const message =
        err instanceof AxiosError
          ? (err.response?.data as { message?: string })?.message || 'Resubmit failed'
          : 'An unexpected error occurred';
      setError(message);
    } finally {
      setIsResubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {currentStatus === 'PENDING_VERIFICATION' && (
        <div className="flex gap-3">
          <button
            onClick={handleApprove}
            disabled={isApproving}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isApproving ? 'Approving...' : 'Approve'}
          </button>

          <button
            onClick={() => setShowRejectForm(!showRejectForm)}
            disabled={isRejecting}
            className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      )}

      {currentStatus === 'REJECTED' && (
        <button
          onClick={handleResubmit}
          disabled={isResubmitting}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isResubmitting ? 'Resubmitting...' : 'Resubmit for Review'}
        </button>
      )}

      {currentStatus === 'VERIFIED' && (
        <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
          ✓ Verified
        </span>
      )}

      {showRejectForm && (
        <div className="rounded-md border border-border bg-card p-4 space-y-3">
          <label htmlFor="rejection-reason" className="block text-sm font-medium text-foreground">
            Rejection Reason <span className="text-destructive">*</span>
          </label>
          <textarea
            id="rejection-reason"
            rows={3}
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Explain why this profile is being rejected..."
          />
          <div className="flex gap-2">
            <button
              onClick={handleReject}
              disabled={isRejecting || !rejectionReason.trim()}
              className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-white hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRejecting ? 'Rejecting...' : 'Confirm Reject'}
            </button>
            <button
              onClick={() => {
                setShowRejectForm(false);
                setRejectionReason('');
                setError(null);
              }}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
