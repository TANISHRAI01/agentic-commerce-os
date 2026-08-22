// ============================================================
// Tests — Transaction State Machine
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  transition,
  isValidTransition,
  isTerminalState,
  getValidNextStates,
  StateMachineError,
} from '@/engine/state-machine';
import type { TransactionState } from '@/types/schemas';

describe('State Machine', () => {
  describe('Valid Transitions', () => {
    const validPaths: Array<[TransactionState, TransactionState]> = [
      ['CREATED', 'DISCOVERY'],
      ['DISCOVERY', 'DECISION'],
      ['DECISION', 'CART_READY'],
      ['CART_READY', 'POLICY_PENDING'],
      ['POLICY_PENDING', 'POLICY_FAIL'],
      ['POLICY_PENDING', 'APPROVAL_REQUIRED'],
      ['POLICY_PENDING', 'AUTO_APPROVED'],
      ['POLICY_FAIL', 'BLOCKED'],
      ['APPROVAL_REQUIRED', 'APPROVED'],
      ['APPROVAL_REQUIRED', 'CANCELLED'],
      ['APPROVED', 'PAYMENT_PENDING'],
      ['AUTO_APPROVED', 'PAYMENT_PENDING'],
      ['PAYMENT_PENDING', 'PAYMENT_SUCCESS'],
      ['PAYMENT_PENDING', 'PAYMENT_FAILED'],
      ['PAYMENT_PENDING', 'PAYMENT_UNKNOWN'],
      ['PAYMENT_SUCCESS', 'VERIFIED'],
      ['PAYMENT_UNKNOWN', 'PAYMENT_SUCCESS'],
      ['PAYMENT_UNKNOWN', 'PAYMENT_FAILED'],
      ['VERIFIED', 'COMPLETED'],
    ];

    for (const [from, to] of validPaths) {
      it(`should allow ${from} → ${to}`, () => {
        expect(isValidTransition(from, to)).toBe(true);
        expect(transition(from, to)).toBe(to);
      });
    }
  });

  describe('Invalid Transitions', () => {
    const invalidPaths: Array<[TransactionState, TransactionState]> = [
      ['CREATED', 'COMPLETED'],
      ['CREATED', 'PAYMENT_PENDING'],
      ['DISCOVERY', 'PAYMENT_SUCCESS'],
      ['POLICY_PENDING', 'PAYMENT_PENDING'],
      ['COMPLETED', 'CREATED'],
      ['BLOCKED', 'CREATED'],
      ['CANCELLED', 'CREATED'],
      ['PAYMENT_SUCCESS', 'PAYMENT_FAILED'],
      ['APPROVED', 'DISCOVERY'],
      ['VERIFIED', 'PAYMENT_PENDING'],
    ];

    for (const [from, to] of invalidPaths) {
      it(`should reject ${from} → ${to}`, () => {
        expect(isValidTransition(from, to)).toBe(false);
        expect(() => transition(from, to)).toThrow(StateMachineError);
      });
    }
  });

  describe('Terminal States', () => {
    it('should identify COMPLETED as terminal', () => {
      expect(isTerminalState('COMPLETED')).toBe(true);
    });

    it('should identify CANCELLED as terminal', () => {
      expect(isTerminalState('CANCELLED')).toBe(true);
    });

    it('should identify BLOCKED as terminal', () => {
      expect(isTerminalState('BLOCKED')).toBe(true);
    });

    it('should NOT identify CREATED as terminal', () => {
      expect(isTerminalState('CREATED')).toBe(false);
    });

    it('should NOT identify PAYMENT_PENDING as terminal', () => {
      expect(isTerminalState('PAYMENT_PENDING')).toBe(false);
    });

    it('terminal states should have no valid next states', () => {
      expect(getValidNextStates('COMPLETED')).toEqual([]);
      expect(getValidNextStates('CANCELLED')).toEqual([]);
      expect(getValidNextStates('BLOCKED')).toEqual([]);
    });
  });

  describe('Happy Path — Full Transaction', () => {
    it('should complete a full happy path', () => {
      let state: TransactionState = 'CREATED';
      state = transition(state, 'DISCOVERY');
      state = transition(state, 'DECISION');
      state = transition(state, 'CART_READY');
      state = transition(state, 'POLICY_PENDING');
      state = transition(state, 'AUTO_APPROVED');
      state = transition(state, 'PAYMENT_PENDING');
      state = transition(state, 'PAYMENT_SUCCESS');
      state = transition(state, 'VERIFIED');
      state = transition(state, 'COMPLETED');
      expect(state).toBe('COMPLETED');
    });

    it('should complete with manual approval', () => {
      let state: TransactionState = 'CREATED';
      state = transition(state, 'DISCOVERY');
      state = transition(state, 'DECISION');
      state = transition(state, 'CART_READY');
      state = transition(state, 'POLICY_PENDING');
      state = transition(state, 'APPROVAL_REQUIRED');
      state = transition(state, 'APPROVED');
      state = transition(state, 'PAYMENT_PENDING');
      state = transition(state, 'PAYMENT_SUCCESS');
      state = transition(state, 'VERIFIED');
      state = transition(state, 'COMPLETED');
      expect(state).toBe('COMPLETED');
    });

    it('should handle payment timeout recovery', () => {
      let state: TransactionState = 'CREATED';
      state = transition(state, 'DISCOVERY');
      state = transition(state, 'DECISION');
      state = transition(state, 'CART_READY');
      state = transition(state, 'POLICY_PENDING');
      state = transition(state, 'AUTO_APPROVED');
      state = transition(state, 'PAYMENT_PENDING');
      state = transition(state, 'PAYMENT_UNKNOWN');
      // After polling, payment confirmed
      state = transition(state, 'PAYMENT_SUCCESS');
      state = transition(state, 'VERIFIED');
      state = transition(state, 'COMPLETED');
      expect(state).toBe('COMPLETED');
    });
  });

  describe('Cancellation Paths', () => {
    it('should allow cancellation from CREATED', () => {
      expect(transition('CREATED', 'CANCELLED')).toBe('CANCELLED');
    });

    it('should allow cancellation from DISCOVERY', () => {
      expect(transition('DISCOVERY', 'CANCELLED')).toBe('CANCELLED');
    });

    it('should allow cancellation from APPROVED', () => {
      expect(transition('APPROVED', 'CANCELLED')).toBe('CANCELLED');
    });

    it('should NOT allow cancellation from COMPLETED', () => {
      expect(() => transition('COMPLETED', 'CANCELLED')).toThrow(StateMachineError);
    });
  });

  describe('Error Messages', () => {
    it('should include state names in error message', () => {
      try {
        transition('CREATED', 'COMPLETED');
        expect.fail('Should have thrown');
      } catch (e) {
        const error = e as StateMachineError;
        expect(error.message).toContain('CREATED');
        expect(error.message).toContain('COMPLETED');
        expect(error.name).toBe('StateMachineError');
      }
    });
  });
});
