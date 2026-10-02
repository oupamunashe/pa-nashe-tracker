/* The signed-in session as the UI needs it. Empty in demo mode (no login). */
export const session = {
  email: '',
  /** writes still waiting in the outbox on this device */
  pending: (): number => 0,
  signOut: async (): Promise<void> => {},
  active: false,
};
