/** A valid upload whose content cannot be converted without user action. */
export class UnsupportedConversionInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedConversionInputError";
  }
}
