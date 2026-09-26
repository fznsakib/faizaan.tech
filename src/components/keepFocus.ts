/** Mouse clicks shouldn't leave focus on a control (Space would then re-press it instead of play/pause). */
export const keepFocus = (event: { preventDefault(): void }) => event.preventDefault();
