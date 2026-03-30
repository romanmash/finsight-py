import { createAuthorizationError } from '../shared/errors.js';

export interface ApprovalContext {
  approvedByUserId?: string;
}

export function assertApprovalForNonMock(isMockMode: boolean, approval?: ApprovalContext): void {
  if (isMockMode) {
    return;
  }

  if (!approval?.approvedByUserId) {
    throw createAuthorizationError('Non-mock trade execution requires explicit human approval context');
  }
}
