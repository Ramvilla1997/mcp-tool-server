/** Raised for bad tool input. The message is safe to show to the model and the user. */
export class ToolInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolInputError';
  }
}
